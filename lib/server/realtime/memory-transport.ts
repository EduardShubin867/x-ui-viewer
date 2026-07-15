import "server-only";
import type { XrayAccessEvent } from "@/lib/domain/access-event";
import type { AccessEventTransport, RealtimeDelivery, RealtimeSubscription } from "./transport";

interface Subscriber {
  queue: RealtimeDelivery[];
  waiting: ((value: IteratorResult<RealtimeDelivery>) => void) | null;
  closed: boolean;
  bufferSize: number;
}

export class MemoryAccessEventTransport implements AccessEventTransport {
  private readonly subscribers = new Set<Subscriber>();

  async publish(events: readonly XrayAccessEvent[]): Promise<void> {
    if (!events.length) return;
    for (const subscriber of this.subscribers) {
      if (subscriber.closed) continue;
      const delivery: RealtimeDelivery = { kind: "events", events };
      if (subscriber.waiting) {
        const resolve = subscriber.waiting;
        subscriber.waiting = null;
        resolve({ done: false, value: delivery });
      } else if (subscriber.queue.length < subscriber.bufferSize) {
        subscriber.queue.push(delivery);
      } else {
        subscriber.queue = [{ kind: "gap", reason: "buffer-overflow" }];
      }
    }
  }

  async subscribe({ signal, bufferSize = 128 }: { signal: AbortSignal; bufferSize?: number }): Promise<RealtimeSubscription> {
    const close = () => {
      if (subscriber.closed) return;
      subscriber.closed = true;
      this.subscribers.delete(subscriber);
      subscriber.waiting?.({ done: true, value: undefined });
      subscriber.waiting = null;
      subscriber.queue = [];
      signal.removeEventListener("abort", close);
    };
    const subscriber: Subscriber = { queue: [], waiting: null, closed: false, bufferSize };
    if (signal.aborted) close();
    else {
      this.subscribers.add(subscriber);
      signal.addEventListener("abort", close, { once: true });
    }

    return {
      close: async () => close(),
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<RealtimeDelivery>> {
            if (subscriber.queue.length) {
              return Promise.resolve({ done: false, value: subscriber.queue.shift()! });
            }
            if (subscriber.closed) return Promise.resolve({ done: true, value: undefined });
            return new Promise((resolve) => { subscriber.waiting = resolve; });
          },
          return(): Promise<IteratorResult<RealtimeDelivery>> {
            close();
            return Promise.resolve({ done: true, value: undefined });
          },
        };
      },
    };
  }
}

const globalRealtime = globalThis as unknown as { accessEventTransport?: MemoryAccessEventTransport };

// Replace this singleton with a PostgreSQL LISTEN/NOTIFY, Redis or NATS adapter
// when running more than one web process. The interface intentionally stays broker-agnostic.
export const accessEventTransport = globalRealtime.accessEventTransport ?? new MemoryAccessEventTransport();
if (process.env.NODE_ENV !== "production") globalRealtime.accessEventTransport = accessEventTransport;
