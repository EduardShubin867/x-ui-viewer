CREATE TABLE "Node" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "panelUrl" TEXT,
  "panelBasePath" TEXT,
  "apiToken" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncAt" TIMESTAMP(3),
  "syncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "XrayClient" (
  "id" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "inboundId" TEXT,
  "inboundTag" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "XrayClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessEvent" (
  "id" BIGSERIAL NOT NULL,
  "eventId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "nodeId" TEXT NOT NULL,
  "clientEmail" TEXT,
  "sourceIp" TEXT,
  "network" TEXT NOT NULL,
  "destinationHost" TEXT,
  "destinationIp" TEXT,
  "destinationPort" INTEGER,
  "detectedDomain" TEXT,
  "inboundTag" TEXT,
  "outboundTag" TEXT,
  "rawLine" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Node_slug_key" ON "Node"("slug");
CREATE UNIQUE INDEX "XrayClient_nodeId_email_key" ON "XrayClient"("nodeId", "email");
CREATE INDEX "XrayClient_email_idx" ON "XrayClient"("email");
CREATE UNIQUE INDEX "AccessEvent_eventId_key" ON "AccessEvent"("eventId");
CREATE INDEX "AccessEvent_occurredAt_idx" ON "AccessEvent"("occurredAt");
CREATE INDEX "AccessEvent_nodeId_occurredAt_idx" ON "AccessEvent"("nodeId", "occurredAt");
CREATE INDEX "AccessEvent_clientEmail_occurredAt_idx" ON "AccessEvent"("clientEmail", "occurredAt");
CREATE INDEX "AccessEvent_destinationHost_occurredAt_idx" ON "AccessEvent"("destinationHost", "occurredAt");
CREATE INDEX "AccessEvent_detectedDomain_occurredAt_idx" ON "AccessEvent"("detectedDomain", "occurredAt");
ALTER TABLE "XrayClient" ADD CONSTRAINT "XrayClient_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessEvent" ADD CONSTRAINT "AccessEvent_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
