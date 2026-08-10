"use client";

import {
  LoaderCircle,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  MarketingAuditPriority,
} from "@/lib/admin/marketing/create-marketing-audit-log";
import type {
  AdminMarketingCampaignListItem,
} from "@/lib/admin/marketing/get-admin-marketing-campaigns";

export default function UpdateMarketingPriorityDialog({
  campaign,
  open,
  onClose,
  onSuccess,
}: {
  campaign: AdminMarketingCampaignListItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [priority, setPriority] =
    useState<MarketingAuditPriority>("NORMAL");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && campaign) {
      setPriority(campaign.priority);
      setReason("");
      setSubmitting(false);
      setError("");
    }
  }, [open, campaign]);

  if (!open || !campaign) return null;

  const currentCampaign = campaign;

  async function submit() {
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/marketing/${encodeURIComponent(
          currentCampaign.id,
        )}/priority`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            priority,
            reason: reason.trim() || null,
          }),
        },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string | { message?: string };
      };

      if (!response.ok || !payload.success) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.message ||
                "Impossible de modifier la priorité.",
        );
      }

      onSuccess(payload.message || "La priorité a été mise à jour.");
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible de modifier la priorité.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative z-10 w-full max-w-lg rounded-[24px] border border-fuchsia-400/15 bg-[#070b0e] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-fuchsia-400/15 bg-fuchsia-400/[0.07] text-fuchsia-300">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-white/[0.04] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-5 text-xl font-black text-white">
          Modifier la priorité
        </h2>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Niveau de priorité
          </span>
          <select
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as MarketingAuditPriority)
            }
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none focus:border-fuchsia-400/30"
          >
            <option value="LOW">Faible</option>
            <option value="NORMAL">Normale</option>
            <option value="HIGH">Élevée</option>
            <option value="URGENT">Urgente</option>
          </select>
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-bold text-neutral-400">
            Motif facultatif
          </span>
          <textarea
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-400/30"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-xs text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 rounded-xl border border-white/[0.08] px-5 text-sm font-bold text-neutral-400"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-fuchsia-500 px-5 text-sm font-black text-white disabled:opacity-40"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <SlidersHorizontal className="h-4 w-4" />
            )}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
