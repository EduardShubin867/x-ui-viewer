import { z } from "zod";
import { getEventStats } from "@/lib/server/services/event-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  nodeId: z.string().max(128).optional(),
  clientEmail: z.string().max(320).optional(),
  minutes: z.coerce.number().int().min(1).max(10_080).default(60),
});

export async function GET(request: Request): Promise<Response> {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) return Response.json({ error: "Invalid filters", issues: parsed.error.issues }, { status: 400 });
  return Response.json(await getEventStats(parsed.data));
}
