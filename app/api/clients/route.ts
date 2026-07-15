import { db } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const nodeSlug = new URL(request.url).searchParams.get("nodeId") || undefined;
  const clients = await db.xrayClient.findMany({
    where: { node: nodeSlug ? { slug: nodeSlug } : undefined },
    select: { email: true, enabled: true, inboundTag: true, lastSeenAt: true, node: { select: { slug: true, name: true } } },
    orderBy: [{ lastSeenAt: "desc" }, { email: "asc" }],
    take: 2_000,
  });
  return Response.json({ items: clients.map((client) => ({ ...client, nodeId: client.node.slug, nodeName: client.node.name, node: undefined })) });
}
