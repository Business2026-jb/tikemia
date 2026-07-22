import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const MAXIMUM_NAME_LENGTH = 80;
const MAXIMUM_BUSINESS_NAME_LENGTH = 160;
const MAXIMUM_DESCRIPTION_LENGTH = 2_000;
const MAXIMUM_ADDRESS_LENGTH = 300;
const MAXIMUM_CITY_LENGTH = 100;
const MAXIMUM_BUSINESS_TYPE_LENGTH = 100;

const optionalTextSchema = (
  maximumLength: number,
  errorMessage: string,
) =>
  z
    .string()
    .trim()
    .max(maximumLength, errorMessage)
    .optional()
    .nullable();

const updateOrganizerProfileSchema = z.object({
  organizerId: z
    .string()
    .trim()
    .min(
      1,
      "L’identifiant de l’organisateur est obligatoire.",
    ),

  firstName: z
    .string()
    .trim()
    .min(
      2,
      "Le prénom doit contenir au moins 2 caractères.",
    )
    .max(
      MAXIMUM_NAME_LENGTH,
      `Le prénom ne peut pas dépasser ${MAXIMUM_NAME_LENGTH} caractères.`,
    ),

  lastName: z
    .string()
    .trim()
    .min(
      2,
      "Le nom doit contenir au moins 2 caractères.",
    )
    .max(
      MAXIMUM_NAME_LENGTH,
      `Le nom ne peut pas dépasser ${MAXIMUM_NAME_LENGTH} caractères.`,
    ),

  phone: z
    .string()
    .trim()
    .min(
      6,
      "Le numéro de téléphone est trop court.",
    )
    .max(
      30,
      "Le numéro de téléphone est trop long.",
    ),

  country: z
    .string()
    .trim()
    .min(2, "Le pays est obligatoire.")
    .max(
      100,
      "Le nom du pays est trop long.",
    ),

  countryCode: z
    .string()
    .trim()
    .min(
      2,
      "Le code du pays est obligatoire.",
    )
    .max(
      3,
      "Le code du pays est invalide.",
    )
    .transform((value) =>
      value.toUpperCase(),
    ),

  dialCode: z
    .string()
    .trim()
    .min(
      2,
      "L’indicatif téléphonique est obligatoire.",
    )
    .max(
      10,
      "L’indicatif téléphonique est invalide.",
    ),

  businessName: optionalTextSchema(
    MAXIMUM_BUSINESS_NAME_LENGTH,
    `Le nom de l’organisation ne peut pas dépasser ${MAXIMUM_BUSINESS_NAME_LENGTH} caractères.`,
  ),

  businessType: optionalTextSchema(
    MAXIMUM_BUSINESS_TYPE_LENGTH,
    `Le type d’activité ne peut pas dépasser ${MAXIMUM_BUSINESS_TYPE_LENGTH} caractères.`,
  ),

  description: optionalTextSchema(
    MAXIMUM_DESCRIPTION_LENGTH,
    `La description ne peut pas dépasser ${MAXIMUM_DESCRIPTION_LENGTH} caractères.`,
  ),

  website: optionalTextSchema(
    500,
    "L’adresse du site internet est trop longue.",
  ),

  address: optionalTextSchema(
    MAXIMUM_ADDRESS_LENGTH,
    `L’adresse ne peut pas dépasser ${MAXIMUM_ADDRESS_LENGTH} caractères.`,
  ),

  city: optionalTextSchema(
    MAXIMUM_CITY_LENGTH,
    `Le nom de la ville ne peut pas dépasser ${MAXIMUM_CITY_LENGTH} caractères.`,
  ),

  facebook: optionalTextSchema(
    500,
    "Le lien Facebook est trop long.",
  ),

  instagram: optionalTextSchema(
    500,
    "Le lien Instagram est trop long.",
  ),

  x: optionalTextSchema(
    500,
    "Le lien X est trop long.",
  ),

  linkedin: optionalTextSchema(
    500,
    "Le lien LinkedIn est trop long.",
  ),
});

export type UpdateOrganizerProfileInput =
  z.input<
    typeof updateOrganizerProfileSchema
  >;

export type UpdateOrganizerProfileResult = {
  message: string;

  organizer: {
    id: string;

    personal: {
      firstName: string;
      lastName: string;
      fullName: string;
      email: string;
      phone: string;

      country: string;
      countryCode: string;
      dialCode: string;

      emailVerified: boolean;
      isActive: boolean;

      updatedAt: string;
    };

    professional: {
      profileId: string;

      businessName: string;
      businessType: string;
      description: string;

      avatar: string | null;
      avatarPath: string | null;

      logo: string | null;
      logoPath: string | null;

      website: string;
      address: string;
      city: string;

      facebook: string;
      instagram: string;
      x: string;
      linkedin: string;

      updatedAt: string;
    };
  };
};

type UpdateOrganizerProfileErrorParameters = {
  code: string;
  message: string;
  status?: number;
  fields?: Record<string, string[]>;
};

export class UpdateOrganizerProfileError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<
    string,
    string[]
  >;

  constructor({
    code,
    message,
    status = 400,
    fields,
  }: UpdateOrganizerProfileErrorParameters) {
    super(message);

    this.name =
      "UpdateOrganizerProfileError";

    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalizedValue =
    value?.trim() ?? "";

  return normalizedValue || null;
}

function normalizePhone(
  value: string,
): string {
  return value
    .trim()
    .replace(/[^\d+]/g, "");
}

function validatePhone(
  phone: string,
): void {
  const digits =
    phone.replace(/\D/g, "");

  if (
    digits.length < 6 ||
    digits.length > 20
  ) {
    throw new UpdateOrganizerProfileError({
      code: "INVALID_PHONE",
      status: 422,
      message:
        "Le numéro de téléphone est invalide.",
      fields: {
        phone: [
          "Renseignez un numéro de téléphone valide.",
        ],
      },
    });
  }
}

function normalizeWebAddress(
  value: string | null,
  fieldName: string,
): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue =
    value.trim();

  const valueWithProtocol =
    /^https?:\/\//i.test(
      normalizedValue,
    )
      ? normalizedValue
      : `https://${normalizedValue}`;

  try {
    const url =
      new URL(valueWithProtocol);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      throw new Error(
        "Unsupported protocol",
      );
    }

    return url.toString();
  } catch {
    throw new UpdateOrganizerProfileError({
      code: "INVALID_URL",
      status: 422,
      message:
        "Une adresse internet renseignée est invalide.",
      fields: {
        [fieldName]: [
          "Renseignez une adresse internet valide.",
        ],
      },
    });
  }
}

function buildFullName(
  firstName: string,
  lastName: string,
): string {
  return `${firstName} ${lastName}`
    .replace(/\s+/g, " ")
    .trim();
}

export async function updateOrganizerProfile(
  input: UpdateOrganizerProfileInput,
): Promise<UpdateOrganizerProfileResult> {
  const validation =
    updateOrganizerProfileSchema.safeParse(
      input,
    );

  if (!validation.success) {
    throw new UpdateOrganizerProfileError({
      code: "VALIDATION_ERROR",
      status: 422,
      message:
        "Certaines informations du profil sont invalides.",
      fields:
        validation.error.flatten()
          .fieldErrors,
    });
  }

  const data = validation.data;

  const phone = normalizePhone(
    data.phone,
  );

  validatePhone(phone);

  const businessName =
    normalizeOptionalText(
      data.businessName,
    );

  const businessType =
    normalizeOptionalText(
      data.businessType,
    );

  const description =
    normalizeOptionalText(
      data.description,
    );

  const address =
    normalizeOptionalText(
      data.address,
    );

  const city =
    normalizeOptionalText(
      data.city,
    );

  const website =
    normalizeWebAddress(
      normalizeOptionalText(
        data.website,
      ),
      "website",
    );

  const facebook =
    normalizeWebAddress(
      normalizeOptionalText(
        data.facebook,
      ),
      "facebook",
    );

  const instagram =
    normalizeWebAddress(
      normalizeOptionalText(
        data.instagram,
      ),
      "instagram",
    );

  const x =
    normalizeWebAddress(
      normalizeOptionalText(
        data.x,
      ),
      "x",
    );

  const linkedin =
    normalizeWebAddress(
      normalizeOptionalText(
        data.linkedin,
      ),
      "linkedin",
    );

  try {
    const existingOrganizer =
      await prisma.user.findFirst({
        where: {
          id: data.organizerId,
          role: "ORGANIZER",
        },

        select: {
          id: true,
          email: true,
          isActive: true,
        },
      });

    if (!existingOrganizer) {
      throw new UpdateOrganizerProfileError({
        code: "ORGANIZER_NOT_FOUND",
        status: 404,
        message:
          "Le compte organisateur est introuvable.",
      });
    }

    if (!existingOrganizer.isActive) {
      throw new UpdateOrganizerProfileError({
        code: "ORGANIZER_DISABLED",
        status: 403,
        message:
          "Ce compte organisateur est désactivé.",
      });
    }

    const phoneOwner =
      await prisma.user.findFirst({
        where: {
          phone,
          id: {
            not: data.organizerId,
          },
        },

        select: {
          id: true,
        },
      });

    if (phoneOwner) {
      throw new UpdateOrganizerProfileError({
        code: "PHONE_ALREADY_USED",
        status: 409,
        message:
          "Ce numéro de téléphone est déjà utilisé par un autre compte.",
        fields: {
          phone: [
            "Choisissez un autre numéro de téléphone.",
          ],
        },
      });
    }

    const result =
      await prisma.$transaction(
        async (transaction) => {
          const updatedUser =
            await transaction.user.update({
              where: {
                id: data.organizerId,
              },

              data: {
                firstName:
                  data.firstName,

                lastName:
                  data.lastName,

                phone,

                country:
                  data.country,

                countryCode:
                  data.countryCode,

                dialCode:
                  data.dialCode,
              },

              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,

                country: true,
                countryCode: true,
                dialCode: true,

                emailVerified: true,
                isActive: true,
                updatedAt: true,
              },
            });

          const updatedProfile =
            await transaction.organizerProfile.upsert(
              {
                where: {
                  userId:
                    data.organizerId,
                },

                create: {
                  userId:
                    data.organizerId,

                  businessName,
                  businessType,
                  description,

                  website,
                  address,
                  city,

                  facebook,
                  instagram,
                  x,
                  linkedin,
                },

                update: {
                  businessName,
                  businessType,
                  description,

                  website,
                  address,
                  city,

                  facebook,
                  instagram,
                  x,
                  linkedin,
                },

                select: {
                  id: true,

                  businessName:
                    true,

                  businessType:
                    true,

                  description:
                    true,

                  avatar: true,
                  avatarPath: true,

                  logo: true,
                  logoPath: true,

                  website: true,
                  address: true,
                  city: true,

                  facebook: true,
                  instagram: true,
                  x: true,
                  linkedin: true,

                  updatedAt: true,
                },
              },
            );

          return {
            user: updatedUser,
            profile:
              updatedProfile,
          };
        },
        {
          maxWait: 5_000,
          timeout: 15_000,
        },
      );

    return {
      message:
        "Votre profil organisateur a été mis à jour avec succès.",

      organizer: {
        id: result.user.id,

        personal: {
          firstName:
            result.user.firstName,

          lastName:
            result.user.lastName,

          fullName:
            buildFullName(
              result.user.firstName,
              result.user.lastName,
            ),

          email:
            result.user.email,

          phone:
            result.user.phone,

          country:
            result.user.country,

          countryCode:
            result.user.countryCode,

          dialCode:
            result.user.dialCode,

          emailVerified:
            result.user.emailVerified,

          isActive:
            result.user.isActive,

          updatedAt:
            result.user.updatedAt.toISOString(),
        },

        professional: {
          profileId:
            result.profile.id,

          businessName:
            result.profile
              .businessName ?? "",

          businessType:
            result.profile
              .businessType ?? "",

          description:
            result.profile
              .description ?? "",

          avatar:
            result.profile.avatar,

          avatarPath:
            result.profile.avatarPath,

          logo:
            result.profile.logo,

          logoPath:
            result.profile.logoPath,

          website:
            result.profile.website ??
            "",

          address:
            result.profile.address ??
            "",

          city:
            result.profile.city ?? "",

          facebook:
            result.profile.facebook ??
            "",

          instagram:
            result.profile.instagram ??
            "",

          x:
            result.profile.x ?? "",

          linkedin:
            result.profile.linkedin ??
            "",

          updatedAt:
            result.profile.updatedAt.toISOString(),
        },
      },
    };
  } catch (error) {
    if (
      error instanceof
      UpdateOrganizerProfileError
    ) {
      throw error;
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target =
        Array.isArray(
          error.meta?.target,
        )
          ? error.meta?.target
          : [];

      if (
        target.includes("phone")
      ) {
        throw new UpdateOrganizerProfileError({
          code:
            "PHONE_ALREADY_USED",

          status: 409,

          message:
            "Ce numéro de téléphone est déjà utilisé.",

          fields: {
            phone: [
              "Choisissez un autre numéro de téléphone.",
            ],
          },
        });
      }

      throw new UpdateOrganizerProfileError({
        code: "DUPLICATE_PROFILE_DATA",
        status: 409,
        message:
          "Certaines informations sont déjà utilisées par un autre compte.",
      });
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new UpdateOrganizerProfileError({
        code: "ORGANIZER_NOT_FOUND",
        status: 404,
        message:
          "Le compte organisateur est introuvable.",
      });
    }

    console.error(
      "[UPDATE_ORGANIZER_PROFILE_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new UpdateOrganizerProfileError({
      code:
        "UPDATE_ORGANIZER_PROFILE_FAILED",

      status: 500,

      message:
        "Impossible de mettre à jour votre profil pour le moment.",
    });
  }
}