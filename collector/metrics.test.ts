import { describe, expect, it } from "vitest";
import { parseXrayMetrics } from "./metrics";

describe("parseXrayMetrics", () => {
  it("parses counters and supports missing online stats", () => {
    const snapshot = parseXrayMetrics({ stats: { user: { rita: { uplink: 10, downlink: 20 }, eduard: { uplink: 3, downlink: 4, online: 1 } } } }, "node", new Date("2026-07-16T00:00:00Z"));
    expect(snapshot.users).toEqual([
      { email: "rita", uplinkBytes: 10, downlinkBytes: 20, online: null },
      { email: "eduard", uplinkBytes: 3, downlinkBytes: 4, online: true },
    ]);
  });
});
