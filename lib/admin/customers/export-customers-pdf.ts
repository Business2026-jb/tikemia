import "server-only";

import {
  AdminCustomerError,
} from "@/lib/admin/customers/customer-errors";
import {
  getAdminCustomers,
  type AdminCustomerListItem,
  type AdminCustomerSort,
  type AdminCustomerStatusFilter,
} from "@/lib/admin/customers/get-admin-customers";

export type ExportCustomersPdfInput = Readonly<{
  search?: string | null;
  status?: AdminCustomerStatusFilter;
  sort?: AdminCustomerSort;
}>;

export type ExportCustomersPdfResult = Readonly<{
  fileName: string;
  mimeType: "application/pdf";
  buffer: Buffer;
  customersCount: number;
}>;

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 34;
const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 26;

function latin1(
  value: string,
): string {
  return value
    .normalize(
      "NFKD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^\x20-\xFF]/g,
      "?",
    );
}

function escapePdfText(
  value: string,
): string {
  return latin1(
    value,
  )
    .replace(
      /\\/g,
      "\\\\",
    )
    .replace(
      /\(/g,
      "\\(",
    )
    .replace(
      /\)/g,
      "\\)",
    );
}

function truncate(
  value: string,
  maximum: number,
): string {
  const normalized =
    value
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  if (
    normalized.length <=
    maximum
  ) {
    return normalized;
  }

  return `${normalized.slice(
    0,
    Math.max(
      maximum - 3,
      0,
    ),
  )}...`;
}

function formatDate(
  value: Date,
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",
    },
  ).format(
    value,
  );
}

function formatAmount(
  customer: AdminCustomerListItem,
): string {
  const amount =
    Number(
      customer.totalSpent,
    );

  const formatted =
    Number.isFinite(
      amount,
    )
      ? amount.toLocaleString(
          "fr-FR",
          {
            minimumFractionDigits:
              0,

            maximumFractionDigits:
              2,
          },
        )
      : customer.totalSpent;

  return `${formatted} ${customer.currency}`;
}

function textCommand({
  x,
  y,
  text,
  size = 8,
  bold = false,
}: {
  x: number;
  y: number;
  text: string;
  size?: number;
  bold?: boolean;
}): string {
  return [
    "BT",
    `/${bold ? "F2" : "F1"} ${size} Tf`,
    `${x} ${y} Td`,
    `(${escapePdfText(
      text,
    )}) Tj`,
    "ET",
  ].join(
    "\n",
  );
}

function rectangleCommand({
  x,
  y,
  width,
  height,
  gray,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  gray: number;
}): string {
  return [
    `${gray} g`,
    `${x} ${y} ${width} ${height} re`,
    "f",
    "0 g",
  ].join(
    "\n",
  );
}

function buildPageContent({
  customers,
  pageNumber,
  totalPages,
  generatedAt,
}: {
  customers: readonly AdminCustomerListItem[];
  pageNumber: number;
  totalPages: number;
  generatedAt: Date;
}): string {
  const commands:
    string[] =
    [];

  commands.push(
    rectangleCommand({
      x:
        0,

      y:
        PAGE_HEIGHT -
        82,

      width:
        PAGE_WIDTH,

      height:
        82,

      gray:
        0.04,
    }),
  );

  commands.push(
    textCommand({
      x:
        MARGIN,

      y:
        PAGE_HEIGHT -
        38,

      text:
        "TIKEMIA",

      size:
        17,

      bold:
        true,
    }),
  );

  commands.push(
    textCommand({
      x:
        MARGIN,

      y:
        PAGE_HEIGHT -
        59,

      text:
        "Liste des clients ayant effectue au moins un achat",

      size:
        10,

      bold:
        true,
    }),
  );

  commands.push(
    textCommand({
      x:
        PAGE_WIDTH -
        260,

      y:
        PAGE_HEIGHT -
        37,

      text:
        `Genere le ${formatDate(
          generatedAt,
        )}`,

      size:
        8,
    }),
  );

  commands.push(
    textCommand({
      x:
        PAGE_WIDTH -
        260,

      y:
        PAGE_HEIGHT -
        55,

      text:
        `Page ${pageNumber}/${totalPages}`,

      size:
        8,
    }),
  );

  const tableTop =
    PAGE_HEIGHT -
    112;

  const columns = [
    {
      label:
        "Client",

      x:
        MARGIN,

      width:
        128,
    },
    {
      label:
        "E-mail",

      x:
        MARGIN +
        132,

      width:
        172,
    },
    {
      label:
        "Telephone",

      x:
        MARGIN +
        308,

      width:
        105,
    },
    {
      label:
        "Commandes",

      x:
        MARGIN +
        417,

      width:
        62,
    },
    {
      label:
        "Billets",

      x:
        MARGIN +
        483,

      width:
        48,
    },
    {
      label:
        "Depense",

      x:
        MARGIN +
        535,

      width:
        105,
    },
    {
      label:
        "Dernier achat",

      x:
        MARGIN +
        644,

      width:
        92,
    },
  ];

  commands.push(
    rectangleCommand({
      x:
        MARGIN,

      y:
        tableTop -
        HEADER_HEIGHT,

      width:
        PAGE_WIDTH -
        MARGIN *
          2,

      height:
        HEADER_HEIGHT,

      gray:
        0.12,
    }),
  );

  for (
    const column of columns
  ) {
    commands.push(
      textCommand({
        x:
          column.x +
          4,

        y:
          tableTop -
          17,

        text:
          column.label,

        size:
          7,

        bold:
          true,
      }),
    );
  }

  customers.forEach(
    (
      customer,
      index,
    ) => {
      const rowTop =
        tableTop -
        HEADER_HEIGHT -
        index *
          ROW_HEIGHT;

      if (
        index %
          2 ===
        1
      ) {
        commands.push(
          rectangleCommand({
            x:
              MARGIN,

            y:
              rowTop -
              ROW_HEIGHT,

            width:
              PAGE_WIDTH -
              MARGIN *
                2,

            height:
              ROW_HEIGHT,

            gray:
              0.95,
          }),
        );
      }

      const values = [
        truncate(
          customer.fullName,
          24,
        ),

        truncate(
          customer.email,
          31,
        ),

        truncate(
          customer.phone ??
            "-",
          18,
        ),

        String(
          customer.ordersCount,
        ),

        String(
          customer.ticketsCount,
        ),

        truncate(
          formatAmount(
            customer,
          ),
          20,
        ),

        formatDate(
          customer.lastPurchaseAt,
        ),
      ];

      values.forEach(
        (
          value,
          valueIndex,
        ) => {
          commands.push(
            textCommand({
              x:
                columns[valueIndex]!
                  .x +
                4,

              y:
                rowTop -
                15,

              text:
                value,

              size:
                7,
            }),
          );
        },
      );
    },
  );

  commands.push(
    textCommand({
      x:
        MARGIN,

      y:
        18,

      text:
        "Document administratif Tikemia - donnees confidentielles",

      size:
        7,
    }),
  );

  return commands.join(
    "\n",
  );
}

function buildPdf(
  pageContents: readonly string[],
): Buffer {
  const objects:
    string[] =
    [];

  const pageObjectNumbers:
    number[] =
    [];

  objects.push(
    "<< /Type /Catalog /Pages 2 0 R >>",
  );

  objects.push(
    "",
  );

  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );

  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  for (
    const content of pageContents
  ) {
    const pageObjectNumber =
      objects.length +
      1;

    const contentObjectNumber =
      pageObjectNumber +
      1;

    pageObjectNumbers.push(
      pageObjectNumber,
    );

    objects.push(
      [
        "<< /Type /Page",
        "/Parent 2 0 R",
        `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
        "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>",
        `/Contents ${contentObjectNumber} 0 R`,
        ">>",
      ].join(
        " ",
      ),
    );

    const contentLength =
      Buffer.byteLength(
        content,
        "latin1",
      );

    objects.push(
      `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`,
    );
  }

  objects[1] =
    `<< /Type /Pages /Count ${pageObjectNumbers.length} /Kids [${pageObjectNumbers
      .map(
        (number) =>
          `${number} 0 R`,
      )
      .join(
        " ",
      )}] >>`;

  let pdf =
    "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";

  const offsets:
    number[] = [
      0,
    ];

  objects.forEach(
    (
      object,
      index,
    ) => {
      offsets.push(
        Buffer.byteLength(
          pdf,
          "latin1",
        ),
      );

      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    },
  );

  const xrefOffset =
    Buffer.byteLength(
      pdf,
      "latin1",
    );

  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (
    const offset of offsets.slice(
      1,
    )
  ) {
    pdf += `${String(
      offset,
    ).padStart(
      10,
      "0",
    )} 00000 n \n`;
  }

  pdf += [
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(
      xrefOffset,
    ),
    "%%EOF",
    "",
  ].join(
    "\n",
  );

  return Buffer.from(
    pdf,
    "latin1",
  );
}

export async function exportCustomersPdf(
  input: ExportCustomersPdfInput = {},
): Promise<ExportCustomersPdfResult> {
  try {
    const result =
      await getAdminCustomers({
        search:
          input.search,

        status:
          input.status,

        sort:
          input.sort,

        exportAll:
          true,

        pageSize:
          10_000,
      });

    const rowsPerPage =
      18;

    const totalPages =
      Math.max(
        Math.ceil(
          result.customers.length /
            rowsPerPage,
        ),
        1,
      );

    const generatedAt =
      new Date();

    const pageContents =
      Array.from(
        {
          length:
            totalPages,
        },
        (
          _,
          pageIndex,
        ) =>
          buildPageContent({
            customers:
              result.customers.slice(
                pageIndex *
                  rowsPerPage,
                (pageIndex + 1) *
                  rowsPerPage,
              ),

            pageNumber:
              pageIndex +
              1,

            totalPages,
            generatedAt,
          }),
      );

    const datePart =
      generatedAt
        .toISOString()
        .slice(
          0,
          10,
        );

    return {
      fileName:
        `tikemia-clients-${datePart}.pdf`,

      mimeType:
        "application/pdf",

      buffer:
        buildPdf(
          pageContents,
        ),

      customersCount:
        result.customers.length,
    };
  } catch (error) {
    if (
      error instanceof
      AdminCustomerError
    ) {
      throw error;
    }

    throw new AdminCustomerError({
      code:
        "ADMIN_CUSTOMERS_EXPORT_FAILED",

      message:
        "Impossible de générer le PDF des clients.",

      status:
        500,

      cause:
        error,
    });
  }
}
