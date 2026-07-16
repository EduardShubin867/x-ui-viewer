import type { ActivityBucket } from "./activity";

export interface RankedStat {
  label: string;
  value: number;
}

export interface ClientEventStat extends RankedStat {
  share: number;
  uniqueDestinations: number;
  firstActivity: string | null;
  lastActivity: string | null;
}

export interface EventStats {
  total: number;
  topDomains: RankedStat[];
  topClients: RankedStat[];
  topOutbounds: RankedStat[];
  networks: RankedStat[];
  clients: ClientEventStat[];
  activity: ActivityBucket[];
  range: {
    from: string;
    to: string;
    bucketMs: number;
  };
  unknownDomain: number;
  uniqueDestinations: number;
  ipOnly: Array<{
    destinationIp: string | null;
    occurredAt: string;
  }>;
  lastSourceIp: string | null;
  firstActivity: string | null;
  lastActivity: string | null;
}
