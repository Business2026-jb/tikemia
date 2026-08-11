import {
  createHash,
} from "node:crypto";

import {
  cookies,
} from "next/headers";
import {
  NextResponse,
} from "next/server";

import {
  getOrganizerRefunds,
  type OrganizerRefundWorkflowStage,
} from "@/lib/organizer/refunds/get-organizer-refunds";
import {
  prisma,
} from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

const MAX_LIMIT =
  200;

const WORKFLOW_STAGES:
  readonly OrganizerRefundWorkflowStage[] =
  [
    "ORGANIZER_REVIEW",
    "ORGANIZER_REJECTED",
    "FORWARDED_TO_ADMIN",
    "ADMIN_REVIEW",
    "ADMIN_REJECTED",
    "REFUND_PROCESSING",
    "REFUNDED",
    "REFUND_FAILED",
    "CANCELLED",
    "UNKNOWN",
  ];


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


function normalizeSearch(
  value:
    string | null,
): string | null {
  const normalized =
    value
      ?.replace(
        /\s+/g,
        " ",
      )
      .trim()
      .slice(
        0,
        200,
      ) ??
    "";

  return normalized ||
    null;
}

function parseLimit(
  value:
    string | null,
): number {
  if (!value) {
    return 100;
  }

  const parsed =
    Number(value);

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed < 1
  ) {
    return 100;
  }

  return Math.min(
    parsed,
    MAX_LIMIT,
  );
}

function parseWorkflowStage(
  value:
    string | null,
):
  | OrganizerRefundWorkflowStage
  | "ALL"
  | null {
  if (!value) {
    return "ALL";
  }

  const normalized =
    value
      .trim()
      .toUpperCase();

  if (
    normalized ===
    "ALL"
  ) {
    return "ALL";
  }

  return WORKFLOW_STAGES.includes(
    normalized as OrganizerRefundWorkflowStage,
  )
    ? (
        normalized as OrganizerRefundWorkflowStage
      )
    : null;
}

export async function GET(
  request: Request,
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

    const url =
      new URL(
        request.url,
      );

    const rawWorkflowStage =
      url.searchParams.get(
        "workflowStage",
      ) ??
      url.searchParams.get(
        "stage",
      );

    const workflowStage =
      parseWorkflowStage(
        rawWorkflowStage,
      );

    if (
      rawWorkflowStage &&
      workflowStage ===
        null
    ) {
      return jsonResponse(
        {
          success:
            false,
          error: {
            code:
              "INVALID_WORKFLOW_STAGE",
            message:
              "L’étape de remboursement demandée n’est pas valide.",
          },
        },
        400,
      );
    }

    const refunds =
      await getOrganizerRefunds({
        organizerId:
          organizer.id,
        filters: {
          workflowStage:
            workflowStage ??
            "ALL",
          search:
            normalizeSearch(
              url.searchParams.get(
                "search",
              ) ??
              url.searchParams.get(
                "q",
              ),
            ),
          limit:
            parseLimit(
              url.searchParams.get(
                "limit",
              ),
            ),
        },
      });

    return jsonResponse({
      success:
        true,
      data: {
        refunds,
        total:
          refunds.length,
        filters: {
          workflowStage:
            workflowStage ??
            "ALL",
          search:
            normalizeSearch(
              url.searchParams.get(
                "search",
              ) ??
              url.searchParams.get(
                "q",
              ),
            ),
        },
      },
    });
  } catch (error) {
    console.error(
      "[ORGANIZER_REFUNDS_GET_ERROR]",
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
            "ORGANIZER_REFUNDS_LOAD_FAILED",
          message:
            "Impossible de charger les demandes de remboursement pour le moment.",
        },
      },
      500,
    );
  }
}
