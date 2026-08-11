import {
  NextResponse,
} from "next/server";

import {
  requireClient,
} from "@/lib/client/auth/require-client";
import {
  getRefundableTickets,
} from "@/lib/client/refunds/get-refundable-tickets";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

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

export async function GET():
  Promise<NextResponse> {
  /*
   * L'authentification est volontairement effectuée
   * avec le helper client déjà utilisé par l'espace
   * personnel Tikemia.
   */
  const {
    customer,
  } =
    await requireClient(
      "/account/refunds",
    );

  try {
    const tickets =
      await getRefundableTickets({
        customer: {
          id:
            customer.id,
          email:
            customer.email,
        },
      });

    return jsonResponse({
      success:
        true,
      data: {
        tickets,
        total:
          tickets.length,
      },
    });
  } catch (error) {
    console.error(
      "[CLIENT_REFUND_ELIGIBLE_TICKETS_ERROR]",
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
            "REFUND_ELIGIBLE_TICKETS_LOAD_FAILED",
          message:
            "Impossible de charger les billets éligibles au remboursement pour le moment.",
        },
      },
      500,
    );
  }
}
