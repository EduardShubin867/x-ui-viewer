import { z } from "zod";
import { db } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createNodeSchema = z.object({
  name: z.string().min(1).max(128),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  panelUrl: z.url().optional(),
  panelBasePath: z.string().max(256).optional(),
  apiToken: z.string().min(1).max(4096).optional(),
}).strict();

const publicSelect = { id: true, name: true, slug: true, panelUrl: true, panelBasePath: true, isEnabled: true, lastSyncAt: true, syncError: true } as const;

export async function GET(): Promise<Response> {
  return Response.json({ items: await db.node.findMany({ select: publicSelect, orderBy: { name: "asc" } }) });
}

export async function POST(request: Request): Promise<Response> {
  const parsed = createNodeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid node", issues: parsed.error.issues }, { status: 400 });
  const node = await db.node.upsert({ where: { slug: parsed.data.slug }, update: parsed.data, create: parsed.data, select: publicSelect });
  return Response.json(node, { status: 201 });
}
