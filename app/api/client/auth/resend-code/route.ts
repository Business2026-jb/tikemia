import {
  createHash,
  randomInt,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";
import {
  Resend,
} from "resend";
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

const EMAIL_VERIFICATION_EXPIRES_MINUTES =
  getPositiveInteger(
    process.env
      .CLIENT_EMAIL_VERIFICATION_EXPIRES_MINUTES,
    10,
  );

const RESEND_DELAY_SECONDS =
  getPositiveInteger(
    process.env
      .CLIENT_EMAIL_VERIFICATION_RESEND_DELAY_SECONDS,
    60,
  );

const resendCodeSchema =
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

function generateVerificationCode(): string {
  return randomInt(
    100000,
    1000000,
  ).toString();
}

function hashVerificationCode(
  code:
    string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      code,
    )
    .digest(
      "hex",
    );
}

function getVerificationSender(): string {
  return (
    process.env
      .MAIL_FROM_CUSTOMERS
      ?.trim() ||
    process.env
      .MAIL_FROM_VERIFICATION
      ?.trim() ||
    process.env
      .MAIL_FROM_SECURITY
      ?.trim() ||
    "Tikemia <noreply@tikemia.com>"
  );
}

function escapeHtml(
  value:
    string,
): string {
  return value
    .replace(
      /&/g,
      "&amp;",
    )
    .replace(
      /</g,
      "&lt;",
    )
    .replace(
      />/g,
      "&gt;",
    )
    .replace(
      /"/g,
      "&quot;",
    )
    .replace(
      /'/g,
      "&#039;",
    );
}

function createErrorResponse({
  message,
  status,
  retryAfterSeconds,
}: {
  message:
    string;
  status:
    number;
  retryAfterSeconds?:
    number;
}) {
  return NextResponse.json(
    {
      success:
        false,

      message,

      retryAfterSeconds,
    },
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",

        ...(retryAfterSeconds
          ? {
              "Retry-After":
                String(
                  retryAfterSeconds,
                ),
            }
          : {}),
      },
    },
  );
}

async function sendVerificationEmail({
  firstName,
  email,
  code,
}: {
  firstName:
    string;
  email:
    string;
  code:
    string;
}): Promise<void> {
  const apiKey =
    process.env
      .RESEND_API_KEY
      ?.trim();

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY_MISSING",
    );
  }

  const resend =
    new Resend(
      apiKey,
    );

  const safeFirstName =
    escapeHtml(
      firstName,
    );

  const safeCode =
    escapeHtml(
      code,
    );

  const appUrl =
    process.env
      .NEXT_PUBLIC_APP_URL
      ?.trim() ||
    process.env
      .APP_URL
      ?.trim() ||
    "https://tikemia.com";

  const result =
    await resend.emails.send({
      from:
        getVerificationSender(),

      to: [
        email,
      ],

      replyTo:
        process.env
          .MAIL_REPLY_TO_SUPPORT
          ?.trim() ||
        undefined,

      subject:
        `${code} — Nouveau code de vérification Tikemia`,

      text:
        [
          `Bonjour ${firstName},`,
          "",
          "Voici votre nouveau code de vérification Tikemia :",
          "",
          code,
          "",
          `Ce code expire dans ${EMAIL_VERIFICATION_EXPIRES_MINUTES} minutes.`,
          "",
          "L’ancien code n’est plus valide.",
          "",
          "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.",
          "",
          "Tikemia",
          appUrl,
        ].join(
          "\n",
        ),

      html:
        `
        <!doctype html>
        <html lang="fr">
          <head>
            <meta charset="utf-8" />

            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />

            <title>
              Nouveau code de vérification Tikemia
            </title>
          </head>

          <body
            style="
              margin: 0;
              padding: 0;
              background: #03070a;
              font-family: Arial, Helvetica, sans-serif;
              color: #ffffff;
            "
          >
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
              style="
                width: 100%;
                background: #03070a;
              "
            >
              <tr>
                <td
                  align="center"
                  style="
                    padding: 32px 16px;
                  "
                >
                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="
                      width: 100%;
                      max-width: 600px;
                      overflow: hidden;
                      border: 1px solid rgba(255,255,255,0.1);
                      border-radius: 24px;
                      background: #081015;
                    "
                  >
                    <tr>
                      <td
                        style="
                          height: 5px;
                          background: linear-gradient(
                            90deg,
                            #10b981,
                            #84cc16,
                            #f97316
                          );
                        "
                      ></td>
                    </tr>

                    <tr>
                      <td
                        style="
                          padding: 36px 32px 16px;
                        "
                      >
                        <div
                          style="
                            font-size: 24px;
                            font-weight: 900;
                            letter-spacing: -0.5px;
                          "
                        >
                          TIKEMIA
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td
                        style="
                          padding: 12px 32px 36px;
                        "
                      >
                        <p
                          style="
                            margin: 0 0 16px;
                            color: #a3a3a3;
                            font-size: 15px;
                            line-height: 24px;
                          "
                        >
                          Bonjour ${safeFirstName},
                        </p>

                        <h1
                          style="
                            margin: 0;
                            color: #ffffff;
                            font-size: 30px;
                            line-height: 38px;
                            font-weight: 900;
                          "
                        >
                          Voici votre nouveau code
                        </h1>

                        <p
                          style="
                            margin: 18px 0 0;
                            color: #a3a3a3;
                            font-size: 15px;
                            line-height: 25px;
                          "
                        >
                          Utilisez ce code pour terminer la vérification de votre compte Tikemia.
                        </p>

                        <div
                          style="
                            margin: 28px 0;
                            padding: 22px 16px;
                            border: 1px solid rgba(132,204,22,0.25);
                            border-radius: 16px;
                            background: rgba(132,204,22,0.08);
                            color: #bef264;
                            font-size: 36px;
                            font-weight: 900;
                            letter-spacing: 10px;
                            text-align: center;
                          "
                        >
                          ${safeCode}
                        </div>

                        <p
                          style="
                            margin: 0;
                            color: #737373;
                            font-size: 13px;
                            line-height: 22px;
                          "
                        >
                          Ce code expire dans
                          ${EMAIL_VERIFICATION_EXPIRES_MINUTES}
                          minutes. L’ancien code n’est plus valide.
                        </p>

                        <p
                          style="
                            margin: 18px 0 0;
                            color: #737373;
                            font-size: 13px;
                            line-height: 22px;
                          "
                        >
                          Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td
                        style="
                          border-top: 1px solid rgba(255,255,255,0.07);
                          padding: 20px 32px;
                          color: #525252;
                          font-size: 12px;
                          line-height: 20px;
                        "
                      >
                        © ${new Date().getFullYear()} Tikemia. Tous droits réservés.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
        `,
    });

  if (
    result.error
  ) {
    console.error(
      "[CLIENT_RESEND_CODE_EMAIL_ERROR]",
      result.error,
    );

    throw new Error(
      "VERIFICATION_EMAIL_SEND_FAILED",
    );
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
      resendCodeSchema.safeParse(
        body,
      );

    if (
      !validation.success
    ) {
      return createErrorResponse({
        message:
          validation
            .error
            .issues[0]
            ?.message ||
          "L’adresse e-mail est invalide.",

        status:
          400,
      });
    }

    const {
      email,
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
      user.emailVerified
    ) {
      return NextResponse.json(
        {
          success:
            true,

          message:
            "Votre adresse e-mail est déjà vérifiée.",

          redirectTo:
            "/login",
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

    const latestVerification =
      await prisma
        .emailVerification
        .findFirst({
          where: {
            userId:
              user.id,

            email:
              user.email,
          },

          orderBy: {
            createdAt:
              "desc",
          },

          select: {
            id:
              true,

            createdAt:
              true,

            status:
              true,
          },
        });

    if (
      latestVerification
    ) {
      const elapsedSeconds =
        Math.floor(
          (
            Date.now() -
            latestVerification
              .createdAt
              .getTime()
          ) /
            1000,
        );

      if (
        elapsedSeconds <
        RESEND_DELAY_SECONDS
      ) {
        const retryAfterSeconds =
          RESEND_DELAY_SECONDS -
          elapsedSeconds;

        return createErrorResponse({
          message:
            `Patientez ${retryAfterSeconds} seconde${
              retryAfterSeconds >
              1
                ? "s"
                : ""
            } avant de demander un nouveau code.`,

          status:
            429,

          retryAfterSeconds,
        });
      }
    }

    const verificationCode =
      generateVerificationCode();

    const codeHash =
      hashVerificationCode(
        verificationCode,
      );

    const expiresAt =
      new Date(
        Date.now() +
          EMAIL_VERIFICATION_EXPIRES_MINUTES *
            60 *
            1000,
      );

    const newVerification =
      await prisma.$transaction(
        async (
          transaction,
        ) => {
          await transaction
            .emailVerification
            .updateMany({
              where: {
                userId:
                  user.id,

                status:
                  "PENDING",
              },

              data: {
                status:
                  "EXPIRED",
              },
            });

          return transaction
            .emailVerification
            .create({
              data: {
                userId:
                  user.id,

                email:
                  user.email,

                codeHash,

                status:
                  "PENDING",

                attempts:
                  0,

                expiresAt,
              },

              select: {
                id:
                  true,
              },
            });
        },
      );

    try {
      await sendVerificationEmail({
        firstName:
          user.firstName,

        email:
          user.email,

        code:
          verificationCode,
      });
    } catch (
      emailError
    ) {
      console.error(
        "[CLIENT_RESEND_CODE_SEND_ERROR]",
        emailError,
      );

      await prisma
        .emailVerification
        .update({
          where: {
            id:
              newVerification.id,
          },

          data: {
            status:
              "EXPIRED",
          },
        })
        .catch(
          (
            cleanupError,
          ) => {
            console.error(
              "[CLIENT_RESEND_CODE_CLEANUP_ERROR]",
              cleanupError,
            );
          },
        );

      return createErrorResponse({
        message:
          "Impossible d’envoyer le nouveau code pour le moment. Réessayez.",

        status:
          500,
      });
    }

    return NextResponse.json(
      {
        success:
          true,

        message:
          "Un nouveau code de vérification vous a été envoyé.",

        expiresInMinutes:
          EMAIL_VERIFICATION_EXPIRES_MINUTES,

        resendAvailableInSeconds:
          RESEND_DELAY_SECONDS,
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
      "[CLIENT_RESEND_CODE_ERROR]",
      error,
    );

    return createErrorResponse({
      message:
        "Impossible de renvoyer le code pour le moment. Réessayez.",

      status:
        500,
    });
  }
}