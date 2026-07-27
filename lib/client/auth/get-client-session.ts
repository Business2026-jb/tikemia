import {
  createHash,
} from "node:crypto";

import {
  cookies,
} from "next/headers";

import {
  prisma,
} from "@/lib/prisma";

const CLIENT_SESSION_COOKIE_NAME =
  process.env
    .CLIENT_SESSION_COOKIE_NAME
    ?.trim() ||
  "tikemia_client_session";

function hashSessionToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(token)
    .digest("hex");
}

export type ClientSessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  countryCode: string;
  dialCode: string;
  role: "CUSTOMER";
  emailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientSessionData = {
  sessionId: string;
  expiresAt: Date;
  customer: ClientSessionUser;
};

export async function getClientSession(): Promise<ClientSessionData | null> {
  try {
    const cookieStore =
      await cookies();

    const sessionToken =
      cookieStore.get(
        CLIENT_SESSION_COOKIE_NAME,
      )?.value;

    if (!sessionToken) {
      return null;
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

    const now =
      new Date();

    if (
      session.expiresAt <=
      now
    ) {
      await prisma.session
        .delete({
          where: {
            id: session.id,
          },
        })
        .catch(
          (
            error,
          ) => {
            console.error(
              "[CLIENT_SESSION_EXPIRED_DELETE_ERROR]",
              error,
            );
          },
        );

      return null;
    }

    if (
      session.user.role !==
      "CUSTOMER"
    ) {
      return null;
    }

    if (
      !session.user
        .emailVerified
    ) {
      return null;
    }

    if (
      !session.user
        .isActive
    ) {
      return null;
    }

    return {
      sessionId:
        session.id,

      expiresAt:
        session.expiresAt,

      customer: {
        id:
          session.user.id,

        firstName:
          session.user
            .firstName,

        lastName:
          session.user
            .lastName,

        email:
          session.user.email,

        phone:
          session.user.phone,

        country:
          session.user.country,

        countryCode:
          session.user
            .countryCode,

        dialCode:
          session.user
            .dialCode,

        role:
          "CUSTOMER",

        emailVerified:
          session.user
            .emailVerified,

        isActive:
          session.user
            .isActive,

        createdAt:
          session.user
            .createdAt,

        updatedAt:
          session.user
            .updatedAt,
      },
    };
  } catch (
    error
  ) {
    console.error(
      "[GET_CLIENT_SESSION_ERROR]",
      error,
    );

    return null;
  }
}