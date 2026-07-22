import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  updateOrganizerProfile,
  UpdateOrganizerProfileError,
  type UpdateOrganizerProfileInput,
} from "@/lib/organizer/update-organizer-profile";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

type UpdateOrganizerProfileRequestBody = Omit<
  UpdateOrganizerProfileInput,
  "organizerId"
>;

type UpdateOrganizerProfileResponse = {
  success: boolean;
  message: string;
  code?: string;
  fields?: Record<string, string[]>;

  data?: {
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
};

type AuthenticatedOrganizer = {
  id: string;
};

function jsonResponse(
  body: UpdateOrganizerProfileResponse,
  status: number,
): NextResponse<UpdateOrganizerProfileResponse> {
  return NextResponse.json(body, {
    status,

    headers: {
      "Cache-Control":
        "no-store, max-age=0, must-revalidate",

      Pragma: "no-cache",
      Expires: "0",

      "X-Content-Type-Options":
        "nosniff",
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

function hasJsonContentType(
  request: Request,
): boolean {
  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() ?? "";

  return contentType.includes(
    "application/json",
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function parseRequestBody(
  request: Request,
): Promise<UpdateOrganizerProfileRequestBody | null> {
  try {
    const body: unknown =
      await request.json();

    if (!isRecord(body)) {
      return null;
    }

    return body as UpdateOrganizerProfileRequestBody;
  } catch {
    return null;
  }
}

async function getAuthenticatedOrganizer(): Promise<AuthenticatedOrganizer | null> {
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
      .catch(
        (error: unknown) => {
          console.error(
            "[UPDATE_PROFILE_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    return null;
  }

  if (
    session.user.role !==
      "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  return {
    id: session.user.id,
  };
}

export async function PATCH(
  request: Request,
): Promise<
  NextResponse<UpdateOrganizerProfileResponse>
> {
  try {
    if (!hasJsonContentType(request)) {
      return jsonResponse(
        {
          success: false,

          code:
            "UNSUPPORTED_CONTENT_TYPE",

          message:
            "Les informations du profil doivent être envoyées au format JSON.",
        },
        415,
      );
    }

    const organizer =
      await getAuthenticatedOrganizer();

    if (!organizer) {
      return jsonResponse(
        {
          success: false,

          code: "UNAUTHORIZED",

          message:
            "Votre session est absente, invalide ou expirée.",
        },
        401,
      );
    }

    const body =
      await parseRequestBody(
        request,
      );

    if (!body) {
      return jsonResponse(
        {
          success: false,

          code:
            "INVALID_JSON_BODY",

          message:
            "Les informations envoyées sont invalides ou illisibles.",
        },
        400,
      );
    }

    /*
     * organizerId ne vient jamais du navigateur.
     * Il est imposé par la session sécurisée.
     */
    const result =
      await updateOrganizerProfile({
        ...body,
        organizerId:
          organizer.id,
      });

    return jsonResponse(
      {
        success: true,

        code:
          "ORGANIZER_PROFILE_UPDATED",

        message:
          result.message,

        data: {
          organizer:
            result.organizer,
        },
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      UpdateOrganizerProfileError
    ) {
      console.warn(
        "[UPDATE_ORGANIZER_PROFILE_REJECTED]",
        {
          code: error.code,
          status: error.status,
          message: error.message,
        },
      );

      return jsonResponse(
        {
          success: false,

          code: error.code,

          message:
            error.message,

          fields:
            error.fields,
        },
        error.status,
      );
    }

    console.error(
      "[UPDATE_ORGANIZER_PROFILE_ROUTE_ERROR]",
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

    return jsonResponse(
      {
        success: false,

        code:
          "UPDATE_ORGANIZER_PROFILE_FAILED",

        message:
          "Impossible de mettre à jour votre profil pour le moment.",
      },
      500,
    );
  }
}

/*
 * PUT est accepté également pour garantir
 * la compatibilité avec le futur formulaire.
 */
export async function PUT(
  request: Request,
): Promise<
  NextResponse<UpdateOrganizerProfileResponse>
> {
  return PATCH(request);
}