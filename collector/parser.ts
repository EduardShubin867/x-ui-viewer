import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { Network, XrayAccessEvent } from "@/lib/domain/access-event";

export interface ParseResult {
  event: XrayAccessEvent | null;
  recognized: boolean;
}

const datePrefix = /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+(.*)$/;
const sourcePattern = /\bfrom\s+(\[[^\]]+\]:\d+|\S+)/i;
const destinationPattern = /\baccepted\s+(tcp|udp):(.+?)\s+\[/i;
const tagsPattern = /\[\s*([^\]]*?)\s*>>\s*([^\]]*?)\s*\]/;
const emailPattern = /\bemail:\s*(.*?)(?=\s*,\s*Domain:|$)/i;
const domainPattern = /(?:^|,)\s*Domain:\s*([^,]+?)(?=\s*,|$)/i;

function parseTimestamp(match: RegExpMatchArray): Date {
  const [, year, month, day, hour, minute, second] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
}

export function parseHostPort(value: string): { host: string; port: number | null } {
  const trimmed = value.trim();
  const bracketed = trimmed.match(/^\[([^\]]+)](?::(\d+))?$/);
  if (bracketed) return { host: bracketed[1], port: bracketed[2] ? Number(bracketed[2]) : null };
  if (isIP(trimmed) === 6) return { host: trimmed, port: null };

  const lastColon = trimmed.lastIndexOf(":");
  if (lastColon > -1) {
    const possiblePort = trimmed.slice(lastColon + 1);
    if (/^\d+$/.test(possiblePort)) {
      return { host: trimmed.slice(0, lastColon), port: Number(possiblePort) };
    }
  }
  return { host: trimmed, port: null };
}

function eventId(rawLine: string, nodeId: string, occurredAt: string): string {
  return createHash("sha256").update(`${nodeId}\0${occurredAt}\0${rawLine}`).digest("hex");
}

export function parseXrayAccessLine(rawLine: string, nodeId: string): ParseResult {
  const line = rawLine.trimEnd();
  const dateMatch = line.match(datePrefix);
  if (!dateMatch) return { event: null, recognized: false };

  const occurredAt = parseTimestamp(dateMatch).toISOString();
  const source = line.match(sourcePattern)?.[1];
  const destination = line.match(destinationPattern);
  const tags = line.match(tagsPattern);
  const email = line.match(emailPattern)?.[1]?.trim() || null;
  const detectedDomain = line.match(domainPattern)?.[1]?.trim() || null;
  const sourceIp = source ? parseHostPort(source).host : null;
  const network = (destination?.[1]?.toLowerCase() ?? "unknown") as Network;
  const target = destination ? parseHostPort(destination[2]) : null;
  const targetKind = target ? isIP(target.host) : 0;
  const recognized = Boolean(source && destination && tags);

  return {
    recognized,
    event: {
      eventId: eventId(line, nodeId, occurredAt),
      occurredAt,
      nodeId,
      clientEmail: email,
      sourceIp,
      network,
      destinationHost: target && !targetKind ? target.host : null,
      destinationIp: target && targetKind ? target.host : null,
      destinationPort: target?.port ?? null,
      detectedDomain,
      inboundTag: tags?.[1]?.trim() || null,
      outboundTag: tags?.[2]?.trim() || null,
      rawLine: line,
    },
  };
}
