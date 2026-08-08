import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  compare,
} from "bcryptjs";
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

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

const DEFAULT_SESSION_COOKIE_NAME =
  "tikemia_session";

const DEFAULT_SHORT_SESSION_MAX_AGE =
  60 * 60 * 24;

const DEFAULT_LONG_SESSION_MAX_AGE =
  60 * 60 * 24 * 7;

const MIN_SESSION_MAX_AGE =
  60 * 60;

const MAX_SESSION_MAX_AGE =
  60 * 60 * 24 * 30;

const loginSchema =
  z.object({
    email:
      z.string()
        .trim()
        .toLowerCase()
        .email(
          "L’adresse e-mail n’est pas valide.",
        )
        .max(
          254,
          "L’adresse e-mail est trop longue.",
        ),

    password:
      z.string()
        .min(
          1,
          "Renseignez votre mot de passe.",
        )
        .max(
          128,
          "Le mot de passe est trop long.",
        ),

    rememberMe:
      z.boolean()
        .optional()
        .default(
          false,
        ),
  })
    .strict();

type LoginResponseBody =
  Readonly<{
    success: boolean;
    message: string;
    redirectTo?: string;
    error?: Readonly<{
      code: string;
      message: string;
    }>;
  }>;

function jsonResponse(
  body: LoginResponseBody,
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

        "Content-Type":
          "application/json; charset=utf-8",

        "X-Content-Type-Options":
          "nosniff",

        "Referrer-Policy":
          "same-origin",
      },
    },
  );
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

function normalizeCookieName(
  value:
    | string
    | null
    | undefined,
): string {
  const normalizedValue =
    value?.trim();

  return normalizedValue ||
    DEFAULT_SESSION_COOKIE_NAME;
}

function getSessionDuration(
  rememberMe: boolean,
): number {
  if (!rememberMe) {
    return DEFAULT_SHORT_SESSION_MAX_AGE;
  }

  const configuredValue =
    Number(
      process.env
        .SESSION_MAX_AGE ??
        DEFAULT_LONG_SESSION_MAX_AGE,
    );

  if (
    !Number.isInteger(
      configuredValue,
    ) ||
    configuredValue <
      MIN_SESSION_MAX_AGE ||
    configuredValue >
      MAX_SESSION_MAX_AGE
  ) {
    return DEFAULT_LONG_SESSION_MAX_AGE;
  }

  return configuredValue;
}

function getSecureCookieFlag():
  boolean {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return true;
  }

  const applicationUrl =
    process.env
      .NEXT_PUBLIC_APP_URL
      ?.trim() ||
    process.env
      .APP_URL
      ?.trim() ||
    "";

  return applicationUrl.startsWith(
    "https://",
  );
}

async function readJsonBody(
  request: Request,
): Promise<unknown> {
  const contentType =
    request.headers.get(
      "content-type",
    ) ??
    "";

  if (
    !contentType
      .toLowerCase()
      .includes(
        "application/json",
      )
  ) {
    throw new Error(
      "INVALID_CONTENT_TYPE",
    );
  }

  try {
    return await request.json();
  } catch {
    throw new Error(
      "INVALID_JSON_BODY",
    );
  }
}

function getPublicErrorMessage(
  error: unknown,
): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  if (
    error.message ===
    "INVALID_CONTENT_TYPE"
  ) {
    return "Le format de la requête n’est pas valide.";
  }

  if (
    error.message ===
    "INVALID_JSON_BODY"
  ) {
    return "La requête envoyée n’est pas valide.";
  }

  return null;
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  try {
    let requestBody:
      unknown;

    try {
      requestBody =
        await readJsonBody(
          request,
        );
    } catch (error) {
      return jsonResponse(
        {
          success:
            false,

          message:
            getPublicErrorMessage(
              error,
            ) ??
            "La requête envoyée n’est pas valide.",

          error: {
            code:
              "INVALID_REQUEST",

            message:
              getPublicErrorMessage(
                error,
              ) ??
              "La requête envoyée n’est pas valide.",
          },
        },
        400,
      );
    }

    const validation =
      loginSchema.safeParse(
        requestBody,
      );

    if (!validation.success) {
      const validationMessage =
        validation.error
          .issues[0]
          ?.message ??
        "Vérifiez les informations renseignées.";

      return jsonResponse(
        {
          success:
            false,

          message:
            validationMessage,

          error: {
            code:
              "VALIDATION_ERROR",

            message:
              validationMessage,
          },
        },
        400,
      );
    }

    const {
      email,
      password,
      rememberMe,
    } =
      validation.data;

    const user =
      await prisma.user.findUnique({
        where: {
          email,
        },

        select: {
          id:
            true,

          passwordHash:
            true,

          role:
            true,

          emailVerified:
            true,

          isActive:
            true,
        },
      });

    /*
     * Le même message est volontairement utilisé lorsque
     * l’adresse ou le mot de passe est incorrect afin de
     * ne pas révéler l’existence d’un compte.
     */
    if (
      !user ||
      !user.passwordHash
    ) {
      return jsonResponse(
        {
          success:
            false,

          message:
            "Adresse e-mail ou mot de passe incorrect.",

          error: {
            code:
              "INVALID_CREDENTIALS",

            message:
              "Adresse e-mail ou mot de passe incorrect.",
          },
        },
        401,
      );
    }

    let passwordIsValid =
      false;

    try {
      passwordIsValid =
        await compare(
          password,
          user.passwordHash,
        );
    } catch (error) {
      console.error(
        "[ORGANIZER_LOGIN_PASSWORD_COMPARE_ERROR]",
        error instanceof Error
          ? {
              name:
                error.name,

              message:
                error.message,
            }
          : error,
      );

      return jsonResponse(
        {
          success:
            false,

          message:
            "Adresse e-mail ou mot de passe incorrect.",

          error: {
            code:
              "INVALID_CREDENTIALS",

            message:
              "Adresse e-mail ou mot de passe incorrect.",
          },
        },
        401,
      );
    }

    if (!passwordIsValid) {
      return jsonResponse(
        {
          success:
            false,

          message:
            "Adresse e-mail ou mot de passe incorrect.",

          error: {
            code:
              "INVALID_CREDENTIALS",

            message:
              "Adresse e-mail ou mot de passe incorrect.",
          },
        },
        401,
      );
    }

    if (
      user.role !==
      "ORGANIZER"
    ) {
      return jsonResponse(
        {
          success:
            false,

          message:
            "Ce compte ne correspond pas à un espace organisateur.",

          error: {
            code:
              "INVALID_ROLE",

            message:
              "Ce compte ne correspond pas à un espace organisateur.",
          },
        },
        403,
      );
    }

    if (!user.isActive) {
      return jsonResponse(
        {
          success:
            false,

          message:
            "Ce compte est désactivé. Contactez l’assistance Tikemia.",

          error: {
            code:
              "ACCOUNT_DISABLED",

            message:
              "Ce compte est désactivé. Contactez l’assistance Tikemia.",
          },
        },
        403,
      );
    }

    if (!user.emailVerified) {
      const redirectTo =
        `/organizer/verify-email?email=${encodeURIComponent(
          email,
        )}`;

      return jsonResponse(
        {
          success:
            false,

          message:
            "Confirmez d’abord votre adresse e-mail pour accéder à votre compte.",

          redirectTo,

          error: {
            code:
              "EMAIL_NOT_VERIFIED",

            message:
              "Confirmez d’abord votre adresse e-mail pour accéder à votre compte.",
          },
        },
        403,
      );
    }

    const sessionMaxAge =
      getSessionDuration(
        rememberMe,
      );

    const now =
      new Date();

    const sessionExpiresAt =
      new Date(
        now.getTime() +
          sessionMaxAge *
            1000,
      );

    const sessionToken =
      randomBytes(
        48,
      ).toString(
        "base64url",
      );

    const sessionTokenHash =
      hashSessionToken(
        sessionToken,
      );

    await prisma.$transaction(
      async (
        transaction,
      ) => {
        await transaction.session.deleteMany({
          where: {
            userId:
              user.id,

            expiresAt: {
              lte:
                now,
            },
          },
        });

        await transaction.session.create({
          data: {
            userId:
              user.id,

            tokenHash:
              sessionTokenHash,

            expiresAt:
              sessionExpiresAt,
          },
        });
      },
    );

    const sessionCookieName =
      normalizeCookieName(
        process.env
          .SESSION_COOKIE_NAME,
      );

    const cookieStore =
      await cookies();

    cookieStore.set(
      sessionCookieName,
      sessionToken,
      {
        httpOnly:
          true,

        secure:
          getSecureCookieFlag(),

        sameSite:
          "lax",

        path:
          "/",

        maxAge:
          sessionMaxAge,

        expires:
          sessionExpiresAt,
      },
    );

    return jsonResponse(
      {
        success:
          true,

        message:
          "Connexion réussie.",

        redirectTo:
          "/organizer/dashboard",
      },
      200,
    );
  } catch (error) {
    console.error(
      "[ORGANIZER_LOGIN_ERROR]",
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

        message:
          "Impossible de vous connecter pour le moment. Réessayez.",

        error: {
          code:
            "INTERNAL_ERROR",

          message:
            "Impossible de vous connecter pour le moment. Réessayez.",
        },
      },
      500,
    );
  }
}