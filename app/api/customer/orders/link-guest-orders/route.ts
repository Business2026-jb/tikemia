import {
  NextResponse,
  type NextRequest,
} from "next/server";
import {
  z,
} from "zod";

import {
  getCurrentClient,
} from "@/lib/client/get-current-client";
import {
  LinkGuestOrdersToCustomerError,
  linkGuestOrdersToCustomer,
} from "@/lib/customer/link-guest-orders-to-customer";
import {
  LinkGuestTicketsToCustomerError,
  linkGuestTicketsToCustomer,
} from "@/lib/customer/link-guest-tickets-to-customer";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const requestSchema =
  z
    .object({
      maximumOrders:
        z
          .number()
          .int()
          .min(1)
          .max(20_000)
          .optional(),

      maximumTickets:
        z
          .number()
          .int()
          .min(1)
          .max(50_000)
          .optional(),

      dryRun:
        z
          .boolean()
          .optional()
          .default(false),

      synchronizeTicketHolderData:
        z
          .boolean()
          .optional()
          .default(true),
    })
    .strict();

type LinkGuestOrdersRequest =
  z.infer<
    typeof requestSchema
  >;

type ApiErrorResponse = {
  ok: false;

  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ApiSuccessResponse = {
  ok: true;

  message: string;

  data: {
    customerId: string;

    orders: Awaited<
      ReturnType<
        typeof linkGuestOrdersToCustomer
      >
    >;

    tickets: Awaited<
      ReturnType<
        typeof linkGuestTicketsToCustomer
      >
    >;
  };
};

function createNoStoreHeaders(): HeadersInit {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",

    Pragma:
      "no-cache",

    Expires:
      "0",
  };
}

function errorResponse({
  status,
  code,
  message,
  details,
}: {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      ok:
        false,

      error: {
        code,
        message,
        ...(details ===
        undefined
          ? {}
          : {
              details,
            }),
      },
    },
    {
      status,

      headers:
        createNoStoreHeaders(),
    },
  );
}

async function parseRequestBody(
  request: NextRequest,
): Promise<
  | {
      success: true;
      data: LinkGuestOrdersRequest;
    }
  | {
      success: false;
      response: NextResponse<ApiErrorResponse>;
    }
> {
  const contentType =
    request.headers
      .get(
        "content-type",
      )
      ?.toLowerCase() ??
    "";

  if (
    !contentType.includes(
      "application/json",
    )
  ) {
    return {
      success:
        true,

      data:
        requestSchema.parse(
          {},
        ),
    };
  }

  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return {
      success:
        false,

      response:
        errorResponse({
          status:
            400,

          code:
            "INVALID_JSON_BODY",

          message:
            "Le corps JSON de la requête est invalide.",
        }),
    };
  }

  const result =
    requestSchema.safeParse(
      body,
    );

  if (!result.success) {
    return {
      success:
        false,

      response:
        errorResponse({
          status:
            400,

          code:
            "INVALID_REQUEST_DATA",

          message:
            "Les paramètres fournis sont invalides.",

          details:
            result.error.flatten(),
        }),
    };
  }

  return {
    success:
      true,

    data:
      result.data,
  };
}

/**
 * POST /api/customer/orders/link-guest-orders
 *
 * Rattache au compte client connecté :
 *
 * 1. les anciennes commandes passées en mode invité ;
 * 2. les usages de codes promotionnels associés ;
 * 3. les billets dépendant des commandes désormais rattachées.
 *
 * Le rattachement repose sur :
 *
 * - l'adresse e-mail normalisée ;
 * - ou le téléphone normalisé ;
 * - le nom sert uniquement de contrôle complémentaire.
 */
export async function POST(
  request: NextRequest,
): Promise<
  NextResponse<
    | ApiSuccessResponse
    | ApiErrorResponse
  >
> {
  try {
    const client =
      await getCurrentClient();

    if (!client) {
      return errorResponse({
        status:
          401,

        code:
          "AUTHENTICATION_REQUIRED",

        message:
          "Vous devez être connecté à un compte client pour récupérer vos anciennes commandes.",
      });
    }

    const parsedRequest =
      await parseRequestBody(
        request,
      );

    if (
      !parsedRequest.success
    ) {
      return parsedRequest.response;
    }

    const {
      maximumOrders,
      maximumTickets,
      dryRun,
      synchronizeTicketHolderData,
    } =
      parsedRequest.data;

    const orders =
      await linkGuestOrdersToCustomer({
        customerId:
          client.id,

        maximumCandidates:
          maximumOrders,

        dryRun,
      });

    const tickets =
      await linkGuestTicketsToCustomer({
        customerId:
          client.id,

        maximumTickets,

        dryRun,

        synchronizeHolderData:
          synchronizeTicketHolderData,
      });

    const linkedOrders =
      orders.linkedOrders;

    const linkedTickets =
      tickets.updatedTickets;

    const message =
      dryRun
        ? "La simulation du rattachement des commandes invitées est terminée."
        : linkedOrders >
              0 ||
            linkedTickets >
              0
          ? "Vos anciennes commandes et vos billets ont été rattachés à votre compte."
          : "Aucune nouvelle commande invitée n’a été trouvée pour ce compte.";

    return NextResponse.json(
      {
        ok:
          true,

        message,

        data: {
          customerId:
            client.id,

          orders,

          tickets,
        },
      },
      {
        status:
          200,

        headers:
          createNoStoreHeaders(),
      },
    );
  } catch (error) {
    if (
      error instanceof
      LinkGuestOrdersToCustomerError ||
      error instanceof
      LinkGuestTicketsToCustomerError
    ) {
      return errorResponse({
        status:
          error.status,

        code:
          error.code,

        message:
          error.message,
      });
    }

    console.error(
      "[API_LINK_GUEST_ORDERS_ERROR]",
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

    return errorResponse({
      status:
        500,

      code:
        "LINK_GUEST_ORDERS_API_FAILED",

      message:
        "Impossible de récupérer vos anciennes commandes pour le moment.",
    });
  }
}