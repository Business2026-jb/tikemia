import { randomInt } from "node:crypto";

import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { sendOrganizerVerificationEmail } from "@/lib/mail/send-verification-email";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resendCodeSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("L’adresse e-mail n’est pas valide.")
    .max(254, "L’adresse e-mail est trop longue."),
});

function jsonResponse(
  body: {
    success: boolean;
    message: string;
    retryAfter?: number;
    redirectTo?: string;
  },
  status: number,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getIntegerEnvironmentValue(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsedValue = Number(value ?? fallback);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < minimum ||
    parsedValue > maximum
  ) {
    return fallback;
  }

  return parsedValue;
}

export async function POST(request: Request) {
  try {
    /*
     * 1. Lire le contenu envoyé par la page.
     */
    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "La requête envoyée n’est pas valide.",
        },
        400,
      );
    }

    /*
     * 2. Valider l’adresse e-mail.
     */
    const validation = resendCodeSchema.safeParse(requestBody);

    if (!validation.success) {
      return jsonResponse(
        {
          success: false,
          message:
            validation.error.issues[0]?.message ??
            "Vérifiez votre adresse e-mail.",
        },
        400,
      );
    }

    const email = validation.data.email;

    /*
     * 3. Lire les paramètres de sécurité.
     */
    const resendDelaySeconds = getIntegerEnvironmentValue(
      process.env.EMAIL_VERIFICATION_RESEND_DELAY_SECONDS,
      60,
      30,
      3600,
    );

    const verificationTtlMinutes = getIntegerEnvironmentValue(
      process.env.EMAIL_VERIFICATION_CODE_TTL_MINUTES,
      10,
      1,
      60,
    );

    const bcryptRounds = getIntegerEnvironmentValue(
      process.env.BCRYPT_SALT_ROUNDS,
      12,
      10,
      15,
    );

    /*
     * 4. Rechercher le compte organisateur.
     */
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        firstName: true,
        email: true,
        emailVerified: true,
        isActive: true,
        role: true,
      },
    });

    if (!user) {
      return jsonResponse(
        {
          success: false,
          message:
            "Aucun compte organisateur en attente n’est associé à cette adresse.",
        },
        404,
      );
    }

    if (user.role !== "ORGANIZER") {
      return jsonResponse(
        {
          success: false,
          message:
            "Cette adresse ne correspond pas à un compte organisateur.",
        },
        403,
      );
    }

    if (!user.isActive) {
      return jsonResponse(
        {
          success: false,
          message:
            "Ce compte n’est pas actif. Contactez l’assistance Tikemia.",
        },
        403,
      );
    }

    if (user.emailVerified) {
      return jsonResponse(
        {
          success: false,
          message:
            "Cette adresse e-mail est déjà confirmée. Vous pouvez vous connecter.",
          redirectTo: "/organizer/login",
        },
        409,
      );
    }

    /*
     * 5. Contrôler la date du dernier code créé.
     */
    const latestVerification =
      await prisma.emailVerification.findFirst({
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
        },
      });

    if (latestVerification) {
      const secondsSinceLastCode = Math.floor(
        (Date.now() - latestVerification.createdAt.getTime()) / 1000,
      );

      if (secondsSinceLastCode < resendDelaySeconds) {
        const retryAfter =
          resendDelaySeconds - secondsSinceLastCode;

        return jsonResponse(
          {
            success: false,
            message: `Patientez encore ${retryAfter} seconde${
              retryAfter > 1 ? "s" : ""
            } avant de demander un nouveau code.`,
            retryAfter,
          },
          429,
        );
      }
    }

    /*
     * 6. Générer et sécuriser le nouveau code.
     */
    const verificationCode = randomInt(
      100000,
      1000000,
    ).toString();

    const codeHash = await hash(
      verificationCode,
      bcryptRounds,
    );

    const expiresAt = new Date(
      Date.now() + verificationTtlMinutes * 60 * 1000,
    );

    /*
     * 7. Expirer les anciens codes et enregistrer le nouveau.
     */
    const verification = await prisma.$transaction(
      async (transaction) => {
        await transaction.emailVerification.updateMany({
          where: {
            userId: user.id,
            status: "PENDING",
          },
          data: {
            status: "EXPIRED",
          },
        });

        return transaction.emailVerification.create({
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

    /*
     * 8. Envoyer le nouveau code avec Resend.
     */
    try {
      await sendOrganizerVerificationEmail({
        to: user.email,
        firstName: user.firstName,
        code: verificationCode,
        verificationId: verification.id,
      });
    } catch (mailError) {
      console.error(
        "[ORGANIZER_RESEND_CODE_EMAIL_ERROR]",
        mailError instanceof Error
          ? mailError.message
          : mailError,
      );

      /*
       * Le code est rendu inutilisable si l’envoi échoue.
       */
      await prisma.emailVerification.update({
        where: {
          id: verification.id,
        },
        data: {
          status: "EXPIRED",
        },
      });

      return jsonResponse(
        {
          success: false,
          message:
            "Le nouveau code n’a pas pu être envoyé. Réessayez dans quelques instants.",
        },
        503,
      );
    }

    /*
     * 9. Réponse envoyée à la page de confirmation.
     */
    return jsonResponse(
      {
        success: true,
        message:
          "Un nouveau code de confirmation vous a été envoyé.",
        retryAfter: resendDelaySeconds,
      },
      200,
    );
  } catch (error) {
    console.error(
      "[ORGANIZER_RESEND_CODE_ERROR]",
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      {
        success: false,
        message:
          "Impossible de renvoyer le code pour le moment. Réessayez.",
      },
      500,
    );
  }
}