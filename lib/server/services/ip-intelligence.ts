import "server-only";
import { reverse } from "node:dns/promises";
import {
  classifyIpAddress,
  type IpIntelligence,
} from "@/lib/domain/ip-intelligence";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: IpIntelligence }>();

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function entityName(payload: Record<string, unknown>): string | null {
  const entities = Array.isArray(payload.entities) ? payload.entities : [];
  const ordered = [...entities].sort((left, right) => {
    const leftRoles = object(left)?.roles;
    const rightRoles = object(right)?.roles;
    const leftRegistrant =
      Array.isArray(leftRoles) && leftRoles.includes("registrant");
    const rightRegistrant =
      Array.isArray(rightRoles) && rightRoles.includes("registrant");
    return Number(rightRegistrant) - Number(leftRegistrant);
  });

  for (const candidate of ordered) {
    const vcard = object(candidate)?.vcardArray;
    if (!Array.isArray(vcard) || !Array.isArray(vcard[1])) continue;
    for (const preferredKind of ["org", "fn"]) {
      for (const property of vcard[1]) {
        if (Array.isArray(property) && property[0] === preferredKind) {
          const value = text(property[3]);
          if (value) return value;
        }
      }
    }
  }
  return null;
}

function friendlyOwner(
  networkName: string | null,
  handle: string | null,
  entity: string | null,
): string {
  const fingerprint = [networkName, handle, entity]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  if (fingerprint.includes("TELEGRAM")) return "Telegram";
  if (fingerprint.includes("GOOGLE") || fingerprint.includes("GOGL"))
    return "Google LLC";
  if (fingerprint.includes("BLIZZARD")) return "Blizzard Entertainment";
  if (entity && !entity.toUpperCase().startsWith("MNT-")) return entity;
  return networkName ?? handle ?? "Владелец не указан";
}

async function lookupReverseDns(ip: string): Promise<string[]> {
  try {
    return await reverse(ip);
  } catch {
    return [];
  }
}

function localResult(
  ip: string,
  scope: Exclude<ReturnType<typeof classifyIpAddress>, "public">,
): IpIntelligence {
  const owner =
    scope === "loopback"
      ? "Локальный сервис на сервере"
      : scope === "private"
        ? "Приватная сеть"
        : "Служебный или зарезервированный адрес";
  return {
    ip,
    scope,
    owner,
    networkName: null,
    country: null,
    range: null,
    reverseDns: [],
    sourceUrl: null,
  };
}

export async function getIpIntelligence(ip: string): Promise<IpIntelligence> {
  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const scope = classifyIpAddress(ip);
  if (scope !== "public") {
    const value = localResult(ip, scope);
    cache.set(ip, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  }

  const [response, reverseDns] = await Promise.all([
    fetch(`https://rdap.org/ip/${encodeURIComponent(ip)}`, {
      headers: {
        Accept: "application/rdap+json, application/json",
        "User-Agent": "Xray-Scope/1.0",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    }),
    lookupReverseDns(ip),
  ]);
  if (!response.ok) throw new Error(`RDAP returned HTTP ${response.status}`);

  const payload = object(await response.json());
  if (!payload) throw new Error("RDAP returned an invalid response");
  const networkName = text(payload.name);
  const handle = text(payload.handle);
  const startAddress = text(payload.startAddress);
  const endAddress = text(payload.endAddress);
  const value: IpIntelligence = {
    ip,
    scope,
    owner: friendlyOwner(networkName, handle, entityName(payload)),
    networkName,
    country: text(payload.country),
    range:
      startAddress && endAddress ? `${startAddress} — ${endAddress}` : null,
    reverseDns,
    sourceUrl: response.url || `https://rdap.org/ip/${encodeURIComponent(ip)}`,
  };
  cache.set(ip, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}
