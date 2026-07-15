import { describe, expect, it } from "vitest";
import type { AccessEventView } from "./access-event";
import { groupAccessEvents } from "./event-groups";

const event = (id: string, occurredAt: string, overrides: Partial<AccessEventView> = {}): AccessEventView => ({
  id, eventId: id, occurredAt, nodeId: "node", nodeName: "Node", clientEmail: "rita", sourceIp: "1.2.3.4", network: "tcp",
  destinationHost: "telegram.org", destinationIp: null, destinationPort: 443, detectedDomain: null, inboundTag: "in", outboundTag: "direct", rawLine: id, ...overrides,
});

describe("groupAccessEvents", () => {
  it("groups the same user, destination and route inside a burst", () => {
    const groups = groupAccessEvents([event("b", "2026-07-16T00:00:40.000Z"), event("a", "2026-07-16T00:00:00.000Z")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(2);
  });

  it("keeps different exact IPs and later bursts separate", () => {
    const groups = groupAccessEvents([
      event("c", "2026-07-16T00:02:00.000Z", { destinationHost: null, destinationIp: "149.154.1.1" }),
      event("b", "2026-07-16T00:00:20.000Z", { destinationHost: null, destinationIp: "149.154.1.2" }),
      event("a", "2026-07-16T00:00:00.000Z", { destinationHost: null, destinationIp: "149.154.1.1" }),
    ]);
    expect(groups).toHaveLength(3);
  });
});
