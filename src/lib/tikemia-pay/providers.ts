import "server-only";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as typeof globalThis & {
  tikemiaPayPrisma?: PrismaClient;
};

export function getPayPrisma(): PrismaClient {
  if (!globalForPrisma.tikemiaPayPrisma) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL est manquante.");
    }

    const adapter = new PrismaPg({ connectionString });

    globalForPrisma.tikemiaPayPrisma = new PrismaClient({
      adapter,
    });
  }

  return globalForPrisma.tikemiaPayPrisma;
}
