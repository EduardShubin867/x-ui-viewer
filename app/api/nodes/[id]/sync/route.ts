import { syncNode } from "@/lib/server/services/sync-node";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  try { return Response.json(await syncNode(id)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return Response.json({ error: message }, { status: message === "Node not found" ? 404 : 502 });
  }
}
