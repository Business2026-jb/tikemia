"use client";

import {
  CheckCircle2,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type {
  AdminPayoutListItem,
} from "@/lib/admin/payouts/get-admin-payouts";

function formatMoney(
  amount: string,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      },
    ).format(
      Number(amount),
    );
  } catch {
    return `${amount} ${currency}`;
  }
}

export default function ApprovePayoutDialog({
  payout,
  open,
  onClose,
  onSuccess,
}: {
  payout:
    | AdminPayoutListItem
    | null;
  open:
    boolean;
  onClose:
    () => void;
  onSuccess:
    (
      message: string,
    ) => void;
}) {
  const [
    adminNote,
    setAdminNote,
  ] = useState("");

  const [
    estimatedDelay,
    setEstimatedDelay,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    if (!open) {
      setAdminNote("");
      setEstimatedDelay("");
      setSubmitting(false);
      setError("");
    }
  }, [
    open,
  ]);

  if (
    !open ||
    !payout
  ) {
    return null;
  }

  /*
   * À partir d'ici, payout est garanti non null.
   * On garde une référence stable pour les fonctions
   * asynchrones internes comme handleSubmit().
   */
  const currentPayout =
    payout;

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/payouts/${encodeURIComponent(
            currentPayout.id,
          )}/approve`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                adminNote:
                  adminNote.trim() ||
                  null,

                estimatedDelay:
                  estimatedDelay.trim() ||
                  null,
              }),
          },
        );

      const payload =
        (await response.json()) as {
          success?: boolean;
          message?: string;
          error?:
            | {
                message?: string;
              }
            | string;
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
                "Impossible d’approuver ce retrait.",
        );
      }

      onSuccess(
        payload.message ||
          "Le retrait a été approuvé.",
      );

      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’approuver ce retrait.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fermer"
        onClick={
          onClose
        }
        className="absolute inset-0"
      />

      <div className="relative z-10 w-full max-w-lg rounded-[24px] border border-emerald-400/15 bg-[#070b0e] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              submitting
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-white/[0.04] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-5 text-xl font-black text-white">
          Approuver le retrait
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Le retrait passera en traitement et l’organisateur recevra
          automatiquement un e-mail.
        </p>

        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="font-black text-white">
            {currentPayout.organizer
              .businessName ??
              currentPayout.organizer
                .fullName}
          </p>

          <p className="mt-1 text-sm text-neutral-500">
            {formatMoney(
              currentPayout.netAmount,
              currentPayout.currency,
            )}
          </p>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Note administrative
          </span>

          <textarea
            value={
              adminNote
            }
            onChange={(
              event,
            ) =>
              setAdminNote(
                event.target.value,
              )
            }
            rows={
              3
            }
            maxLength={
              4000
            }
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-emerald-400/30"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-bold text-neutral-400">
            Délai estimé communiqué
          </span>

          <input
            value={
              estimatedDelay
            }
            onChange={(
              event,
            ) =>
              setEstimatedDelay(
                event.target.value,
              )
            }
            maxLength={
              500
            }
            placeholder="Exemple : 1 à 3 jours ouvrés"
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-emerald-400/30"
          />
        </label>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-300">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              submitting
            }
            className="h-11 rounded-xl border border-white/[0.08] px-5 text-sm font-bold text-neutral-400 hover:bg-white/[0.04] hover:text-white"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={
              handleSubmit
            }
            disabled={
              submitting
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}

            Confirmer l’approbation
          </button>
        </div>
      </div>
    </div>
  );
}