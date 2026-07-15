import "server-only";
import type { XrayAccessEvent } from "@/lib/domain/access-event";

export type RealtimeDelivery =
  | { kind: "events"; events: readonly XrayAccessEvent[] }
  | { kind: "gap"; reason: "buffer-overflow" };

export interface RealtimeSubscription extends AsyncIterable<RealtimeDelivery> {
  close(): Promise<void>;
}

export interface AccessEventTransport {
  publish(events: readonly XrayAccessEvent[]): Promise<void>;
  subscribe(options: { signal: AbortSignal; bufferSize?: number }): Promise<RealtimeSubscription>;
}
