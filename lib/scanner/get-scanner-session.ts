import "server-only";

import {
  createHash,
} from "node:crypto";

import type {
  UserRole,
} from "@prisma/client";
import {
  cookies,
} from "next/headers";

import {
  prisma,
} from "@/lib/prisma";

export const SCANNER_SESSION_COOKIE_NAME =
  process.env
    .SCANNER_SESSION_COOKIE_NAME
    ?.trim() ||
  "tikemia_scanner_session";

export const ORGANIZER_SESSION_COOKIE_NAME =
  process.env
    .ORGANIZER_SESSION_COOKIE_NAME
    ?.trim() ||
  "tikemia_organizer_session";

export type ScannerAccessRole =
  | "ORGANIZER"
  | "SCANNER";

export type ScannerAccessMode =
  | "ORGANIZER_OWNER"
  | "ASSIGNED_SCANNER";

export type ScannerSessionUser =
  Readonly<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: ScannerAccessRole;
    emailVerified: boolean;
    isActive: boolean;
  }>;

export type ScannerSession =
  Readonly<{
    sessionId: string;
    expiresAt: Date;
    cookieName: string;
    accessMode: ScannerAccessMode;
    user: ScannerSessionUser;
  }>;

type SessionCandidate =
  Readonly<{
    cookieName: string;
    rawToken: string;
  }>;

const ALLOWED_SCANNER_ACCESS_ROLES:
  readonly ScannerAccessRole[] = [
    "ORGANIZER",
    "SCANNER",
  ];

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function hashSessionToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      token,
      "utf8",
    )
    .digest(
      "hex",
    );
}

function isScannerAccessRole(
  role: UserRole,
): role is ScannerAccessRole {
  return ALLOWED_SCANNER_ACCESS_ROLES.includes(
    role as ScannerAccessRole,
  );
}

function getAccessMode(
  role: ScannerAccessRole,
): ScannerAccessMode {
  return role ===
    "ORGANIZER"
    ? "ORGANIZER_OWNER"
    : "ASSIGNED_SCANNER";
}

async function getSessionCandidates():
  Promise<SessionCandidate[]> {
  const cookieStore =
    await cookies();

  const candidates:
    SessionCandidate[] = [];

  const scannerToken =
    normalizeText(
      cookieStore.get(
        SCANNER_SESSION_COOKIE_NAME,
      )?.value,
    );

  if (scannerToken) {
    candidates.push({
      cookieName:
        SCANNER_SESSION_COOKIE_NAME,

      rawToken:
        scannerToken,
    });
  }

  const organizerToken =
    normalizeText(
      cookieStore.get(
        ORGANIZER_SESSION_COOKIE_NAME,
      )?.value,
    );

  if (
    organizerToken &&
    organizerToken !==
      scannerToken
  ) {
    candidates.push({
      cookieName:
        ORGANIZER_SESSION_COOKIE_NAME,

      rawToken:
        organizerToken,
    });
  }

  return candidates;
}

async function deleteExpiredSession(
  sessionId: string,
): Promise<void> {
  await prisma.session
    .delete({
      where: {
        id:
          sessionId,
      },
    })
    .catch(
      () =>
        undefined,
    );
}

export async function getScannerSession():
  Promise<ScannerSession | null> {
  const candidates =
    await getSessionCandidates();

  if (
    candidates.length ===
    0
  ) {
    return null;
  }

  for (
    const candidate of candidates
  ) {
    const session =
      await prisma.session.findUnique({
        where: {
          tokenHash:
            hashSessionToken(
              candidate.rawToken,
            ),
        },

        select: {
          id:
            true,

          expiresAt:
            true,

          user: {
            select: {
              id:
                true,

              firstName:
                true,

              lastName:
                true,

              email:
                true,

              phone:
                true,

              role:
                true,

              emailVerified:
                true,

              isActive:
                true,
            },
          },
        },
      });

    if (!session) {
      continue;
    }

    if (
      session.expiresAt.getTime() <=
      Date.now()
    ) {
      await deleteExpiredSession(
        session.id,
      );

      continue;
    }

    if (
      !session.user.emailVerified ||
      !session.user.isActive ||
      !isScannerAccessRole(
        session.user.role,
      )
    ) {
      continue;
    }

    const role =
      session.user.role;

    return {
      sessionId:
        session.id,

      expiresAt:
        session.expiresAt,

      cookieName:
        candidate.cookieName,

      accessMode:
        getAccessMode(
          role,
        ),

      user: {
        id:
          session.user.id,

        firstName:
          session.user.firstName,

        lastName:
          session.user.lastName,

        email:
          session.user.email,

        phone:
          session.user.phone,

        role,

        emailVerified:
          session.user.emailVerified,

        isActive:
          session.user.isActive,
      },
    };
  }

  return null;
}
