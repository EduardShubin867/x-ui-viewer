CREATE TABLE "ClientTraffic" (
  "id" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "uplinkBytes" BIGINT NOT NULL DEFAULT 0,
  "downlinkBytes" BIGINT NOT NULL DEFAULT 0,
  "uplinkRateBps" BIGINT NOT NULL DEFAULT 0,
  "downlinkRateBps" BIGINT NOT NULL DEFAULT 0,
  "online" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientTraffic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientTraffic_nodeId_email_key" ON "ClientTraffic"("nodeId", "email");
CREATE INDEX "ClientTraffic_email_idx" ON "ClientTraffic"("email");
CREATE INDEX "ClientTraffic_observedAt_idx" ON "ClientTraffic"("observedAt");
ALTER TABLE "ClientTraffic" ADD CONSTRAINT "ClientTraffic_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
