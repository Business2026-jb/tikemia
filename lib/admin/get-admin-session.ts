import { createHash } from "node:crypto";

import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin/admin-auth-config";

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(
    ADMIN_SESSION_COOKIE_NAME,
  )?.value;

  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);

  const session = await prisma.session.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          country: true,
          countryCode: true,
          dialCode: true,
          role: true,
          emailVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch(() => undefined);

    return null;
  }

  if (
    session.user.role !== "ADMIN" ||
    !session.user.isActive ||
    !session.user.emailVerified
  ) {
    return null;
  }

  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    admin: session.user,
  };
}