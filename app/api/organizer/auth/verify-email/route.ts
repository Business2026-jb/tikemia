import { createHash, randomBytes } from "node:crypto";

import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifyEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("L’adresse e-mail n’est pas valide.")
    .max(254, "L’adresse e-mail est trop longue."),

  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Le code doit contenir exactement 6 chiffres."),
});

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getPositiveInteger(
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
      return jsonError("La requête envoyée n’est pas valide.", 400);
    }

    const validation = verifyEmailSchema.safeParse(requestBody);

    if (!validation.success) {
      return jsonError(
        validation.error.issues[0]?.message ??
          "Vérifiez le code renseigné.",
        400,
      );
    }

    const { email, code } = validation.data;

    const maxAttempts = getPositiveInteger(
      process.env.EMAIL_VERIFICATION_MAX_ATTEMPTS,
      5,
      1,
      10,
    );

    const sessionMaxAge = getPositiveInteger(
      process.env.SESSION_MAX_AGE,
      604800,
      3600,
      2592000,
    );

    const sessionCookieName =
      process.env.SESSION_COOKIE_NAME?.trim() || "tikemia_session";

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        emailVerified: true,
        isActive: true,
        role: true,
      },
    });

    if (!user) {
      return jsonError(
        "Le code est incorrect, expiré ou ne correspond pas à ce compte.",
        400,
      );
    }

    if (!user.isActive) {
      return jsonError(
        "Ce compte n’est pas actif. Contactez l’assistance Tikemia.",
        403,
      );
    }

    if (user.role !== "ORGANIZER") {
      return jsonError(
        "Ce compte ne correspond pas à un compte organisateur.",
        403,
      );
    }

    if (user.emailVerified) {
      return jsonError(
        "Cette adresse e-mail a déjà été confirmée. Vous pouvez vous connecter.",
        409,
      );
    }

    const verification = await prisma.emailVerification.findFirst({
      where: {
        userId: user.id,
        email,
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
      },
    });

    if (!verification) {
      return jsonError(
        "Aucun code actif n’a été trouvé. Demandez un nouveau code.",
        400,
      );
    }

    if (verification.attempts >= maxAttempts) {
      await prisma.emailVerification.update({
        where: {
          id: verification.id,
        },
        data: {
          status: "EXPIRED",
        },
      });

      return jsonError(
        "Le nombre maximal de tentatives est atteint. Demandez un nouveau code.",
        429,
      );
    }

    if (verification.expiresAt.getTime() <= Date.now()) {
      await prisma.emailVerification.update({
        where: {
          id: verification.id,
        },
        data: {
          status: "EXPIRED",
        },
      });

      return jsonError(
        "Ce code a expiré. Demandez un nouveau code.",
        410,
      );
    }

    const codeIsValid = await compare(code, verification.codeHash);

    if (!codeIsValid) {
      const updatedVerification =
        await prisma.emailVerification.update({
          where: {
            id: verification.id,
          },
          data: {
            attempts: {
              increment: 1,
            },
          },
          select: {
            attempts: true,
          },
        });

      const attemptsRemaining = Math.max(
        maxAttempts - updatedVerification.attempts,
        0,
      );

      if (attemptsRemaining === 0) {
        await prisma.emailVerification.update({
          where: {
            id: verification.id,
          },
          data: {
            status: "EXPIRED",
          },
        });

        return jsonError(
          "Le nombre maximal de tentatives est atteint. Demandez un nouveau code.",
          429,
        );
      }

      return jsonError(
        `Code incorrect. Il vous reste ${attemptsRemaining} tentative${
          attemptsRemaining > 1 ? "s" : ""
        }.`,
        400,
      );
    }

    const sessionToken = randomBytes(48).toString("hex");
    const sessionTokenHash = hashSessionToken(sessionToken);
    const sessionExpiresAt = new Date(
      Date.now() + sessionMaxAge * 1000,
    );

    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: {
          id: user.id,
        },
        data: {
          emailVerified: true,
        },
      });

      await transaction.emailVerification.update({
        where: {
          id: verification.id,
        },
        data: {
          status: "VERIFIED",
          verifiedAt: new Date(),
        },
      });

      await transaction.emailVerification.updateMany({
        where: {
          userId: user.id,
          id: {
            not: verification.id,
          },
          status: "PENDING",
        },
        data: {
          status: "EXPIRED",
        },
      });

      await transaction.session.deleteMany({
        where: {
          userId: user.id,
          expiresAt: {
            lte: new Date(),
          },
        },
      });

      await transaction.session.create({
        data: {
          userId: user.id,
          tokenHash: sessionTokenHash,
          expiresAt: sessionExpiresAt,
        },
      });
    });

    const cookieStore = await cookies();

    cookieStore.set({
      name: sessionCookieName,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionMaxAge,
      expires: sessionExpiresAt,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Votre compte organisateur est confirmé.",
        redirectTo: "/organizer/dashboard",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "[ORGANIZER_VERIFY_EMAIL_ERROR]",
      error instanceof Error ? error.message : error,
    );

    return jsonError(
      "Impossible de confirmer votre compte pour le moment. Réessayez.",
      500,
    );
  }
}