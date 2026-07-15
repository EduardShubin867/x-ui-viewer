import { analysisScopeSchema, analyzeTraffic } from "@/lib/server/services/traffic-analysis";
import { readOpenRouterConfig } from "@/lib/server/openrouter/client";
import { allowCollectorRequest } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  const config = readOpenRouterConfig();
  return Response.json({ enabled: Boolean(config), model: config?.model ?? null });
}

export async function POST(request: Request): Promise<Response> {
  const key = `ai:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`;
  if (!allowCollectorRequest(key, 10, 60_000)) return Response.json({ error: "Слишком много запросов анализа" }, { status: 429 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: "Некорректный JSON" }, { status: 400 }); }
  const parsed = analysisScopeSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Некорректная область анализа", issues: parsed.error.issues }, { status: 400 });
  try { return Response.json(await analyzeTraffic(parsed.data)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось выполнить анализ" }, { status: 502 }); }
}
