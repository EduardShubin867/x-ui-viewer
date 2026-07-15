import { handleCollectorMetrics } from "@/lib/server/http/collector-metrics";
import { allowCollectorRequest } from "@/lib/server/rate-limit";
import { ingestTraffic } from "@/lib/server/services/ingest-traffic";

export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  return handleCollectorMetrics(request, { token: process.env.COLLECTOR_TOKEN, allow: allowCollectorRequest, ingest: ingestTraffic });
}
