import { describe, expect, it } from "vitest";
import { classifyIpAddress } from "@/lib/domain/ip-intelligence";

describe("IP address classification", () => {
  it.each([
    ["127.0.0.1", "loopback"],
    ["10.0.0.1", "private"],
    ["172.20.1.1", "private"],
    ["192.168.1.1", "private"],
    ["100.64.0.1", "reserved"],
    ["192.0.2.1", "reserved"],
    ["149.154.167.41", "public"],
    ["::1", "loopback"],
    ["fd00::1", "private"],
    ["2001:db8::1", "reserved"],
  ])("classifies %s as %s", (ip, expected) => {
    expect(classifyIpAddress(ip)).toBe(expected);
  });
});
