export type IpScope = "public" | "loopback" | "private" | "reserved";

export interface IpIntelligence {
  ip: string;
  scope: IpScope;
  owner: string;
  networkName: string | null;
  country: string | null;
  range: string | null;
  reverseDns: string[];
  sourceUrl: string | null;
}

function ipv4Octets(ip: string): number[] | null {
  const octets = ip.split(".").map(Number);
  return octets.length === 4 &&
    octets.every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 255,
    )
    ? octets
    : null;
}

export function classifyIpAddress(ip: string): IpScope {
  const octets = ipv4Octets(ip);
  if (octets) {
    const [a, b, c] = octets;
    if (a === 127) return "loopback";
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
      return "private";
    if (
      a === 0 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    )
      return "reserved";
    return "public";
  }

  const normalized = ip.toLowerCase();
  if (normalized === "::1") return "loopback";
  if (normalized === "::" || normalized.startsWith("2001:db8:"))
    return "reserved";
  if (normalized.startsWith("fc") || normalized.startsWith("fd"))
    return "private";
  if (/^fe[89ab]/.test(normalized) || normalized.startsWith("ff"))
    return "reserved";
  return "public";
}
