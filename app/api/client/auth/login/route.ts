import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  UserRole,
} from "@prisma/client";
import {
  compare,
} from "bcryptjs";
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

const DEFAULT_CLIENT_SESSION_COOKIE_NAME =
  "tikemia_client_session";

const LEGACY_SESSION_COOKIE_NAME =
  "tikemia_session";

const CLIENT_SESSION_COOKIE_NAME =
  process.env
    .CLIENT_SESSION_COOKIE_NAME
    ?.trim() ||
  DEFAULT_CLIENT_SESSION_COOKIE_NAME;

const CLIENT_SESSION_MAX_AGE =
  getPositiveInteger(
    process.env
      .CLIENT_SESSION_MAX_AGE,
    60 * 60 * 24 * 30,
  );

const CLIENT_TEMPORARY_SESSION_MAX_AGE =
  getPositiveInteger(
    process.env
      .CLIENT_TEMPORARY_SESSION_MAX_AGE,
    60 * 60 * 8,
  );

const loginSchema =
  z
    .object({
      email:
        z
          .string()
          .trim()
          .email(
            "L’adresse e-mail est invalide.",
          )
          .max(
            190,
            "L’adresse e-mail est trop longue.",
          )
          .transform(
            (
              value,
            ) =>
              value.toLowerCase(),
          ),

      password:
        z
          .string()
          .min(
            1,
            "Le mot de passe est obligatoire.",
          )
          .max(
            200,
            "Le mot de passe est trop long.",
          ),

      rememberMe:
        z
          .boolean()
          .optional()
          .default(
            false,
          ),

      redirectTo:
        z
          .string()
          .trim()
          .max(
            500,
            "La destination de redirection est invalide.",
          )
          .optional(),
    })
    .strict();

function getPositiveInteger(
  value:
    | string
    | undefined,
  fallback:
    number,
): number {
  const parsedValue =
    Number.parseInt(
      value ?? "",
      10,
    );

  if (
    !Number.isInteger(
      parsedValue,
    ) ||
    parsedValue <=
      0
  ) {
    return fallback;
  }

  return parsedValue;
}

function hashSessionToken(
  token:
    string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      token,
    )
    .digest(
      "hex",
    );
}

function generateSessionToken(): string {
  return randomBytes(
    48,
  ).toString(
    "hex",
  );
}

function normalizeRedirectPath(
  value:
    | string
    | undefined,
): string {
  if (
    !value ||
    !value.startsWith(
      "/",
    ) ||
    value.startsWith(
      "//",
    )
  ) {
    return "/account/tickets";
  }

  const blockedPaths = [
    "/login",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
  ];

  const normalizedPath =
    value.split(
      "#",
    )[0] ??
    value;

  const pathWithoutQuery =
    normalizedPath.split(
      "?",
    )[0] ??
    normalizedPath;

  const isBlocked =
    blockedPaths.some(
      (
        blockedPath,
      ) =>
        pathWithoutQuery ===
          blockedPath ||
        pathWithoutQuery.startsWith(
          `${blockedPath}/`,
        ),
    );

  if (
    isBlocked
  ) {
    return "/account/tickets";
  }

  return value;
}

function createErrorResponse({
  message,
  status,
  field,
  redirectTo,
}: {
  message:
    string;
  status:
    number;
  field?:
    string;
  redirectTo?:
    string;
}) {
  return NextResponse.json(
    {
      success:
        false,

      message,

      field,

      redirectTo,
    },
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",

        Pragma:
          "no-cache",
      },
    },
  );
}

function clearOtherSessionCookies(
  response:
    NextResponse,
): void {
  const cookieNames =
    Array.from(
      new Set(
        [
          process.env
            .SESSION_COOKIE_NAME
            ?.trim(),

          DEFAULT_CLIENT_SESSION_COOKIE_NAME,

          LEGACY_SESSION_COOKIE_NAME,
        ].filter(
          (
            value,
          ): value is string =>
            Boolean(
              value &&
                value !==
                  CLIENT_SESSION_COOKIE_NAME,
            ),
        ),
      ),
    );

  for (
    const cookieName of
    cookieNames
  ) {
    response.cookies.set({
      name:
        cookieName,

      value:
        "",

      httpOnly:
        true,

      secure:
        process.env
          .NODE_ENV ===
        "production",

      sameSite:
        "lax",

      path:
        "/",

      maxAge:
        0,

      expires:
        new Date(0),
    });
  }
}

export async function POST(
  request:
    Request,
) {
  try {
    let body:
      unknown;

    try {
      body =
        await request.json();
    } catch {
      return createErrorResponse({
        message:
          "Les informations envoyées sont invalides.",

        status:
          400,
      });
    }

    const validation =
      loginSchema.safeParse(
        body,
      );

    if (
      !validation.success
    ) {
      const firstIssue =
        validation
          .error
          .issues[0];

      return createErrorResponse({
        message:
          firstIssue
            ?.message ||
          "Vérifiez les informations saisies.",

        status:
          400,

        field:
          firstIssue
            ?.path[0]
            ?.toString(),
      });
    }

    const {
      email,
      password,
      rememberMe,
      redirectTo,
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

          firstName:
            true,

          lastName:
            true,

          email:
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

    if (
      !user
    ) {
      return createErrorResponse({
        message:
          "Adresse e-mail ou mot de passe incorrect.",

        status:
          401,
      });
    }

    const passwordIsValid =
      await compare(
        password,
        user.passwordHash,
      );

    if (
      !passwordIsValid
    ) {
      return createErrorResponse({
        message:
          "Adresse e-mail ou mot de passe incorrect.",

        status:
          401,
      });
    }

    if (
      user.role !==
        UserRole.CUSTOMER
    ) {
      return createErrorResponse({
        message:
          "Ce compte n’est pas autorisé à accéder à l’espace client.",

        status:
          403,
      });
    }

    if (
      !user.isActive
    ) {
      return createErrorResponse({
        message:
          "Ce compte client est actuellement désactivé.",

        status:
          403,
      });
    }

    if (
      !user.emailVerified
    ) {
      const verificationRedirect =
        `/verify-email?email=${encodeURIComponent(
          user.email,
        )}`;

      return createErrorResponse({
        message:
          "Votre adresse e-mail n’est pas encore vérifiée.",

        status:
          403,

        redirectTo:
          verificationRedirect,
      });
    }

    const sessionMaxAge =
      rememberMe
        ? CLIENT_SESSION_MAX_AGE
        : CLIENT_TEMPORARY_SESSION_MAX_AGE;

    const sessionToken =
      generateSessionToken();

    const tokenHash =
      hashSessionToken(
        sessionToken,
      );

    const now =
      new Date();

    const expiresAt =
      new Date(
        now.getTime() +
          sessionMaxAge *
            1000,
      );

    const finalRedirectTo =
      normalizeRedirectPath(
        redirectTo,
      );

    await prisma.$transaction(
      async (
        transaction,
      ) => {
        await transaction
          .session
          .deleteMany({
            where: {
              userId:
                user.id,

              expiresAt: {
                lte:
                  now,
              },
            },
          });

        await transaction
          .session
          .create({
            data: {
              userId:
                user.id,

              tokenHash,

              expiresAt,
            },
          });

        await transaction
          .order
          .updateMany({
            where: {
              customerId:
                null,

              customerEmail: {
                equals:
                  user.email,

                mode:
                  "insensitive",
              },
            },

            data: {
              customerId:
                user.id,
            },
          });
      },
    );

    const response =
      NextResponse.json(
        {
          success:
            true,

          message:
            "Connexion réussie.",

          redirectTo:
            finalRedirectTo,

          customer: {
            id:
              user.id,

            firstName:
              user.firstName,

            lastName:
              user.lastName,

            email:
              user.email,
          },
        },
        {
          status:
            200,

          headers: {
            "Cache-Control":
              "no-store, max-age=0",

            Pragma:
              "no-cache",
          },
        },
      );

    response.cookies.set({
      name:
        CLIENT_SESSION_COOKIE_NAME,

      value:
        sessionToken,

      httpOnly:
        true,

      secure:
        process.env
          .NODE_ENV ===
        "production",

      sameSite:
        "lax",

      path:
        "/",

      maxAge:
        sessionMaxAge,

      expires:
        expiresAt,
    });

    clearOtherSessionCookies(
      response,
    );

    return response;
  } catch (
    error
  ) {
    console.error(
      "[CLIENT_LOGIN_ERROR]",
      error,
    );

    return createErrorResponse({
      message:
        "Impossible de vous connecter pour le moment. Réessayez.",

      status:
        500,
    });
  }
}