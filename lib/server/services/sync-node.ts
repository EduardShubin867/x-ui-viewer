import "server-only";
import { db } from "@/lib/server/db";
import { logger } from "@/lib/server/logger";
import { ThreeXuiHttpClient } from "@/lib/server/three-xui/client";

export async function syncNode(nodeId: string): Promise<{ clients: number; online: number; syncedAt: string }> {
  const node = await db.node.findUnique({ where: { id: nodeId } });
  if (!node) throw new Error("Node not found");
  if (!node.panelUrl || !node.apiToken) throw new Error("Node panel URL and API token are required");

  // MVP stores the token in plaintext. Keep this access server-only; encrypt at rest in a later release.
  const client = new ThreeXuiHttpClient({ panelUrl: node.panelUrl, panelBasePath: node.panelBasePath, apiToken: node.apiToken });
  try {
    const [inbounds, online] = await Promise.all([client.getInbounds(), client.getOnlineClients()]);
    const onlineSet = new Set(online);
    let clients = 0;
    await db.$transaction(async (tx) => {
      for (const inbound of inbounds) {
        for (const item of inbound.clients) {
          clients += 1;
          await tx.xrayClient.upsert({
            where: { nodeId_email: { nodeId: node.id, email: item.email } },
            update: { inboundId: inbound.id, inboundTag: inbound.tag, enabled: item.enabled, metadata: item.metadata },
            create: { nodeId: node.id, email: item.email, inboundId: inbound.id, inboundTag: inbound.tag, enabled: item.enabled, metadata: item.metadata },
          });
        }
      }
      await tx.node.update({ where: { id: node.id }, data: { lastSyncAt: new Date(), syncError: null } });
    });
    return { clients, online: onlineSet.size, syncedAt: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await db.node.update({ where: { id: node.id }, data: { syncError: message } });
    logger.error({ nodeId: node.id, error: message }, "3x-ui node sync failed");
    throw error;
  }
}
