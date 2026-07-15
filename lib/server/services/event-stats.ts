import "server-only";
import { db } from "@/lib/server/db";

export async function getEventStats(filters: { nodeId?: string; clientEmails: string[]; includeLoopback: boolean; minutes: number }) {
  const from = new Date(Date.now() - filters.minutes * 60_000);
  const events = await db.accessEvent.findMany({
    where: {
      occurredAt: { gte: from },
      node: filters.nodeId ? { slug: filters.nodeId } : undefined,
      clientEmail: filters.clientEmails.length ? { in: filters.clientEmails } : undefined,
      OR: filters.includeLoopback ? undefined : [{ destinationIp: null }, { destinationIp: { not: "127.0.0.1" } }],
    },
    select: { occurredAt: true, clientEmail: true, sourceIp: true, detectedDomain: true, destinationHost: true, destinationIp: true, outboundTag: true, network: true },
    orderBy: { occurredAt: "desc" },
    take: 20_000,
  });
  const count = (values: (string | null)[]) => {
    const map = new Map<string, number>();
    for (const value of values) if (value) map.set(value, (map.get(value) ?? 0) + 1);
    return [...map].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));
  };
  const domains = events.map((event) => event.detectedDomain ?? event.destinationHost ?? event.destinationIp);
  const minutes = new Map<string, number>();
  for (const event of events) {
    const key = event.occurredAt.toISOString().slice(0, 16);
    minutes.set(key, (minutes.get(key) ?? 0) + 1);
  }
  return {
    total: events.length,
    topDomains: count(domains),
    topClients: count(events.map((event) => event.clientEmail)),
    topOutbounds: count(events.map((event) => event.outboundTag)),
    networks: count(events.map((event) => event.network)),
    perMinute: [...minutes].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value })),
    unknownDomain: events.filter((event) => !event.detectedDomain && !event.destinationHost).length,
    uniqueDestinations: new Set(domains.filter(Boolean)).size,
    ipOnly: events.filter((event) => !event.detectedDomain && !event.destinationHost && event.destinationIp).slice(0, 20),
    lastSourceIp: events.find((event) => event.sourceIp)?.sourceIp ?? null,
    lastActivity: events[0]?.occurredAt.toISOString() ?? null,
  };
}
