import { describe, expect, it } from "vitest";
import { parseHostPort, parseXrayAccessLine } from "./parser";

const parse = (line: string) => parseXrayAccessLine(line, "finland-1");

describe("Xray access log parser", () => {
  it("parses a TCP domain", () => {
    const result = parse("2026/07/15 21:13:04 from 1.2.3.4:52133 accepted tcp:api.openai.com:443 [inbound-443 >> direct] email: eduard");
    expect(result.recognized).toBe(true);
    expect(result.event).toMatchObject({ sourceIp: "1.2.3.4", network: "tcp", destinationHost: "api.openai.com", destinationPort: 443, clientEmail: "eduard" });
  });

  it("parses IPv4 and a detected Domain", () => {
    const result = parse("2026/07/15 21:13:04 from 1.2.3.4:52133 accepted tcp:104.18.33.45:443 [inbound-443 >> direct] email: eduard, Domain: api.openai.com");
    expect(result.event).toMatchObject({ destinationIp: "104.18.33.45", destinationHost: null, detectedDomain: "api.openai.com" });
  });

  it("parses bracketed IPv6 without splitting on every colon", () => {
    const result = parse("2026/07/15 21:13:04 from [2001:db8::2]:52133 accepted tcp:[2001:db8::1]:443 [vless in >> freedom out] email: ipv6");
    expect(result.event).toMatchObject({ sourceIp: "2001:db8::2", destinationIp: "2001:db8::1", destinationPort: 443, inboundTag: "vless in", outboundTag: "freedom out" });
    expect(parseHostPort("2001:db8::1")).toEqual({ host: "2001:db8::1", port: null });
  });

  it("parses UDP without email", () => {
    const result = parse("2026/07/15 21:13:04 from 1.2.3.4:52133 accepted udp:8.8.8.8:53 [dns inbound >> dns-out]");
    expect(result.event).toMatchObject({ network: "udp", clientEmail: null, destinationIp: "8.8.8.8", inboundTag: "dns inbound", outboundTag: "dns-out" });
  });

  it("tolerates extra spaces, nonstandard tags and commas", () => {
    const result = parse("2026/07/15 21:13:04   from 1.2.3.4:55 accepted tcp:example.com:80 [ custom, in   >>   proxy, eu ] email: user, one, Domain: example.com");
    expect(result.event).toMatchObject({ inboundTag: "custom, in", outboundTag: "proxy, eu", clientEmail: "user, one", detectedDomain: "example.com" });
  });

  it("returns a partial event for an unknown timestamped line", () => {
    const result = parse("2026/07/15 21:13:04 strange future format");
    expect(result.recognized).toBe(false);
    expect(result.event).toMatchObject({ network: "unknown", rawLine: "2026/07/15 21:13:04 strange future format" });
  });

  it("ignores a damaged line without a timestamp", () => {
    expect(parse("damaged line")).toEqual({ event: null, recognized: false });
  });

  it("generates deterministic ids for duplicate lines", () => {
    const line = "2026/07/15 21:13:04 from 1.2.3.4:1 accepted tcp:a.test:443 [in >> out]";
    expect(parse(line).event?.eventId).toBe(parse(line).event?.eventId);
    expect(parseXrayAccessLine(line, "other").event?.eventId).not.toBe(parse(line).event?.eventId);
  });
});
