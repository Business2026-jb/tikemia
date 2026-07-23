import "server-only";

import { Prisma, type EventStatus } from "@prisma/client";
import { z } from "zod";

import {
  calculateEventRevenueProjection,
  DEFAULT_EVENT_CURRENCY,
  PricingValidationError,
  TIKEMIA_PLATFORM_FEE_PERCENT,
} from "@/lib/events/pricing";
import { prisma } from "@/lib/prisma";
import {
  removeEventImagesFromStorage,
  sanitizeStorageSegment,
} from "@/lib/supabase/admin";

const MAX_TICKET_TYPES = 20;
const MAX_EVENT_CAPACITY = 1_000_000;
const MAX_EVENT_IMAGES = 5;

const ticketTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom du billet doit contenir au moins 2 caractères.")
    .max(80, "Le nom du billet ne peut pas dépasser 80 caractères."),

  description: z
    .string()
    .trim()
    .max(
      500,
      "La description du billet ne peut pas dépasser 500 caractères.",
    )
    .optional()
    .nullable(),

  price: z.union([
    z
      .number()
      .finite("Le prix du billet n’est pas valide.")
      .nonnegative("Le prix du billet ne peut pas être négatif."),

    z
      .string()
      .trim()
      .min(1, "Le prix du billet est obligatoire."),
  ]),

  quantity: z
    .number()
    .int("La quantité doit être un nombre entier.")
    .min(1, "La quantité doit être supérieure à zéro.")
    .max(
      MAX_EVENT_CAPACITY,
      "La quantité renseignée est trop élevée.",
    ),

  maxPerOrder: z
    .number()
    .int("La limite par commande doit être un nombre entier.")
    .min(1, "La limite par commande doit être supérieure à zéro.")
    .max(100, "La limite par commande ne peut pas dépasser 100 billets.")
    .default(10),

  saleStartsAt: z.coerce.date().optional().nullable(),

  saleEndsAt: z.coerce.date().optional().nullable(),

  isActive: z.boolean().default(true),
});

const eventImageSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1, "Le chemin de l’image est obligatoire.")
    .max(1_000, "Le chemin de l’image est trop long."),

  publicUrl: z
    .string()
    .trim()
    .url("L’adresse publique de l’image n’est pas valide.")
    .max(2_000, "L’adresse publique de l’image est trop longue."),

  position: z
    .number()
    .int("La position de l’image doit être un entier.")
    .min(0, "La position de l’image est invalide.")
    .max(
      MAX_EVENT_IMAGES - 1,
      "La position de l’image est invalide.",
    ),

  isCover: z.boolean(),
});

const createEventSchema = z.object({
  organizerId: z
    .string()
    .trim()
    .min(1, "L’identifiant de l’organisateur est obligatoire."),

  categoryId: z
    .string()
    .trim()
    .min(1, "La catégorie de l’événement est obligatoire."),

  title: z
    .string()
    .trim()
    .min(3, "Le titre doit contenir au moins 3 caractères.")
    .max(140, "Le titre ne peut pas dépasser 140 caractères."),

  description: z
    .string()
    .trim()
    .min(
      30,
      "La description doit contenir au moins 30 caractères.",
    )
    .max(
      20_000,
      "La description de l’événement est trop longue.",
    ),

  coverImage: z
    .string()
    .trim()
    .url("L’adresse de l’image principale n’est pas valide.")
    .max(2_000, "L’adresse de l’image est trop longue.")
    .optional()
    .nullable(),

  images: z
    .array(eventImageSchema)
    .min(1, "Ajoutez au moins une image à l’événement.")
    .max(
      MAX_EVENT_IMAGES,
      `Un événement ne peut pas contenir plus de ${MAX_EVENT_IMAGES} images.`,
    ),

  venueName: z
    .string()
    .trim()
    .min(2, "Le nom du lieu est obligatoire.")
    .max(160, "Le nom du lieu est trop long."),

  address: z
    .string()
    .trim()
    .min(3, "L’adresse de l’événement est obligatoire.")
    .max(300, "L’adresse est trop longue."),

  city: z
    .string()
    .trim()
    .min(2, "La ville est obligatoire.")
    .max(100, "Le nom de la ville est trop long."),

  country: z
    .string()
    .trim()
    .min(2, "Le pays est obligatoire.")
    .max(100, "Le nom du pays est trop long."),

  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{2}$/,
      "Le code du pays doit contenir exactement 2 lettres.",
    ),

  timezone: z
    .string()
    .trim()
    .min(1, "Le fuseau horaire est obligatoire.")
    .max(100, "Le fuseau horaire est trop long."),

  startsAt: z.coerce.date(),

  endsAt: z.coerce.date().optional().nullable(),

  salesStartAt: z.coerce.date().optional().nullable(),

  salesEndAt: z.coerce.date().optional().nullable(),

  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{3}$/,
      "La devise doit contenir exactement 3 lettres.",
    )
    .default(DEFAULT_EVENT_CURRENCY),

  publicationMode: z
    .enum(["DRAFT", "SUBMIT"])
    .default("DRAFT"),

  ticketTypes: z
    .array(ticketTypeSchema)
    .min(
      1,
      "Ajoutez au moins un type de billet à l’événement.",
    )
    .max(
      MAX_TICKET_TYPES,
      `Un événement ne peut pas contenir plus de ${MAX_TICKET_TYPES} types de billets.`,
    ),
});

export type CreateEventInput = z.input<
  typeof createEventSchema
>;

export type CreatedEventTicketType = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  maxPerOrder: number;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  isActive: boolean;
};

export type CreatedEventImage = {
  id: string;
  path: string;
  publicUrl: string;
  position: number;
  isCover: boolean;
  createdAt: string;
};

export type CreateEventResult = {
  event: {
    id: string;
    title: string;
    slug: string;
    status: EventStatus;
    categoryId: string | null;
    coverImage: string | null;
    startsAt: string;
    endsAt: string | null;
    salesStartAt: string | null;
    salesEndAt: string | null;
    currency: string;
    capacity: number;
    platformFeeRate: number;
    createdAt: string;
  };

  category: {
    id: string;
    name: string;
    slug: string;
  };

  images: CreatedEventImage[];
  ticketTypes: CreatedEventTicketType[];

  projection: {
    currency: string;
    totalCapacity: number;
    averageTicketPrice: number;
    grossRevenue: number;
    platformFee: number;
    organizerNet: number;
  };
};

export class CreateEventError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string[]>;

  constructor({
    message,
    code,
    status = 400,
    fields,
  }: {
    message: string;
    code: string;
    status?: number;
    fields?: Record<string, string[]>;
  }) {
    super(message);
    this.name = "CreateEventError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function validateTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("fr-FR", {
      timeZone,
    }).format(new Date());
  } catch {
    throw new CreateEventError({
      code: "INVALID_TIMEZONE",
      status: 400,
      message: "Le fuseau horaire sélectionné n’est pas valide.",
      fields: {
        timezone: ["Le fuseau horaire sélectionné n’est pas valide."],
      },
    });
  }
}

function validateEventDates({
  startsAt,
  endsAt,
  salesStartAt,
  salesEndAt,
}: {
  startsAt: Date;
  endsAt: Date | null | undefined;
  salesStartAt: Date | null | undefined;
  salesEndAt: Date | null | undefined;
}): void {
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new CreateEventError({
      code: "INVALID_EVENT_END_DATE",
      message:
        "La date de fin doit être postérieure à la date de début.",
      fields: {
        endsAt: [
          "La date de fin doit être postérieure à la date de début.",
        ],
      },
    });
  }

  if (
    salesStartAt &&
    salesEndAt &&
    salesEndAt.getTime() <= salesStartAt.getTime()
  ) {
    throw new CreateEventError({
      code: "INVALID_SALES_END_DATE",
      message:
        "La date de fin des ventes doit être postérieure à leur date de début.",
      fields: {
        salesEndAt: [
          "La date de fin des ventes doit être postérieure à leur date de début.",
        ],
      },
    });
  }

  if (
    salesStartAt &&
    salesStartAt.getTime() >= startsAt.getTime()
  ) {
    throw new CreateEventError({
      code: "INVALID_SALES_START_DATE",
      message:
        "Les ventes doivent commencer avant le début de l’événement.",
      fields: {
        salesStartAt: [
          "Les ventes doivent commencer avant le début de l’événement.",
        ],
      },
    });
  }

  if (
    salesEndAt &&
    salesEndAt.getTime() > startsAt.getTime()
  ) {
    throw new CreateEventError({
      code: "INVALID_SALES_END_DATE",
      message:
        "Les ventes doivent se terminer au plus tard au début de l’événement.",
      fields: {
        salesEndAt: [
          "Les ventes doivent se terminer au plus tard au début de l’événement.",
        ],
      },
    });
  }
}

function validateTicketTypes({
  ticketTypes,
  eventStartsAt,
  eventSalesStartAt,
  eventSalesEndAt,
}: {
  ticketTypes: Array<z.output<typeof ticketTypeSchema>>;
  eventStartsAt: Date;
  eventSalesStartAt: Date | null | undefined;
  eventSalesEndAt: Date | null | undefined;
}): void {
  const normalizedNames = new Set<string>();

  ticketTypes.forEach((ticketType, index) => {
    const normalizedName = ticketType.name
      .trim()
      .toLocaleLowerCase("fr-FR");

    if (normalizedNames.has(normalizedName)) {
      throw new CreateEventError({
        code: "DUPLICATE_TICKET_TYPE",
        message: `Le type de billet « ${ticketType.name} » apparaît plusieurs fois.`,
        fields: {
          [`ticketTypes.${index}.name`]: [
            "Chaque type de billet doit avoir un nom unique.",
          ],
        },
      });
    }

    normalizedNames.add(normalizedName);

    if (
      ticketType.saleStartsAt &&
      ticketType.saleEndsAt &&
      ticketType.saleEndsAt.getTime() <=
        ticketType.saleStartsAt.getTime()
    ) {
      throw new CreateEventError({
        code: "INVALID_TICKET_SALE_DATES",
        message: `Les dates de vente du billet « ${ticketType.name} » ne sont pas valides.`,
        fields: {
          [`ticketTypes.${index}.saleEndsAt`]: [
            "La fin des ventes doit être postérieure au début.",
          ],
        },
      });
    }

    if (
      ticketType.saleStartsAt &&
      ticketType.saleStartsAt.getTime() >=
        eventStartsAt.getTime()
    ) {
      throw new CreateEventError({
        code: "INVALID_TICKET_SALE_START",
        message: `La vente du billet « ${ticketType.name} » doit commencer avant l’événement.`,
        fields: {
          [`ticketTypes.${index}.saleStartsAt`]: [
            "La vente doit commencer avant l’événement.",
          ],
        },
      });
    }

    if (
      ticketType.saleEndsAt &&
      ticketType.saleEndsAt.getTime() >
        eventStartsAt.getTime()
    ) {
      throw new CreateEventError({
        code: "INVALID_TICKET_SALE_END",
        message: `La vente du billet « ${ticketType.name} » doit se terminer au plus tard au début de l’événement.`,
        fields: {
          [`ticketTypes.${index}.saleEndsAt`]: [
            "La vente doit se terminer au plus tard au début de l’événement.",
          ],
        },
      });
    }

    if (
      eventSalesStartAt &&
      ticketType.saleStartsAt &&
      ticketType.saleStartsAt.getTime() <
        eventSalesStartAt.getTime()
    ) {
      throw new CreateEventError({
        code: "TICKET_SALE_BEFORE_EVENT_SALES",
        message: `La vente du billet « ${ticketType.name} » ne peut pas commencer avant l’ouverture générale des ventes.`,
        fields: {
          [`ticketTypes.${index}.saleStartsAt`]: [
            "Cette date précède l’ouverture générale des ventes.",
          ],
        },
      });
    }

    if (
      eventSalesEndAt &&
      ticketType.saleEndsAt &&
      ticketType.saleEndsAt.getTime() >
        eventSalesEndAt.getTime()
    ) {
      throw new CreateEventError({
        code: "TICKET_SALE_AFTER_EVENT_SALES",
        message: `La vente du billet « ${ticketType.name} » ne peut pas se terminer après la fermeture générale des ventes.`,
        fields: {
          [`ticketTypes.${index}.saleEndsAt`]: [
            "Cette date dépasse la fermeture générale des ventes.",
          ],
        },
      });
    }

    if (ticketType.maxPerOrder > ticketType.quantity) {
      throw new CreateEventError({
        code: "INVALID_MAX_PER_ORDER",
        message: `La limite par commande du billet « ${ticketType.name} » dépasse sa quantité disponible.`,
        fields: {
          [`ticketTypes.${index}.maxPerOrder`]: [
            "La limite par commande ne peut pas dépasser la quantité disponible.",
          ],
        },
      });
    }
  });
}

function validateEventImages({
  organizerId,
  images,
}: {
  organizerId: string;
  images: Array<z.output<typeof eventImageSchema>>;
}): void {
  const positions = new Set<number>();
  const paths = new Set<string>();
  const coverImages = images.filter((image) => image.isCover);

  if (coverImages.length !== 1) {
    throw new CreateEventError({
      code: "INVALID_EVENT_COVER_IMAGE",
      message:
        "Sélectionnez exactement une image principale pour l’événement.",
      fields: {
        images: [
          "Une seule image doit être définie comme image principale.",
        ],
      },
    });
  }

  const organizerStorageSegment =
    sanitizeStorageSegment(organizerId);

  const expectedPrefix =
    `organizers/${organizerStorageSegment}/events/`;

  images.forEach((image, index) => {
    if (positions.has(image.position)) {
      throw new CreateEventError({
        code: "DUPLICATE_IMAGE_POSITION",
        message:
          "Deux images utilisent la même position.",
        fields: {
          [`images.${index}.position`]: [
            "Chaque image doit avoir une position unique.",
          ],
        },
      });
    }

    if (paths.has(image.path)) {
      throw new CreateEventError({
        code: "DUPLICATE_IMAGE_PATH",
        message:
          "Une même image a été envoyée plusieurs fois.",
        fields: {
          [`images.${index}.path`]: [
            "Chaque image doit avoir un chemin unique.",
          ],
        },
      });
    }

    if (!image.path.startsWith(expectedPrefix)) {
      throw new CreateEventError({
        code: "INVALID_IMAGE_OWNER",
        status: 403,
        message:
          "Une image envoyée n’appartient pas à votre espace organisateur.",
        fields: {
          [`images.${index}.path`]: [
            "Le chemin de cette image n’est pas autorisé.",
          ],
        },
      });
    }

    positions.add(image.position);
    paths.add(image.path);
  });

  const sortedPositions = [...positions].sort((a, b) => a - b);

  sortedPositions.forEach((position, index) => {
    if (position !== index) {
      throw new CreateEventError({
        code: "INVALID_IMAGE_ORDER",
        message:
          "L’ordre des images n’est pas valide.",
        fields: {
          images: [
            "Les positions des images doivent commencer à 0 et se suivre.",
          ],
        },
      });
    }
  });
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "");

  return slug || "evenement";
}

async function generateUniqueEventSlug(
  transaction: Prisma.TransactionClient,
  title: string,
): Promise<string> {
  const baseSlug = slugify(title).slice(0, 120);

  const exactSlugExists = await transaction.event.findUnique({
    where: {
      slug: baseSlug,
    },
    select: {
      id: true,
    },
  });

  if (!exactSlugExists) {
    return baseSlug;
  }

  for (let suffix = 2; suffix <= 100; suffix += 1) {
    const suffixText = `-${suffix}`;
    const candidate = `${baseSlug.slice(
      0,
      140 - suffixText.length,
    )}${suffixText}`;

    const candidateExists = await transaction.event.findUnique({
      where: {
        slug: candidate,
      },
      select: {
        id: true,
      },
    });

    if (!candidateExists) {
      return candidate;
    }
  }

  const uniqueSuffix = crypto.randomUUID().slice(0, 8);

  return `${baseSlug.slice(
    0,
    131,
  )}-${uniqueSuffix}`;
}

function getEventStatus(
  publicationMode: "DRAFT" | "SUBMIT",
): EventStatus {
  /*
   * L’organisateur peut toujours conserver un brouillon.
   * Lorsqu’il choisit de mettre l’événement en ligne,
   * celui-ci est publié immédiatement sur Tikemia.
   *
   * L’administration conserve ensuite la possibilité
   * de suspendre, annuler ou archiver l’événement.
   */
  return publicationMode === "SUBMIT"
    ? "PUBLISHED"
    : "DRAFT";
}

function parseZodFields(
  error: z.ZodError,
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";

    fields[path] ??= [];
    fields[path].push(issue.message);
  }

  return fields;
}

export async function createEvent(
  input: CreateEventInput,
): Promise<CreateEventResult> {
  const validation = createEventSchema.safeParse(input);

  if (!validation.success) {
    throw new CreateEventError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Certaines informations de l’événement sont invalides.",
      fields: parseZodFields(validation.error),
    });
  }

  const data = validation.data;

  validateEventImages({
    organizerId: data.organizerId,
    images: data.images,
  });

  validateTimeZone(data.timezone);

  validateEventDates({
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    salesStartAt: data.salesStartAt,
    salesEndAt: data.salesEndAt,
  });

  validateTicketTypes({
    ticketTypes: data.ticketTypes,
    eventStartsAt: data.startsAt,
    eventSalesStartAt: data.salesStartAt,
    eventSalesEndAt: data.salesEndAt,
  });

  let projection;

  try {
    projection = calculateEventRevenueProjection(
      data.ticketTypes.map((ticketType) => ({
        name: ticketType.name,
        unitPrice: ticketType.price,
        quantity: ticketType.quantity,
      })),
      {
        currency: data.currency,
        platformFeePercent:
          TIKEMIA_PLATFORM_FEE_PERCENT,
      },
    );
  } catch (error) {
    if (error instanceof PricingValidationError) {
      throw new CreateEventError({
        code: "PRICING_ERROR",
        status: 400,
        message: error.message,
      });
    }

    throw error;
  }

  if (
    projection.totalCapacity < 1 ||
    projection.totalCapacity > MAX_EVENT_CAPACITY
  ) {
    throw new CreateEventError({
      code: "INVALID_EVENT_CAPACITY",
      message: `La capacité totale doit être comprise entre 1 et ${MAX_EVENT_CAPACITY.toLocaleString(
        "fr-FR",
      )} billets.`,
      fields: {
        ticketTypes: [
          "La capacité totale de l’événement n’est pas valide.",
        ],
      },
    });
  }

  const organizer = await prisma.user.findFirst({
    where: {
      id: data.organizerId,
      role: "ORGANIZER",
      emailVerified: true,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!organizer) {
    throw new CreateEventError({
      code: "ORGANIZER_NOT_ALLOWED",
      status: 403,
      message:
        "Votre compte organisateur n’est pas autorisé à créer un événement.",
    });
  }

  const category = await prisma.eventCategory.findFirst({
    where: {
      id: data.categoryId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!category) {
    throw new CreateEventError({
      code: "CATEGORY_NOT_FOUND",
      status: 404,
      message:
        "La catégorie sélectionnée est introuvable ou inactive.",
      fields: {
        categoryId: [
          "Sélectionnez une catégorie Tikemia valide.",
        ],
      },
    });
  }

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const slug = await generateUniqueEventSlug(
          transaction,
          data.title,
        );

        const status = getEventStatus(
          data.publicationMode,
        );

        const publicationDate =
          status === "PUBLISHED"
            ? new Date()
            : null;

        const coverImage =
          data.images.find((image) => image.isCover) ??
          data.images[0];

        const createdEvent =
          await transaction.event.create({
            data: {
              organizerId: organizer.id,
              categoryId: category.id,
              title: data.title,
              slug,
              description: data.description,
              coverImage: coverImage.publicUrl,
              venueName: data.venueName,
              address: data.address,
              city: data.city,
              country: data.country,
              countryCode: data.countryCode,
              timezone: data.timezone,
              startsAt: data.startsAt,
              endsAt: data.endsAt ?? null,
              salesStartAt:
                data.salesStartAt ?? null,
              salesEndAt:
                data.salesEndAt ?? null,
              currency: data.currency,
              platformFeeRate:
                new Prisma.Decimal(
                  TIKEMIA_PLATFORM_FEE_PERCENT,
                ),
              capacity:
                projection.totalCapacity,
              status,
              submittedAt: publicationDate,
              publishedAt: publicationDate,

              images: {
                create: data.images.map((image) => ({
                  path: image.path,
                  publicUrl: image.publicUrl,
                  position: image.position,
                  isCover: image.isCover,
                })),
              },

              ticketTypes: {
                create: data.ticketTypes.map(
                  (ticketType) => ({
                    name: ticketType.name,
                    description:
                      normalizeOptionalText(
                        ticketType.description,
                      ),
                    price: new Prisma.Decimal(
                      String(ticketType.price)
                        .trim()
                        .replace(",", "."),
                    ),
                    quantity:
                      ticketType.quantity,
                    maxPerOrder:
                      ticketType.maxPerOrder,
                    saleStartsAt:
                      ticketType.saleStartsAt ??
                      data.salesStartAt ??
                      null,
                    saleEndsAt:
                      ticketType.saleEndsAt ??
                      data.salesEndAt ??
                      null,
                    isActive:
                      ticketType.isActive,
                  }),
                ),
              },
            },

            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              categoryId: true,
              coverImage: true,
              startsAt: true,
              endsAt: true,
              salesStartAt: true,
              salesEndAt: true,
              currency: true,
              capacity: true,
              platformFeeRate: true,
              createdAt: true,

              images: {
                orderBy: {
                  position: "asc",
                },
                select: {
                  id: true,
                  path: true,
                  publicUrl: true,
                  position: true,
                  isCover: true,
                  createdAt: true,
                },
              },

              ticketTypes: {
                orderBy: {
                  createdAt: "asc",
                },

                select: {
                  id: true,
                  name: true,
                  description: true,
                  price: true,
                  quantity: true,
                  maxPerOrder: true,
                  saleStartsAt: true,
                  saleEndsAt: true,
                  isActive: true,
                },
              },
            },
          });

        await transaction.organizerActivity.create({
          data: {
            organizerId: organizer.id,
            eventId: createdEvent.id,
            type:
              status === "DRAFT"
                ? "EVENT_CREATED"
                : "EVENT_PUBLISHED",
            title:
              status === "DRAFT"
                ? "Nouvel événement créé"
                : "Événement publié",
            description:
              status === "DRAFT"
                ? `L’événement « ${createdEvent.title} » a été enregistré comme brouillon.`
                : `L’événement « ${createdEvent.title} » a été publié immédiatement sur Tikemia.`,
            currency: createdEvent.currency,
            metadata: {
              eventStatus: status,
              categoryId: category.id,
              categoryName: category.name,
              images:
                createdEvent.images.length,
              ticketTypes:
                createdEvent.ticketTypes.length,
              totalCapacity:
                createdEvent.capacity,
              platformFeeRate:
                TIKEMIA_PLATFORM_FEE_PERCENT,
              projectedGrossRevenue:
                projection.grossRevenue,
              projectedPlatformFee:
                projection.platformFee,
              projectedOrganizerNet:
                projection.organizerNet,
            },
          },
        });

        return {
          event: {
            id: createdEvent.id,
            title: createdEvent.title,
            slug: createdEvent.slug,
            status: createdEvent.status,
            categoryId:
              createdEvent.categoryId,
            coverImage:
              createdEvent.coverImage,
            startsAt:
              createdEvent.startsAt.toISOString(),
            endsAt:
              createdEvent.endsAt?.toISOString() ??
              null,
            salesStartAt:
              createdEvent.salesStartAt?.toISOString() ??
              null,
            salesEndAt:
              createdEvent.salesEndAt?.toISOString() ??
              null,
            currency:
              createdEvent.currency,
            capacity:
              createdEvent.capacity,
            platformFeeRate: Number(
              createdEvent.platformFeeRate,
            ),
            createdAt:
              createdEvent.createdAt.toISOString(),
          },

          category,

          images: createdEvent.images.map((image) => ({
            id: image.id,
            path: image.path,
            publicUrl: image.publicUrl,
            position: image.position,
            isCover: image.isCover,
            createdAt: image.createdAt.toISOString(),
          })),

          ticketTypes:
            createdEvent.ticketTypes.map(
              (ticketType) => ({
                id: ticketType.id,
                name: ticketType.name,
                description:
                  ticketType.description,
                price: Number(ticketType.price),
                quantity:
                  ticketType.quantity,
                maxPerOrder:
                  ticketType.maxPerOrder,
                saleStartsAt:
                  ticketType.saleStartsAt?.toISOString() ??
                  null,
                saleEndsAt:
                  ticketType.saleEndsAt?.toISOString() ??
                  null,
                isActive:
                  ticketType.isActive,
              }),
            ),

          projection: {
            currency: projection.currency,
            totalCapacity:
              projection.totalCapacity,
            averageTicketPrice:
              projection.averageTicketPrice,
            grossRevenue:
              projection.grossRevenue,
            platformFee:
              projection.platformFee,
            organizerNet:
              projection.organizerNet,
          },
        };
      },
      {
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  } catch (error) {
    await removeEventImagesFromStorage(
      data.images.map((image) => image.path),
    ).catch((cleanupError: unknown) => {
      console.error(
        "[CREATE_EVENT_IMAGE_CLEANUP_ERROR]",
        cleanupError instanceof Error
          ? cleanupError.message
          : cleanupError,
      );
    });

    if (error instanceof CreateEventError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      if (error.code === "P2002") {
        throw new CreateEventError({
          code: "EVENT_ALREADY_EXISTS",
          status: 409,
          message:
            "Un événement utilisant déjà ces informations existe.",
        });
      }

      if (error.code === "P2003") {
        throw new CreateEventError({
          code: "INVALID_EVENT_RELATION",
          status: 400,
          message:
            "Une information liée à l’événement n’est plus disponible.",
        });
      }
    }

    console.error(
      "[CREATE_EVENT_SERVICE_ERROR]",
      error instanceof Error
        ? error.message
        : error,
    );

    throw new CreateEventError({
      code: "CREATE_EVENT_FAILED",
      status: 500,
      message:
        "Impossible de créer l’événement pour le moment. Réessayez.",
    });
  }
}