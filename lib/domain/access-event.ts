import { z } from "zod";

export const networkSchema = z.enum(["tcp", "udp", "unknown"]);

export const xrayAccessEventSchema = z.object({
  eventId: z.string().min(16).max(128),
  occurredAt: z.iso.datetime({ offset: true }),
  nodeId: z.string().min(1).max(128),
  clientEmail: z.string().max(320).nullable(),
  sourceIp: z.string().max(64).nullable(),
  network: networkSchema,
  destinationHost: z.string().max(512).nullable(),
  destinationIp: z.string().max(64).nullable(),
  destinationPort: z.number().int().min(1).max(65535).nullable(),
  detectedDomain: z.string().max(512).nullable(),
  inboundTag: z.string().max(256).nullable(),
  outboundTag: z.string().max(256).nullable(),
  rawLine: z.string().max(16_384),
}).strict();

export const collectorPayloadSchema = z.union([
  xrayAccessEventSchema,
  z.object({ events: z.array(xrayAccessEventSchema).min(1).max(500) }).strict(),
]);

export type XrayAccessEvent = z.infer<typeof xrayAccessEventSchema>;
export type Network = z.infer<typeof networkSchema>;

export interface AccessEventView extends XrayAccessEvent {
  id: string;
  nodeName: string;
}

export interface EventsPage {
  items: AccessEventView[];
  nextCursor: string | null;
}

export function destinationLabel(event: XrayAccessEvent): string {
  const host = event.detectedDomain ?? event.destinationHost ?? event.destinationIp ?? "unknown";
  return event.destinationPort ? `${host}:${event.destinationPort}` : host;
}
