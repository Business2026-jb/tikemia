"use client";

import {
  LoaderCircle,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  AdminMarketingCampaignListItem,
} from "@/lib/admin/marketing/get-admin-marketing-campaigns";

export default function UpdateMarketingBudgetDialog({
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
  const [budget, setBudget] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && campaign) {
      setBudget(campaign.budget ?? "");
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
        )}/budget`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            budget: budget.trim() || null,
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
                "Impossible de modifier le budget.",
        );
      }

      onSuccess(payload.message || "Le budget a été mis à jour.");
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible de modifier le budget.",
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

      <div className="relative z-10 w-full max-w-lg rounded-[24px] border border-cyan-400/15 bg-[#070b0e] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.07] text-cyan-300">
            <WalletCards className="h-5 w-5" />
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
          Modifier le budget
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Devise de la campagne : {currentCampaign.currency}
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Nouveau budget
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none focus:border-cyan-400/30"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-bold text-neutral-400">
            Motif facultatif
          </span>
          <textarea
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/30"
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
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-500 px-5 text-sm font-black text-black disabled:opacity-40"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <WalletCards className="h-4 w-4" />
            )}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
