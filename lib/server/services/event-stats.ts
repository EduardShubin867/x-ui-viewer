import "server-only";
import { db } from "@/lib/server/db";
import { buildActivityBuckets } from "@/lib/domain/activity";

export async function getEventStats(filters: {
  nodeId?: string;
  clientEmails: string[];
  includeLoopback: boolean;
  from: Date;
  to: Date;
}) {
  const events = await db.accessEvent.findMany({
    where: {
      occurredAt: { gte: filters.from, lte: filters.to },
      node: filters.nodeId ? { slug: filters.nodeId } : undefined,
      clientEmail: filters.clientEmails.length
        ? { in: filters.clientEmails }
        : undefined,
      OR: filters.includeLoopback
        ? undefined
        : [{ destinationIp: null }, { destinationIp: { not: "127.0.0.1" } }],
    },
    select: {
      occurredAt: true,
      clientEmail: true,
      sourceIp: true,
      detectedDomain: true,
      destinationHost: true,
      destinationIp: true,
      outboundTag: true,
      network: true,
    },
    orderBy: { occurredAt: "desc" },
    take: 20_000,
  });
  const count = (values: (string | null)[]) => {
    const map = new Map<string, number>();
    for (const value of values)
      if (value) map.set(value, (map.get(value) ?? 0) + 1);
    return [...map]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));
  };
  const domains = events.map(
    (event) =>
      event.detectedDomain ?? event.destinationHost ?? event.destinationIp,
  );
  const activity = buildActivityBuckets(
    events.map((event) => event.occurredAt),
    filters.from,
    filters.to,
  );
  return {
    total: events.length,
    topDomains: count(domains),
    topClients: count(events.map((event) => event.clientEmail)),
    topOutbounds: count(events.map((event) => event.outboundTag)),
    networks: count(events.map((event) => event.network)),
    activity: activity.items,
    range: {
      from: filters.from.toISOString(),
      to: filters.to.toISOString(),
      bucketMs: activity.bucketMs,
    },
    unknownDomain: events.filter(
      (event) => !event.detectedDomain && !event.destinationHost,
    ).length,
    uniqueDestinations: new Set(domains.filter(Boolean)).size,
    ipOnly: events
      .filter(
        (event) =>
          !event.detectedDomain &&
          !event.destinationHost &&
          event.destinationIp,
      )
      .slice(0, 20),
    lastSourceIp: events.find((event) => event.sourceIp)?.sourceIp ?? null,
    lastActivity: events[0]?.occurredAt.toISOString() ?? null,
  };
}
