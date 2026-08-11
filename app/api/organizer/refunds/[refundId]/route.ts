import {
  createHash,
} from "node:crypto";

import {
  cookies,
} from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getOrganizerRefund,
} from "@/lib/organizer/refunds/get-organizer-refund";
import {
  prisma,
} from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

type RouteContext =
  Readonly<{
    params: Promise<{
      refundId: string;
    }>;
  }>;


function noStoreHeaders():
  HeadersInit {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma:
      "no-cache",
    Expires:
      "0",
    "X-Content-Type-Options":
      "nosniff",
  };
}

function jsonResponse<
  T extends object,
>(
  body: T,
  status = 200,
): NextResponse<T> {
  return NextResponse.json(
    body,
    {
      status,
      headers:
        noStoreHeaders(),
    },
  );
}



async function getAuthenticatedOrganizer():
  Promise<
    | {
        id: string;
      }
    | null
  > {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    "tikemia_session";

  const rawToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!rawToken) {
    return null;
  }

  const tokenHash =
    createHash(
      "sha256",
    )
      .update(
        rawToken,
      )
      .digest(
        "hex",
      );

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash,
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
            role:
              true,
            isActive:
              true,
            emailVerified:
              true,
          },
        },
      },
    });

  if (!session) {
    return null;
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id:
            session.id,
        },
      })
      .catch(
        (
          error:
            unknown,
        ) => {
          console.error(
            "[ORGANIZER_REFUND_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    return null;
  }

  if (
    session.user.role !==
      "ORGANIZER" ||
    !session.user.isActive ||
    !session.user.emailVerified
  ) {
    return null;
  }

  return {
    id:
      session.user.id,
  };
}


function normalizeRefundId(
  value:
    string | null | undefined,
): string {
  return (
    value
      ?.trim()
      .slice(
        0,
        120,
      ) ??
    ""
  );
}

export async function GET(
  _request: NextRequest,
  {
    params,
  }:
    RouteContext,
): Promise<NextResponse> {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    if (!organizer) {
      return jsonResponse(
        {
          success:
            false,
          error: {
            code:
              "UNAUTHORIZED",
            message:
              "Votre session organisateur est absente, expirée ou non autorisée.",
          },
        },
        401,
      );
    }

    const {
      refundId:
        rawRefundId,
    } =
      await params;

    const refundId =
      normalizeRefundId(
        rawRefundId,
      );

    if (!refundId) {
      return jsonResponse(
        {
          success:
            false,
          error: {
            code:
              "REFUND_ID_REQUIRED",
            message:
              "L’identifiant de la demande de remboursement est obligatoire.",
          },
        },
        400,
      );
    }

    const refund =
      await getOrganizerRefund({
        organizerId:
          organizer.id,
        refundId,
      });

    if (!refund) {
      return jsonResponse(
        {
          success:
            false,
          error: {
            code:
              "REFUND_NOT_FOUND",
            message:
              "Cette demande de remboursement est introuvable.",
          },
        },
        404,
      );
    }

    return jsonResponse({
      success:
        true,
      data: {
        refund,
      },
    });
  } catch (error) {
    console.error(
      "[ORGANIZER_REFUND_DETAILS_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,
            message:
              error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return jsonResponse(
      {
        success:
          false,
        error: {
          code:
            "ORGANIZER_REFUND_DETAILS_LOAD_FAILED",
          message:
            "Impossible de charger cette demande de remboursement pour le moment.",
        },
      },
      500,
    );
  }
}
