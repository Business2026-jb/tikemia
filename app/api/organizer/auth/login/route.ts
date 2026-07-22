import { createHash, randomBytes } from "node:crypto";

import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("L’adresse e-mail n’est pas valide.")
    .max(254, "L’adresse e-mail est trop longue."),

  password: z
    .string()
    .min(1, "Renseignez votre mot de passe.")
    .max(128, "Le mot de passe est trop long."),

  rememberMe: z.boolean().optional().default(false),
});

type LoginResponseBody = {
  success: boolean;
  message: string;
  redirectTo?: string;
};

function jsonResponse(body: LoginResponseBody, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getSessionDuration(rememberMe: boolean): number {
  if (!rememberMe) {
    return 60 * 60 * 24;
  }

  const configuredValue = Number(
    process.env.SESSION_MAX_AGE ?? "604800",
  );

  if (
    !Number.isInteger(configuredValue) ||
    configuredValue < 60 * 60 ||
    configuredValue > 60 * 60 * 24 * 30
  ) {
    return 60 * 60 * 24 * 7;
  }

  return configuredValue;
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

    const validation = loginSchema.safeParse(requestBody);

    if (!validation.success) {
      return jsonResponse(
        {
          success: false,
          message:
            validation.error.issues[0]?.message ??
            "Vérifiez les informations renseignées.",
        },
        400,
      );
    }

    const { email, password, rememberMe } = validation.data;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        passwordHash: true,
        role: true,
        emailVerified: true,
        isActive: true,
      },
    });

    /*
     * Le même message est utilisé lorsque le compte ou le mot de passe
     * est incorrect afin de ne pas révéler l’existence d’une adresse.
     */
    if (!user) {
      return jsonResponse(
        {
          success: false,
          message: "Adresse e-mail ou mot de passe incorrect.",
        },
        401,
      );
    }

    const passwordIsValid = await compare(
      password,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      return jsonResponse(
        {
          success: false,
          message: "Adresse e-mail ou mot de passe incorrect.",
        },
        401,
      );
    }

    if (user.role !== "ORGANIZER") {
      return jsonResponse(
        {
          success: false,
          message:
            "Ce compte ne correspond pas à un espace organisateur.",
        },
        403,
      );
    }

    if (!user.isActive) {
      return jsonResponse(
        {
          success: false,
          message:
            "Ce compte est désactivé. Contactez l’assistance Tikemia.",
        },
        403,
      );
    }

    if (!user.emailVerified) {
      return jsonResponse(
        {
          success: false,
          message:
            "Confirmez d’abord votre adresse e-mail pour accéder à votre compte.",
          redirectTo: `/organizer/verify-email?email=${encodeURIComponent(
            email,
          )}`,
        },
        403,
      );
    }

    const sessionMaxAge = getSessionDuration(rememberMe);

    const sessionExpiresAt = new Date(
      Date.now() + sessionMaxAge * 1000,
    );

    const sessionToken = randomBytes(48).toString("hex");
    const sessionTokenHash = hashSessionToken(sessionToken);

    /*
     * Le nettoyage des sessions expirées et la création de la session
     * sont exécutés séparément.
     *
     * Cela évite de maintenir une transaction interactive ouverte
     * pendant une connexion distante à Supabase.
     */
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
        expiresAt: {
          lte: new Date(),
        },
      },
    });

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sessionTokenHash,
        expiresAt: sessionExpiresAt,
      },
    });

    const sessionCookieName =
      process.env.SESSION_COOKIE_NAME?.trim() ||
      "tikemia_session";

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

    return jsonResponse(
      {
        success: true,
        message: "Connexion réussie.",
        redirectTo: "/organizer/dashboard",
      },
      200,
    );
  } catch (error) {
    console.error(
      "[ORGANIZER_LOGIN_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
    );

    return jsonResponse(
      {
        success: false,
        message:
          "Impossible de vous connecter pour le moment. Réessayez.",
      },
      500,
    );
  }
}