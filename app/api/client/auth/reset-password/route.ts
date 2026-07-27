import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_SESSION_COOKIE_NAME =
  process.env.CLIENT_SESSION_COOKIE_NAME?.trim() ||
  "tikemia_client_session";

const PASSWORD_RESET_MAX_ATTEMPTS =
  getPositiveInteger(
    process.env.CLIENT_PASSWORD_RESET_MAX_ATTEMPTS,
    5,
  );

const PASSWORD_HASH_ROUNDS =
  getPositiveInteger(
    process.env.PASSWORD_HASH_ROUNDS,
    12,
  );

const resetPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("L’adresse e-mail est invalide.")
      .max(
        190,
        "L’adresse e-mail est trop longue.",
      )
      .transform((value) =>
        value.toLowerCase(),
      ),

    code: z
      .string()
      .trim()
      .regex(
        /^\d{6}$/,
        "Le code doit contenir exactement 6 chiffres.",
      ),

    password: z
      .string()
      .min(
        8,
        "Le mot de passe doit contenir au moins 8 caractères.",
      )
      .max(
        200,
        "Le mot de passe est trop long.",
      )
      .regex(
        /[A-Z]/,
        "Le mot de passe doit contenir une lettre majuscule.",
      )
      .regex(
        /[a-z]/,
        "Le mot de passe doit contenir une lettre minuscule.",
      )
      .regex(
        /\d/,
        "Le mot de passe doit contenir un chiffre.",
      ),

    confirmPassword: z
      .string()
      .min(
        1,
        "La confirmation du mot de passe est obligatoire.",
      )
      .max(
        200,
        "La confirmation du mot de passe est trop longue.",
      ),
  })
  .superRefine(
    (
      values,
      context,
    ) => {
      if (
        values.password !==
        values.confirmPassword
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [
            "confirmPassword",
          ],
          message:
            "Les deux mots de passe ne correspondent pas.",
        });
      }
    },
  );

function getPositiveInteger(
  value: string | undefined,
  fallback: number,
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
    parsedValue <= 0
  ) {
    return fallback;
  }

  return parsedValue;
}

function hashResetCode(
  code: string,
): string {
  return createHash("sha256")
    .update(code)
    .digest("hex");
}

function hashesMatch(
  firstHash: string,
  secondHash: string,
): boolean {
  const firstBuffer =
    Buffer.from(
      firstHash,
      "hex",
    );

  const secondBuffer =
    Buffer.from(
      secondHash,
      "hex",
    );

  if (
    firstBuffer.length !==
    secondBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    firstBuffer,
    secondBuffer,
  );
}

function createErrorResponse({
  message,
  status,
  field,
  redirectTo,
}: {
  message: string;
  status: number;
  field?: string;
  redirectTo?: string;
}) {
  return NextResponse.json(
    {
      success: false,
      message,
      field,
      redirectTo,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}

function clearClientSessionCookie(
  response: NextResponse,
): void {
  response.cookies.set({
    name:
      CLIENT_SESSION_COOKIE_NAME,

    value: "",

    httpOnly: true,

    secure:
      process.env.NODE_ENV ===
      "production",

    sameSite: "lax",

    path: "/",

    maxAge: 0,

    expires:
      new Date(0),
  });
}

export async function POST(
  request: Request,
) {
  try {
    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      return createErrorResponse({
        message:
          "Les informations envoyées sont invalides.",
        status: 400,
      });
    }

    const validation =
      resetPasswordSchema.safeParse(
        body,
      );

    if (
      !validation.success
    ) {
      const firstIssue =
        validation.error.issues[0];

      return createErrorResponse({
        message:
          firstIssue?.message ||
          "Vérifiez les informations saisies.",

        status: 400,

        field:
          firstIssue?.path[0]?.toString(),
      });
    }

    const {
      email,
      code,
      password,
    } = validation.data;

    const user =
      await prisma.user.findUnique({
        where: {
          email,
        },

        select: {
          id: true,
          email: true,
          role: true,
          emailVerified: true,
          isActive: true,
          passwordHash: true,
        },
      });

    if (
      !user ||
      user.role !== "CUSTOMER"
    ) {
      return createErrorResponse({
        message:
          "Le code de réinitialisation est invalide ou a expiré.",
        status: 400,
      });
    }

    if (!user.isActive) {
      return createErrorResponse({
        message:
          "Ce compte client est actuellement désactivé.",
        status: 403,
      });
    }

    if (!user.emailVerified) {
      return createErrorResponse({
        message:
          "Votre adresse e-mail doit être vérifiée avant de modifier votre mot de passe.",

        status: 403,

        redirectTo:
          `/verify-email?email=${encodeURIComponent(
            user.email,
          )}`,
      });
    }

    const passwordReset =
      await prisma.passwordReset.findFirst({
        where: {
          userId: user.id,
          email: user.email,
          status: "PENDING",
        },

        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          codeHash: true,
          attempts: true,
          expiresAt: true,
          status: true,
        },
      });

    if (!passwordReset) {
      return createErrorResponse({
        message:
          "Aucun code de réinitialisation actif n’a été trouvé. Demandez un nouveau code.",
        status: 404,
        redirectTo:
          "/forgot-password",
      });
    }

    const now =
      new Date();

    if (
      passwordReset.expiresAt <=
      now
    ) {
      await prisma.passwordReset.update({
        where: {
          id: passwordReset.id,
        },

        data: {
          status: "EXPIRED",
        },
      });

      return createErrorResponse({
        message:
          "Ce code a expiré. Demandez un nouveau code.",
        status: 410,
        redirectTo:
          "/forgot-password",
      });
    }

    if (
      passwordReset.attempts >=
      PASSWORD_RESET_MAX_ATTEMPTS
    ) {
      await prisma.passwordReset.update({
        where: {
          id: passwordReset.id,
        },

        data: {
          status: "EXPIRED",
        },
      });

      return createErrorResponse({
        message:
          "Le nombre maximal d’essais a été atteint. Demandez un nouveau code.",
        status: 429,
        redirectTo:
          "/forgot-password",
      });
    }

    const submittedCodeHash =
      hashResetCode(code);

    const codeIsValid =
      hashesMatch(
        submittedCodeHash,
        passwordReset.codeHash,
      );

    if (!codeIsValid) {
      const nextAttempts =
        passwordReset.attempts +
        1;

      const mustExpire =
        nextAttempts >=
        PASSWORD_RESET_MAX_ATTEMPTS;

      await prisma.passwordReset.update({
        where: {
          id: passwordReset.id,
        },

        data: {
          attempts:
            nextAttempts,

          status:
            mustExpire
              ? "EXPIRED"
              : "PENDING",
        },
      });

      if (mustExpire) {
        return createErrorResponse({
          message:
            "Le nombre maximal d’essais a été atteint. Demandez un nouveau code.",
          status: 429,
          field: "code",
          redirectTo:
            "/forgot-password",
        });
      }

      const remainingAttempts =
        PASSWORD_RESET_MAX_ATTEMPTS -
        nextAttempts;

      return createErrorResponse({
        message:
          remainingAttempts > 1
            ? `Code incorrect. Il vous reste ${remainingAttempts} essais.`
            : "Code incorrect. Il vous reste un seul essai.",

        status: 400,

        field: "code",
      });
    }

    const newPasswordHash =
      await hash(
        password,
        PASSWORD_HASH_ROUNDS,
      );

    await prisma.$transaction(
      async (transaction) => {
        await transaction.user.update({
          where: {
            id: user.id,
          },

          data: {
            passwordHash:
              newPasswordHash,
          },
        });

        await transaction.passwordReset.update({
          where: {
            id: passwordReset.id,
          },

          data: {
            status: "USED",
            usedAt: now,
          },
        });

        /*
         * Invalide les autres codes encore actifs.
         */
        await transaction.passwordReset.updateMany({
          where: {
            userId: user.id,

            id: {
              not: passwordReset.id,
            },

            status: "PENDING",
          },

          data: {
            status: "EXPIRED",
          },
        });

        /*
         * Déconnecte toutes les anciennes sessions.
         * Le client devra se reconnecter avec son
         * nouveau mot de passe.
         */
        await transaction.session.deleteMany({
          where: {
            userId: user.id,
          },
        });
      },
    );

    const response =
      NextResponse.json(
        {
          success: true,

          message:
            "Votre mot de passe a été modifié avec succès.",

          redirectTo:
            "/login?reset=success",
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );

    clearClientSessionCookie(
      response,
    );

    return response;
  } catch (error) {
    console.error(
      "[CLIENT_RESET_PASSWORD_ERROR]",
      error,
    );

    return createErrorResponse({
      message:
        "Impossible de modifier votre mot de passe pour le moment. Réessayez.",
      status: 500,
    });
  }
}