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
  z,
} from "zod";

import {
  forwardRefundToAdmin,
  OrganizerRefundForwardError,
} from "@/lib/organizer/refunds/forward-refund-to-admin";
import {
  prisma,
} from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const maxDuration =
  30;

const MAX_REQUEST_BODY_BYTES =
  16 * 1024;

const forwardSchema =
  z
    .object({
      note:
        z
          .string()
          .trim()
          .max(
            1_500,
            "La note ne peut pas dépasser 1500 caractères.",
          )
          .optional()
          .nullable(),
    })
    .strict();

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


function getContentLength(
  request: NextRequest,
): number | null {
  const raw =
    request.headers.get(
      "content-length",
    );

  if (!raw) {
    return null;
  }

  const parsed =
    Number(raw);

  return Number.isFinite(
    parsed,
  ) &&
    parsed >= 0
    ? parsed
    : null;
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

export async function POST(
  request: NextRequest,
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

    const contentLength =
      getContentLength(
        request,
      );

    if (
      contentLength !== null &&
      contentLength >
        MAX_REQUEST_BODY_BYTES
    ) {
      return jsonResponse(
        {
          success:
            false,
          error: {
            code:
              "REQUEST_TOO_LARGE",
            message:
              "La requête est trop volumineuse.",
          },
        },
        413,
      );
    }

    let body:
      unknown = {};

    const rawBody =
      await request.text();

    if (
      rawBody.trim()
    ) {
      try {
        body =
          JSON.parse(
            rawBody,
          ) as unknown;
      } catch {
        return jsonResponse(
          {
            success:
              false,
            error: {
              code:
                "INVALID_JSON",
              message:
                "Le contenu de la requête n’est pas un JSON valide.",
            },
          },
          400,
        );
      }
    }

    const parsed =
      forwardSchema.safeParse(
        body,
      );

    if (!parsed.success) {
      return jsonResponse(
        {
          success:
            false,
          error: {
            code:
              "INVALID_FORWARD_REQUEST",
            message:
              parsed.error.issues[0]
                ?.message ??
              "La demande de transmission est invalide.",
            details:
              parsed.error.issues.map(
                (
                  issue,
                ) => ({
                  path:
                    issue.path.join(
                      ".",
                    ),
                  message:
                    issue.message,
                }),
              ),
          },
        },
        400,
      );
    }

    const result =
      await forwardRefundToAdmin({
        organizerId:
          organizer.id,
        refundId,
        note:
          parsed.data.note ??
          null,
      });

    return jsonResponse({
      success:
        true,
      message:
        "La demande de remboursement a été transmise à Tikemia pour validation finale.",
      data: {
        refund:
          result,
      },
    });
  } catch (error) {
    if (
      error instanceof
      OrganizerRefundForwardError
    ) {
      return jsonResponse(
        {
          success:
            false,
          error: {
            code:
              error.code,
            message:
              error.message,
          },
        },
        error.status,
      );
    }

    console.error(
      "[ORGANIZER_REFUND_FORWARD_ERROR]",
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
            "REFUND_FORWARD_FAILED",
          message:
            "Impossible de transmettre cette demande de remboursement pour le moment.",
        },
      },
      500,
    );
  }
}
