import { ZodError } from "zod";
import { filtersFromUrl } from "@/lib/domain/filters";
import { accessEventRepository } from "@/lib/server/repositories/access-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const filters = filtersFromUrl(new URL(request.url));
    return Response.json(await accessEventRepository.list(filters));
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid filters", issues: error.issues }, { status: 400 });
    throw error;
  }
}
