import {
  createHash,
  randomInt,
} from "node:crypto";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PASSWORD_RESET_EXPIRES_MINUTES =
  getPositiveInteger(
    process.env.CLIENT_PASSWORD_RESET_EXPIRES_MINUTES,
    10,
  );

const PASSWORD_RESET_RESEND_DELAY_SECONDS =
  getPositiveInteger(
    process.env.CLIENT_PASSWORD_RESET_RESEND_DELAY_SECONDS,
    60,
  );

const forgotPasswordSchema = z.object({
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
});

function getPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsedValue = Number.parseInt(
    value ?? "",
    10,
  );

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return fallback;
  }

  return parsedValue;
}

function generateResetCode(): string {
  return randomInt(
    100000,
    1000000,
  ).toString();
}

function hashResetCode(
  code: string,
): string {
  return createHash("sha256")
    .update(code)
    .digest("hex");
}

function getPasswordResetSender(): string {
  return (
    process.env.MAIL_FROM_CUSTOMERS?.trim() ||
    process.env.MAIL_FROM_SECURITY?.trim() ||
    process.env.MAIL_FROM_VERIFICATION?.trim() ||
    "Tikemia <noreply@tikemia.com>"
  );
}

function escapeHtml(
  value: string,
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createErrorResponse({
  message,
  status,
  retryAfterSeconds,
}: {
  message: string;
  status: number;
  retryAfterSeconds?: number;
}) {
  return NextResponse.json(
    {
      success: false,
      message,
      retryAfterSeconds,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",

        ...(retryAfterSeconds
          ? {
              "Retry-After": String(
                retryAfterSeconds,
              ),
            }
          : {}),
      },
    },
  );
}

function createSuccessResponse({
  email,
}: {
  email: string;
}) {
  return NextResponse.json(
    {
      success: true,

      message:
        "Si un compte client correspond à cette adresse, un code de réinitialisation vient d’être envoyé.",

      redirectTo:
        `/reset-password?email=${encodeURIComponent(
          email,
        )}`,

      expiresInMinutes:
        PASSWORD_RESET_EXPIRES_MINUTES,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function sendPasswordResetEmail({
  firstName,
  email,
  code,
}: {
  firstName: string;
  email: string;
  code: string;
}): Promise<void> {
  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY_MISSING",
    );
  }

  const resend = new Resend(apiKey);

  const safeFirstName =
    escapeHtml(firstName);

  const safeCode =
    escapeHtml(code);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "https://tikemia.com";

  const resetUrl =
    `${appUrl}/reset-password?email=${encodeURIComponent(
      email,
    )}`;

  const result =
    await resend.emails.send({
      from:
        getPasswordResetSender(),

      to: [email],

      replyTo:
        process.env.MAIL_REPLY_TO_SUPPORT?.trim() ||
        undefined,

      subject:
        `${code} — Réinitialisation de votre mot de passe Tikemia`,

      text: [
        `Bonjour ${firstName},`,
        "",
        "Vous avez demandé la réinitialisation de votre mot de passe Tikemia.",
        "",
        `Votre code de réinitialisation est : ${code}`,
        "",
        `Ce code expire dans ${PASSWORD_RESET_EXPIRES_MINUTES} minutes.`,
        "",
        `Vous pouvez continuer ici : ${resetUrl}`,
        "",
        "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.",
        "",
        "Tikemia",
        appUrl,
      ].join("\n"),

      html: `
        <!doctype html>
        <html lang="fr">
          <head>
            <meta charset="utf-8" />

            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />

            <title>
              Réinitialisation du mot de passe Tikemia
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
                          Réinitialisez votre mot de passe
                        </h1>

                        <p
                          style="
                            margin: 18px 0 0;
                            color: #a3a3a3;
                            font-size: 15px;
                            line-height: 25px;
                          "
                        >
                          Utilisez le code ci-dessous pour créer un nouveau mot de passe Tikemia.
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
                          ${PASSWORD_RESET_EXPIRES_MINUTES}
                          minutes.
                        </p>

                        <table
                          role="presentation"
                          cellspacing="0"
                          cellpadding="0"
                          border="0"
                          style="
                            margin-top: 26px;
                          "
                        >
                          <tr>
                            <td
                              style="
                                border-radius: 12px;
                                background: #84cc16;
                              "
                            >
                              <a
                                href="${resetUrl}"
                                style="
                                  display: inline-block;
                                  padding: 14px 22px;
                                  color: #071000;
                                  font-size: 14px;
                                  font-weight: 900;
                                  text-decoration: none;
                                "
                              >
                                Créer un nouveau mot de passe
                              </a>
                            </td>
                          </tr>
                        </table>

                        <p
                          style="
                            margin: 24px 0 0;
                            color: #737373;
                            font-size: 13px;
                            line-height: 22px;
                          "
                        >
                          Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail. Votre mot de passe actuel restera inchangé.
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

  if (result.error) {
    console.error(
      "[CLIENT_PASSWORD_RESET_EMAIL_ERROR]",
      result.error,
    );

    throw new Error(
      "PASSWORD_RESET_EMAIL_SEND_FAILED",
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return createErrorResponse({
        message:
          "Les informations envoyées sont invalides.",
        status: 400,
      });
    }

    const validation =
      forgotPasswordSchema.safeParse(
        body,
      );

    if (!validation.success) {
      return createErrorResponse({
        message:
          validation.error.issues[0]
            ?.message ||
          "L’adresse e-mail est invalide.",
        status: 400,
      });
    }

    const { email } =
      validation.data;

    const user =
      await prisma.user.findUnique({
        where: {
          email,
        },

        select: {
          id: true,
          firstName: true,
          email: true,
          role: true,
          emailVerified: true,
          isActive: true,
        },
      });

    /*
     * Réponse volontairement identique lorsque le compte
     * n’existe pas afin de ne pas révéler les adresses
     * enregistrées sur Tikemia.
     */
    if (
      !user ||
      user.role !== "CUSTOMER" ||
      !user.isActive
    ) {
      return createSuccessResponse({
        email,
      });
    }

    /*
     * Un compte non vérifié doit d’abord terminer
     * la vérification de son adresse e-mail.
     */
    if (!user.emailVerified) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Votre adresse e-mail n’est pas encore vérifiée.",

          redirectTo:
            `/verify-email?email=${encodeURIComponent(
              user.email,
            )}`,
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const latestReset =
      await prisma.passwordReset.findFirst({
        where: {
          userId: user.id,
          email: user.email,
        },

        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          createdAt: true,
          status: true,
        },
      });

    if (latestReset) {
      const elapsedSeconds =
        Math.floor(
          (
            Date.now() -
            latestReset.createdAt.getTime()
          ) /
            1000,
        );

      if (
        elapsedSeconds <
        PASSWORD_RESET_RESEND_DELAY_SECONDS
      ) {
        const retryAfterSeconds =
          PASSWORD_RESET_RESEND_DELAY_SECONDS -
          elapsedSeconds;

        return createErrorResponse({
          message:
            `Patientez ${retryAfterSeconds} seconde${
              retryAfterSeconds > 1
                ? "s"
                : ""
            } avant de demander un nouveau code.`,

          status: 429,
          retryAfterSeconds,
        });
      }
    }

    const resetCode =
      generateResetCode();

    const codeHash =
      hashResetCode(
        resetCode,
      );

    const expiresAt =
      new Date(
        Date.now() +
          PASSWORD_RESET_EXPIRES_MINUTES *
            60 *
            1000,
      );

    const passwordReset =
      await prisma.$transaction(
        async (transaction) => {
          /*
           * Tous les anciens codes encore actifs
           * deviennent immédiatement invalides.
           */
          await transaction.passwordReset.updateMany({
            where: {
              userId: user.id,
              status: "PENDING",
            },

            data: {
              status: "EXPIRED",
            },
          });

          return transaction.passwordReset.create({
            data: {
              userId: user.id,
              email: user.email,
              codeHash,
              status: "PENDING",
              attempts: 0,
              expiresAt,
            },

            select: {
              id: true,
            },
          });
        },
      );

    try {
      await sendPasswordResetEmail({
        firstName:
          user.firstName,
        email:
          user.email,
        code:
          resetCode,
      });
    } catch (emailError) {
      console.error(
        "[CLIENT_FORGOT_PASSWORD_SEND_ERROR]",
        emailError,
      );

      await prisma.passwordReset
        .update({
          where: {
            id: passwordReset.id,
          },

          data: {
            status: "EXPIRED",
          },
        })
        .catch(
          (cleanupError) => {
            console.error(
              "[CLIENT_FORGOT_PASSWORD_CLEANUP_ERROR]",
              cleanupError,
            );
          },
        );

      return createErrorResponse({
        message:
          "Impossible d’envoyer le code de réinitialisation pour le moment. Réessayez.",
        status: 500,
      });
    }

    return createSuccessResponse({
      email: user.email,
    });
  } catch (error) {
    console.error(
      "[CLIENT_FORGOT_PASSWORD_ERROR]",
      error,
    );

    return createErrorResponse({
      message:
        "Impossible de traiter votre demande pour le moment. Réessayez.",
      status: 500,
    });
  }
}