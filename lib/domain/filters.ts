import { z } from "zod";
import { networkSchema } from "./access-event";

const optionalText = z.string().trim().max(512).optional().transform((value) => value || undefined);

export const eventFiltersSchema = z.object({
  nodeId: optionalText,
  clientEmails: z.array(z.string().trim().min(1).max(320)).max(100).default([]),
  search: optionalText,
  network: networkSchema.optional(),
  inboundTag: optionalText,
  outboundTag: optionalText,
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().regex(/^\d+$/).optional(),
});

export type EventFilters = z.infer<typeof eventFiltersSchema>;

export function filtersFromUrl(url: URL): EventFilters {
  return eventFiltersSchema.parse({
    ...Object.fromEntries(url.searchParams.entries()),
    clientEmails: [...new Set(url.searchParams.getAll("clientEmail"))].sort(),
  });
}
