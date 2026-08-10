"use client";

import {
  Gauge,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type {
  AdminPromotionListItem,
} from "@/lib/admin/promotions/get-admin-promotions";

export default function UpdatePromotionPriorityDialog({
  promotion,
  open,
  onClose,
  onSuccess,
}: {
  promotion:
    AdminPromotionListItem | null;
  open:
    boolean;
  onClose:
    () => void;
  onSuccess:
    (message: string) => void;
}) {
  const [priorityScore, setPriorityScore] =
    useState("");
  const [submitting, setSubmitting] =
    useState(false);
  const [error, setError] =
    useState("");

  useEffect(() => {
    if (open && promotion) {
      setPriorityScore(
        String(
          promotion.priorityScore,
        ),
      );
    }

    if (!open) {
      setPriorityScore("");
      setSubmitting(false);
      setError("");
    }
  }, [open, promotion]);

  if (
    !open ||
    !promotion
  ) {
    return null;
  }

  const currentPromotion =
    promotion;

  const score =
    Number(
      priorityScore,
    );

  const canSubmit =
    Number.isInteger(
      score,
    ) &&
    score >= 0 &&
    score <= 10000 &&
    score !==
      currentPromotion.priorityScore &&
    !submitting;

  async function submit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/promotions/${encodeURIComponent(
            currentPromotion.id,
          )}/priority`,
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                priorityScore:
                  score,
              }),
          },
        );

      const payload =
        (await response.json()) as {
          success?:
            boolean;
          message?:
            string;
          error?:
            | string
            | {
                message?:
                  string;
              };
        };

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          typeof payload.error ===
          "string"
            ? payload.error
            : payload.error?.message ||
                "Impossible de modifier la priorité.",
        );
      }

      onSuccess(
        payload.message ||
          "La priorité a été mise à jour.",
      );

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
            <Gauge className="h-5 w-5" />
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

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Un score plus élevé place l’événement avant les autres promotions.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Score de priorité
          </span>

          <input
            type="number"
            min={0}
            max={10000}
            value={priorityScore}
            onChange={(event) =>
              setPriorityScore(
                event.target.value,
              )
            }
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none focus:border-fuchsia-400/30"
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
            onClick={() =>
              void submit()
            }
            disabled={!canSubmit}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-fuchsia-500 px-5 text-sm font-black text-white disabled:opacity-40"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Gauge className="h-4 w-4" />
            )}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
