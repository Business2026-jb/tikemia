"use client";

import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import type {
  RefundableTicketData,
} from "@/components/client/refunds/client-refunds-page";

const REASON_OPTIONS =
  [
    {
      value:
        "EVENT_CHANGE",
      label:
        "Changement lié à l’événement",
    },
    {
      value:
        "PERSONAL_REASON",
      label:
        "Empêchement personnel",
    },
    {
      value:
        "PURCHASE_ERROR",
      label:
        "Erreur lors de l’achat",
    },
    {
      value:
        "OTHER",
      label:
        "Autre motif",
    },
  ] as const;

function formatMoney(
  amount: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",
        currency:
          currency.toUpperCase(),
        maximumFractionDigits:
          currency.toUpperCase() ===
          "XOF"
            ? 0
            : 2,
      },
    ).format(
      amount,
    );
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default function RefundRequestForm({
  selectedTickets,
  selectedAmount,
  currency,
  submitting,
  onSubmit,
}: {
  selectedTickets:
    readonly RefundableTicketData[];
  selectedAmount:
    number;
  currency:
    string;
  submitting:
    boolean;
  onSubmit:
    (
      input: {
        reason: string;
        reasonCategory:
          string | null;
      },
    ) => Promise<boolean>;
}) {
  const [
    reason,
    setReason,
  ] =
    useState("");

  const [
    reasonCategory,
    setReasonCategory,
  ] =
    useState("PERSONAL_REASON");

  const [
    localError,
    setLocalError,
  ] =
    useState("");

  const remainingCharacters =
    useMemo(
      () =>
        Math.max(
          0,
          2_000 -
            reason.length,
        ),
      [reason.length],
    );

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedReason =
      reason.trim();

    if (
      selectedTickets.length ===
      0
    ) {
      setLocalError(
        "Sélectionnez au moins un billet.",
      );
      return;
    }

    if (
      normalizedReason.length <
      10
    ) {
      setLocalError(
        "Expliquez votre demande en au moins 10 caractères.",
      );
      return;
    }

    setLocalError("");

    const sent =
      await onSubmit({
        reason:
          normalizedReason,
        reasonCategory:
          reasonCategory ||
          null,
      });

    if (sent) {
      setReason("");
      setReasonCategory(
        "PERSONAL_REASON",
      );
    }
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#071015]"
    >
      <div className="border-b border-white/[0.07] p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-lime-400/15 bg-lime-400/[0.07] text-lime-300">
            <ReceiptText className="h-5 w-5" />
          </span>

          <div>
            <h2 className="text-lg font-black text-white">
              Votre demande
            </h2>

            <p className="text-xs text-neutral-500">
              Vérifiez avant l’envoi.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-neutral-400">
              Billets sélectionnés
            </span>

            <span className="text-base font-black text-white">
              {
                selectedTickets.length
              }
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-4 border-t border-white/[0.06] pt-3">
            <span className="text-sm font-bold text-neutral-300">
              Montant demandé
            </span>

            <span className="text-xl font-black tracking-[-0.03em] text-lime-300">
              {formatMoney(
                selectedAmount,
                currency,
              )}
            </span>
          </div>
        </div>

        <div>
          <label
            htmlFor="refund-reason-category"
            className="text-xs font-black uppercase tracking-[0.1em] text-neutral-500"
          >
            Type de motif
          </label>

          <select
            id="refund-reason-category"
            value={
              reasonCategory
            }
            onChange={
              (event) =>
                setReasonCategory(
                  event.target
                    .value,
                )
            }
            disabled={
              submitting
            }
            className="mt-2 h-12 w-full rounded-xl border border-white/[0.08] bg-[#050b0f] px-3 text-sm font-bold text-white outline-none transition focus:border-lime-400/40 disabled:opacity-50"
          >
            {REASON_OPTIONS.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {
                    option.label
                  }
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="refund-reason"
              className="text-xs font-black uppercase tracking-[0.1em] text-neutral-500"
            >
              Motif détaillé
            </label>

            <span className="text-[10px] font-bold text-neutral-600">
              {
                remainingCharacters
              } caractères
            </span>
          </div>

          <textarea
            id="refund-reason"
            value={
              reason
            }
            onChange={
              (event) =>
                setReason(
                  event.target
                    .value.slice(
                      0,
                      2_000,
                    ),
                )
            }
            disabled={
              submitting
            }
            rows={6}
            placeholder="Expliquez clairement pourquoi vous demandez le remboursement de ce billet…"
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-[#050b0f] p-3 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-400/40 disabled:opacity-50"
          />
        </div>

        {localError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

            {
              localError
            }
          </div>
        )}

        <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />

            <p className="text-xs leading-5 text-amber-100/75">
              L’envoi d’une demande ne signifie pas que le remboursement est déjà effectué. La demande sera d’abord examinée selon le workflow Tikemia.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={
            submitting ||
            selectedTickets.length ===
              0
          }
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-black transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Envoi…
            </>
          ) : (
            <>
              Envoyer la demande
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
