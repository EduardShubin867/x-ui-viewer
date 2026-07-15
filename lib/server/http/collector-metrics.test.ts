import { describe, expect, it } from "vitest";
import { handleCollectorMetrics } from "./collector-metrics";

const snapshot = { nodeId: "node", observedAt: "2026-07-16T00:00:00.000Z", users: [{ email: "rita", uplinkBytes: 10, downlinkBytes: 20, online: true }] };
const request = (body: unknown, token = "secret") => new Request("http://localhost/api/collector/metrics", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });

describe("collector metrics HTTP handler", () => {
  it("authenticates and ingests a valid snapshot", async () => {
    let received: unknown;
    const response = await handleCollectorMetrics(request(snapshot), { token: "secret", allow: () => true, ingest: async (value) => { received = value; return { updated: value.users.length }; } });
    expect(response.status).toBe(202);
    expect(received).toEqual(snapshot);
  });

  it("rejects invalid credentials and payloads", async () => {
    const deps = { token: "secret", allow: () => true, ingest: async () => ({ updated: 0 }) };
    expect((await handleCollectorMetrics(request(snapshot, "wrong"), deps)).status).toBe(401);
    expect((await handleCollectorMetrics(request({ ...snapshot, users: [{ email: "", uplinkBytes: -1 }] }), deps)).status).toBe(400);
  });
});
