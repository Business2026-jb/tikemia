"use client";

import {
  Download,
  LoaderCircle,
} from "lucide-react";
import {
  useState,
} from "react";

export type PromotionExportFilters = {
  search: string;
  status: string;
  source: string;
  organizerId: string;
  country: string;
  startsFrom: string;
  startsTo: string;
  sort: string;
};

export default function ExportPromotionsButton({
  filters,
}: {
  filters: PromotionExportFilters;
}) {
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState("");

  async function handleExport() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const params =
        new URLSearchParams();

      Object.entries(filters).forEach(
        ([key, value]) => {
          if (
            value &&
            value !== "all"
          ) {
            params.set(
              key,
              value,
            );
          }
        },
      );

      const response =
        await fetch(
          `/api/admin/promotions/export?${params.toString()}`,
          {
            cache:
              "no-store",
          },
        );

      if (!response.ok) {
        let message =
          "Impossible de générer le rapport PDF.";

        try {
          const payload =
            (await response.json()) as {
              error?:
                | string
                | {
                    message?:
                      string;
                  };
            };

          message =
            typeof payload.error ===
            "string"
              ? payload.error
              : payload.error
                  ?.message ||
                message;
        } catch {
          // Réponse non JSON.
        }

        throw new Error(message);
      }

      const blob =
        await response.blob();

      const disposition =
        response.headers.get(
          "content-disposition",
        );

      const match =
        disposition?.match(
          /filename="?([^"]+)"?/i,
        );

      const fileName =
        match?.[1] ||
        `rapport-promotions-tikemia-${Date.now()}.pdf`;

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
        fileName;

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
          : "Impossible de générer le rapport PDF.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-4 text-sm font-extrabold text-emerald-300 transition hover:bg-emerald-400/[0.13] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}

        {loading
          ? "Génération..."
          : "Rapport PDF"}
      </button>

      {error ? (
        <p className="max-w-xs text-right text-[11px] text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
