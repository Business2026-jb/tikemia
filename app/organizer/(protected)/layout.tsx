import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import OrganizerShell from "@/components/organizer/organizer-shell";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrganizerProtectedLayoutProps = Readonly<{
  children: ReactNode;
}>;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function buildOrganizerName({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): string {
  return `${firstName} ${lastName}`
    .replace(/\s+/g, " ")
    .trim();
}

function buildOrganizerInitials({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): string {
  const firstInitial =
    firstName.trim().charAt(0);

  const lastInitial =
    lastName.trim().charAt(0);

  const initials =
    `${firstInitial}${lastInitial}`
      .trim()
      .toUpperCase();

  return initials || "OR";
}

export default async function OrganizerProtectedLayout({
  children,
}: OrganizerProtectedLayoutProps) {
  const sessionCookieName =
    process.env
      .SESSION_COOKIE_NAME
      ?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const cookieStore =
    await cookies();

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    redirect(
      "/organizer/login",
    );
  }

  const tokenHash =
    hashSessionToken(
      sessionToken,
    );

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash,
      },

      select: {
        id: true,
        expiresAt: true,

        user: {
          select: {
            id: true,

            firstName: true,
            lastName: true,
            email: true,

            role: true,
            emailVerified: true,
            isActive: true,

            organizerProfile: {
              select: {
                businessName: true,
                avatar: true,
                logo: true,
              },
            },
          },
        },
      },
    });

  if (!session) {
    redirect(
      "/organizer/login",
    );
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch(
        (
          error: unknown,
        ) => {
          console.error(
            "[ORGANIZER_LAYOUT_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    redirect(
      "/organizer/login",
    );
  }

  const organizer =
    session.user;

  if (
    organizer.role !==
      "ORGANIZER" ||
    !organizer.emailVerified ||
    !organizer.isActive
  ) {
    redirect(
      "/organizer/login",
    );
  }

  const organizerName =
    buildOrganizerName({
      firstName:
        organizer.firstName,
      lastName:
        organizer.lastName,
    });

  const organizerInitials =
    buildOrganizerInitials({
      firstName:
        organizer.firstName,
      lastName:
        organizer.lastName,
    });

  const businessName =
    organizer.organizerProfile
      ?.businessName
      ?.trim() ||
    null;

  const displayName =
    businessName ||
    organizerName ||
    "Organisateur Tikemia";

  const organizerAvatarUrl =
    organizer.organizerProfile
      ?.avatar
      ?.trim() ||
    null;

  const organizerLogoUrl =
    organizer.organizerProfile
      ?.logo
      ?.trim() ||
    null;

  return (
    <OrganizerShell
      organizerName={
        displayName
      }
      organizerFullName={
        organizerName ||
        "Organisateur Tikemia"
      }
      organizerEmail={
        organizer.email
      }
      organizerInitials={
        organizerInitials
      }
      organizerAvatarUrl={
        organizerAvatarUrl
      }
      organizerLogoUrl={
        organizerLogoUrl
      }
      organizerBusinessName={
        businessName
      }
      notificationCount={0}
    >
      <div className="w-full min-w-0 max-w-none">
        {children}
      </div>
    </OrganizerShell>
  );
}