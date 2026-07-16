import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  buildActivityBucketsFromCounts,
  chooseActivityBucketMs,
} from "@/lib/domain/activity";
import type {
  ClientEventStat,
  EventStats,
  RankedStat,
} from "@/lib/domain/event-stats";
import { db } from "@/lib/server/db";

interface StatsFilters {
  nodeId?: string;
  clientEmails: string[];
  includeLoopback: boolean;
  from: Date;
  to: Date;
}

interface SummaryRow {
  total: bigint;
  unknownDomain: bigint;
  uniqueDestinations: bigint;
  firstActivity: Date | null;
  lastActivity: Date | null;
}

interface RankedRow {
  label: string;
  value: bigint;
}

interface ActivityRow {
  bucketIndex: number;
  value: bigint;
}

interface ClientRow extends RankedRow {
  uniqueDestinations: bigint;
  firstActivity: Date | null;
  lastActivity: Date | null;
}

const ranked = (rows: readonly RankedRow[]): RankedStat[] =>
  rows.map((row) => ({ label: row.label, value: Number(row.value) }));

function sqlWhere(filters: StatsFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`e."occurredAt" >= ${filters.from}`,
    Prisma.sql`e."occurredAt" <= ${filters.to}`,
  ];
  if (filters.nodeId) conditions.push(Prisma.sql`n."slug" = ${filters.nodeId}`);
  if (filters.clientEmails.length)
    conditions.push(
      Prisma.sql`e."clientEmail" IN (${Prisma.join(filters.clientEmails)})`,
    );
  if (!filters.includeLoopback)
    conditions.push(
      Prisma.sql`(e."destinationIp" IS NULL OR e."destinationIp" <> '127.0.0.1')`,
    );
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

export async function getEventStats(
  filters: StatsFilters,
): Promise<EventStats> {
  const where = sqlWhere(filters);
  const durationMs = filters.to.getTime() - filters.from.getTime();
  const bucketMs = chooseActivityBucketMs(durationMs);
  const destination = Prisma.sql`COALESCE(e."detectedDomain", e."destinationHost", e."destinationIp")`;

  const [
    summaryRows,
    domainRows,
    clientRows,
    outboundRows,
    networkRows,
    activityRows,
    ipOnlyRows,
    sourceRow,
  ] = await Promise.all([
    db.$queryRaw<SummaryRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS "total",
        COUNT(*) FILTER (
          WHERE e."detectedDomain" IS NULL AND e."destinationHost" IS NULL
        )::bigint AS "unknownDomain",
        COUNT(DISTINCT ${destination})::bigint AS "uniqueDestinations",
        MIN(e."occurredAt") AS "firstActivity",
        MAX(e."occurredAt") AS "lastActivity"
      FROM "AccessEvent" e
      JOIN "Node" n ON n."id" = e."nodeId"
      ${where}
    `),
    db.$queryRaw<RankedRow[]>(Prisma.sql`
      SELECT ${destination} AS "label", COUNT(*)::bigint AS "value"
      FROM "AccessEvent" e
      JOIN "Node" n ON n."id" = e."nodeId"
      ${where} AND ${destination} IS NOT NULL
      GROUP BY "label"
      ORDER BY "value" DESC, "label" ASC
      LIMIT 10
    `),
    db.$queryRaw<ClientRow[]>(Prisma.sql`
      SELECT
        e."clientEmail" AS "label",
        COUNT(*)::bigint AS "value",
        COUNT(DISTINCT ${destination})::bigint AS "uniqueDestinations",
        MIN(e."occurredAt") AS "firstActivity",
        MAX(e."occurredAt") AS "lastActivity"
      FROM "AccessEvent" e
      JOIN "Node" n ON n."id" = e."nodeId"
      ${where} AND e."clientEmail" IS NOT NULL
      GROUP BY e."clientEmail"
      ORDER BY "value" DESC, "label" ASC
    `),
    db.$queryRaw<RankedRow[]>(Prisma.sql`
      SELECT e."outboundTag" AS "label", COUNT(*)::bigint AS "value"
      FROM "AccessEvent" e
      JOIN "Node" n ON n."id" = e."nodeId"
      ${where} AND e."outboundTag" IS NOT NULL
      GROUP BY e."outboundTag"
      ORDER BY "value" DESC, "label" ASC
      LIMIT 10
    `),
    db.$queryRaw<RankedRow[]>(Prisma.sql`
      SELECT e."network" AS "label", COUNT(*)::bigint AS "value"
      FROM "AccessEvent" e
      JOIN "Node" n ON n."id" = e."nodeId"
      ${where}
      GROUP BY e."network"
      ORDER BY "value" DESC, "label" ASC
    `),
    db.$queryRaw<ActivityRow[]>(Prisma.sql`
      SELECT
        FLOOR(
          EXTRACT(EPOCH FROM (e."occurredAt" - ${filters.from})) * 1000 / ${bucketMs}
        )::integer AS "bucketIndex",
        COUNT(*)::bigint AS "value"
      FROM "AccessEvent" e
      JOIN "Node" n ON n."id" = e."nodeId"
      ${where}
      GROUP BY "bucketIndex"
      ORDER BY "bucketIndex" ASC
    `),
    db.accessEvent.findMany({
      where: {
        occurredAt: { gte: filters.from, lte: filters.to },
        node: filters.nodeId ? { slug: filters.nodeId } : undefined,
        clientEmail: filters.clientEmails.length
          ? { in: filters.clientEmails }
          : undefined,
        detectedDomain: null,
        destinationHost: null,
        destinationIp: filters.includeLoopback
          ? { not: null }
          : { notIn: ["127.0.0.1"] },
      },
      select: { destinationIp: true, occurredAt: true },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
    db.accessEvent.findFirst({
      where: {
        occurredAt: { gte: filters.from, lte: filters.to },
        node: filters.nodeId ? { slug: filters.nodeId } : undefined,
        clientEmail: filters.clientEmails.length
          ? { in: filters.clientEmails }
          : undefined,
        sourceIp: { not: null },
        OR: filters.includeLoopback
          ? undefined
          : [{ destinationIp: null }, { destinationIp: { not: "127.0.0.1" } }],
      },
      select: { sourceIp: true },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  const summary = summaryRows[0] ?? {
    total: BigInt(0),
    unknownDomain: BigInt(0),
    uniqueDestinations: BigInt(0),
    firstActivity: null,
    lastActivity: null,
  };
  const total = Number(summary.total);
  const activityCount = Math.ceil(durationMs / bucketMs);
  const counts = new Map<number, number>();
  for (const row of activityRows) {
    const index = Math.min(row.bucketIndex, activityCount - 1);
    if (index >= 0)
      counts.set(index, (counts.get(index) ?? 0) + Number(row.value));
  }
  const activity = buildActivityBucketsFromCounts(
    counts,
    filters.from,
    filters.to,
  );
  const clients: ClientEventStat[] = clientRows.map((row) => ({
    label: row.label,
    value: Number(row.value),
    share: total ? Number(row.value) / total : 0,
    uniqueDestinations: Number(row.uniqueDestinations),
    firstActivity: row.firstActivity?.toISOString() ?? null,
    lastActivity: row.lastActivity?.toISOString() ?? null,
  }));

  return {
    total,
    topDomains: ranked(domainRows),
    topClients: clients.slice(0, 10).map(({ label, value }) => ({
      label,
      value,
    })),
    topOutbounds: ranked(outboundRows),
    networks: ranked(networkRows),
    clients,
    activity: activity.items,
    range: {
      from: filters.from.toISOString(),
      to: filters.to.toISOString(),
      bucketMs: activity.bucketMs,
    },
    unknownDomain: Number(summary.unknownDomain),
    uniqueDestinations: Number(summary.uniqueDestinations),
    ipOnly: ipOnlyRows.map((row) => ({
      destinationIp: row.destinationIp,
      occurredAt: row.occurredAt.toISOString(),
    })),
    lastSourceIp: sourceRow?.sourceIp ?? null,
    firstActivity: summary.firstActivity?.toISOString() ?? null,
    lastActivity: summary.lastActivity?.toISOString() ?? null,
  };
}
