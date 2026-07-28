import {
  OrderStatus,
  PaymentStatus,
  TicketStatus,
} from "@prisma/client";
import {
  PDFDocument,
} from "pdf-lib";
import {
  NextResponse,
} from "next/server";

import {
  requireCurrentClient,
} from "@/lib/client/get-current-client";
import {
  generateOrderTicketPdfs,
  type GeneratedTicketPdf,
} from "@/lib/tickets/generate-ticket-pdf";
import {
  prisma,
} from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

type DownloadOrderTicketsRouteProps = {
  params: Promise<{
    orderId: string;
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
        "");

  return (
    normalized.slice(
      0,
      120,
    ) ||
    "billets-tikemia"
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
}) {
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
          "no-store, max-age=0",

        Pragma:
          "no-cache",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

async function mergeTicketPdfs(
  tickets:
    GeneratedTicketPdf[],
): Promise<Uint8Array> {
  if (
    tickets.length ===
    1
  ) {
    return Uint8Array.from(
      tickets[0].bytes,
    );
  }

  const mergedDocument =
    await PDFDocument.create();

  mergedDocument.setTitle(
    "Billets Tikemia",
  );

  mergedDocument.setAuthor(
    "Tikemia",
  );

  mergedDocument.setCreator(
    "Tikemia",
  );

  mergedDocument.setProducer(
    "Tikemia Ticketing Platform",
  );

  for (
    const ticket of
    tickets
  ) {
    const sourceDocument =
      await PDFDocument.load(
        ticket.bytes,
      );

    const pageIndices =
      sourceDocument
        .getPageIndices();

    const copiedPages =
      await mergedDocument
        .copyPages(
          sourceDocument,
          pageIndices,
        );

    for (
      const page of
      copiedPages
    ) {
      mergedDocument.addPage(
        page,
      );
    }
  }

  return mergedDocument.save({
    useObjectStreams:
      true,

    addDefaultPage:
      false,

    objectsPerTick:
      50,
  });
}

function createPdfResponse({
  bytes,
  fileName,
}: {
  bytes: Uint8Array;
  fileName: string;
}) {
  const safeBytes =
    Uint8Array.from(
      bytes,
    );

  const body =
    new Blob(
      [
        safeBytes.buffer,
      ],
      {
        type:
          "application/pdf",
      },
    );

  return new NextResponse(
    body,
    {
      status:
        200,

      headers: {
        "Content-Type":
          "application/pdf",

        "Content-Disposition":
          `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(
            fileName,
          )}`,

        "Content-Length":
          String(
            safeBytes.byteLength,
          ),

        "Cache-Control":
          "private, no-store, max-age=0",

        Pragma:
          "no-cache",

        "X-Content-Type-Options":
          "nosniff",

        "Content-Security-Policy":
          "default-src 'none'; sandbox",
      },
    },
  );
}

export async function GET(
  _request: Request,
  {
    params,
  }: DownloadOrderTicketsRouteProps,
) {
  try {
    const {
      orderId: rawOrderId,
    } =
      await params;

    const orderId =
      normalizeText(
        rawOrderId,
      );

    if (
      !orderId
    ) {
      return createJsonError({
        code:
          "ORDER_ID_REQUIRED",

        message:
          "L’identifiant de la commande est obligatoire.",

        status:
          400,
      });
    }

    const client =
      await requireCurrentClient({
        redirectTo:
          `/account/orders`,
      });

    const order =
      await prisma.order.findUnique({
        where: {
          id:
            orderId,
        },

        select: {
          id:
            true,

          reference:
            true,

          customerId:
            true,

          status:
            true,

          ticketsIssuedAt:
            true,

          payment: {
            select: {
              status:
                true,
            },
          },

          event: {
            select: {
              title:
                true,

              slug:
                true,
            },
          },

          items: {
            select: {
              quantity:
                true,

              tickets: {
                where: {
                  status: {
                    in: [
                      TicketStatus.VALID,
                      TicketStatus.USED,
                    ],
                  },
                },

                select: {
                  id:
                    true,

                  status:
                    true,
                },
              },
            },
          },
        },
      });

    if (
      !order
    ) {
      return createJsonError({
        code:
          "ORDER_NOT_FOUND",

        message:
          "La commande est introuvable.",

        status:
          404,
      });
    }

    if (
      order.customerId !==
      client.id
    ) {
      return createJsonError({
        code:
          "ORDER_FORBIDDEN",

        message:
          "Cette commande n’appartient pas à votre compte.",

        status:
          403,
      });
    }

    if (
      order.status !==
        OrderStatus.PAID ||
      order.payment?.status !==
        PaymentStatus.SUCCESS
    ) {
      return createJsonError({
        code:
          "ORDER_NOT_PAID",

        message:
          "Les billets sont disponibles uniquement après confirmation du paiement.",

        status:
          409,
      });
    }

    const expectedTickets =
      order.items.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.quantity,
        0,
      );

    const availableTickets =
      order.items.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.tickets.length,
        0,
      );

    if (
      expectedTickets <=
        0 ||
      availableTickets !==
        expectedTickets ||
      !order.ticketsIssuedAt
    ) {
      return createJsonError({
        code:
          "TICKETS_NOT_READY",

        message:
          "Les billets de cette commande ne sont pas encore tous disponibles.",

        status:
          409,
      });
    }

    const generated =
      await generateOrderTicketPdfs({
        orderId:
          order.id,
      });

    if (
      generated.tickets.length !==
      expectedTickets
    ) {
      return createJsonError({
        code:
          "TICKET_PDF_COUNT_MISMATCH",

        message:
          "Tous les PDF de la commande ne sont pas disponibles.",

        status:
          409,
      });
    }

    const downloadedAt =
      new Date();

    const ticketIds =
      generated.tickets.map(
        (
          ticket,
        ) =>
          ticket.ticketId,
      );

    await prisma.ticket.updateMany({
      where: {
        id: {
          in:
            ticketIds,
        },

        orderId:
          order.id,
      },

      data: {
        pdfGeneratedAt:
          downloadedAt,

        lastDownloadedAt:
          downloadedAt,
      },
    });

    const pdfBytes =
      await mergeTicketPdfs(
        generated.tickets,
      );

    const fileBaseName =
      sanitizeFileName(
        generated.tickets.length ===
          1
          ? generated.tickets[0]
              .ticketCode
          : `Tikemia-${order.reference}-${order.event.title}`,
      );

    return createPdfResponse({
      bytes:
        pdfBytes,

      fileName:
        `${fileBaseName}.pdf`,
    });
  } catch (
    error
  ) {
    console.error(
      "[CLIENT_ORDER_TICKETS_DOWNLOAD_ERROR]",
      error instanceof
        Error
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

    return createJsonError({
      code:
        "TICKET_DOWNLOAD_FAILED",

      message:
        "Impossible de télécharger les billets pour le moment.",

      status:
        500,
    });
  }
}