import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  requireClient,
} from "@/lib/client/auth/require-client";
import {
  ClientRefundRequestError,
  createRefundRequest,
} from "@/lib/client/refunds/create-refund-request";
import {
  getClientRefunds,
} from "@/lib/client/refunds/get-client-refunds";
import {
  prisma,
} from "@/lib/prisma";
import {
  sendRefundOrganizerNotificationEmail,
} from "@/lib/refunds/mails/send-refund-organizer-notification-email";
import {
  sendRefundRequestedEmail,
} from "@/lib/refunds/mails/send-refund-requested-email";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const maxDuration =
  30;

const MAX_REQUEST_BODY_BYTES =
  32 * 1024;

const createRefundRequestSchema =
  z
    .object({
      ticketIds:
        z
          .array(
            z
              .string()
              .trim()
              .min(
                1,
                "Un identifiant de billet est invalide.",
              )
              .max(
                120,
                "Un identifiant de billet est trop long.",
              ),
          )
          .min(
            1,
            "Sélectionnez au moins un billet.",
          )
          .max(
            20,
            "Une demande ne peut pas contenir plus de 20 billets.",
          ),

      reason:
        z
          .string()
          .trim()
          .min(
            10,
            "Expliquez votre demande en au moins 10 caractères.",
          )
          .max(
            2_000,
            "Le motif ne peut pas dépasser 2000 caractères.",
          ),

      reasonCategory:
        z
          .string()
          .trim()
          .max(
            120,
            "La catégorie du motif est trop longue.",
          )
          .optional()
          .nullable(),
    })
    .strict();

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",
        Pragma:
          "no-cache",
        Expires:
          "0",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
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

function getZodMessage(
  error: z.ZodError,
): string {
  return (
    error.issues[0]
      ?.message ??
    "Les informations de la demande de remboursement sont invalides."
  );
}

async function sendRequestNotifications({
  customer,
  createdRefund,
}: {
  customer: Readonly<{
    id: string;
    email: string;
  }>;
  createdRefund: Awaited<
    ReturnType<
      typeof createRefundRequest
    >
  >;
}): Promise<void> {
  /*
   * Les e-mails sont secondaires par rapport à
   * l'enregistrement transactionnel de la demande.
   *
   * Une panne Resend ne doit donc jamais supprimer
   * ou recréer une demande déjà enregistrée.
   */
  try {
    const [
      customerRecord,
      event,
    ] =
      await Promise.all([
        prisma.user.findUnique({
          where: {
            id:
              customer.id,
          },
          select: {
            firstName:
              true,
            lastName:
              true,
            email:
              true,
          },
        }),

        prisma.event.findUnique({
          where: {
            id:
              createdRefund.eventId,
          },
          select: {
            title:
              true,
            startsAt:
              true,
            organizer: {
              select: {
                firstName:
                  true,
                lastName:
                  true,
                email:
                  true,
              },
            },
          },
        }),
      ]);

    if (!event) {
      return;
    }

    const customerName =
      customerRecord
        ? `${customerRecord.firstName} ${customerRecord.lastName}`
            .replace(
              /\s+/g,
              " ",
            )
            .trim()
        : "";

    const organizerName =
      `${event.organizer.firstName} ${event.organizer.lastName}`
        .replace(
          /\s+/g,
          " ",
        )
        .trim();

    const refundEmailData = {
      id:
        createdRefund.id,
      reference:
        createdRefund.reference,
      amount:
        createdRefund.requestedAmount,
      currency:
        createdRefund.currency,
      requestedAt:
        createdRefund.requestedAt,
    };

    const eventEmailData = {
      title:
        event.title,
      startsAt:
        event.startsAt,
    };

    const results =
      await Promise.allSettled([
        sendRefundRequestedEmail({
          customer: {
            name:
              customerName ||
              customerRecord?.email ||
              customer.email,
            email:
              customerRecord?.email ??
              customer.email,
          },
          event:
            eventEmailData,
          refund:
            refundEmailData,
        }),

        sendRefundOrganizerNotificationEmail({
          organizer: {
            name:
              organizerName ||
              event.organizer.email,
            email:
              event.organizer.email,
          },
          event:
            eventEmailData,
          refund:
            refundEmailData,
        }),
      ]);

    for (
      const notification of
      results
    ) {
      if (
        notification.status ===
        "rejected"
      ) {
        console.error(
          "[CLIENT_REFUND_NOTIFICATION_ERROR]",
          notification.reason,
        );
      }
    }
  } catch (error) {
    console.error(
      "[CLIENT_REFUND_NOTIFICATION_PREPARATION_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,
            message:
              error.message,
          }
        : error,
    );
  }
}

export async function GET():
  Promise<NextResponse> {
  const {
    customer,
  } =
    await requireClient(
      "/account/refunds",
    );

  try {
    const refunds =
      await getClientRefunds({
        customer: {
          id:
            customer.id,
          email:
            customer.email,
        },
        limit:
          200,
      });

    return jsonResponse({
      success:
        true,
      data: {
        refunds,
        total:
          refunds.length,
      },
    });
  } catch (error) {
    console.error(
      "[CLIENT_REFUNDS_GET_ERROR]",
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
            "CLIENT_REFUNDS_LOAD_FAILED",
          message:
            "Impossible de charger vos demandes de remboursement pour le moment.",
        },
      },
      500,
    );
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const {
    customer,
  } =
    await requireClient(
      "/account/refunds",
    );

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
            "REFUND_REQUEST_TOO_LARGE",
          message:
            "La demande de remboursement est trop volumineuse.",
        },
      },
      413,
    );
  }

  let body:
    unknown;

  try {
    body =
      await request.json();
  } catch {
    return jsonResponse(
      {
        success:
          false,
        error: {
          code:
            "REFUND_INVALID_JSON",
          message:
            "Le contenu de la demande n’est pas un JSON valide.",
        },
      },
      400,
    );
  }

  const parsed =
    createRefundRequestSchema
      .safeParse(
        body,
      );

  if (!parsed.success) {
    return jsonResponse(
      {
        success:
          false,
        error: {
          code:
            "REFUND_INVALID_REQUEST",
          message:
            getZodMessage(
              parsed.error,
            ),
          details:
            parsed.error.issues.map(
              (issue) => ({
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

  try {
    const createdRefund =
      await createRefundRequest({
        customer: {
          id:
            customer.id,
          email:
            customer.email,
        },

        ticketIds:
          parsed.data.ticketIds,

        reason:
          parsed.data.reason,

        reasonCategory:
          parsed.data
            .reasonCategory ??
          null,
      });

    /*
     * On ne bloque pas la réponse HTTP sur une
     * éventuelle panne d'e-mail.
     */
    void sendRequestNotifications({
      customer: {
        id:
          customer.id,
        email:
          customer.email,
      },
      createdRefund,
    });

    return jsonResponse(
      {
        success:
          true,
        message:
          "Votre demande de remboursement a bien été transmise à l’organisateur.",
        data: {
          refund:
            createdRefund,
        },
      },
      201,
    );
  } catch (error) {
    if (
      error instanceof
      ClientRefundRequestError
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
      "[CLIENT_REFUND_CREATE_ERROR]",
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
            "REFUND_CREATE_FAILED",
          message:
            "Impossible d’enregistrer votre demande de remboursement pour le moment.",
        },
      },
      500,
    );
  }
}
