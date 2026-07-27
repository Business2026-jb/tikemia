import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_SESSION_COOKIE_NAME =
  process.env.CLIENT_SESSION_COOKIE_NAME?.trim() ||
  "tikemia_client_session";

const updateProfileSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "Le prénom doit contenir au moins 2 caractères.")
      .max(80, "Le prénom est trop long."),

    lastName: z
      .string()
      .trim()
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(80, "Le nom est trop long."),

    phone: z
      .string()
      .trim()
      .min(6, "Le numéro de téléphone est invalide.")
      .max(30, "Le numéro de téléphone est trop long."),

    country: z
      .string()
      .trim()
      .min(2, "Le pays est obligatoire.")
      .max(80, "Le nom du pays est trop long."),

    countryCode: z
      .string()
      .trim()
      .length(2, "Le code pays est invalide.")
      .transform((value) =>
        value.toUpperCase(),
      ),

    dialCode: z
      .string()
      .trim()
      .regex(
        /^\+\d{1,4}$/,
        "L’indicatif téléphonique est invalide.",
      ),
  })
  .strict();

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function normalizePhone(
  value: string,
): string {
  return value
    .trim()
    .replace(/[^\d]/g, "");
}

async function getAuthenticatedCustomer() {
  const cookieStore =
    await cookies();

  const sessionToken =
    cookieStore
      .get(CLIENT_SESSION_COOKIE_NAME)
      ?.value?.trim();

  if (!sessionToken) {
    return null;
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
            role: true,
            emailVerified: true,
            isActive: true,
          },
        },
      },
    });

  if (!session) {
    return null;
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
      .catch(() => undefined);

    return null;
  }

  if (
    session.user.role !== "CUSTOMER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  return session.user;
}

async function getProfile(
  userId: string,
) {
  return prisma.user.findUnique({
    where: {
      id: userId,
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
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function GET() {
  try {
    const customer =
      await getAuthenticatedCustomer();

    if (!customer) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Connectez-vous à votre compte Tikemia.",
        },
        401,
      );
    }

    const profile =
      await getProfile(
        customer.id,
      );

    if (!profile) {
      return jsonResponse(
        {
          success: false,
          code: "PROFILE_NOT_FOUND",
          message:
            "Votre profil est introuvable.",
        },
        404,
      );
    }

    return jsonResponse({
      success: true,
      profile,
    });
  } catch (error) {
    console.error(
      "[CLIENT_PROFILE_GET_ERROR]",
      error,
    );

    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message:
          "Impossible de charger votre profil pour le moment.",
      },
      500,
    );
  }
}

export async function PATCH(
  request: Request,
) {
  try {
    const customer =
      await getAuthenticatedCustomer();

    if (!customer) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Connectez-vous à votre compte Tikemia.",
        },
        401,
      );
    }

    let rawBody: unknown;

    try {
      rawBody =
        await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_JSON",
          message:
            "La requête envoyée est invalide.",
        },
        400,
      );
    }

    const parsedBody =
      updateProfileSchema.safeParse(
        rawBody,
      );

    if (!parsedBody.success) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_PROFILE_DATA",
          message:
            parsedBody.error.issues[0]
              ?.message ||
            "Les informations saisies sont invalides.",
        },
        400,
      );
    }

    const {
      firstName,
      lastName,
      phone,
      country,
      countryCode,
      dialCode,
    } =
      parsedBody.data;

    const phoneDigits =
      normalizePhone(
        phone,
      );

    if (
      phoneDigits.length < 6 ||
      phoneDigits.length > 15
    ) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_PHONE",
          message:
            "Saisissez un numéro de téléphone valide.",
        },
        400,
      );
    }

    const normalizedPhone =
      `${dialCode}${phoneDigits}`;

    const phoneOwner =
      await prisma.user.findFirst({
        where: {
          id: {
            not:
              customer.id,
          },

          OR: [
            {
              phone:
                normalizedPhone,
            },
            {
              phone:
                phoneDigits,
            },
          ],
        },

        select: {
          id: true,
        },
      });

    if (phoneOwner) {
      return jsonResponse(
        {
          success: false,
          code: "PHONE_ALREADY_USED",
          message:
            "Ce numéro de téléphone est déjà associé à un autre compte Tikemia.",
        },
        409,
      );
    }

    const profile =
      await prisma.user.update({
        where: {
          id:
            customer.id,
        },

        data: {
          firstName,
          lastName,
          phone:
            normalizedPhone,
          country,
          countryCode,
          dialCode,
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
          createdAt: true,
          updatedAt: true,
        },
      });

    return jsonResponse({
      success: true,
      message:
        "Vos informations ont été mises à jour.",
      profile,
    });
  } catch (error) {
    console.error(
      "[CLIENT_PROFILE_UPDATE_ERROR]",
      error,
    );

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return jsonResponse(
        {
          success: false,
          code: "PHONE_ALREADY_USED",
          message:
            "Ce numéro de téléphone est déjà associé à un autre compte Tikemia.",
        },
        409,
      );
    }

    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message:
          "Impossible d’enregistrer vos modifications pour le moment.",
      },
      500,
    );
  }
}