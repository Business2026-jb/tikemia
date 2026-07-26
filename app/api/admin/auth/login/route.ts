import { createHash, randomBytes } from "node:crypto";

import { compare } from "bcryptjs";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE,
} from "@/lib/admin/admin-auth-config";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Adresse email invalide.")
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(1, "Le mot de passe est obligatoire.")
    .max(200, "Le mot de passe est trop long."),

  rememberMe: z.boolean().optional().default(false),
});

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getClientIp(headersList: Headers): string | null {
  const forwardedFor = headersList.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return (
    headersList.get("x-real-ip") ||
    headersList.get("cf-connecting-ip") ||
    null
  );
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsedBody = loginSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            parsedBody.error.issues[0]?.message ||
            "Informations de connexion invalides.",
        },
        {
          status: 400,
        },
      );
    }

    const { email, password, rememberMe } = parsedBody.data;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        passwordHash: true,
        role: true,
        emailVerified: true,
        isActive: true,
      },
    });

    /*
     * Le même message est utilisé lorsqu’un compte n’existe pas
     * ou lorsque le mot de passe est incorrect.
     * Cela évite de révéler les comptes enregistrés.
     */
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Email ou mot de passe incorrect.",
        },
        {
          status: 401,
        },
      );
    }

    const passwordIsValid = await compare(
      password,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Email ou mot de passe incorrect.",
        },
        {
          status: 401,
        },
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ce compte n’est pas autorisé à accéder à l’administration.",
        },
        {
          status: 403,
        },
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        {
          success: false,
          message:
            "L’adresse email de ce compte administrateur n’est pas vérifiée.",
        },
        {
          status: 403,
        },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ce compte administrateur est actuellement désactivé.",
        },
        {
          status: 403,
        },
      );
    }

    const sessionMaxAge = rememberMe
      ? 60 * 60 * 24 * 30
      : ADMIN_SESSION_MAX_AGE;

    const expiresAt = new Date(
      Date.now() + sessionMaxAge * 1000,
    );

    const sessionToken = randomBytes(48).toString("hex");
    const tokenHash = hashSessionToken(sessionToken);

    const headersList = await headers();
    const ipAddress = getClientIp(headersList);
    const userAgent = headersList.get("user-agent");

    /*
     * Nettoyage des anciennes sessions expirées de cet Admin.
     */
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
        expiresAt: {
          lte: new Date(),
        },
      },
    });

    await prisma.$transaction(async (transaction) => {
      await transaction.session.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      await transaction.adminAuditLog.create({
        data: {
          adminId: user.id,
          action: "ADMIN_LOGIN_SUCCESS",
          targetType: "ADMIN_SESSION",
          targetId: user.id,
          metadata: {
            email: user.email,
            rememberMe,
          },
          ipAddress,
          userAgent,
        },
      });
    });

    const cookieStore = await cookies();

    cookieStore.set({
      name: ADMIN_SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionMaxAge,
      expires: expiresAt,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Connexion réussie.",
        redirectTo: "/admin/dashboard",
        admin: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("ADMIN_LOGIN_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Impossible de vous connecter pour le moment. Réessayez.",
      },
      {
        status: 500,
      },
    );
  }
}