import "server-only";
import type { TrafficSnapshot } from "@/lib/domain/traffic";
import { db } from "@/lib/server/db";

function rate(previous: bigint, current: bigint, durationMs: bigint): bigint {
  return durationMs > BigInt(0) && current >= previous ? (current - previous) * BigInt(1_000) / durationMs : BigInt(0);
}

export async function ingestTraffic(snapshot: TrafficSnapshot): Promise<{ updated: number }> {
  const observedAt = new Date(snapshot.observedAt);
  const node = await db.node.upsert({ where: { slug: snapshot.nodeId }, update: {}, create: { slug: snapshot.nodeId, name: snapshot.nodeId } });
  let updated = 0;
  await db.$transaction(async (tx) => {
    for (const user of snapshot.users) {
      const previous = await tx.clientTraffic.findUnique({ where: { nodeId_email: { nodeId: node.id, email: user.email } } });
      if (previous && previous.observedAt >= observedAt) continue;
      const elapsed = previous ? BigInt(observedAt.getTime() - previous.observedAt.getTime()) : BigInt(0);
      const uplinkBytes = BigInt(user.uplinkBytes);
      const downlinkBytes = BigInt(user.downlinkBytes);
      const values = {
        observedAt,
        uplinkBytes,
        downlinkBytes,
        uplinkRateBps: previous ? rate(previous.uplinkBytes, uplinkBytes, elapsed) : BigInt(0),
        downlinkRateBps: previous ? rate(previous.downlinkBytes, downlinkBytes, elapsed) : BigInt(0),
        online: user.online,
      };
      await tx.clientTraffic.upsert({
        where: { nodeId_email: { nodeId: node.id, email: user.email } },
        update: values,
        create: { nodeId: node.id, email: user.email, ...values },
      });
      await tx.xrayClient.upsert({
        where: { nodeId_email: { nodeId: node.id, email: user.email } },
        update: {},
        create: { nodeId: node.id, email: user.email },
      });
      updated += 1;
    }
  });
  return { updated };
}
