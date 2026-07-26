import { createHash } from "node:crypto";

import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin/admin-auth-config";

export const runtime = "nodejs";

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

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(
      ADMIN_SESSION_COOKIE_NAME,
    )?.value;

    if (sessionToken) {
      const tokenHash = hashSessionToken(sessionToken);

      const existingSession = await prisma.session.findUnique({
        where: {
          tokenHash,
        },
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              role: true,
            },
          },
        },
      });

      if (
        existingSession &&
        existingSession.user.role === "ADMIN"
      ) {
        const headersList = await headers();

        await prisma.$transaction(async (transaction) => {
          await transaction.adminAuditLog.create({
            data: {
              adminId: existingSession.userId,
              action: "ADMIN_LOGOUT",
              targetType: "ADMIN_SESSION",
              targetId: existingSession.id,
              ipAddress: getClientIp(headersList),
              userAgent: headersList.get("user-agent"),
            },
          });

          await transaction.session.delete({
            where: {
              id: existingSession.id,
            },
          });
        });
      } else if (existingSession) {
        await prisma.session.delete({
          where: {
            id: existingSession.id,
          },
        });
      }
    }

    cookieStore.set({
      name: ADMIN_SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return NextResponse.json({
      success: true,
      message: "Déconnexion réussie.",
      redirectTo: "/admin/login",
    });
  } catch (error) {
    console.error("ADMIN_LOGOUT_ERROR", error);

    const cookieStore = await cookies();

    cookieStore.set({
      name: ADMIN_SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return NextResponse.json(
      {
        success: false,
        message:
          "La session locale a été supprimée, mais une erreur est survenue.",
      },
      {
        status: 500,
      },
    );
  }
}