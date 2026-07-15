import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";

async function main(): Promise<void> {
  const hours = z.coerce.number().int().positive().default(72).parse(process.env.EVENT_RETENTION_HOURS);
  const connectionString = z.string().min(1).parse(process.env.DATABASE_URL);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  try {
    const result = await db.accessEvent.deleteMany({ where: { occurredAt: { lt: cutoff } } });
    console.log(JSON.stringify({ level: "info", message: "expired access events removed", deleted: result.count, cutoff: cutoff.toISOString() }));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ level: "error", message: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
