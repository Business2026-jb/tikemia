import { randomInt } from "node:crypto";

import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { sendOrganizerPasswordResetEmail } from "@/lib/mail/send-password-reset-email";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("L’adresse e-mail n’est pas valide.")
    .max(254, "L’adresse e-mail est trop longue."),
});

type JsonResponseBody = {
  success: boolean;
  message: string;
  redirectTo?: string;
  retryAfter?: number;
};

function jsonResponse(body: JsonResponseBody, status: number) {
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

    const validation = forgotPasswordSchema.safeParse(requestBody);

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

    const verificationTtlMinutes = getIntegerEnvironmentValue(
      process.env.PASSWORD_RESET_CODE_TTL_MINUTES,
      10,
      1,
      60,
    );

    const resendDelaySeconds = getIntegerEnvironmentValue(
      process.env.PASSWORD_RESET_RESEND_DELAY_SECONDS,
      60,
      30,
      3600,
    );

    const bcryptRounds = getIntegerEnvironmentValue(
      process.env.BCRYPT_SALT_ROUNDS,
      12,
      10,
      15,
    );

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        firstName: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    /*
     * Nous utilisons une réponse volontairement générale lorsque
     * l’adresse n’existe pas afin de ne pas révéler les comptes enregistrés.
     */
    if (!user || user.role !== "ORGANIZER" || !user.isActive) {
      return jsonResponse(
        {
          success: true,
          message:
            "Si cette adresse correspond à un compte organisateur, un code de réinitialisation sera envoyé.",
          redirectTo: `/organizer/reset-password?email=${encodeURIComponent(
            email,
          )}`,
        },
        200,
      );
    }

    const latestPasswordReset = await prisma.passwordReset.findFirst({
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

    if (latestPasswordReset) {
      const secondsSinceLastRequest = Math.floor(
        (Date.now() - latestPasswordReset.createdAt.getTime()) / 1000,
      );

      if (secondsSinceLastRequest < resendDelaySeconds) {
        const retryAfter =
          resendDelaySeconds - secondsSinceLastRequest;

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

    const resetCode = randomInt(100000, 1000000).toString();

    const codeHash = await hash(resetCode, bcryptRounds);

    const expiresAt = new Date(
      Date.now() + verificationTtlMinutes * 60 * 1000,
    );

    const passwordReset = await prisma.$transaction(
      async (transaction) => {
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
      await sendOrganizerPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        code: resetCode,
        passwordResetId: passwordReset.id,
      });
    } catch (mailError) {
      console.error(
        "[ORGANIZER_FORGOT_PASSWORD_EMAIL_ERROR]",
        mailError instanceof Error
          ? mailError.message
          : mailError,
      );

      await prisma.passwordReset.update({
        where: {
          id: passwordReset.id,
        },
        data: {
          status: "EXPIRED",
        },
      });

      return jsonResponse(
        {
          success: false,
          message:
            "Le code de réinitialisation n’a pas pu être envoyé. Réessayez dans quelques instants.",
        },
        503,
      );
    }

    return jsonResponse(
      {
        success: true,
        message:
          "Un code de réinitialisation vous a été envoyé par e-mail.",
        redirectTo: `/organizer/reset-password?email=${encodeURIComponent(
          user.email,
        )}`,
      },
      200,
    );
  } catch (error) {
    console.error(
      "[ORGANIZER_FORGOT_PASSWORD_ERROR]",
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      {
        success: false,
        message:
          "Impossible de traiter votre demande pour le moment. Réessayez.",
      },
      500,
    );
  }
}