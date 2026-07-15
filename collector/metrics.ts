import { z } from "zod";
import type { TrafficSnapshot } from "@/lib/domain/traffic";

const counterSchema = z.object({
  uplink: z.number().int().nonnegative().safe().default(0),
  downlink: z.number().int().nonnegative().safe().default(0),
  online: z.union([z.boolean(), z.number()]).optional(),
}).passthrough();

const varsSchema = z.object({
  stats: z.object({ user: z.record(z.string(), counterSchema).default({}) }).passthrough(),
}).passthrough();

export function parseXrayMetrics(payload: unknown, nodeId: string, observedAt = new Date()): TrafficSnapshot {
  const parsed = varsSchema.parse(payload);
  return {
    nodeId,
    observedAt: observedAt.toISOString(),
    users: Object.entries(parsed.stats.user).map(([email, value]) => ({
      email,
      uplinkBytes: value.uplink,
      downlinkBytes: value.downlink,
      online: value.online === undefined ? null : value.online === true || value.online === 1,
    })),
  };
}
