import { describe, expect, it } from "vitest";
import { readCollectorConfig } from "./config";

const required = {
  NODE_ID: "node",
  WEB_API_URL: "https://viewer.example.com",
  COLLECTOR_TOKEN: "secret",
};

describe("readCollectorConfig", () => {
  it("treats an empty metrics URL from Docker Compose as disabled", () => {
    expect(readCollectorConfig({ ...required, XRAY_METRICS_URL: "" }).XRAY_METRICS_URL).toBeUndefined();
    expect(readCollectorConfig({ ...required, XRAY_METRICS_URL: "   " }).XRAY_METRICS_URL).toBeUndefined();
  });

  it("accepts a configured metrics endpoint and rejects malformed values", () => {
    expect(readCollectorConfig({ ...required, XRAY_METRICS_URL: "http://127.0.0.1:11111/debug/vars" }).XRAY_METRICS_URL).toBe("http://127.0.0.1:11111/debug/vars");
    expect(() => readCollectorConfig({ ...required, XRAY_METRICS_URL: "not-a-url" })).toThrow();
  });
});
