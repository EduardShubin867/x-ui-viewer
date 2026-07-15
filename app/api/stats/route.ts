import { z } from "zod";
import { getEventStats } from "@/lib/server/services/event-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  nodeId: z.string().max(128).optional(),
  clientEmails: z.array(z.string().trim().min(1).max(320)).max(100).default([]),
  includeLoopback: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  minutes: z.coerce.number().int().min(1).max(10_080).default(60),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    ...Object.fromEntries(url.searchParams.entries()),
    clientEmails: [...new Set(url.searchParams.getAll("clientEmail"))].sort(),
  });
  if (!parsed.success) return Response.json({ error: "Invalid filters", issues: parsed.error.issues }, { status: 400 });
  return Response.json(await getEventStats(parsed.data));
}
