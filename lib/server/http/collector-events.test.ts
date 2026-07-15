import { describe, expect, it } from "vitest";
import type { XrayAccessEvent } from "@/lib/domain/access-event";
import { handleCollectorEvents } from "./collector-events";

const event: XrayAccessEvent = {
  eventId: "a".repeat(64), occurredAt: "2026-07-15T18:13:04.000Z", nodeId: "finland-1",
  clientEmail: "eduard", sourceIp: "1.2.3.4", network: "tcp", destinationHost: "example.com",
  destinationIp: null, destinationPort: 443, detectedDomain: null, inboundTag: "in", outboundTag: "out", rawLine: "line",
};

function request(body: unknown, token = "secret"): Request {
  return new Request("http://localhost/api/collector/events", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
}

function deps() {
  const seen = new Set<string>();
  return {
    token: "secret", allow: () => true,
    ingest: async (events: readonly XrayAccessEvent[]) => {
      let created = 0;
      for (const item of events) if (!seen.has(item.eventId)) { seen.add(item.eventId); created += 1; }
      return { created, skipped: events.length - created };
    },
  };
}

describe("collector event HTTP handler", () => {
  it("accepts a single event with the correct token", async () => {
    const response = await handleCollectorEvents(request(event), deps());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ created: 1, skipped: 0 });
  });
  it("rejects an incorrect token", async () => expect((await handleCollectorEvents(request(event, "wrong"), deps())).status).toBe(401));
  it("accepts a batch", async () => {
    const response = await handleCollectorEvents(request({ events: [event, { ...event, eventId: "b".repeat(64) }] }), deps());
    expect(await response.json()).toEqual({ created: 2, skipped: 0 });
  });
  it("deduplicates repeated deliveries", async () => {
    const dependencies = deps();
    await handleCollectorEvents(request(event), dependencies);
    expect(await (await handleCollectorEvents(request(event), dependencies)).json()).toEqual({ created: 0, skipped: 1 });
  });
  it("rejects an invalid body", async () => expect((await handleCollectorEvents(request({ nope: true }), deps())).status).toBe(400));
  it("rejects batches larger than 500", async () => {
    const events = Array.from({ length: 501 }, (_, index) => ({ ...event, eventId: index.toString().padStart(64, "0") }));
    expect((await handleCollectorEvents(request({ events }), deps())).status).toBe(400);
  });
  it("rejects an oversized declared body", async () => {
    const oversized = new Request("http://localhost", { method: "POST", headers: { authorization: "Bearer secret", "content-length": "2000000" }, body: "{}" });
    expect((await handleCollectorEvents(oversized, deps())).status).toBe(413);
  });
});
