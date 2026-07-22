import "server-only";

import { createHash } from "node:crypto";

import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const PROFILE_COMPLETION_FIELDS = 15;

export type OrganizerProfileData = {
  id: string;

  personal: {
    firstName: string;
    lastName: string;
    fullName: string;
    initials: string;

    email: string;
    phone: string;

    country: string;
    countryCode: string;
    dialCode: string;

    emailVerified: boolean;
    isActive: boolean;

    createdAt: string;
    updatedAt: string;
  };

  professional: {
    profileId: string | null;

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

    createdAt: string | null;
    updatedAt: string | null;
  };

  display: {
    displayName: string;
    secondaryName: string;
    location: string;
    verifiedLabel: string;
    accountStatusLabel: string;
  };

  completion: {
    percentage: number;
    completedFields: number;
    totalFields: number;
    isComplete: boolean;
    missingFields: OrganizerProfileMissingField[];
  };

  permissions: {
    canEditPersonalInformation: boolean;
    canEditProfessionalInformation: boolean;
    canUploadAvatar: boolean;
    canUploadLogo: boolean;
    canChangeEmail: boolean;
    canChangePhone: boolean;
  };
};

export type OrganizerProfileMissingField = {
  key:
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "country"
    | "businessName"
    | "businessType"
    | "description"
    | "avatar"
    | "website"
    | "address"
    | "city"
    | "facebook"
    | "instagram"
    | "linkedin";

  label: string;
  section:
    | "PERSONAL"
    | "PROFESSIONAL"
    | "ONLINE";
};

export type GetOrganizerProfileResult = {
  organizer: OrganizerProfileData;
};

export class GetOrganizerProfileError extends Error {
  readonly code: string;
  readonly status: number;
  readonly redirectTo?: string;

  constructor({
    code,
    message,
    status = 500,
    redirectTo,
  }: {
    code: string;
    message: string;
    status?: number;
    redirectTo?: string;
  }) {
    super(message);

    this.name =
      "GetOrganizerProfileError";

    this.code = code;
    this.status = status;
    this.redirectTo = redirectTo;
  }
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function buildInitials({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): string {
  const firstInitial =
    firstName.trim().charAt(0);

  const lastInitial =
    lastName.trim().charAt(0);

  const initials =
    `${firstInitial}${lastInitial}`
      .trim()
      .toUpperCase();

  return initials || "OR";
}

function buildFullName({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): string {
  return `${firstName} ${lastName}`
    .replace(/\s+/g, " ")
    .trim();
}

function buildLocation({
  city,
  country,
}: {
  city: string;
  country: string;
}): string {
  if (city && country) {
    return `${city}, ${country}`;
  }

  return city || country || "Localisation non renseignée";
}

function calculateProfileCompletion({
  firstName,
  lastName,
  email,
  phone,
  country,
  businessName,
  businessType,
  description,
  avatar,
  website,
  address,
  city,
  facebook,
  instagram,
  linkedin,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  businessName: string;
  businessType: string;
  description: string;
  avatar: string | null;
  website: string;
  address: string;
  city: string;
  facebook: string;
  instagram: string;
  linkedin: string;
}): OrganizerProfileData["completion"] {
  const fields: Array<{
    key: OrganizerProfileMissingField["key"];
    label: string;
    section: OrganizerProfileMissingField["section"];
    completed: boolean;
  }> = [
    {
      key: "firstName",
      label: "Prénom",
      section: "PERSONAL",
      completed:
        Boolean(firstName),
    },
    {
      key: "lastName",
      label: "Nom",
      section: "PERSONAL",
      completed:
        Boolean(lastName),
    },
    {
      key: "email",
      label: "Adresse e-mail",
      section: "PERSONAL",
      completed:
        Boolean(email),
    },
    {
      key: "phone",
      label: "Téléphone",
      section: "PERSONAL",
      completed:
        Boolean(phone),
    },
    {
      key: "country",
      label: "Pays",
      section: "PERSONAL",
      completed:
        Boolean(country),
    },
    {
      key: "businessName",
      label: "Nom de l’organisation",
      section: "PROFESSIONAL",
      completed:
        Boolean(businessName),
    },
    {
      key: "businessType",
      label: "Type d’activité",
      section: "PROFESSIONAL",
      completed:
        Boolean(businessType),
    },
    {
      key: "description",
      label: "Description professionnelle",
      section: "PROFESSIONAL",
      completed:
        description.length >= 20,
    },
    {
      key: "avatar",
      label: "Photo de profil",
      section: "PROFESSIONAL",
      completed:
        Boolean(avatar),
    },
    {
      key: "website",
      label: "Site internet",
      section: "ONLINE",
      completed:
        Boolean(website),
    },
    {
      key: "address",
      label: "Adresse",
      section: "PROFESSIONAL",
      completed:
        Boolean(address),
    },
    {
      key: "city",
      label: "Ville",
      section: "PROFESSIONAL",
      completed:
        Boolean(city),
    },
    {
      key: "facebook",
      label: "Facebook",
      section: "ONLINE",
      completed:
        Boolean(facebook),
    },
    {
      key: "instagram",
      label: "Instagram",
      section: "ONLINE",
      completed:
        Boolean(instagram),
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      section: "ONLINE",
      completed:
        Boolean(linkedin),
    },
  ];

  const completedFields =
    fields.filter(
      (field) => field.completed,
    ).length;

  const percentage =
    Math.round(
      (completedFields /
        PROFILE_COMPLETION_FIELDS) *
        100,
    );

  const missingFields =
    fields
      .filter(
        (field) =>
          !field.completed,
      )
      .map(
        ({
          key,
          label,
          section,
        }) => ({
          key,
          label,
          section,
        }),
      );

  return {
    percentage,
    completedFields,
    totalFields:
      PROFILE_COMPLETION_FIELDS,

    isComplete:
      completedFields ===
      PROFILE_COMPLETION_FIELDS,

    missingFields,
  };
}

async function getAuthenticatedOrganizer() {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env
      .SESSION_COOKIE_NAME
      ?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    throw new GetOrganizerProfileError({
      code: "UNAUTHORIZED",
      status: 401,
      message:
        "Votre session est absente ou expirée.",
      redirectTo:
        "/organizer/login",
    });
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(
            sessionToken,
          ),
      },

      select: {
        id: true,
        expiresAt: true,

        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,

            country: true,
            countryCode: true,
            dialCode: true,

            role: true,
            emailVerified: true,
            isActive: true,

            createdAt: true,
            updatedAt: true,

            organizerProfile: {
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

                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

  if (!session) {
    throw new GetOrganizerProfileError({
      code: "INVALID_SESSION",
      status: 401,
      message:
        "Votre session n’est plus valide.",
      redirectTo:
        "/organizer/login",
    });
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch(
        (error: unknown) => {
          console.error(
            "[GET_ORGANIZER_PROFILE_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    throw new GetOrganizerProfileError({
      code: "EXPIRED_SESSION",
      status: 401,
      message:
        "Votre session a expiré. Reconnectez-vous.",
      redirectTo:
        "/organizer/login",
    });
  }

  if (
    session.user.role !==
      "ORGANIZER" ||
    !session.user.isActive
  ) {
    throw new GetOrganizerProfileError({
      code: "FORBIDDEN",
      status: 403,
      message:
        "Votre compte ne peut pas accéder à cet espace organisateur.",
      redirectTo:
        "/organizer/login",
    });
  }

  return session.user;
}

export async function getOrganizerProfile(): Promise<GetOrganizerProfileResult> {
  try {
    const user =
      await getAuthenticatedOrganizer();

    const profile =
      user.organizerProfile;

    const firstName =
      normalizeText(
        user.firstName,
      );

    const lastName =
      normalizeText(
        user.lastName,
      );

    const email =
      normalizeText(user.email);

    const phone =
      normalizeText(user.phone);

    const country =
      normalizeText(
        user.country,
      );

    const countryCode =
      normalizeText(
        user.countryCode,
      );

    const dialCode =
      normalizeText(
        user.dialCode,
      );

    const businessName =
      normalizeText(
        profile?.businessName,
      );

    const businessType =
      normalizeText(
        profile?.businessType,
      );

    const description =
      normalizeText(
        profile?.description,
      );

    const website =
      normalizeText(
        profile?.website,
      );

    const address =
      normalizeText(
        profile?.address,
      );

    const city =
      normalizeText(
        profile?.city,
      );

    const facebook =
      normalizeText(
        profile?.facebook,
      );

    const instagram =
      normalizeText(
        profile?.instagram,
      );

    const x =
      normalizeText(
        profile?.x,
      );

    const linkedin =
      normalizeText(
        profile?.linkedin,
      );

    const avatar =
      profile?.avatar?.trim() ||
      null;

    const avatarPath =
      profile?.avatarPath?.trim() ||
      null;

    const logo =
      profile?.logo?.trim() ||
      null;

    const logoPath =
      profile?.logoPath?.trim() ||
      null;

    const fullName =
      buildFullName({
        firstName,
        lastName,
      });

    const displayName =
      businessName ||
      fullName ||
      "Organisateur Tikemia";

    const completion =
      calculateProfileCompletion({
        firstName,
        lastName,
        email,
        phone,
        country,

        businessName,
        businessType,
        description,
        avatar,

        website,
        address,
        city,

        facebook,
        instagram,
        linkedin,
      });

    return {
      organizer: {
        id: user.id,

        personal: {
          firstName,
          lastName,
          fullName,

          initials:
            buildInitials({
              firstName,
              lastName,
            }),

          email,
          phone,

          country,
          countryCode,
          dialCode,

          emailVerified:
            user.emailVerified,

          isActive:
            user.isActive,

          createdAt:
            user.createdAt.toISOString(),

          updatedAt:
            user.updatedAt.toISOString(),
        },

        professional: {
          profileId:
            profile?.id ?? null,

          businessName,
          businessType,
          description,

          avatar,
          avatarPath,

          logo,
          logoPath,

          website,

          address,
          city,

          facebook,
          instagram,
          x,
          linkedin,

          createdAt:
            profile?.createdAt
              ?.toISOString() ??
            null,

          updatedAt:
            profile?.updatedAt
              ?.toISOString() ??
            null,
        },

        display: {
          displayName,

          secondaryName:
            businessName &&
            fullName
              ? fullName
              : "Organisateur Tikemia",

          location:
            buildLocation({
              city,
              country,
            }),

          verifiedLabel:
            user.emailVerified
              ? "Compte vérifié"
              : "E-mail non vérifié",

          accountStatusLabel:
            user.isActive
              ? "Compte actif"
              : "Compte désactivé",
        },

        completion,

        permissions: {
          canEditPersonalInformation:
            user.isActive,

          canEditProfessionalInformation:
            user.isActive,

          canUploadAvatar:
            user.isActive,

          canUploadLogo:
            user.isActive,

          canChangeEmail:
            user.isActive,

          canChangePhone:
            user.isActive,
        },
      },
    };
  } catch (error) {
    if (
      error instanceof
      GetOrganizerProfileError
    ) {
      throw error;
    }

    console.error(
      "[GET_ORGANIZER_PROFILE_ERROR]",
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

    throw new GetOrganizerProfileError({
      code:
        "GET_ORGANIZER_PROFILE_FAILED",

      status: 500,

      message:
        "Impossible de charger votre profil organisateur pour le moment.",
    });
  }
}