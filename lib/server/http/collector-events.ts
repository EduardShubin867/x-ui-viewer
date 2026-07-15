import { timingSafeEqual } from "node:crypto";
import { collectorPayloadSchema, type XrayAccessEvent } from "@/lib/domain/access-event";

const MAX_BODY_BYTES = 1_048_576;

export interface CollectorHandlerDependencies {
  token: string | undefined;
  ingest(events: readonly XrayAccessEvent[]): Promise<{ created: number; skipped: number }>;
  allow(key: string): boolean;
}

function tokenMatches(header: string | null, expected: string | undefined): boolean {
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const wanted = Buffer.from(expected);
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

export async function handleCollectorEvents(request: Request, deps: CollectorHandlerDependencies): Promise<Response> {
  if (!tokenMatches(request.headers.get("authorization"), deps.token)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!deps.allow(key)) return Response.json({ error: "Rate limit exceeded" }, { status: 429 });

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return Response.json({ error: "Request body too large" }, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return Response.json({ error: "Request body too large" }, { status: 413 });

  let json: unknown;
  try { json = JSON.parse(body); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = collectorPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid event payload", issues: parsed.error.issues }, { status: 400 });
  }
  const events = "events" in parsed.data ? parsed.data.events : [parsed.data];
  return Response.json(await deps.ingest(events), { status: 202 });
}
