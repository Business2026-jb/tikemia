"use client";

import {
  Download,
  LoaderCircle,
} from "lucide-react";
import {
  useState,
} from "react";

import type {
  CustomerSort,
  CustomerStatusFilter,
} from "@/components/admin/customers/admin-customers-page";

function getDownloadFileName(
  response: Response,
): string {
  const disposition =
    response.headers.get(
      "content-disposition",
    );

  const match =
    disposition?.match(
      /filename="([^"]+)"/i,
    );

  return (
    match?.[1] ||
    `tikemia-clients-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`
  );
}

export default function ExportCustomersButton({
  search,
  status,
  sort,
}: {
  search: string;
  status: CustomerStatusFilter;
  sort: CustomerSort;
}) {
  const [exporting, setExporting] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleExport() {
    if (exporting) {
      return;
    }

    setExporting(true);
    setError("");

    try {
      const params =
        new URLSearchParams();

      if (search.trim()) {
        params.set(
          "search",
          search.trim(),
        );
      }

      params.set(
        "status",
        status,
      );

      params.set(
        "sort",
        sort,
      );

      const response =
        await fetch(
          `/api/admin/customers/export?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept:
                "application/pdf, application/json",
            },
          },
        );

      if (!response.ok) {
        const contentType =
          response.headers.get(
            "content-type",
          ) ?? "";

        if (
          contentType.includes(
            "application/json",
          )
        ) {
          const payload =
            (await response.json()) as {
              error?: {
                message?: string;
              };
            };

          throw new Error(
            payload.error?.message ||
              "Impossible d’exporter les clients.",
          );
        }

        throw new Error(
          "Impossible d’exporter les clients.",
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob,
        );

      const anchor =
        document.createElement(
          "a",
        );

      anchor.href =
        url;

      anchor.download =
        getDownloadFileName(
          response,
        );

      document.body.appendChild(
        anchor,
      );

      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(
        url,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’exporter les clients.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 px-4 text-xs font-black text-[#04100b] shadow-lg shadow-emerald-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {exporting ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {exporting
          ? "Export en cours…"
          : "Télécharger en PDF"}
      </button>

      {error ? (
        <p className="max-w-sm text-right text-[10px] font-semibold text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
