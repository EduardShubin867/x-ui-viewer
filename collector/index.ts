import { readCollectorConfig } from "./config";
import { XrayLogCollector } from "./collector";

const collector = new XrayLogCollector(readCollectorConfig());
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => collector.stop());
}

collector.run().catch((error: unknown) => {
  console.error(JSON.stringify({ level: "fatal", message: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
