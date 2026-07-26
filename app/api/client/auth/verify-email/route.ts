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

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const CLIENT_SESSION_COOKIE_NAME =
  process.env
    .CLIENT_SESSION_COOKIE_NAME
    ?.trim() ||
  "tikemia_client_session";

const CLIENT_SESSION_MAX_AGE =
  getPositiveInteger(
    process.env
      .CLIENT_SESSION_MAX_AGE,
    60 *
      60 *
      24 *
      30,
  );

const CLIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS =
  getPositiveInteger(
    process.env
      .CLIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS,
    5,
  );

const verifyEmailSchema =
  z.object({
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

    code:
      z
        .string()
        .trim()
        .regex(
          /^\d{6}$/,
          "Le code doit contenir exactement 6 chiffres.",
        ),
  });

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

function hashValue(
  value:
    string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      value,
    )
    .digest(
      "hex",
    );
}

function createSessionToken(): string {
  return randomBytes(
    48,
  ).toString(
    "hex",
  );
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
          "no-store",
      },
    },
  );
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
      verifyEmailSchema.safeParse(
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
      code,
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

          role:
            true,

          emailVerified:
            true,

          isActive:
            true,
        },
      });

    if (
      !user ||
      user.role !==
        "CUSTOMER"
    ) {
      return createErrorResponse({
        message:
          "Aucun compte client correspondant n’a été trouvé.",
        status:
          404,
        field:
          "email",
        redirectTo:
          "/register",
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

    /*
     * Lorsqu’un compte est déjà vérifié, on crée simplement
     * une nouvelle session afin que le client puisse continuer.
     */
    if (
      user.emailVerified
    ) {
      const sessionToken =
        createSessionToken();

      const tokenHash =
        hashValue(
          sessionToken,
        );

      const expiresAt =
        new Date(
          Date.now() +
            CLIENT_SESSION_MAX_AGE *
              1000,
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
                    new Date(),
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

      const cookieStore =
        await cookies();

      cookieStore.set({
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
          CLIENT_SESSION_MAX_AGE,

        expires:
          expiresAt,
      });

      return NextResponse.json(
        {
          success:
            true,

          message:
            "Votre compte est déjà vérifié.",

          redirectTo:
            "/account/tickets",
        },
        {
          status:
            200,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    const verification =
      await prisma
        .emailVerification
        .findFirst({
          where: {
            userId:
              user.id,

            email:
              user.email,

            status:
              "PENDING",
          },

          orderBy: {
            createdAt:
              "desc",
          },

          select: {
            id:
              true,

            codeHash:
              true,

            attempts:
              true,

            expiresAt:
              true,

            status:
              true,
          },
        });

    if (
      !verification
    ) {
      return createErrorResponse({
        message:
          "Aucun code de vérification actif n’a été trouvé. Demandez un nouveau code.",
        status:
          404,
      });
    }

    const now =
      new Date();

    if (
      verification
        .expiresAt <=
      now
    ) {
      await prisma
        .emailVerification
        .update({
          where: {
            id:
              verification.id,
          },

          data: {
            status:
              "EXPIRED",
          },
        });

      return createErrorResponse({
        message:
          "Ce code a expiré. Demandez un nouveau code.",
        status:
          410,
      });
    }

    if (
      verification
        .attempts >=
      CLIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS
    ) {
      await prisma
        .emailVerification
        .update({
          where: {
            id:
              verification.id,
          },

          data: {
            status:
              "EXPIRED",
          },
        });

      return createErrorResponse({
        message:
          "Le nombre maximal d’essais a été atteint. Demandez un nouveau code.",
        status:
          429,
      });
    }

    const submittedCodeHash =
      hashValue(
        code,
      );

    if (
      submittedCodeHash !==
      verification.codeHash
    ) {
      const nextAttempts =
        verification.attempts +
        1;

      const codeMustExpire =
        nextAttempts >=
        CLIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS;

      await prisma
        .emailVerification
        .update({
          where: {
            id:
              verification.id,
          },

          data: {
            attempts:
              nextAttempts,

            status:
              codeMustExpire
                ? "EXPIRED"
                : "PENDING",
          },
        });

      if (
        codeMustExpire
      ) {
        return createErrorResponse({
          message:
            "Le nombre maximal d’essais a été atteint. Demandez un nouveau code.",
          status:
            429,
          field:
            "code",
        });
      }

      const remainingAttempts =
        CLIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS -
        nextAttempts;

      return createErrorResponse({
        message:
          remainingAttempts >
          1
            ? `Code incorrect. Il vous reste ${remainingAttempts} essais.`
            : "Code incorrect. Il vous reste un seul essai.",
        status:
          400,
        field:
          "code",
      });
    }

    const sessionToken =
      createSessionToken();

    const tokenHash =
      hashValue(
        sessionToken,
      );

    const sessionExpiresAt =
      new Date(
        Date.now() +
          CLIENT_SESSION_MAX_AGE *
            1000,
      );

    await prisma.$transaction(
      async (
        transaction,
      ) => {
        await transaction
          .user
          .update({
            where: {
              id:
                user.id,
            },

            data: {
              emailVerified:
                true,
            },
          });

        await transaction
          .emailVerification
          .update({
            where: {
              id:
                verification.id,
            },

            data: {
              status:
                "VERIFIED",

              verifiedAt:
                now,
            },
          });

        /*
         * Les anciens codes encore en attente sont invalidés.
         */
        await transaction
          .emailVerification
          .updateMany({
            where: {
              userId:
                user.id,

              id: {
                not:
                  verification.id,
              },

              status:
                "PENDING",
            },

            data: {
              status:
                "EXPIRED",
            },
          });

        /*
         * Les commandes réalisées avant la création du compte
         * sont automatiquement rattachées grâce à l’e-mail.
         */
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

        /*
         * Nettoyage des anciennes sessions expirées.
         */
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

              expiresAt:
                sessionExpiresAt,
            },
          });
      },
    );

    const cookieStore =
      await cookies();

    cookieStore.set({
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
        CLIENT_SESSION_MAX_AGE,

      expires:
        sessionExpiresAt,
    });

    return NextResponse.json(
      {
        success:
          true,

        message:
          "Votre compte Tikemia a été vérifié avec succès.",

        redirectTo:
          "/account/tickets",

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
            "no-store",
        },
      },
    );
  } catch (
    error
  ) {
    console.error(
      "[CLIENT_VERIFY_EMAIL_ERROR]",
      error,
    );

    return createErrorResponse({
      message:
        "Impossible de vérifier votre compte pour le moment. Réessayez.",
      status:
        500,
    });
  }
}