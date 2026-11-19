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

/** Public origins are explicit: never trust arbitrary forwarded host headers. */
export function getTrustedRequestOrigin(request: { headers: Headers; nextUrl: { origin: string } }): string {
  if (request.headers.get("sec-fetch-site") === "cross-site") return "";
  const trusted = new Set(["https://tikemia.com", "https://www.tikemia.com"]);
  for (const value of [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_SITE_URL, process.env.SITE_URL]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password) trusted.add(url.origin);
    } catch { /* An invalid setting cannot expand the allowlist. */ }
  }
  const origin = request.headers.get("origin");
  if (origin && trusted.has(origin)) return origin;
  return request.nextUrl.origin;
}
