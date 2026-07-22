import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { TIKEMIA_EVENT_CATEGORIES } from "../lib/events/categories";

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["error", "warn"]
      : ["error"],
});

async function seedEventCategories(): Promise<void> {
  console.log(
    `[TIKEMIA_SEED] Synchronisation de ${TIKEMIA_EVENT_CATEGORIES.length} catégories...`,
  );

  const results = await prisma.$transaction(
    TIKEMIA_EVENT_CATEGORIES.map((category) =>
      prisma.eventCategory.upsert({
        where: {
          slug: category.slug,
        },

        update: {
          name: category.name,
          description: category.description,
          icon: category.icon,
          isActive: true,
        },

        create: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          isActive: true,
        },

        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      }),
    ),
  );

  console.log(
    `[TIKEMIA_SEED] ${results.length} catégories synchronisées avec succès.`,
  );
}

async function main(): Promise<void> {
  console.log("[TIKEMIA_SEED] Démarrage...");

  await seedEventCategories();

  console.log("[TIKEMIA_SEED] Terminé avec succès.");
}

main()
  .catch((error: unknown) => {
    console.error("[TIKEMIA_SEED_ERROR]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });