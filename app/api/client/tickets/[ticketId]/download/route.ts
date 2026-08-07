import {
  Prisma,
  TicketStatus,
} from "@prisma/client";
import {
  NextResponse,
} from "next/server";

import {
  requireClient,
} from "@/lib/client/auth/require-client";
import {
  PaymentError,
  PaymentValidationError,
} from "@/lib/payments/payment-errors";
import {
  prisma,
} from "@/lib/prisma";
import {
  generateTicketPdf,
} from "@/lib/tickets/generate-ticket-pdf";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const maxDuration =
  60;

type ClientTicketDownloadRouteProps = {
  params: Promise<{
    ticketId: string;
  }>;
};

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeEmail(
  value:
    | string
    | null
    | undefined,
): string {
  return normalizeText(
    value,
  ).toLowerCase();
}

function sanitizeFileName(
  value: string,
): string {
  const normalized =
    normalizeText(
      value,
    )
      .normalize(
        "NFD",
      )
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      )
      .replace(
        /^[-.]+|[-.]+$/g,
        "",
      );

  return (
    normalized.slice(
      0,
      140,
    ) ||
    "billet-tikemia"
  );
}

function createJsonError({
  code,
  message,
  status,
}: {
  code: string;
  message: string;
  status: number;
}): NextResponse {
  return NextResponse.json(
    {
      success:
        false,

      error: {
        code,
        message,
      },
    },
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

function buildTicketOwnershipWhere({
  customerId,
  customerEmail,
}: {
  customerId: string;
  customerEmail: string;
}): Prisma.TicketWhereInput {
  const normalizedEmail =
    normalizeEmail(
      customerEmail,
    );

  const ownershipConditions:
    Prisma.TicketWhereInput[] = [
    {
      ownerId:
        customerId,
    },
  ];

  /*
   * Compatibilité avec les anciens billets créés
   * avant le rattachement systématique de ownerId.
   *
   * Dès qu’un ownerId existe, seul ce propriétaire
   * peut télécharger le billet.
   */
  if (normalizedEmail) {
    ownershipConditions.push({
      AND: [
        {
          ownerId:
            null,
        },

        {
          holderEmail: {
            equals:
              normalizedEmail,

            mode:
              Prisma.QueryMode.insensitive,
          },
        },
      ],
    });
  }

  return {
    OR:
      ownershipConditions,
  };
}

function assertTicketCanBeDownloaded({
  status,
}: {
  status: TicketStatus;
}): void {
  if (
    status ===
      TicketStatus.CANCELLED ||
    status ===
      TicketStatus.REFUNDED ||
    status ===
      TicketStatus.REVOKED
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_PAYABLE",

      message:
        "Ce billet ne peut plus être téléchargé.",

      status:
        409,
    });
  }
}

function createPdfResponse({
  bytes,
  fileName,
}: {
  bytes: Uint8Array;
  fileName: string;
}): Response {
  const safeFileName =
    sanitizeFileName(
      fileName,
    );

  const finalFileName =
    safeFileName
      .toLowerCase()
      .endsWith(
        ".pdf",
      )
      ? safeFileName
      : `${safeFileName}.pdf`;

  const encodedFileName =
    encodeURIComponent(
      finalFileName,
    );

  return new Response(
    Uint8Array.from(
      bytes,
    ),
    {
      status:
        200,

      headers: {
        "Content-Type":
          "application/pdf",

        "Content-Disposition":
          `attachment; filename="${finalFileName}"; filename*=UTF-8''${encodedFileName}`,

        "Content-Length":
          String(
            bytes.byteLength,
          ),

        "Cache-Control":
          "private, no-store, no-cache, must-revalidate, max-age=0",

        Pragma:
          "no-cache",

        Expires:
          "0",

        "X-Content-Type-Options":
          "nosniff",

        "Content-Security-Policy":
          "default-src 'none'; frame-ancestors 'none'; sandbox",

        "Cross-Origin-Resource-Policy":
          "same-origin",

        "Referrer-Policy":
          "no-referrer",
      },
    },
  );
}

function getErrorStatus(
  error: unknown,
): number | null {
  if (
    error &&
    typeof error ===
      "object" &&
    "status" in error &&
    typeof error.status ===
      "number"
  ) {
    return error.status;
  }

  return null;
}

function getErrorCode(
  error: unknown,
): string | null {
  if (
    error &&
    typeof error ===
      "object" &&
    "code" in error &&
    typeof error.code ===
      "string"
  ) {
    return error.code;
  }

  return null;
}

function getErrorMessage(
  error: unknown,
): string | null {
  if (
    error instanceof Error &&
    normalizeText(
      error.message,
    )
  ) {
    return normalizeText(
      error.message,
    );
  }

  return null;
}

export async function GET(
  _request: Request,
  {
    params,
  }: ClientTicketDownloadRouteProps,
): Promise<Response> {
  try {
    const {
      customer,
    } =
      await requireClient(
        "/account/tickets",
      );

    const {
      ticketId: rawTicketId,
    } =
      await params;

    const ticketId =
      normalizeText(
        rawTicketId,
      );

    if (!ticketId) {
      return createJsonError({
        code:
          "TICKET_ID_REQUIRED",

        message:
          "L’identifiant du billet est obligatoire.",

        status:
          400,
      });
    }

    /*
     * Cette requête protège le téléchargement avant
     * même la génération du PDF.
     *
     * Un billet transféré ne peut plus être téléchargé
     * par son ancien propriétaire, même si celui-ci est
     * encore l’acheteur de la commande d’origine.
     */
    const ticket =
      await prisma.ticket.findFirst({
        where: {
          id:
            ticketId,

          AND: [
            buildTicketOwnershipWhere({
              customerId:
                customer.id,

              customerEmail:
                customer.email,
            }),
          ],
        },

        select: {
          id:
            true,

          code:
            true,

          status:
            true,

          holderName:
            true,

          holderEmail:
            true,

          event: {
            select: {
              id:
                true,

              title:
                true,
            },
          },

          ticketType: {
            select: {
              id:
                true,

              name:
                true,
            },
          },

          order: {
            select: {
              id:
                true,

              reference:
                true,
            },
          },
        },
      });

    if (!ticket) {
      return createJsonError({
        code:
          "TICKET_NOT_FOUND",

        message:
          "Ce billet est introuvable ou ne vous appartient plus.",

        status:
          404,
      });
    }

    assertTicketCanBeDownloaded({
      status:
        ticket.status,
    });

    const generatedPdf =
      await generateTicketPdf({
        ticketId:
          ticket.id,

        generatedAt:
          new Date(),
      });

    const fileName =
      [
        "tikemia",
        "billet",
        sanitizeFileName(
          ticket.event.title,
        ),
        sanitizeFileName(
          ticket.ticketType.name,
        ),
        sanitizeFileName(
          ticket.code,
        ),
      ]
        .filter(
          Boolean,
        )
        .join(
          "-",
        ) +
      ".pdf";

    return createPdfResponse({
      bytes:
        generatedPdf.bytes,

      fileName,
    });
  } catch (error) {
    console.error(
      "[CLIENT_TICKET_DOWNLOAD_ERROR]",
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

    /*
     * requireClient peut rediriger automatiquement
     * selon son implémentation. Si une réponse ou une
     * redirection Next.js est levée, elle ne doit pas
     * être transformée en erreur métier.
     */
    if (
      error instanceof Response
    ) {
      return error;
    }

    if (
      error instanceof
        PaymentValidationError ||
      error instanceof
        PaymentError
    ) {
      const status =
        getErrorStatus(
          error,
        ) ??
        500;

      const code =
        getErrorCode(
          error,
        ) ??
        "TICKET_PDF_GENERATION_FAILED";

      const message =
        status >= 500
          ? "Impossible de générer le PDF du billet pour le moment."
          : (
              getErrorMessage(
                error,
              ) ??
              "Le PDF de ce billet ne peut pas être généré."
            );

      return createJsonError({
        code,
        message,
        status,
      });
    }

    if (
      error instanceof
        Prisma
          .PrismaClientKnownRequestError
    ) {
      return createJsonError({
        code:
          "TICKET_DATABASE_ERROR",

        message:
          "Impossible de récupérer le billet pour le moment.",

        status:
          500,
      });
    }

    return createJsonError({
      code:
        "TICKET_DOWNLOAD_FAILED",

      message:
        "Impossible de télécharger le billet pour le moment. Réessayez.",

      status:
        500,
    });
  }
}