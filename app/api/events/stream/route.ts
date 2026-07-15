import { accessEventTransport } from "@/lib/server/realtime/memory-transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();
  const subscription = await accessEventTransport.subscribe({ signal: request.signal, bufferSize: 256 });
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("event: ready\ndata: {}\n\n"));
      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { /* connection closed */ }
      }, 15_000);
      void (async () => {
        try {
          for await (const delivery of subscription) {
            if (delivery.kind === "gap") {
              controller.enqueue(encoder.encode(`event: resync-required\ndata: ${JSON.stringify(delivery)}\n\n`));
              continue;
            }
            for (const event of delivery.events) {
              controller.enqueue(encoder.encode(`id: ${event.eventId}\nevent: access-event\ndata: ${JSON.stringify(event)}\n\n`));
            }
          }
        } catch {
          // Aborted streams are expected when the browser reconnects.
        } finally {
          if (heartbeat) clearInterval(heartbeat);
          try { controller.close(); } catch { /* already closed */ }
        }
      })();
    },
    async cancel() {
      if (heartbeat) clearInterval(heartbeat);
      await subscription.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
