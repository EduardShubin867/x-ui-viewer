import "server-only";
import type { XrayAccessEvent } from "@/lib/domain/access-event";
import type { AccessEventTransport } from "@/lib/server/realtime/transport";

export interface EventWriter {
  insert(events: readonly XrayAccessEvent[]): Promise<XrayAccessEvent[]>;
}

export interface IngestResult {
  created: number;
  skipped: number;
}

export class IngestEventsService {
  constructor(private readonly repository: EventWriter, private readonly realtime: AccessEventTransport) {}

  async execute(events: readonly XrayAccessEvent[]): Promise<IngestResult> {
    const created = await this.repository.insert(events);
    await this.realtime.publish(created);
    return { created: created.length, skipped: events.length - created.length };
  }
}
