import "server-only";

import {
  EventStatus,
  OrganizerActivityType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

import {
  TIKEMIA_PLATFORM_FEE_PERCENT,
} from "@/lib/events/pricing";
import {
  getCountryByCode,
} from "@/lib/localization/countries";
import {
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import {
  getCurrencyDecimals,
  roundMoneyAmount,
} from "@/lib/localization/format-money";
import { prisma } from "@/lib/prisma";
import {
  removeEventImagesFromStorage,
  sanitizeStorageSegment,
} from "@/lib/supabase/admin";

const MAX_EVENT_IMAGES = 5;
const MAX_TICKET_TYPES = 20;
const MAX_EVENT_CAPACITY = 1_000_000;
const MAX_TICKET_PRICE = 1_000_000_000;

const EDITABLE_EVENT_STATUSES: readonly EventStatus[] = [
  "DRAFT",
  "PENDING",
  "PUBLISHED",
  "SUSPENDED",
];

const eventImageSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable(),

  path: z
    .string()
    .trim()
    .min(1, "Le chemin de l’image est obligatoire.")
    .max(1_000, "Le chemin de l’image est trop long."),

  publicUrl: z
    .string()
    .trim()
    .url("L’adresse publique de l’image est invalide.")
    .max(
      2_000,
      "L’adresse publique de l’image est trop longue.",
    ),

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

const ticketTypeSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable(),

  name: z
    .string()
    .trim()
    .min(
      2,
      "Le nom du billet doit contenir au moins 2 caractères.",
    )
    .max(
      80,
      "Le nom du billet ne peut pas dépasser 80 caractères.",
    ),

  description: z
    .string()
    .trim()
    .max(
      500,
      "La description du billet est trop longue.",
    )
    .optional()
    .nullable(),

  price: z.union([
    z
      .number()
      .finite("Le prix du billet est invalide.")
      .min(
        0,
        "Le prix du billet ne peut pas être négatif.",
      )
      .max(
        MAX_TICKET_PRICE,
        "Le prix du billet est trop élevé.",
      ),

    z
      .string()
      .trim()
      .min(
        1,
        "Le prix du billet est obligatoire.",
      ),
  ]),

  quantity: z
    .number()
    .int("La quantité doit être un nombre entier.")
    .min(
      1,
      "La quantité d’un billet doit être supérieure à zéro.",
    )
    .max(
      MAX_EVENT_CAPACITY,
      "La quantité du billet est trop élevée.",
    ),

  maxPerOrder: z
    .number()
    .int(
      "La limite par commande doit être un nombre entier.",
    )
    .min(
      1,
      "La limite par commande doit être supérieure à zéro.",
    )
    .max(
      100,
      "La limite par commande ne peut pas dépasser 100 billets.",
    ),

  saleStartsAt: z
    .string()
    .trim()
    .optional()
    .nullable(),

  saleEndsAt: z
    .string()
    .trim()
    .optional()
    .nullable(),

  isActive: z.boolean().default(true),
});

const updateEventSchema = z.object({
  eventId: z
    .string()
    .trim()
    .min(
      1,
      "L’identifiant de l’événement est obligatoire.",
    ),

  organizerId: z
    .string()
    .trim()
    .min(
      1,
      "L’identifiant de l’organisateur est obligatoire.",
    ),

  categoryId: z
    .string()
    .trim()
    .min(
      1,
      "Sélectionnez une catégorie.",
    ),

  title: z
    .string()
    .trim()
    .min(
      3,
      "Le titre doit contenir au moins 3 caractères.",
    )
    .max(
      140,
      "Le titre ne peut pas dépasser 140 caractères.",
    ),

  description: z
    .string()
    .trim()
    .min(
      30,
      "La description doit contenir au moins 30 caractères.",
    )
    .max(
      20_000,
      "La description ne peut pas dépasser 20 000 caractères.",
    ),

  venueName: z
    .string()
    .trim()
    .min(
      2,
      "Le nom du lieu est obligatoire.",
    )
    .max(
      160,
      "Le nom du lieu ne peut pas dépasser 160 caractères.",
    ),

  address: z
    .string()
    .trim()
    .min(
      3,
      "L’adresse complète est obligatoire.",
    )
    .max(
      300,
      "L’adresse ne peut pas dépasser 300 caractères.",
    ),

  city: z
    .string()
    .trim()
    .min(
      2,
      "La ville est obligatoire.",
    )
    .max(
      100,
      "Le nom de la ville est trop long.",
    ),

  country: z
    .string()
    .trim()
    .min(
      2,
      "Le pays est obligatoire.",
    )
    .max(
      100,
      "Le nom du pays est trop long.",
    ),

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
    .min(
      1,
      "Le fuseau horaire est obligatoire.",
    )
    .max(
      100,
      "Le fuseau horaire est invalide.",
    ),

  startsAt: z
    .string()
    .trim()
    .min(
      1,
      "La date et l’heure de début sont obligatoires.",
    ),

  endsAt: z
    .string()
    .trim()
    .optional()
    .nullable(),

  salesStartAt: z
    .string()
    .trim()
    .optional()
    .nullable(),

  salesEndAt: z
    .string()
    .trim()
    .optional()
    .nullable(),

  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{3}$/,
      "La devise doit contenir exactement 3 lettres.",
    ),

  publicationMode: z.enum([
    "SAVE",
    "SUBMIT",
  ]),

  images: z
    .array(eventImageSchema)
    .min(
      1,
      "Ajoutez au moins une image à l’événement.",
    )
    .max(
      MAX_EVENT_IMAGES,
      `Vous pouvez enregistrer au maximum ${MAX_EVENT_IMAGES} images.`,
    ),

  ticketTypes: z
    .array(ticketTypeSchema)
    .min(
      1,
      "Ajoutez au moins un type de billet.",
    )
    .max(
      MAX_TICKET_TYPES,
      `Vous pouvez créer au maximum ${MAX_TICKET_TYPES} types de billets.`,
    ),
});

export type UpdateEventInput =
  z.input<typeof updateEventSchema>;

export type UpdatedEventImage = {
  id: string;
  path: string;
  publicUrl: string;
  position: number;
  isCover: boolean;
};

export type UpdatedEventTicketType = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  maxPerOrder: number;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  isActive: boolean;
  soldCount: number;
};

export type UpdateEventResult = {
  event: {
    id: string;
    title: string;
    slug: string;
    status: EventStatus;
    coverImage: string;
    currency: SupportedCurrencyCode;
    capacity: number;
    updatedAt: string;
    images: UpdatedEventImage[];
    ticketTypes: UpdatedEventTicketType[];
  };

  redirectTo: string;
  message: string;
};

type UpdateEventErrorParameters = {
  code: string;
  message: string;
  status?: number;
  fields?: Record<string, string[]>;
};

export class UpdateEventError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string[]>;

  constructor({
    code,
    message,
    status = 400,
    fields,
  }: UpdateEventErrorParameters) {
    super(message);

    this.name = "UpdateEventError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

type ParsedTicketType = Omit<
  z.output<typeof ticketTypeSchema>,
  "price" | "saleStartsAt" | "saleEndsAt"
> & {
  price: number;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
};

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalizedValue =
    value?.trim() ?? "";

  return normalizedValue || null;
}

function parseZodFields(
  error: z.ZodError,
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path =
      issue.path.join(".") ||
      "form";

    fields[path] ??= [];
    fields[path].push(
      issue.message,
    );
  }

  return fields;
}

function parseDateTime({
  value,
  field,
  required = false,
}: {
  value: string | null | undefined;
  field: string;
  required?: boolean;
}): Date | null {
  const normalizedValue =
    value?.trim() ?? "";

  if (!normalizedValue) {
    if (required) {
      throw new UpdateEventError({
        code: "MISSING_DATE",
        message:
          "Certaines dates obligatoires sont absentes.",
        fields: {
          [field]: [
            "Cette date et cette heure sont obligatoires.",
          ],
        },
      });
    }

    return null;
  }

  const date =
    new Date(normalizedValue);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new UpdateEventError({
      code: "INVALID_DATE",
      message:
        "Une date ou une heure renseignée est invalide.",
      fields: {
        [field]: [
          "La date ou l’heure renseignée est invalide.",
        ],
      },
    });
  }

  return date;
}

function validateTimezone(
  timezone: string,
): void {
  try {
    new Intl.DateTimeFormat(
      "fr-FR",
      {
        timeZone: timezone,
      },
    ).format(new Date());
  } catch {
    throw new UpdateEventError({
      code: "INVALID_TIMEZONE",
      message:
        "Le fuseau horaire sélectionné est invalide.",
      fields: {
        timezone: [
          "Sélectionnez un fuseau horaire valide.",
        ],
      },
    });
  }
}

function validateCountryAndCurrency({
  country,
  countryCode,
  timezone,
  currency,
}: {
  country: string;
  countryCode: string;
  timezone: string;
  currency: string;
}): {
  countryName: string;
  countryCode: string;
  timezone: string;
  currency: SupportedCurrencyCode;
} {
  const countryDefinition =
    getCountryByCode(countryCode);

  if (
    !countryDefinition ||
    !countryDefinition.active
  ) {
    throw new UpdateEventError({
      code:
        "UNSUPPORTED_EVENT_COUNTRY",
      status: 422,
      message:
        "Le pays sélectionné n’est pas pris en charge.",
      fields: {
        countryCode: [
          "Sélectionnez un pays disponible sur Tikemia.",
        ],
      },
    });
  }

  if (
    country.trim().toLocaleLowerCase(
      "fr-FR",
    ) !==
    countryDefinition.name
      .trim()
      .toLocaleLowerCase(
        "fr-FR",
      )
  ) {
    throw new UpdateEventError({
      code:
        "COUNTRY_NAME_MISMATCH",
      status: 422,
      message:
        "Le nom du pays ne correspond pas au code sélectionné.",
      fields: {
        country: [
          `Le pays attendu est « ${countryDefinition.name} ».`,
        ],
      },
    });
  }

  validateTimezone(timezone);

  if (
    timezone !==
    countryDefinition.timezone
  ) {
    throw new UpdateEventError({
      code:
        "COUNTRY_TIMEZONE_MISMATCH",
      status: 422,
      message:
        "Le fuseau horaire ne correspond pas au pays sélectionné.",
      fields: {
        timezone: [
          `Le fuseau horaire attendu est « ${countryDefinition.timezone} ».`,
        ],
      },
    });
  }

  const normalizedCurrency =
    currency.trim().toUpperCase();

  if (
    !isSupportedCurrencyCode(
      normalizedCurrency,
    )
  ) {
    throw new UpdateEventError({
      code:
        "UNSUPPORTED_EVENT_CURRENCY",
      status: 422,
      message:
        "La devise sélectionnée n’est pas prise en charge.",
      fields: {
        currency: [
          "Sélectionnez une devise disponible sur Tikemia.",
        ],
      },
    });
  }

  const currencyDefinition =
    getCurrencyDefinition(
      normalizedCurrency,
    );

  if (
    !currencyDefinition ||
    !currencyDefinition.active
  ) {
    throw new UpdateEventError({
      code:
        "INACTIVE_EVENT_CURRENCY",
      status: 422,
      message:
        "La devise sélectionnée n’est pas actuellement disponible.",
      fields: {
        currency: [
          "Sélectionnez une devise active.",
        ],
      },
    });
  }

  return {
    countryName:
      countryDefinition.name,

    countryCode:
      countryDefinition.code,

    timezone:
      countryDefinition.timezone,

    currency:
      normalizedCurrency,
  };
}

function normalizeTicketPrice({
  value,
  currency,
  field,
}: {
  value: number | string;
  currency: SupportedCurrencyCode;
  field: string;
}): number {
  const normalizedValue =
    typeof value === "number"
      ? value
      : Number(
          value
            .trim()
            .replace(/\s/g, "")
            .replace(",", "."),
        );

  if (
    !Number.isFinite(
      normalizedValue,
    ) ||
    normalizedValue < 0
  ) {
    throw new UpdateEventError({
      code:
        "INVALID_TICKET_PRICE",
      status: 422,
      message:
        "Un prix de billet est invalide.",
      fields: {
        [field]: [
          "Renseignez un prix valide et positif ou égal à zéro.",
        ],
      },
    });
  }

  if (
    normalizedValue >
    MAX_TICKET_PRICE
  ) {
    throw new UpdateEventError({
      code:
        "TICKET_PRICE_TOO_HIGH",
      status: 422,
      message:
        "Un prix de billet est trop élevé.",
      fields: {
        [field]: [
          `Le prix ne peut pas dépasser ${MAX_TICKET_PRICE.toLocaleString(
            "fr-FR",
          )}.`,
        ],
      },
    });
  }

  const decimals =
    getCurrencyDecimals(
      currency,
    );

  const decimalPart =
    String(normalizedValue)
      .split(".")[1] ?? "";

  if (
    decimalPart.length >
    decimals
  ) {
    throw new UpdateEventError({
      code:
        "INVALID_CURRENCY_PRECISION",
      status: 422,
      message:
        "Le prix contient trop de décimales pour la devise sélectionnée.",
      fields: {
        [field]: [
          decimals === 0
            ? `La devise ${currency} n’accepte pas de décimales.`
            : `La devise ${currency} accepte au maximum ${decimals} décimales.`,
        ],
      },
    });
  }

  return roundMoneyAmount({
    amount:
      normalizedValue,

    currency,
  });
}

function validateEventDates({
  startsAt,
  endsAt,
  salesStartAt,
  salesEndAt,
}: {
  startsAt: Date;
  endsAt: Date | null;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
}): void {
  if (
    endsAt &&
    endsAt.getTime() <=
      startsAt.getTime()
  ) {
    throw new UpdateEventError({
      code:
        "INVALID_EVENT_END_DATE",

      message:
        "La date de fin doit être postérieure à la date de début.",

      fields: {
        endsAt: [
          "La fin de l’événement doit être postérieure à son début.",
        ],
      },
    });
  }

  if (
    salesStartAt &&
    salesEndAt &&
    salesEndAt.getTime() <=
      salesStartAt.getTime()
  ) {
    throw new UpdateEventError({
      code:
        "INVALID_SALES_END_DATE",

      message:
        "La fermeture des ventes doit être postérieure à leur ouverture.",

      fields: {
        salesEndAt: [
          "La fermeture des ventes doit être postérieure à leur ouverture.",
        ],
      },
    });
  }

  if (
    salesStartAt &&
    salesStartAt.getTime() >=
      startsAt.getTime()
  ) {
    throw new UpdateEventError({
      code:
        "INVALID_SALES_START_DATE",

      message:
        "L’ouverture des ventes doit être antérieure au début de l’événement.",

      fields: {
        salesStartAt: [
          "Les ventes doivent ouvrir avant le début de l’événement.",
        ],
      },
    });
  }

  if (
    salesEndAt &&
    salesEndAt.getTime() >
      startsAt.getTime()
  ) {
    throw new UpdateEventError({
      code:
        "INVALID_SALES_CLOSING_DATE",

      message:
        "La fermeture des ventes ne peut pas être postérieure au début de l’événement.",

      fields: {
        salesEndAt: [
          "Les ventes doivent fermer au plus tard au début de l’événement.",
        ],
      },
    });
  }
}

function validateEventImages({
  organizerId,
  images,
}: {
  organizerId: string;
  images: Array<
    z.output<
      typeof eventImageSchema
    >
  >;
}): void {
  const coverImages =
    images.filter(
      (image) =>
        image.isCover,
    );

  if (
    coverImages.length !== 1
  ) {
    throw new UpdateEventError({
      code:
        "INVALID_COVER_IMAGE",

      message:
        "Sélectionnez exactement une image principale.",

      fields: {
        images: [
          "Une seule image doit être définie comme couverture.",
        ],
      },
    });
  }

  const positions =
    new Set<number>();

  const paths =
    new Set<string>();

  const safeOrganizerId =
    sanitizeStorageSegment(
      organizerId,
    );

  const expectedPathPrefix =
    `organizers/${safeOrganizerId}/events/`;

  images.forEach(
    (image, index) => {
      if (
        !image.path.startsWith(
          expectedPathPrefix,
        )
      ) {
        throw new UpdateEventError({
          code:
            "INVALID_IMAGE_OWNER",

          status: 403,

          message:
            "Une image ne vous appartient pas.",

          fields: {
            [`images.${index}.path`]:
              [
                "Le chemin de cette image n’est pas autorisé.",
              ],
          },
        });
      }

      if (
        positions.has(
          image.position,
        )
      ) {
        throw new UpdateEventError({
          code:
            "DUPLICATE_IMAGE_POSITION",

          message:
            "Deux images utilisent la même position.",

          fields: {
            [`images.${index}.position`]:
              [
                "Chaque image doit avoir une position unique.",
              ],
          },
        });
      }

      if (
        paths.has(
          image.path,
        )
      ) {
        throw new UpdateEventError({
          code:
            "DUPLICATE_IMAGE_PATH",

          message:
            "Une même image a été envoyée plusieurs fois.",

          fields: {
            [`images.${index}.path`]:
              [
                "Chaque image doit être unique.",
              ],
          },
        });
      }

      positions.add(
        image.position,
      );

      paths.add(
        image.path,
      );
    },
  );

  const orderedPositions =
    [...positions].sort(
      (first, second) =>
        first - second,
    );

  orderedPositions.forEach(
    (position, index) => {
      if (
        position !== index
      ) {
        throw new UpdateEventError({
          code:
            "INVALID_IMAGE_ORDER",

          message:
            "L’ordre des images est invalide.",

          fields: {
            images: [
              "Les positions doivent commencer à 0 et se suivre.",
            ],
          },
        });
      }
    },
  );
}

function ensureEventIsEditable(
  status: EventStatus,
): void {
  if (
    EDITABLE_EVENT_STATUSES.includes(
      status,
    )
  ) {
    return;
  }

  if (
    status === "CANCELLED"
  ) {
    throw new UpdateEventError({
      code:
        "CANCELLED_EVENT_NOT_EDITABLE",

      status: 409,

      message:
        "Un événement annulé ne peut plus être modifié.",
    });
  }

  if (
    status === "COMPLETED"
  ) {
    throw new UpdateEventError({
      code:
        "COMPLETED_EVENT_NOT_EDITABLE",

      status: 409,

      message:
        "Un événement terminé ne peut plus être modifié.",
    });
  }

  throw new UpdateEventError({
    code:
      "EVENT_NOT_EDITABLE",

    status: 409,

    message:
      "Cet événement ne peut pas être modifié dans son état actuel.",
  });
}

function determineUpdatedStatus({
  currentStatus,
  publicationMode,
}: {
  currentStatus: EventStatus;
  publicationMode:
    | "SAVE"
    | "SUBMIT";
}): EventStatus {
  if (
    publicationMode ===
    "SUBMIT"
  ) {
    return "PENDING";
  }

  if (
    currentStatus ===
      "PUBLISHED" ||
    currentStatus ===
      "SUSPENDED"
  ) {
    return currentStatus;
  }

  return "DRAFT";
}

function getActivityType(): OrganizerActivityType {
  /*
   * L’énumération actuelle ne possède pas encore EVENT_UPDATED.
   * On conserve EVENT_CREATED pour rester compatible sans migration.
   */
  return "EVENT_CREATED";
}

function decimalToNumber(
  value:
    | Prisma.Decimal
    | number
    | string
    | null
    | undefined,
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue,
  )
    ? numberValue
    : 0;
}

export async function updateEvent(
  input: UpdateEventInput,
): Promise<UpdateEventResult> {
  const validation =
    updateEventSchema.safeParse(
      input,
    );

  if (
    !validation.success
  ) {
    throw new UpdateEventError({
      code:
        "VALIDATION_ERROR",

      message:
        "Certaines informations de l’événement sont invalides.",

      status: 422,

      fields:
        parseZodFields(
          validation.error,
        ),
    });
  }

  const data =
    validation.data;

  const localization =
    validateCountryAndCurrency(
      {
        country:
          data.country,

        countryCode:
          data.countryCode,

        timezone:
          data.timezone,

        currency:
          data.currency,
      },
    );

  const startsAt =
    parseDateTime({
      value:
        data.startsAt,

      field:
        "startsAt",

      required:
        true,
    });

  if (!startsAt) {
    throw new UpdateEventError({
      code:
        "MISSING_START_DATE",

      message:
        "La date de début est obligatoire.",

      fields: {
        startsAt: [
          "Renseignez la date et l’heure de début.",
        ],
      },
    });
  }

  const endsAt =
    parseDateTime({
      value:
        data.endsAt,

      field:
        "endsAt",
    });

  const salesStartAt =
    parseDateTime({
      value:
        data.salesStartAt,

      field:
        "salesStartAt",
    });

  const salesEndAt =
    parseDateTime({
      value:
        data.salesEndAt,

      field:
        "salesEndAt",
    });

  validateEventDates({
    startsAt,
    endsAt,
    salesStartAt,
    salesEndAt,
  });

  validateEventImages({
    organizerId:
      data.organizerId,

    images:
      data.images,
  });

  const parsedTicketTypes: ParsedTicketType[] =
    data.ticketTypes.map(
      (ticketType, index) => {
        const ticketSaleStartsAt =
          parseDateTime({
            value:
              ticketType.saleStartsAt,

            field:
              `ticketTypes.${index}.saleStartsAt`,
          });

        const ticketSaleEndsAt =
          parseDateTime({
            value:
              ticketType.saleEndsAt,

            field:
              `ticketTypes.${index}.saleEndsAt`,
          });

        if (
          ticketSaleStartsAt &&
          ticketSaleEndsAt &&
          ticketSaleEndsAt.getTime() <=
            ticketSaleStartsAt.getTime()
        ) {
          throw new UpdateEventError({
            code:
              "INVALID_TICKET_SALE_DATES",

            message:
              "La fermeture d’une vente de billet doit être postérieure à son ouverture.",

            fields: {
              [`ticketTypes.${index}.saleEndsAt`]:
                [
                  "La date de fin doit être postérieure à la date de début.",
                ],
            },
          });
        }

        if (
          ticketSaleStartsAt &&
          ticketSaleStartsAt.getTime() >=
            startsAt.getTime()
        ) {
          throw new UpdateEventError({
            code:
              "TICKET_SALE_AFTER_EVENT_START",

            message:
              "La vente d’un billet doit commencer avant le début de l’événement.",

            fields: {
              [`ticketTypes.${index}.saleStartsAt`]:
                [
                  "La vente doit commencer avant le début de l’événement.",
                ],
            },
          });
        }

        if (
          ticketSaleEndsAt &&
          ticketSaleEndsAt.getTime() >
            startsAt.getTime()
        ) {
          throw new UpdateEventError({
            code:
              "TICKET_SALE_AFTER_EVENT_START",

            message:
              "La vente d’un billet ne peut pas se terminer après le début de l’événement.",

            fields: {
              [`ticketTypes.${index}.saleEndsAt`]:
                [
                  "La vente doit se terminer au plus tard au début de l’événement.",
                ],
            },
          });
        }

        if (
          salesStartAt &&
          ticketSaleStartsAt &&
          ticketSaleStartsAt.getTime() <
            salesStartAt.getTime()
        ) {
          throw new UpdateEventError({
            code:
              "TICKET_SALE_BEFORE_EVENT_SALES",

            message:
              "La vente d’un billet ne peut pas commencer avant l’ouverture générale des ventes.",

            fields: {
              [`ticketTypes.${index}.saleStartsAt`]:
                [
                  "Cette date précède l’ouverture générale des ventes.",
                ],
            },
          });
        }

        if (
          salesEndAt &&
          ticketSaleEndsAt &&
          ticketSaleEndsAt.getTime() >
            salesEndAt.getTime()
        ) {
          throw new UpdateEventError({
            code:
              "TICKET_SALE_AFTER_EVENT_SALES",

            message:
              "La vente d’un billet ne peut pas se terminer après la fermeture générale des ventes.",

            fields: {
              [`ticketTypes.${index}.saleEndsAt`]:
                [
                  "Cette date dépasse la fermeture générale des ventes.",
                ],
            },
          });
        }

        if (
          ticketType.maxPerOrder >
          ticketType.quantity
        ) {
          throw new UpdateEventError({
            code:
              "INVALID_MAX_PER_ORDER",

            message:
              "La limite par commande ne peut pas dépasser la quantité disponible.",

            fields: {
              [`ticketTypes.${index}.maxPerOrder`]:
                [
                  "Cette limite dépasse la quantité totale du billet.",
                ],
            },
          });
        }

        return {
          ...ticketType,

          description:
            normalizeOptionalText(
              ticketType.description,
            ),

          price:
            normalizeTicketPrice({
              value:
                ticketType.price,

              currency:
                localization.currency,

              field:
                `ticketTypes.${index}.price`,
            }),

          saleStartsAt:
            ticketSaleStartsAt,

          saleEndsAt:
            ticketSaleEndsAt,
        };
      },
    );

  const normalizedTicketNames =
    new Set<string>();

  parsedTicketTypes.forEach(
    (ticketType, index) => {
      const normalizedName =
        ticketType.name
          .trim()
          .toLocaleLowerCase(
            "fr-FR",
          );

      if (
        normalizedTicketNames.has(
          normalizedName,
        )
      ) {
        throw new UpdateEventError({
          code:
            "DUPLICATE_TICKET_TYPE",

          status: 422,

          message:
            `Le type de billet « ${ticketType.name} » apparaît plusieurs fois.`,

          fields: {
            [`ticketTypes.${index}.name`]:
              [
                "Chaque type de billet doit avoir un nom unique.",
              ],
          },
        });
      }

      normalizedTicketNames.add(
        normalizedName,
      );
    },
  );

  const totalCapacity =
    parsedTicketTypes.reduce(
      (total, ticketType) =>
        total +
        ticketType.quantity,
      0,
    );

  if (
    totalCapacity < 1 ||
    totalCapacity >
      MAX_EVENT_CAPACITY
  ) {
    throw new UpdateEventError({
      code:
        "INVALID_EVENT_CAPACITY",

      message:
        "La capacité totale de l’événement est invalide.",

      fields: {
        ticketTypes: [
          `La capacité totale doit être comprise entre 1 et ${MAX_EVENT_CAPACITY.toLocaleString(
            "fr-FR",
          )} billets.`,
        ],
      },
    });
  }

  const imagePathsToRemove:
    string[] = [];

  try {
    const result =
      await prisma.$transaction(
        async (transaction) => {
          const existingEvent =
            await transaction.event.findFirst(
              {
                where: {
                  id:
                    data.eventId,

                  organizerId:
                    data.organizerId,
                },

                select: {
                  id: true,
                  title: true,
                  status: true,
                  capacity: true,
                  currency: true,

                  category: {
                    select: {
                      id: true,
                    },
                  },

                  images: {
                    select: {
                      id: true,
                      path: true,
                      publicUrl: true,
                      position: true,
                      isCover: true,
                    },
                  },

                  ticketTypes: {
                    select: {
                      id: true,
                      quantity: true,
                    },
                  },
                },
              },
            );

          if (!existingEvent) {
            throw new UpdateEventError({
              code:
                "EVENT_NOT_FOUND",

              status: 404,

              message:
                "Cet événement est introuvable ou ne vous appartient pas.",
            });
          }

          ensureEventIsEditable(
            existingEvent.status,
          );

          const category =
            await transaction.eventCategory.findFirst(
              {
                where: {
                  id:
                    data.categoryId,

                  isActive:
                    true,
                },

                select: {
                  id: true,
                  name: true,
                },
              },
            );

          if (!category) {
            throw new UpdateEventError({
              code:
                "EVENT_CATEGORY_NOT_FOUND",

              status: 404,

              message:
                "La catégorie sélectionnée est indisponible.",

              fields: {
                categoryId: [
                  "Sélectionnez une catégorie active.",
                ],
              },
            });
          }

          const existingTicketTypeIds =
            existingEvent.ticketTypes.map(
              (ticketType) =>
                ticketType.id,
            );

          const submittedExistingTicketIds =
            parsedTicketTypes
              .map(
                (ticketType) =>
                  ticketType.id,
              )
              .filter(
                (
                  ticketTypeId,
                ): ticketTypeId is string =>
                  Boolean(
                    ticketTypeId,
                  ),
              );

          for (
            const submittedTicketId of
            submittedExistingTicketIds
          ) {
            if (
              !existingTicketTypeIds.includes(
                submittedTicketId,
              )
            ) {
              throw new UpdateEventError({
                code:
                  "INVALID_TICKET_TYPE",

                status: 403,

                message:
                  "Un type de billet ne vous appartient pas.",
              });
            }
          }

          const soldTicketsGrouped =
            existingTicketTypeIds.length >
            0
              ? await transaction.ticket.groupBy(
                  {
                    by: [
                      "ticketTypeId",
                    ],

                    where: {
                      eventId:
                        existingEvent.id,

                      ticketTypeId: {
                        in:
                          existingTicketTypeIds,
                      },

                      status: {
                        in: [
                          "VALID",
                          "USED",
                        ],
                      },
                    },

                    _count: {
                      _all:
                        true,
                    },
                  },
                )
              : [];

          const soldCountByTicketType =
            new Map(
              soldTicketsGrouped.map(
                (ticketType) => [
                  ticketType.ticketTypeId,
                  ticketType._count._all,
                ],
              ),
            );

          const totalTicketsSold =
            soldTicketsGrouped.reduce(
              (
                total,
                ticketType,
              ) =>
                total +
                ticketType._count._all,
              0,
            );

          const hasPaidOrders =
            await transaction.order.count(
              {
                where: {
                  eventId:
                    existingEvent.id,

                  status:
                    "PAID",
                },
              },
            );

          const hasFinancialHistory =
            totalTicketsSold > 0 ||
            hasPaidOrders > 0;

          if (
            existingEvent.currency !==
              localization.currency &&
            hasFinancialHistory
          ) {
            throw new UpdateEventError({
              code:
                "EVENT_CURRENCY_LOCKED",

              status: 409,

              message:
                "La devise ne peut plus être modifiée après la première vente ou commande payée.",

              fields: {
                currency: [
                  `La devise actuelle ${existingEvent.currency} doit être conservée.`,
                ],
              },
            });
          }

          for (
            const ticketType of
            parsedTicketTypes
          ) {
            if (
              !ticketType.id
            ) {
              continue;
            }

            const soldCount =
              soldCountByTicketType.get(
                ticketType.id,
              ) ?? 0;

            if (
              ticketType.quantity <
              soldCount
            ) {
              throw new UpdateEventError({
                code:
                  "TICKET_QUANTITY_BELOW_SOLD",

                status: 409,

                message:
                  `La quantité du billet « ${ticketType.name} » ne peut pas être inférieure au nombre déjà vendu.`,

                fields: {
                  ticketTypes: [
                    `${soldCount.toLocaleString(
                      "fr-FR",
                    )} billet(s) ont déjà été vendus pour « ${ticketType.name} ».`,
                  ],
                },
              });
            }
          }

          const removedTicketTypeIds =
            existingTicketTypeIds.filter(
              (ticketTypeId) =>
                !submittedExistingTicketIds.includes(
                  ticketTypeId,
                ),
            );

          for (
            const removedTicketTypeId of
            removedTicketTypeIds
          ) {
            const soldCount =
              soldCountByTicketType.get(
                removedTicketTypeId,
              ) ?? 0;

            if (
              soldCount > 0
            ) {
              throw new UpdateEventError({
                code:
                  "SOLD_TICKET_TYPE_CANNOT_BE_DELETED",

                status: 409,

                message:
                  "Un type de billet déjà vendu ne peut pas être supprimé.",
              });
            }
          }

          if (
            totalCapacity <
            totalTicketsSold
          ) {
            throw new UpdateEventError({
              code:
                "CAPACITY_BELOW_SOLD_TICKETS",

              status: 409,

              message:
                "La capacité totale ne peut pas être inférieure au nombre de billets déjà vendus.",
            });
          }

          const submittedImagePaths =
            new Set(
              data.images.map(
                (image) =>
                  image.path,
              ),
            );

          existingEvent.images.forEach(
            (image) => {
              if (
                !submittedImagePaths.has(
                  image.path,
                )
              ) {
                imagePathsToRemove.push(
                  image.path,
                );
              }
            },
          );

          const submittedExistingImageIds =
            data.images
              .map(
                (image) =>
                  image.id,
              )
              .filter(
                (
                  imageId,
                ): imageId is string =>
                  Boolean(
                    imageId,
                  ),
              );

          const existingImageIds =
            existingEvent.images.map(
              (image) =>
                image.id,
            );

          for (
            const imageId of
            submittedExistingImageIds
          ) {
            if (
              !existingImageIds.includes(
                imageId,
              )
            ) {
              throw new UpdateEventError({
                code:
                  "INVALID_EVENT_IMAGE",

                status: 403,

                message:
                  "Une image ne vous appartient pas.",
              });
            }
          }

          const coverImage =
            data.images.find(
              (image) =>
                image.isCover,
            );

          if (!coverImage) {
            throw new UpdateEventError({
              code:
                "COVER_IMAGE_NOT_FOUND",

              message:
                "Sélectionnez une image principale.",
            });
          }

          await transaction.eventImage.deleteMany(
            {
              where: {
                eventId:
                  existingEvent.id,
              },
            },
          );

          if (
            removedTicketTypeIds.length >
            0
          ) {
            await transaction.ticketType.deleteMany(
              {
                where: {
                  id: {
                    in:
                      removedTicketTypeIds,
                  },

                  eventId:
                    existingEvent.id,
                },
              },
            );
          }

          for (
            const ticketType of
            parsedTicketTypes
          ) {
            if (
              ticketType.id
            ) {
              await transaction.ticketType.update(
                {
                  where: {
                    id:
                      ticketType.id,
                  },

                  data: {
                    name:
                      ticketType.name,

                    description:
                      ticketType.description,

                    price:
                      new Prisma.Decimal(
                        ticketType.price.toString(),
                      ),

                    quantity:
                      ticketType.quantity,

                    maxPerOrder:
                      ticketType.maxPerOrder,

                    saleStartsAt:
                      ticketType.saleStartsAt ??
                      salesStartAt,

                    saleEndsAt:
                      ticketType.saleEndsAt ??
                      salesEndAt,

                    isActive:
                      ticketType.isActive,
                  },
                },
              );

              continue;
            }

            await transaction.ticketType.create(
              {
                data: {
                  eventId:
                    existingEvent.id,

                  name:
                    ticketType.name,

                  description:
                    ticketType.description,

                  price:
                    new Prisma.Decimal(
                      ticketType.price.toString(),
                    ),

                  quantity:
                    ticketType.quantity,

                  maxPerOrder:
                    ticketType.maxPerOrder,

                  saleStartsAt:
                    ticketType.saleStartsAt ??
                    salesStartAt,

                  saleEndsAt:
                    ticketType.saleEndsAt ??
                    salesEndAt,

                  isActive:
                    ticketType.isActive,
                },
              },
            );
          }

          const updatedStatus =
            determineUpdatedStatus(
              {
                currentStatus:
                  existingEvent.status,

                publicationMode:
                  data.publicationMode,
              },
            );

          const updatedEvent =
            await transaction.event.update(
              {
                where: {
                  id:
                    existingEvent.id,
                },

                data: {
                  categoryId:
                    category.id,

                  title:
                    data.title,

                  description:
                    data.description,

                  coverImage:
                    coverImage.publicUrl,

                  venueName:
                    data.venueName,

                  address:
                    data.address,

                  city:
                    data.city,

                  country:
                    localization.countryName,

                  countryCode:
                    localization.countryCode,

                  timezone:
                    localization.timezone,

                  startsAt,
                  endsAt,
                  salesStartAt,
                  salesEndAt,

                  currency:
                    localization.currency,

                  platformFeeRate:
                    new Prisma.Decimal(
                      TIKEMIA_PLATFORM_FEE_PERCENT,
                    ),

                  capacity:
                    totalCapacity,

                  status:
                    updatedStatus,

                  publishedAt:
                    updatedStatus ===
                    "PUBLISHED"
                      ? undefined
                      : null,

                  images: {
                    create:
                      data.images.map(
                        (image) => ({
                          path:
                            image.path,

                          publicUrl:
                            image.publicUrl,

                          position:
                            image.position,

                          isCover:
                            image.isCover,
                        }),
                      ),
                  },
                },

                select: {
                  id: true,
                  title: true,
                  slug: true,
                  status: true,
                  coverImage: true,
                  currency: true,
                  capacity: true,
                  updatedAt: true,

                  images: {
                    orderBy: {
                      position:
                        "asc",
                    },

                    select: {
                      id: true,
                      path: true,
                      publicUrl: true,
                      position: true,
                      isCover: true,
                    },
                  },

                  ticketTypes: {
                    orderBy: {
                      createdAt:
                        "asc",
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
              },
            );

          await transaction.organizerActivity.create(
            {
              data: {
                organizerId:
                  data.organizerId,

                eventId:
                  updatedEvent.id,

                type:
                  getActivityType(),

                title:
                  updatedEvent.status ===
                  "PENDING"
                    ? "Événement modifié et envoyé pour validation"
                    : "Événement modifié",

                description:
                  `L’événement « ${updatedEvent.title} » a été mis à jour.`,

                currency:
                  updatedEvent.currency,

                metadata: {
                  previousStatus:
                    existingEvent.status,

                  newStatus:
                    updatedEvent.status,

                  previousCurrency:
                    existingEvent.currency,

                  newCurrency:
                    updatedEvent.currency,

                  currencyLocked:
                    hasFinancialHistory,

                  categoryId:
                    category.id,

                  categoryName:
                    category.name,

                  images:
                    updatedEvent.images.length,

                  ticketTypes:
                    updatedEvent.ticketTypes.length,

                  totalCapacity:
                    updatedEvent.capacity,

                  platformFeeRate:
                    TIKEMIA_PLATFORM_FEE_PERCENT,
                },
              },
            },
          );

          const updatedTicketTypeIds =
            updatedEvent.ticketTypes.map(
              (ticketType) =>
                ticketType.id,
            );

          const updatedSoldTickets =
            updatedTicketTypeIds.length >
            0
              ? await transaction.ticket.groupBy(
                  {
                    by: [
                      "ticketTypeId",
                    ],

                    where: {
                      eventId:
                        updatedEvent.id,

                      ticketTypeId: {
                        in:
                          updatedTicketTypeIds,
                      },

                      status: {
                        in: [
                          "VALID",
                          "USED",
                        ],
                      },
                    },

                    _count: {
                      _all:
                        true,
                    },
                  },
                )
              : [];

          const updatedSoldMap =
            new Map(
              updatedSoldTickets.map(
                (ticketType) => [
                  ticketType.ticketTypeId,
                  ticketType._count._all,
                ],
              ),
            );

          return {
            id:
              updatedEvent.id,

            title:
              updatedEvent.title,

            slug:
              updatedEvent.slug,

            status:
              updatedEvent.status,

            coverImage:
              updatedEvent.coverImage ??
              coverImage.publicUrl,

            currency:
              updatedEvent.currency as SupportedCurrencyCode,

            capacity:
              updatedEvent.capacity,

            updatedAt:
              updatedEvent.updatedAt,

            images:
              updatedEvent.images,

            ticketTypes:
              updatedEvent.ticketTypes.map(
                (ticketType) => ({
                  ...ticketType,

                  soldCount:
                    updatedSoldMap.get(
                      ticketType.id,
                    ) ?? 0,
                }),
              ),
          };
        },
        {
          maxWait:
            5_000,

          timeout:
            30_000,
        },
      );

    if (
      imagePathsToRemove.length >
      0
    ) {
      await removeEventImagesFromStorage(
        imagePathsToRemove,
      ).catch(
        (
          storageError: unknown,
        ) => {
          console.error(
            "[UPDATE_EVENT_STORAGE_CLEANUP_ERROR]",
            {
              eventId:
                data.eventId,

              paths:
                imagePathsToRemove,

              message:
                storageError instanceof
                Error
                  ? storageError.message
                  : storageError,
            },
          );
        },
      );
    }

    return {
      event: {
        id:
          result.id,

        title:
          result.title,

        slug:
          result.slug,

        status:
          result.status,

        coverImage:
          result.coverImage,

        currency:
          result.currency,

        capacity:
          result.capacity,

        updatedAt:
          result.updatedAt.toISOString(),

        images:
          result.images.map(
            (image) => ({
              id:
                image.id,

              path:
                image.path,

              publicUrl:
                image.publicUrl,

              position:
                image.position,

              isCover:
                image.isCover,
            }),
          ),

        ticketTypes:
          result.ticketTypes.map(
            (ticketType) => ({
              id:
                ticketType.id,

              name:
                ticketType.name,

              description:
                ticketType.description,

              price:
                decimalToNumber(
                  ticketType.price,
                ),

              quantity:
                ticketType.quantity,

              maxPerOrder:
                ticketType.maxPerOrder,

              saleStartsAt:
                ticketType.saleStartsAt
                  ?.toISOString() ??
                null,

              saleEndsAt:
                ticketType.saleEndsAt
                  ?.toISOString() ??
                null,

              isActive:
                ticketType.isActive,

              soldCount:
                ticketType.soldCount,
            }),
          ),
      },

      redirectTo:
        `/organizer/events/${result.id}`,

      message:
        data.publicationMode ===
        "SUBMIT"
          ? "Les modifications ont été enregistrées et l’événement a été envoyé pour validation."
          : "Les modifications ont été enregistrées avec succès.",
    };
  } catch (error) {
    if (
      error instanceof
      UpdateEventError
    ) {
      throw error;
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code ===
        "P2025"
    ) {
      throw new UpdateEventError({
        code:
          "EVENT_NOT_FOUND",

        status: 404,

        message:
          "L’événement ou une donnée associée est introuvable.",
      });
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code ===
        "P2002"
    ) {
      throw new UpdateEventError({
        code:
          "DUPLICATE_EVENT_DATA",

        status: 409,

        message:
          "Une donnée de cet événement existe déjà.",
      });
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code ===
        "P2003"
    ) {
      throw new UpdateEventError({
        code:
          "EVENT_RELATION_CONFLICT",

        status: 409,

        message:
          "Certaines données liées empêchent cette modification.",
      });
    }

    console.error(
      "[UPDATE_EVENT_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new UpdateEventError({
      code:
        "UPDATE_EVENT_FAILED",

      status: 500,

      message:
        "Impossible de modifier l’événement pour le moment.",
    });
  }
}