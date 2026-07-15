import { z } from "zod";
import type { TrafficView } from "@/lib/domain/traffic";
import { db } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({ nodeId: z.string().trim().max(128).optional(), email: z.string().trim().max(320).optional() });

export async function GET(request: Request): Promise<Response> {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Invalid filters" }, { status: 400 });
  const rows = await db.clientTraffic.findMany({
    where: { email: parsed.data.email, node: parsed.data.nodeId ? { slug: parsed.data.nodeId } : undefined },
    include: { node: { select: { slug: true, name: true } } },
    orderBy: [{ observedAt: "desc" }, { email: "asc" }],
    take: 2_000,
  });
  const now = Date.now();
  const items: TrafficView[] = rows.map((row) => ({
    email: row.email, nodeId: row.node.slug, nodeName: row.node.name, observedAt: row.observedAt.toISOString(),
    uplinkBytes: row.uplinkBytes.toString(), downlinkBytes: row.downlinkBytes.toString(),
    uplinkRateBps: row.uplinkRateBps.toString(), downlinkRateBps: row.downlinkRateBps.toString(),
    online: row.online, stale: now - row.observedAt.getTime() > 45_000,
  }));
  return Response.json({ items });
}
