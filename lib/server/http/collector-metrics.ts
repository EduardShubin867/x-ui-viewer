import { timingSafeEqual } from "node:crypto";
import { trafficSnapshotSchema, type TrafficSnapshot } from "@/lib/domain/traffic";

const MAX_BODY_BYTES = 1_048_576;

export interface CollectorMetricsDependencies {
  token: string | undefined;
  ingest(snapshot: TrafficSnapshot): Promise<{ updated: number }>;
  allow(key: string): boolean;
}

function tokenMatches(header: string | null, expected: string | undefined): boolean {
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const wanted = Buffer.from(expected);
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

export async function handleCollectorMetrics(request: Request, deps: CollectorMetricsDependencies): Promise<Response> {
  if (!tokenMatches(request.headers.get("authorization"), deps.token)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const key = `metrics:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`;
  if (!deps.allow(key)) return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  const body = await request.text();
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return Response.json({ error: "Request body too large" }, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(body); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = trafficSnapshotSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid metrics payload", issues: parsed.error.issues }, { status: 400 });
  return Response.json(await deps.ingest(parsed.data), { status: 202 });
}
