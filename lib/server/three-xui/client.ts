import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/server/logger";

export interface ThreeXuiInbound {
  id: string;
  tag: string | null;
  enabled: boolean;
  clients: { email: string; enabled: boolean; metadata: Prisma.InputJsonObject }[];
}

export interface ThreeXuiClient {
  getInbounds(): Promise<ThreeXuiInbound[]>;
  getOnlineClients(): Promise<string[]>;
  getClientTraffic(): Promise<unknown>;
}

const envelopeSchema = z.object({ success: z.boolean().optional(), msg: z.string().optional(), obj: z.unknown().optional() }).passthrough();
const inboundSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  tag: z.string().nullable().optional(),
  enable: z.boolean().optional(),
  settings: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
}).passthrough();

const ENDPOINTS = {
  inbounds: "/panel/api/inbounds/list",
  onlineClients: "/panel/api/inbounds/onlines",
  clientTraffic: "/panel/api/inbounds/getClientTraffics",
} as const;

function joinUrl(panelUrl: string, basePath: string | null, endpoint: string): string {
  return `${panelUrl.replace(/\/$/, "")}/${(basePath ?? "").replace(/^\/+|\/+$/g, "")}${endpoint}`.replace(/([^:]\/)\/+/g, "$1");
}

function parseClients(settings: string | Record<string, unknown> | undefined): ThreeXuiInbound["clients"] {
  let value: unknown = settings;
  if (typeof settings === "string") {
    try { value = JSON.parse(settings); } catch { return []; }
  }
  const parsed = z.object({ clients: z.array(z.object({ email: z.string().min(1), enable: z.boolean().optional() }).passthrough()).default([]) }).safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.clients.map((client) => ({
    email: client.email,
    enabled: client.enable ?? true,
    metadata: z.record(z.string(), z.json()).parse(client),
  }));
}

export class ThreeXuiHttpClient implements ThreeXuiClient {
  constructor(private readonly config: { panelUrl: string; panelBasePath: string | null; apiToken: string }) {}

  private async request(endpoint: string): Promise<unknown> {
    const url = joinUrl(this.config.panelUrl, this.config.panelBasePath, endpoint);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.apiToken}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const raw: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      logger.warn({ status: response.status, endpoint, response: raw }, "3x-ui request failed");
      throw new Error(`3x-ui returned HTTP ${response.status}`);
    }
    const envelope = envelopeSchema.safeParse(raw);
    if (!envelope.success) throw new Error("Unexpected 3x-ui response");
    if (envelope.data.success === false) throw new Error(envelope.data.msg || "3x-ui request failed");
    return envelope.data.obj ?? raw;
  }

  async getInbounds(): Promise<ThreeXuiInbound[]> {
    const response = await this.request(ENDPOINTS.inbounds);
    const parsed = z.array(inboundSchema).safeParse(response);
    if (!parsed.success) throw new Error("Unexpected 3x-ui inbounds response");
    return parsed.data.map((inbound) => ({
      id: inbound.id,
      tag: inbound.tag ?? null,
      enabled: inbound.enable ?? true,
      clients: parseClients(inbound.settings),
    }));
  }

  async getOnlineClients(): Promise<string[]> {
    const response = await this.request(ENDPOINTS.onlineClients);
    return z.array(z.string()).parse(response);
  }

  getClientTraffic(): Promise<unknown> {
    return this.request(ENDPOINTS.clientTraffic);
  }
}
