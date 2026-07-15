import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { XrayAccessEvent } from "@/lib/domain/access-event";

export interface CollectorState {
  inode: number | null;
  offset: number;
  remainder: string;
  queue: XrayAccessEvent[];
}

export async function loadState(path: string): Promise<CollectorState> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<CollectorState>;
    return {
      inode: typeof parsed.inode === "number" ? parsed.inode : null,
      offset: typeof parsed.offset === "number" ? parsed.offset : 0,
      remainder: typeof parsed.remainder === "string" ? parsed.remainder : "",
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
    };
  } catch { return { inode: null, offset: 0, remainder: "", queue: [] }; }
}

export async function saveState(path: string, state: CollectorState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
  await rename(temporary, path);
}
