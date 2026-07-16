import { z } from "zod";
import { getEventStats } from "@/lib/server/services/event-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    nodeId: z.string().max(128).optional(),
    clientEmails: z
      .array(z.string().trim().min(1).max(320))
      .max(100)
      .default([]),
    includeLoopback: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    minutes: z.coerce.number().int().min(1).max(10_080).default(60),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.from) !== Boolean(value.to))
      context.addIssue({
        code: "custom",
        message: "from and to must be provided together",
        path: [value.from ? "to" : "from"],
      });
    if (value.from && value.to) {
      const duration =
        new Date(value.to).getTime() - new Date(value.from).getTime();
      if (duration <= 0)
        context.addIssue({
          code: "custom",
          message: "from must be earlier than to",
          path: ["to"],
        });
      if (duration > 31 * 24 * 60 * 60_000)
        context.addIssue({
          code: "custom",
          message: "range must not exceed 31 days",
          path: ["to"],
        });
    }
  });

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    ...Object.fromEntries(url.searchParams.entries()),
    clientEmails: [...new Set(url.searchParams.getAll("clientEmail"))].sort(),
  });
  if (!parsed.success)
    return Response.json(
      { error: "Invalid filters", issues: parsed.error.issues },
      { status: 400 },
    );
  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();
  const from = parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(to.getTime() - parsed.data.minutes * 60_000);
  return Response.json(await getEventStats({ ...parsed.data, from, to }));
}
