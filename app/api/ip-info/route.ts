import { isIP } from "node:net";
import { getIpIntelligence } from "@/lib/server/services/ip-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const ip = new URL(request.url).searchParams.get("ip")?.trim() ?? "";
  if (!isIP(ip))
    return Response.json({ error: "Некорректный IP-адрес" }, { status: 400 });

  try {
    return Response.json(await getIpIntelligence(ip), {
      headers: {
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("IP intelligence lookup failed", { ip, error });
    return Response.json(
      { error: "Не удалось определить владельца IP" },
      { status: 502 },
    );
  }
}
