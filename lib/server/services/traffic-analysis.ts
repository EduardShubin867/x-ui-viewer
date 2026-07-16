import "server-only";
import { z } from "zod";
import { db } from "@/lib/server/db";
import {
  OpenRouterClient,
  readOpenRouterConfig,
} from "@/lib/server/openrouter/client";

export const analysisScopeSchema = z
  .object({
    nodeId: z.string().trim().max(128).optional(),
    clientEmails: z
      .array(z.string().trim().min(1).max(320))
      .max(100)
      .default([]),
    minutes: z.number().int().min(1).max(1_440).default(60),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    includeLoopback: z.boolean().default(false),
  })
  .strict()
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

const count = (values: (string | null)[], limit = 15) =>
  [
    ...values.reduce((map, value) => {
      if (value) map.set(value, (map.get(value) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));

export async function analyzeTraffic(
  scope: z.infer<typeof analysisScopeSchema>,
) {
  const config = readOpenRouterConfig();
  if (!config) throw new Error("OpenRouter не настроен");
  const rangeTo = scope.to ? new Date(scope.to) : new Date();
  const rangeFrom = scope.from
    ? new Date(scope.from)
    : new Date(rangeTo.getTime() - scope.minutes * 60_000);
  const occurredAt = { gte: rangeFrom, lte: rangeTo };
  const events = await db.accessEvent.findMany({
    where: {
      occurredAt,
      node: scope.nodeId ? { slug: scope.nodeId } : undefined,
      clientEmail: scope.clientEmails.length
        ? { in: scope.clientEmails }
        : undefined,
      destinationIp: scope.includeLoopback ? undefined : { not: "127.0.0.1" },
    },
    select: {
      clientEmail: true,
      detectedDomain: true,
      destinationHost: true,
      network: true,
      inboundTag: true,
      outboundTag: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: "desc" },
    take: 10_000,
  });
  if (events.length < 3)
    return {
      insufficient: true as const,
      reason: "За выбранный период недостаточно событий для анализа",
    };

  const emails = [
    ...new Set(
      events
        .map((event) => event.clientEmail)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const aliases = new Map(
    emails.map((email, index) => [email, `Client #${index + 1}`]),
  );
  const traffic = await db.clientTraffic.findMany({
    where: {
      email: emails.length ? { in: emails } : undefined,
      node: scope.nodeId ? { slug: scope.nodeId } : undefined,
    },
    select: {
      email: true,
      uplinkBytes: true,
      downlinkBytes: true,
      uplinkRateBps: true,
      downlinkRateBps: true,
      online: true,
      observedAt: true,
    },
    take: 2_000,
  });
  const aggregate = {
    period: { from: rangeFrom.toISOString(), to: rangeTo.toISOString() },
    eventCount: events.length,
    truncated: events.length === 10_000,
    firstEventAt: events.at(-1)?.occurredAt.toISOString(),
    lastEventAt: events[0]?.occurredAt.toISOString(),
    topDestinations: count(
      events.map((event) => event.detectedDomain ?? event.destinationHost),
    ),
    networks: count(events.map((event) => event.network)),
    routes: count(
      events.map(
        (event) => `${event.inboundTag ?? "?"} -> ${event.outboundTag ?? "?"}`,
      ),
    ),
    clients: emails.map((email) => ({
      alias: aliases.get(email),
      events: events.filter((event) => event.clientEmail === email).length,
    })),
    traffic: traffic.map((item) => ({
      alias: aliases.get(item.email) ?? "Client (not in event sample)",
      online: item.online,
      sampleAgeSeconds: Math.max(
        0,
        Math.round((Date.now() - item.observedAt.getTime()) / 1_000),
      ),
      uplinkBytes: item.uplinkBytes.toString(),
      downlinkBytes: item.downlinkBytes.toString(),
      uplinkRateBps: item.uplinkRateBps.toString(),
      downlinkRateBps: item.downlinkRateBps.toString(),
    })),
  };
  const result = await new OpenRouterClient(config).analyze(aggregate);
  let content = result.content;
  for (const [email, alias] of aliases)
    content = content.replaceAll(alias, email);
  return {
    insufficient: false as const,
    content,
    model: result.model,
    usage: result.usage,
    analyzedEvents: events.length,
  };
}
