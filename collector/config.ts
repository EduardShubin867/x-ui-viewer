import { z } from "zod";

const configSchema = z.object({
  XRAY_ACCESS_LOG_PATH: z.string().min(1).default("/var/log/xray/access.log"),
  NODE_ID: z.string().min(1),
  WEB_API_URL: z.url(),
  COLLECTOR_TOKEN: z.string().min(1),
  COLLECTOR_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
  COLLECTOR_FLUSH_INTERVAL_MS: z.coerce.number().int().min(100).default(1000),
  COLLECTOR_STATE_PATH: z.string().min(1).default("/data/collector-state.json"),
  COLLECTOR_MAX_QUEUE_SIZE: z.coerce.number().int().min(500).default(10_000),
});

export type CollectorConfig = z.infer<typeof configSchema>;

export function readCollectorConfig(env: NodeJS.ProcessEnv = process.env): CollectorConfig {
  return configSchema.parse(env);
}
