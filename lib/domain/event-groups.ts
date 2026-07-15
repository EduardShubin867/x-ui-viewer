import type { AccessEventView } from "@/lib/domain/access-event";

export interface EventGroup {
  id: string;
  representative: AccessEventView;
  events: AccessEventView[];
  firstAt: string;
  lastAt: string;
}

const WINDOW_MS = 60_000;

function destination(event: AccessEventView): string {
  return event.detectedDomain ?? event.destinationHost ?? event.destinationIp ?? "unknown";
}

function key(event: AccessEventView): string {
  return [event.nodeId, event.clientEmail ?? "", destination(event), event.destinationPort ?? "", event.network, event.inboundTag ?? "", event.outboundTag ?? ""].join("\u0000");
}

export function groupAccessEvents(events: readonly AccessEventView[], windowMs = WINDOW_MS): EventGroup[] {
  const groups: EventGroup[] = [];
  const latest = new Map<string, EventGroup>();
  for (const event of events) {
    const groupKey = key(event);
    const existing = latest.get(groupKey);
    const eventAt = new Date(event.occurredAt).getTime();
    const latestAt = existing ? new Date(existing.lastAt).getTime() : Number.NaN;
    if (existing && Math.abs(latestAt - eventAt) <= windowMs) {
      existing.events.push(event);
      if (eventAt < new Date(existing.firstAt).getTime()) existing.firstAt = event.occurredAt;
      if (eventAt > latestAt) {
        existing.lastAt = event.occurredAt;
        existing.representative = event;
      }
      continue;
    }
    const group: EventGroup = { id: event.eventId, representative: event, events: [event], firstAt: event.occurredAt, lastAt: event.occurredAt };
    groups.push(group);
    latest.set(groupKey, group);
  }
  return groups.sort((left, right) => new Date(right.lastAt).getTime() - new Date(left.lastAt).getTime());
}
