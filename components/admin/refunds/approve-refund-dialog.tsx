"use client";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import type {
  AdminRefundDetail,
} from "@/components/admin/refunds/admin-refunds-page";

type Payload =
  Readonly<{
    success?: boolean;
    message?: string;
    error?: Readonly<{
      message?: string;
    }>;
  }>;

async function json(
  response: Response,
): Promise<Payload | null> {
  try {
    return await response.json() as Payload;
  } catch {
    return null;
  }
}

export default function ApproveRefundDialog({
  refund,
  open,
  onClose,
  onComplete,
}: {
  refund:
    AdminRefundDetail;
  open: boolean;
  onClose: () => void;
  onComplete:
    (
      message: string,
    ) => Promise<void> |
    void;
}) {
  const [
    note,
    setNote,
  ] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  useEffect(
    () => {
      if (!open) {
        setNote("");
        setErrorMessage("");
      }
    },
    [open],
  );

  if (!open) {
    return null;
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      const response =
        await fetch(
          `/api/admin/refunds/${encodeURIComponent(
            refund.id,
          )}/approve`,
          {
            method:
              "POST",
            headers: {
              Accept:
                "application/json",
              "Content-Type":
                "application/json",
            },
            credentials:
              "include",
            cache:
              "no-store",
            body:
              JSON.stringify({
                note:
                  note.trim() ||
                  null,
              }),
          },
        );

      const payload =
        await json(
          response,
        );

      if (!response.ok) {
        throw new Error(
          payload?.error
            ?.message ??
          payload?.message ??
          "Impossible d’approuver ce remboursement.",
        );
      }

      onClose();

      await onComplete(
        payload?.message ??
        "La demande a été approuvée.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’approuver ce remboursement.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <form
        onSubmit={
          submit
        }
        className="w-full max-w-lg overflow-hidden rounded-[26px] border border-emerald-400/20 bg-[#071015]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
              Décision Tikemia
            </p>
            <h3 className="mt-1 text-xl font-black text-white">
              Approuver le remboursement
            </h3>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              submitting
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-neutral-400">
            L’approbation place la demande dans le traitement financier prévu par Tikemia. Vérifiez le paiement, les billets et les informations du client avant de confirmer.
          </p>

          <textarea
            value={
              note
            }
            onChange={
              (event) =>
                setNote(
                  event.target
                    .value.slice(
                      0,
                      1_500,
                    ),
                )
            }
            rows={5}
            placeholder="Note administrative facultative…"
            disabled={
              submitting
            }
            className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#050b0f] p-3 text-sm leading-6 text-white outline-none placeholder:text-neutral-700 focus:border-emerald-400/35"
          />

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-xs text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting
            }
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-sm font-black text-black disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validation…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmer l’approbation
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
