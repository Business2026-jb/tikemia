import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  cookies,
} from "next/headers";
import {
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  prisma,
} from "@/lib/prisma";
import {
  SCANNER_SESSION_COOKIE_NAME,
} from "@/lib/scanner/get-scanner-session";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

const ORGANIZER_SESSION_COOKIE_NAME =
  process.env
    .SESSION_COOKIE_NAME
    ?.trim() ||
  "tikemia_session";

const SCANNER_SESSION_DURATION_SECONDS =
  60 * 60 * 12;

const loginSchema =
  z.object({
    email:
      z.string()
        .trim()
        .email(
          "Saisissez une adresse e-mail valide.",
        )
        .max(
          320,
          "L’adresse e-mail est trop longue.",
        )
        .transform(
          (
            value,
          ) =>
            value.toLowerCase(),
        ),
  })
    .strict();

type OrganizerSessionLookup =
  Readonly<{
    id: string;
    expiresAt: Date;

    user: Readonly<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      role: string;
      emailVerified: boolean;
      isActive: boolean;
    }>;
  }>;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",

        Pragma:
          "no-cache",

        Expires:
          "0",

        "X-Content-Type-Options":
          "nosniff",

        "Referrer-Policy":
          "same-origin",
      },
    },
  );
}

async function readJsonBody(
  request: Request,
): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function hashSessionToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      token,
      "utf8",
    )
    .digest(
      "hex",
    );
}

function createSessionToken():
  string {
  return randomBytes(
    48,
  ).toString(
    "base64url",
  );
}

function getCookieSecureFlag():
  boolean {
  return (
    process.env.NODE_ENV ===
      "production" ||
    process.env
      .NEXT_PUBLIC_APP_URL
      ?.trim()
      .startsWith(
        "https://",
      ) === true ||
    process.env
      .APP_URL
      ?.trim()
      .startsWith(
        "https://",
      ) === true
  );
}

async function getAuthenticatedOrganizerSession():
  Promise<OrganizerSessionLookup | null> {
  const cookieStore =
    await cookies();

  const organizerToken =
    normalizeText(
      cookieStore.get(
        ORGANIZER_SESSION_COOKIE_NAME,
      )?.value,
    );

  if (!organizerToken) {
    return null;
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(
            organizerToken,
          ),
      },

      select: {
        id:
          true,

        expiresAt:
          true,

        user: {
          select: {
            id:
              true,

            firstName:
              true,

            lastName:
              true,

            email:
              true,

            phone:
              true,

            role:
              true,

            emailVerified:
              true,

            isActive:
              true,
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
          id:
            session.id,
        },
      })
      .catch(
        () =>
          undefined,
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

  return session;
}

async function replaceScannerSession({
  userId,
}: {
  userId: string;
}): Promise<{
  rawToken: string;
  expiresAt: Date;
}> {
  const rawToken =
    createSessionToken();

  const tokenHash =
    hashSessionToken(
      rawToken,
    );

  const expiresAt =
    new Date(
      Date.now() +
        SCANNER_SESSION_DURATION_SECONDS *
          1000,
    );

  const cookieStore =
    await cookies();

  const currentScannerToken =
    normalizeText(
      cookieStore.get(
        SCANNER_SESSION_COOKIE_NAME,
      )?.value,
    );

  const currentScannerTokenHash =
    currentScannerToken
      ? hashSessionToken(
          currentScannerToken,
        )
      : null;

  await prisma.$transaction(
    async (
      transaction,
    ) => {
      if (
        currentScannerTokenHash
      ) {
        await transaction.session.deleteMany({
          where: {
            tokenHash:
              currentScannerTokenHash,
          },
        });
      }

      await transaction.session.deleteMany({
        where: {
          userId,

          expiresAt: {
            lte:
              new Date(),
          },
        },
      });

      await transaction.session.create({
        data: {
          userId,

          tokenHash,

          expiresAt,
        },
      });
    },
  );

  return {
    rawToken,
    expiresAt,
  };
}

async function setScannerCookie({
  rawToken,
  expiresAt,
}: {
  rawToken: string;
  expiresAt: Date;
}): Promise<void> {
  const cookieStore =
    await cookies();

  cookieStore.set(
    SCANNER_SESSION_COOKIE_NAME,
    rawToken,
    {
      httpOnly:
        true,

      secure:
        getCookieSecureFlag(),

      sameSite:
        "lax",

      path:
        "/",

      maxAge:
        SCANNER_SESSION_DURATION_SECONDS,

      expires:
        expiresAt,
    },
  );
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  try {
    const body =
      await readJsonBody(
        request,
      );

    const parsed =
      loginSchema.safeParse(
        body,
      );

    if (!parsed.success) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "SCANNER_LOGIN_INVALID",

            message:
              parsed.error.issues[0]
                ?.message ??
              "L’adresse e-mail est invalide.",

            fields:
              parsed.error.flatten()
                .fieldErrors,
          },
        },
        400,
      );
    }

    const organizerSession =
      await getAuthenticatedOrganizerSession();

    if (!organizerSession) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "ORGANIZER_SESSION_REQUIRED",

            message:
              "Votre session organisateur est introuvable ou expirée. Reconnectez-vous à votre espace organisateur.",
          },
        },
        401,
      );
    }

    const submittedEmail =
      parsed.data.email;

    const authenticatedEmail =
      organizerSession.user.email
        .trim()
        .toLowerCase();

    if (
      submittedEmail !==
      authenticatedEmail
    ) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "ORGANIZER_EMAIL_MISMATCH",

            message:
              "Cette adresse e-mail ne correspond pas au compte organisateur actuellement connecté.",
          },
        },
        403,
      );
    }

    const scannerSession =
      await replaceScannerSession({
        userId:
          organizerSession.user.id,
      });

    await setScannerCookie({
      rawToken:
        scannerSession.rawToken,

      expiresAt:
        scannerSession.expiresAt,
    });

    return jsonResponse({
      success:
        true,

      message:
        "Compte organisateur reconnu. Accès au scanner autorisé.",

      scanner: {
        id:
          organizerSession.user.id,

        firstName:
          organizerSession.user.firstName,

        lastName:
          organizerSession.user.lastName,

        email:
          organizerSession.user.email,

        phone:
          organizerSession.user.phone,

        role:
          organizerSession.user.role,
      },

      session: {
        expiresAt:
          scannerSession.expiresAt.toISOString(),
      },

      redirectTo:
        "/scanner",
    });
  } catch (error) {
    console.error(
      "[SCANNER_ORGANIZER_ACCESS_ERROR]",
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

    return jsonResponse(
      {
        success:
          false,

        error: {
          code:
            "SCANNER_ACCESS_FAILED",

          message:
            "Impossible d’accéder au scanner Tikemia pour le moment.",
        },
      },
      500,
    );
  }
}