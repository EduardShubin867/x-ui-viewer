import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AccessEventView, EventsPage, XrayAccessEvent } from "@/lib/domain/access-event";
import type { EventFilters } from "@/lib/domain/filters";
import { db } from "@/lib/server/db";

function toView(row: {
  id: bigint;
  eventId: string;
  occurredAt: Date;
  clientEmail: string | null;
  sourceIp: string | null;
  network: string;
  destinationHost: string | null;
  destinationIp: string | null;
  destinationPort: number | null;
  detectedDomain: string | null;
  inboundTag: string | null;
  outboundTag: string | null;
  rawLine: string | null;
  node: { slug: string; name: string };
}): AccessEventView {
  return {
    id: row.id.toString(),
    eventId: row.eventId,
    occurredAt: row.occurredAt.toISOString(),
    nodeId: row.node.slug,
    nodeName: row.node.name,
    clientEmail: row.clientEmail,
    sourceIp: row.sourceIp,
    network: row.network === "tcp" || row.network === "udp" ? row.network : "unknown",
    destinationHost: row.destinationHost,
    destinationIp: row.destinationIp,
    destinationPort: row.destinationPort,
    detectedDomain: row.detectedDomain,
    inboundTag: row.inboundTag,
    outboundTag: row.outboundTag,
    rawLine: row.rawLine ?? "",
  };
}

export class PrismaAccessEventRepository {
  async insert(events: readonly XrayAccessEvent[]): Promise<XrayAccessEvent[]> {
    const created: XrayAccessEvent[] = [];
    const byNode = Map.groupBy(events, (event) => event.nodeId);

    await db.$transaction(async (tx) => {
      for (const [slug, nodeEvents] of byNode) {
        const node = await tx.node.upsert({
          where: { slug },
          update: {},
          create: { slug, name: slug },
        });
        const rows = await tx.accessEvent.createManyAndReturn({
          data: nodeEvents.map((event) => ({
            eventId: event.eventId,
            occurredAt: new Date(event.occurredAt),
            nodeId: node.id,
            clientEmail: event.clientEmail,
            sourceIp: event.sourceIp,
            network: event.network,
            destinationHost: event.destinationHost,
            destinationIp: event.destinationIp,
            destinationPort: event.destinationPort,
            detectedDomain: event.detectedDomain,
            inboundTag: event.inboundTag,
            outboundTag: event.outboundTag,
            rawLine: event.rawLine,
          })),
          skipDuplicates: true,
          select: { eventId: true },
        });
        const insertedIds = new Set(rows.map((row) => row.eventId));
        created.push(...nodeEvents.filter((event) => insertedIds.has(event.eventId)));

        const latestByEmail = new Map<string, Date>();
        for (const event of nodeEvents) {
          if (!event.clientEmail) continue;
          const date = new Date(event.occurredAt);
          const current = latestByEmail.get(event.clientEmail);
          if (!current || date > current) latestByEmail.set(event.clientEmail, date);
        }
        for (const [email, lastSeenAt] of latestByEmail) {
          await tx.xrayClient.upsert({
            where: { nodeId_email: { nodeId: node.id, email } },
            update: { lastSeenAt },
            create: { nodeId: node.id, email, lastSeenAt },
          });
        }
      }
    });
    return created;
  }

  async list(filters: EventFilters): Promise<EventsPage> {
    const search = filters.search;
    const where: Prisma.AccessEventWhereInput = {
      node: filters.nodeId ? { slug: filters.nodeId } : undefined,
      clientEmail: filters.clientEmails.length ? { in: filters.clientEmails } : undefined,
      network: filters.network,
      inboundTag: filters.inboundTag,
      outboundTag: filters.outboundTag,
      occurredAt: filters.from || filters.to ? {
        gte: filters.from ? new Date(filters.from) : undefined,
        lte: filters.to ? new Date(filters.to) : undefined,
      } : undefined,
      OR: search ? [
        { clientEmail: { contains: search, mode: "insensitive" } },
        { destinationHost: { contains: search, mode: "insensitive" } },
        { destinationIp: { contains: search, mode: "insensitive" } },
        { detectedDomain: { contains: search, mode: "insensitive" } },
        { inboundTag: { contains: search, mode: "insensitive" } },
        { outboundTag: { contains: search, mode: "insensitive" } },
      ] : undefined,
    };
    const rows = await db.accessEvent.findMany({
      where,
      include: { node: { select: { slug: true, name: true } } },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: filters.limit + 1,
      cursor: filters.cursor ? { id: BigInt(filters.cursor) } : undefined,
      skip: filters.cursor ? 1 : 0,
    });
    const hasMore = rows.length > filters.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map(toView);
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }
}

export const accessEventRepository = new PrismaAccessEventRepository();
