import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireClient,
} from "@/lib/client/auth/require-client";
import {
  getClientRefunds,
} from "@/lib/client/refunds/get-client-refunds";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

type ClientRefundDetailsRouteProps =
  Readonly<{
    params: Promise<{
      refundId: string;
    }>;
  }>;

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

function normalizeId(
  value:
    | string
    | null
    | undefined,
): string {
  return value
    ?.trim()
    .slice(
      0,
      120,
    ) ??
    "";
}

export async function GET(
  _request: NextRequest,
  {
    params,
  }:
    ClientRefundDetailsRouteProps,
): Promise<NextResponse> {
  const {
    customer,
  } =
    await requireClient(
      "/account/refunds",
    );

  const {
    refundId:
      rawRefundId,
  } =
    await params;

  const refundId =
    normalizeId(
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

  try {
    /*
     * On réutilise la lecture client déjà sécurisée :
     * getClientRefunds ne retourne que les remboursements
     * appartenant au client connecté.
     *
     * On ne fait donc jamais confiance au refundId seul.
     */
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

    const refund =
      refunds.find(
        (item) =>
          item.id ===
            refundId ||
          item.reference ===
            refundId,
      );

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
      "[CLIENT_REFUND_DETAILS_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,
            message:
              error.message,
            refundId,
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
            "REFUND_DETAILS_LOAD_FAILED",
          message:
            "Impossible de charger cette demande de remboursement pour le moment.",
        },
      },
      500,
    );
  }
}
