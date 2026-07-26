import {
  createHash,
  randomInt,
} from "node:crypto";

import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import {
  findClientCountryByCode,
} from "@/lib/client/auth/countries";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_VERIFICATION_EXPIRES_MINUTES =
  getPositiveInteger(
    process.env
      .CLIENT_EMAIL_VERIFICATION_EXPIRES_MINUTES,
    10,
  );

const PASSWORD_HASH_ROUNDS =
  getPositiveInteger(
    process.env.PASSWORD_HASH_ROUNDS,
    12,
  );

const registerSchema =
  z.object({
    firstName:
      z
        .string()
        .trim()
        .min(
          2,
          "Le prénom doit contenir au moins 2 caractères.",
        )
        .max(
          80,
          "Le prénom est trop long.",
        ),

    lastName:
      z
        .string()
        .trim()
        .min(
          2,
          "Le nom doit contenir au moins 2 caractères.",
        )
        .max(
          80,
          "Le nom est trop long.",
        ),

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
          (value) =>
            value.toLowerCase(),
        ),

    countryCode:
      z
        .string()
        .trim()
        .length(
          2,
          "Le pays sélectionné est invalide.",
        )
        .transform(
          (value) =>
            value.toUpperCase(),
        ),

    /*
     * Ces deux champs sont reçus depuis le formulaire,
     * mais les valeurs officielles seront récupérées
     * depuis countries.ts pour éviter toute falsification.
     */
    country:
      z
        .string()
        .trim()
        .optional(),

    dialCode:
      z
        .string()
        .trim()
        .optional(),

    phone:
      z
        .string()
        .trim()
        .min(
          4,
          "Le numéro de téléphone est trop court.",
        )
        .max(
          30,
          "Le numéro de téléphone est trop long.",
        ),

    password:
      z
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
  });

type RegisterInput =
  z.infer<
    typeof registerSchema
  >;

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
    parsedValue <= 0
  ) {
    return fallback;
  }

  return parsedValue;
}

function normalizePhone({
  dialCode,
  phone,
}: {
  dialCode:
    string;
  phone:
    string;
}): string {
  const normalizedDialCode =
    dialCode
      .replace(
        /[^\d+]/g,
        "",
      )
      .replace(
        /^(?!\+)/,
        "+",
      );

  let nationalNumber =
    phone.replace(
      /\D/g,
      "",
    );

  /*
   * Lorsqu’un numéro national commence par 0,
   * ce préfixe est généralement retiré devant
   * l’indicatif international.
   */
  if (
    nationalNumber.startsWith(
      "0",
    )
  ) {
    nationalNumber =
      nationalNumber.slice(
        1,
      );
  }

  const dialCodeDigits =
    normalizedDialCode.replace(
      /\D/g,
      "",
    );

  /*
   * Évite de dupliquer l’indicatif si le client
   * l’a déjà saisi dans le champ numéro.
   */
  if (
    nationalNumber.startsWith(
      dialCodeDigits,
    )
  ) {
    nationalNumber =
      nationalNumber.slice(
        dialCodeDigits.length,
      );
  }

  return `${normalizedDialCode}${nationalNumber}`;
}

function hashVerificationCode(
  code:
    string,
): string {
  return createHash(
    "sha256",
  )
    .update(code)
    .digest("hex");
}

function generateVerificationCode(): string {
  return randomInt(
    100000,
    1000000,
  ).toString();
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
    new Resend(apiKey);

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
        `${code} — Votre code de vérification Tikemia`,

      text:
        [
          `Bonjour ${firstName},`,
          "",
          "Bienvenue sur Tikemia.",
          "",
          `Votre code de vérification est : ${code}`,
          "",
          `Ce code expire dans ${EMAIL_VERIFICATION_EXPIRES_MINUTES} minutes.`,
          "",
          "Si vous n’êtes pas à l’origine de cette inscription, ignorez cet e-mail.",
          "",
          "Tikemia",
          appUrl,
        ].join("\n"),

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
              Vérification de votre compte Tikemia
            </title>
          </head>

          <body
            style="
              margin: 0;
              padding: 0;
              background: #03070a;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
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
                    padding:
                      32px 16px;
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
                      border:
                        1px solid
                        rgba(
                          255,
                          255,
                          255,
                          0.1
                        );
                      border-radius: 24px;
                      background: #081015;
                    "
                  >
                    <tr>
                      <td
                        style="
                          height: 5px;
                          background:
                            linear-gradient(
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
                          padding:
                            36px 32px
                            16px;
                        "
                      >
                        <div
                          style="
                            font-size:
                              24px;
                            font-weight:
                              900;
                            letter-spacing:
                              -0.5px;
                          "
                        >
                          TIKEMIA
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td
                        style="
                          padding:
                            12px 32px
                            36px;
                        "
                      >
                        <p
                          style="
                            margin:
                              0 0 16px;
                            color:
                              #a3a3a3;
                            font-size:
                              15px;
                            line-height:
                              24px;
                          "
                        >
                          Bonjour
                          ${safeFirstName},
                        </p>

                        <h1
                          style="
                            margin:
                              0;
                            color:
                              #ffffff;
                            font-size:
                              30px;
                            line-height:
                              38px;
                            font-weight:
                              900;
                          "
                        >
                          Vérifiez votre adresse e-mail
                        </h1>

                        <p
                          style="
                            margin:
                              18px 0 0;
                            color:
                              #a3a3a3;
                            font-size:
                              15px;
                            line-height:
                              25px;
                          "
                        >
                          Utilisez le code ci-dessous pour terminer la création de votre compte client Tikemia.
                        </p>

                        <div
                          style="
                            margin:
                              28px 0;
                            padding:
                              22px 16px;
                            border:
                              1px solid
                              rgba(
                                132,
                                204,
                                22,
                                0.25
                              );
                            border-radius:
                              16px;
                            background:
                              rgba(
                                132,
                                204,
                                22,
                                0.08
                              );
                            color:
                              #bef264;
                            font-size:
                              36px;
                            font-weight:
                              900;
                            letter-spacing:
                              10px;
                            text-align:
                              center;
                          "
                        >
                          ${safeCode}
                        </div>

                        <p
                          style="
                            margin: 0;
                            color:
                              #737373;
                            font-size:
                              13px;
                            line-height:
                              22px;
                          "
                        >
                          Ce code expire dans
                          ${EMAIL_VERIFICATION_EXPIRES_MINUTES}
                          minutes.
                        </p>

                        <p
                          style="
                            margin:
                              18px 0 0;
                            color:
                              #737373;
                            font-size:
                              13px;
                            line-height:
                              22px;
                          "
                        >
                          Si vous n’êtes pas à l’origine de cette inscription, vous pouvez ignorer cet e-mail.
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td
                        style="
                          border-top:
                            1px solid
                            rgba(
                              255,
                              255,
                              255,
                              0.07
                            );
                          padding:
                            20px 32px;
                          color:
                            #525252;
                          font-size:
                            12px;
                          line-height:
                            20px;
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
      "[CLIENT_VERIFICATION_EMAIL_ERROR]",
      result.error,
    );

    throw new Error(
      "VERIFICATION_EMAIL_SEND_FAILED",
    );
  }
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
  let createdUserId:
    string |
    null =
      null;

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
      registerSchema.safeParse(
        body,
      );

    if (!validation.success) {
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

    const input:
      RegisterInput =
        validation.data;

    const country =
      findClientCountryByCode(
        input.countryCode,
      );

    if (!country) {
      return createErrorResponse({
        message:
          "Le pays sélectionné n’est pas disponible.",
        status:
          400,
        field:
          "countryCode",
      });
    }

    const normalizedPhone =
      normalizePhone({
        dialCode:
          country.dialCode,
        phone:
          input.phone,
      });

    const phoneDigits =
      normalizedPhone.replace(
        /\D/g,
        "",
      );

    if (
      phoneDigits.length <
        7 ||
      phoneDigits.length >
        15
    ) {
      return createErrorResponse({
        message:
          "Le numéro de téléphone est invalide.",
        status:
          400,
        field:
          "phone",
      });
    }

    const existingUserByEmail =
      await prisma.user.findUnique({
        where: {
          email:
            input.email,
        },
        select: {
          id:
            true,
          role:
            true,
          emailVerified:
            true,
        },
      });

    if (
      existingUserByEmail
    ) {
      if (
        existingUserByEmail
          .role ===
          "CUSTOMER" &&
        !existingUserByEmail
          .emailVerified
      ) {
        return createErrorResponse({
          message:
            "Un compte existe déjà avec cette adresse e-mail. Terminez la vérification de votre compte.",
          status:
            409,
          field:
            "email",
          redirectTo:
            `/verify-email?email=${encodeURIComponent(
              input.email,
            )}`,
        });
      }

      return createErrorResponse({
        message:
          "Un compte existe déjà avec cette adresse e-mail.",
        status:
          409,
        field:
          "email",
      });
    }

    const existingUserByPhone =
      await prisma.user.findUnique({
        where: {
          phone:
            normalizedPhone,
        },
        select: {
          id:
            true,
        },
      });

    if (
      existingUserByPhone
    ) {
      return createErrorResponse({
        message:
          "Un compte existe déjà avec ce numéro de téléphone.",
        status:
          409,
        field:
          "phone",
      });
    }

    const passwordHash =
      await hash(
        input.password,
        PASSWORD_HASH_ROUNDS,
      );

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

    const user =
      await prisma.$transaction(
        async (
          transaction,
        ) => {
          const createdUser =
            await transaction
              .user
              .create({
                data: {
                  firstName:
                    input.firstName,

                  lastName:
                    input.lastName,

                  email:
                    input.email,

                  phone:
                    normalizedPhone,

                  country:
                    country.name,

                  countryCode:
                    country.code,

                  dialCode:
                    country.dialCode,

                  passwordHash,

                  role:
                    "CUSTOMER",

                  emailVerified:
                    false,

                  isActive:
                    true,
                },

                select: {
                  id:
                    true,

                  firstName:
                    true,

                  email:
                    true,
                },
              });

          await transaction
            .emailVerification
            .create({
              data: {
                userId:
                  createdUser.id,

                email:
                  createdUser.email,

                codeHash,

                status:
                  "PENDING",

                attempts:
                  0,

                expiresAt,
              },
            });

          return createdUser;
        },
      );

    createdUserId =
      user.id;

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
        "[CLIENT_REGISTER_EMAIL_ERROR]",
        emailError,
      );

      /*
       * Le compte vient d’être créé mais l’e-mail
       * n’a pas pu être envoyé.
       * On supprime ce nouveau compte pour permettre
       * au client de recommencer immédiatement.
       *
       * Les vérifications associées seront supprimées
       * automatiquement grâce à onDelete: Cascade.
       */
      await prisma.user
        .delete({
          where: {
            id:
              user.id,
          },
        })
        .catch(
          (
            cleanupError,
          ) => {
            console.error(
              "[CLIENT_REGISTER_CLEANUP_ERROR]",
              cleanupError,
            );
          },
        );

      createdUserId =
        null;

      return createErrorResponse({
        message:
          "Impossible d’envoyer le code de vérification pour le moment. Réessayez.",
        status:
          500,
      });
    }

    const redirectTo =
      `/verify-email?email=${encodeURIComponent(
        user.email,
      )}`;

    return NextResponse.json(
      {
        success:
          true,

        message:
          "Votre compte a été créé. Consultez votre e-mail pour obtenir votre code de vérification.",

        redirectTo,

        email:
          user.email,

        expiresInMinutes:
          EMAIL_VERIFICATION_EXPIRES_MINUTES,
      },
      {
        status:
          201,

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
      "[CLIENT_REGISTER_ERROR]",
      error,
    );

    /*
     * Nettoyage de sécurité uniquement si une erreur
     * inattendue survient après la création du compte.
     */
    if (
      createdUserId
    ) {
      await prisma.user
        .delete({
          where: {
            id:
              createdUserId,
          },
        })
        .catch(
          (
            cleanupError,
          ) => {
            console.error(
              "[CLIENT_REGISTER_FINAL_CLEANUP_ERROR]",
              cleanupError,
            );
          },
        );
    }

    if (
      error instanceof
        z.ZodError
    ) {
      return createErrorResponse({
        message:
          "Vérifiez les informations saisies.",
        status:
          400,
      });
    }

    /*
     * Prisma retourne généralement P2002
     * lorsqu’une contrainte unique est violée.
     */
    if (
      typeof error ===
        "object" &&
      error !== null &&
      "code" in error &&
      error.code ===
        "P2002"
    ) {
      return createErrorResponse({
        message:
          "Un compte existe déjà avec cette adresse e-mail ou ce numéro de téléphone.",
        status:
          409,
      });
    }

    return createErrorResponse({
      message:
        "Impossible de créer votre compte pour le moment. Réessayez.",
      status:
        500,
    });
  }
}