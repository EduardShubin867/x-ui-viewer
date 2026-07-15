import { z } from "zod";

export const trafficUserSchema = z.object({
  email: z.string().trim().min(1).max(320),
  uplinkBytes: z.number().int().nonnegative().safe(),
  downlinkBytes: z.number().int().nonnegative().safe(),
  online: z.boolean().nullable().default(null),
}).strict();

export const trafficSnapshotSchema = z.object({
  nodeId: z.string().trim().min(1).max(128),
  observedAt: z.iso.datetime(),
  users: z.array(trafficUserSchema).max(2_000),
}).strict();

export type TrafficSnapshot = z.infer<typeof trafficSnapshotSchema>;

export interface TrafficView {
  email: string;
  nodeId: string;
  nodeName: string;
  observedAt: string;
  uplinkBytes: string;
  downlinkBytes: string;
  uplinkRateBps: string;
  downlinkRateBps: string;
  online: boolean | null;
  onlineSource: "xray" | "activity";
  stale: boolean;
}
