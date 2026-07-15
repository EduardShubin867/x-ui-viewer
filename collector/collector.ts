import { open, stat, type FileHandle } from "node:fs/promises";
import type { CollectorConfig } from "./config";
import { parseXrayAccessLine } from "./parser";
import { loadState, saveState, type CollectorState } from "./state";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (level: "info" | "warn" | "error" | "debug", message: string, fields: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ level, time: new Date().toISOString(), message, ...fields }));

export class XrayLogCollector {
  private state!: CollectorState;
  private handle: FileHandle | null = null;
  private stopping = false;
  private backoffMs = 1_000;
  private lastFlushAt = 0;

  constructor(private readonly config: CollectorConfig) {}

  async run(): Promise<void> {
    this.state = await loadState(this.config.COLLECTOR_STATE_PATH);
    if (this.state.queue.length > this.config.COLLECTOR_MAX_QUEUE_SIZE) {
      this.state.queue = this.state.queue.slice(-this.config.COLLECTOR_MAX_QUEUE_SIZE);
    }
    await this.persist();
    while (!this.stopping) {
      try { await this.readAvailable(); }
      catch (error) { log("warn", "access log unavailable", { error: error instanceof Error ? error.message : String(error) }); }
      await this.flushIfDue();
      await sleep(250);
    }
    await this.readAvailable().catch(() => undefined);
    await this.flush(true);
    await this.persist();
    await this.handle?.close();
  }

  stop(): void { this.stopping = true; }

  private async openCurrent(): Promise<void> {
    const fileStat = await stat(this.config.XRAY_ACCESS_LOG_PATH);
    if (this.handle && this.state.inode === fileStat.ino) {
      if (fileStat.size < this.state.offset) {
        log("info", "access log truncation detected");
        this.state.offset = 0;
        this.state.remainder = "";
      }
      return;
    }
    if (this.handle) {
      await this.consumeHandle(this.handle);
      await this.handle.close();
      log("info", "access log rotation detected", { previousInode: this.state.inode, nextInode: fileStat.ino });
      this.state.offset = 0;
      this.state.remainder = "";
    }
    this.handle = await open(this.config.XRAY_ACCESS_LOG_PATH, "r");
    this.state.inode = fileStat.ino;
    if (this.state.offset > fileStat.size) this.state.offset = 0;
  }

  private async readAvailable(): Promise<void> {
    await this.openCurrent();
    if (this.handle) await this.consumeHandle(this.handle);
  }

  private async consumeHandle(handle: FileHandle): Promise<void> {
    const buffer = Buffer.allocUnsafe(64 * 1024);
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, this.state.offset);
      if (!bytesRead) break;
      this.state.offset += bytesRead;
      const text = this.state.remainder + buffer.subarray(0, bytesRead).toString("utf8");
      const lines = text.split(/\r?\n/);
      this.state.remainder = lines.pop() ?? "";
      for (const line of lines) this.enqueueLine(line);
      await this.persist();
      if (bytesRead < buffer.length) break;
    }
  }

  private enqueueLine(line: string): void {
    if (!line) return;
    const parsed = parseXrayAccessLine(line, this.config.NODE_ID);
    if (!parsed.recognized) log("debug", "unrecognized Xray access line", { line: line.slice(0, 500) });
    if (!parsed.event) return;
    if (this.state.queue.some((event) => event.eventId === parsed.event!.eventId)) return;
    if (this.state.queue.length >= this.config.COLLECTOR_MAX_QUEUE_SIZE) {
      const dropped = this.state.queue.shift();
      log("error", "collector queue overflow; oldest event dropped", { droppedEventId: dropped?.eventId });
    }
    this.state.queue.push(parsed.event);
  }

  private async flushIfDue(): Promise<void> {
    if (Date.now() - this.lastFlushAt >= this.config.COLLECTOR_FLUSH_INTERVAL_MS || this.state.queue.length >= this.config.COLLECTOR_BATCH_SIZE) {
      await this.flush(false);
    }
  }

  private async flush(force: boolean): Promise<void> {
    if (!this.state.queue.length) return;
    if (!force && Date.now() - this.lastFlushAt < this.backoffMs) return;
    this.lastFlushAt = Date.now();
    const batch = this.state.queue.slice(0, this.config.COLLECTOR_BATCH_SIZE);
    try {
      const response = await fetch(`${this.config.WEB_API_URL.replace(/\/$/, "")}/api/collector/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.COLLECTOR_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`web API returned ${response.status}`);
      this.state.queue.splice(0, batch.length);
      this.backoffMs = 1_000;
      await this.persist();
      log("info", "events delivered", { count: batch.length, queued: this.state.queue.length });
    } catch (error) {
      log("warn", "event delivery failed", { error: error instanceof Error ? error.message : String(error), retryInMs: this.backoffMs });
      this.lastFlushAt = Date.now();
      this.backoffMs = Math.min(this.backoffMs * 2, 60_000);
    }
  }

  private persist(): Promise<void> { return saveState(this.config.COLLECTOR_STATE_PATH, this.state); }
}
