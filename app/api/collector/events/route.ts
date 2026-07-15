import { handleCollectorEvents } from "@/lib/server/http/collector-events";
import { accessEventRepository } from "@/lib/server/repositories/access-events";
import { accessEventTransport } from "@/lib/server/realtime/memory-transport";
import { allowCollectorRequest } from "@/lib/server/rate-limit";
import { IngestEventsService } from "@/lib/server/services/ingest-events";

export const runtime = "nodejs";
const service = new IngestEventsService(accessEventRepository, accessEventTransport);

export function POST(request: Request): Promise<Response> {
  return handleCollectorEvents(request, {
    token: process.env.COLLECTOR_TOKEN,
    allow: allowCollectorRequest,
    ingest: (events) => service.execute(events),
  });
}
