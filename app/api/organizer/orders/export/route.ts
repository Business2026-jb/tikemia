import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createOrdersCsv,
  CreateOrdersCsvError,
  type OrdersCsvSection,
} from "@/lib/organizer/orders/create-orders-csv";
import {
  createOrdersExcel,
  CreateOrdersExcelError,
} from "@/lib/organizer/orders/create-orders-excel";
import {
  createOrdersPdf,
  CreateOrdersPdfError,
} from "@/lib/organizer/orders/create-orders-pdf";
import {
  exportOrdersData,
  ExportOrdersDataError,
  type OrganizerOrdersExportFormat,
} from "@/lib/organizer/orders/export-orders-data";
import type {
  OrganizerOrdersSort,
} from "@/lib/organizer/get-organizer-orders";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const ALLOWED_FORMATS: readonly OrganizerOrdersExportFormat[] = [
  "csv",
  "xlsx",
  "pdf",
];

const ALLOWED_CSV_SECTIONS: readonly OrdersCsvSection[] = [
  "orders",
  "items",
  "tickets",
  "customers",
  "summary",
];

const ALLOWED_SORTS: readonly OrganizerOrdersSort[] = [
  "NEWEST",
  "OLDEST",
  "AMOUNT_HIGH",
  "AMOUNT_LOW",
];

const DEFAULT_MAX_EXPORT_ORDERS =
  50_000;

const MAX_PDF_ORDERS =
  1_000;

type ConnectedOrganizer = {
  id: string;
  email: string;
};

class OrdersExportRouteError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({
    code,
    message,
    status = 500,
  }: {
    code: string;
    message: string;
    status?: number;
  }) {
    super(message);

    this.name =
      "OrdersExportRouteError";

    this.code =
      code;

    this.status =
      status;
  }
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function normalizeFormat(
  value: string | null,
): OrganizerOrdersExportFormat {
  const normalized =
    value?.trim().toLowerCase() ?? "";

  if (
    ALLOWED_FORMATS.includes(
      normalized as OrganizerOrdersExportFormat,
    )
  ) {
    return normalized as OrganizerOrdersExportFormat;
  }

  return "csv";
}

function normalizeCsvSection(
  value: string | null,
): OrdersCsvSection {
  const normalized =
    value?.trim().toLowerCase() ?? "";

  if (
    ALLOWED_CSV_SECTIONS.includes(
      normalized as OrdersCsvSection,
    )
  ) {
    return normalized as OrdersCsvSection;
  }

  return "orders";
}

function normalizeSort(
  value: string | null,
): OrganizerOrdersSort {
  const normalized =
    value?.trim().toUpperCase() ?? "";

  if (
    ALLOWED_SORTS.includes(
      normalized as OrganizerOrdersSort,
    )
  ) {
    return normalized as OrganizerOrdersSort;
  }

  return "NEWEST";
}

function normalizeOptionalQueryValue(
  value: string | null,
): string | null {
  const normalized =
    value?.trim() ?? "";

  return normalized || null;
}

function parsePositiveInteger({
  value,
  fallback,
  maximum,
}: {
  value: string | null;
  fallback: number;
  maximum: number;
}): number {
  const parsed =
    Number.parseInt(
      value ?? "",
      10,
    );

  if (
    !Number.isFinite(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    maximum,
  );
}

function parseBoolean(
  value: string | null,
  fallback: boolean,
): boolean {
  if (value === null) {
    return fallback;
  }

  const normalized =
    value.trim().toLowerCase();

  if (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "oui"
  ) {
    return true;
  }

  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no" ||
    normalized === "non"
  ) {
    return false;
  }

  return fallback;
}

function sanitizeDownloadFilename(
  filename: string,
): string {
  return filename
    .replace(/[\r\n"]/g, "")
    .trim();
}

function createContentDisposition(
  filename: string,
): string {
  const safeFilename =
    sanitizeDownloadFilename(
      filename,
    );

  const asciiFilename =
    safeFilename
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^\x20-\x7E]/g,
        "",
      )
      .replace(
        /[\\/:*?<>|]/g,
        "-",
      ) ||
    "tikemia-commandes";

  const encodedFilename =
    encodeURIComponent(
      safeFilename,
    ).replace(
      /['()]/g,
      escape,
    );

  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;
}

function createDownloadHeaders({
  filename,
  mimeType,
  contentLength,
}: {
  filename: string;
  mimeType: string;
  contentLength: number;
}): Headers {
  const headers =
    new Headers();

  headers.set(
    "Content-Type",
    mimeType,
  );

  headers.set(
    "Content-Disposition",
    createContentDisposition(
      filename,
    ),
  );

  headers.set(
    "Content-Length",
    String(
      contentLength,
    ),
  );

  headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, max-age=0",
  );

  headers.set(
    "Pragma",
    "no-cache",
  );

  headers.set(
    "Expires",
    "0",
  );

  headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );

  return headers;
}

function createErrorResponse({
  message,
  code,
  status,
}: {
  message: string;
  code: string;
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
          "no-store",
      },
    },
  );
}

async function getConnectedOrganizer(): Promise<ConnectedOrganizer> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    throw new OrdersExportRouteError({
      code:
        "UNAUTHENTICATED",

      status:
        401,

      message:
        "Votre session organisateur est introuvable. Veuillez vous reconnecter.",
    });
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(
            sessionToken,
          ),
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

            email:
              true,

            role:
              true,

            emailVerified:
              true,

            isActive:
              true,
          },
        },
      },
    });

  if (!session) {
    throw new OrdersExportRouteError({
      code:
        "SESSION_NOT_FOUND",

      status:
        401,

      message:
        "Votre session a expiré ou n’est plus valide. Veuillez vous reconnecter.",
    });
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
          error: unknown,
        ) => {
          console.error(
            "[ORGANIZER_ORDERS_EXPORT_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    throw new OrdersExportRouteError({
      code:
        "SESSION_EXPIRED",

      status:
        401,

      message:
        "Votre session a expiré. Veuillez vous reconnecter.",
    });
  }

  const organizer =
    session.user;

  if (
    organizer.role !==
      "ORGANIZER" ||
    !organizer.emailVerified ||
    !organizer.isActive
  ) {
    throw new OrdersExportRouteError({
      code:
        "FORBIDDEN",

      status:
        403,

      message:
        "Ce compte n’est pas autorisé à exporter les commandes organisateur.",
    });
  }

  return {
    id:
      organizer.id,

    email:
      organizer.email,
  };
}

export async function GET(
  request: NextRequest,
) {
  try {
    const organizer =
      await getConnectedOrganizer();

    const searchParams =
      request.nextUrl.searchParams;

    const format =
      normalizeFormat(
        searchParams.get(
          "format",
        ),
      );

    const csvSection =
      normalizeCsvSection(
        searchParams.get(
          "section",
        ),
      );

    const maximumOrders =
      parsePositiveInteger({
        value:
          searchParams.get(
            "maxOrders",
          ),

        fallback:
          DEFAULT_MAX_EXPORT_ORDERS,

        maximum:
          DEFAULT_MAX_EXPORT_ORDERS,
      });

    const maximumPdfOrders =
      parsePositiveInteger({
        value:
          searchParams.get(
            "maxPdfOrders",
          ),

        fallback:
          300,

        maximum:
          MAX_PDF_ORDERS,
      });

    const exportData =
      await exportOrdersData({
        organizerId:
          organizer.id,

        format,

        search:
          normalizeOptionalQueryValue(
            searchParams.get(
              "search",
            ),
          ),

        eventId:
          normalizeOptionalQueryValue(
            searchParams.get(
              "eventId",
            ),
          ),

        status:
          normalizeOptionalQueryValue(
            searchParams.get(
              "status",
            ),
          ),

        currency:
          normalizeOptionalQueryValue(
            searchParams.get(
              "currency",
            ),
          ),

        paymentStatus:
          normalizeOptionalQueryValue(
            searchParams.get(
              "paymentStatus",
            ),
          ),

        paymentMethod:
          normalizeOptionalQueryValue(
            searchParams.get(
              "paymentMethod",
            ),
          ),

        dateFrom:
          normalizeOptionalQueryValue(
            searchParams.get(
              "dateFrom",
            ),
          ),

        dateTo:
          normalizeOptionalQueryValue(
            searchParams.get(
              "dateTo",
            ),
          ),

        sort:
          normalizeSort(
            searchParams.get(
              "sort",
            ),
          ),

        maxOrders:
          maximumOrders,
      });

    if (format === "xlsx") {
      const excel =
        await createOrdersExcel(
          exportData,
          {
            includeSummary:
              parseBoolean(
                searchParams.get(
                  "includeSummary",
                ),
                true,
              ),

            includeOrders:
              parseBoolean(
                searchParams.get(
                  "includeOrders",
                ),
                true,
              ),

            includeItems:
              parseBoolean(
                searchParams.get(
                  "includeItems",
                ),
                true,
              ),

            includeTickets:
              parseBoolean(
                searchParams.get(
                  "includeTickets",
                ),
                true,
              ),

            includeCustomers:
              parseBoolean(
                searchParams.get(
                  "includeCustomers",
                ),
                true,
              ),
          },
        );

      return new Response(
        new Uint8Array(
          excel.buffer,
        ),
        {
          status:
            200,

          headers:
            createDownloadHeaders({
              filename:
                excel.filename,

              mimeType:
                excel.mimeType,

              contentLength:
                excel.buffer.byteLength,
            }),
        },
      );
    }

    if (format === "pdf") {
      const pdf =
        await createOrdersPdf(
          exportData,
          {
            includeSummary:
              parseBoolean(
                searchParams.get(
                  "includeSummary",
                ),
                true,
              ),

            includeFilters:
              parseBoolean(
                searchParams.get(
                  "includeFilters",
                ),
                true,
              ),

            includeOrders:
              parseBoolean(
                searchParams.get(
                  "includeOrders",
                ),
                true,
              ),

            maximumOrders:
              maximumPdfOrders,
          },
        );

      return new Response(
        new Uint8Array(
          pdf.buffer,
        ),
        {
          status:
            200,

          headers:
            createDownloadHeaders({
              filename:
                pdf.filename,

              mimeType:
                pdf.mimeType,

              contentLength:
                pdf.buffer.byteLength,
            }),
        },
      );
    }

    const csv =
      createOrdersCsv(
        exportData,
        {
          section:
            csvSection,

          includeBom:
            parseBoolean(
              searchParams.get(
                "includeBom",
              ),
              true,
            ),

          includeMetadata:
            parseBoolean(
              searchParams.get(
                "includeMetadata",
              ),
              true,
            ),
        },
      );

    const csvBuffer =
      Buffer.from(
        csv.content,
        "utf8",
      );

    return new Response(
      new Uint8Array(
        csvBuffer,
      ),
      {
        status:
          200,

        headers:
          createDownloadHeaders({
            filename:
              csv.filename,

            mimeType:
              csv.mimeType,

            contentLength:
              csvBuffer.byteLength,
          }),
      },
    );
  } catch (error) {
    if (
      error instanceof
        OrdersExportRouteError ||
      error instanceof
        ExportOrdersDataError ||
      error instanceof
        CreateOrdersCsvError ||
      error instanceof
        CreateOrdersExcelError ||
      error instanceof
        CreateOrdersPdfError
    ) {
      return createErrorResponse({
        code:
          error.code,

        message:
          error.message,

        status:
          error.status,
      });
    }

    console.error(
      "[ORGANIZER_ORDERS_EXPORT_ROUTE_ERROR]",
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

    return createErrorResponse({
      code:
        "ORGANIZER_ORDERS_EXPORT_FAILED",

      status:
        500,

      message:
        "Impossible de générer l’export des commandes pour le moment.",
    });
  }
}