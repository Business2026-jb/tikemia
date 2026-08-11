"use client";

import {
  AlertCircle,
  Loader2,
  X,
  XCircle,
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

export default function RejectRefundDialog({
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
    reason,
    setReason,
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
        setReason("");
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

    const normalized =
      reason.trim();

    if (
      normalized.length <
      10
    ) {
      setErrorMessage(
        "Le motif du refus doit contenir au moins 10 caractères.",
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const response =
        await fetch(
          `/api/admin/refunds/${encodeURIComponent(
            refund.id,
          )}/reject`,
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
                reason:
                  normalized,
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
          "Impossible de refuser ce remboursement.",
        );
      }

      onClose();

      await onComplete(
        payload?.message ??
        "La demande a été refusée.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de refuser ce remboursement.",
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
        className="w-full max-w-lg overflow-hidden rounded-[26px] border border-red-400/20 bg-[#11080a]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-red-400/10 p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-300">
              Décision Tikemia
            </p>
            <h3 className="mt-1 text-xl font-black text-white">
              Refuser le remboursement
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
            Le motif sera enregistré dans le dossier. Il doit être clair et suffisamment précis.
          </p>

          <textarea
            value={
              reason
            }
            onChange={
              (event) =>
                setReason(
                  event.target
                    .value.slice(
                      0,
                      1_500,
                    ),
                )
            }
            rows={6}
            placeholder="Expliquez précisément le motif du refus…"
            disabled={
              submitting
            }
            className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#080406] p-3 text-sm leading-6 text-white outline-none placeholder:text-neutral-700 focus:border-red-400/35"
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
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-5 text-sm font-black text-white disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Confirmer le refus
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
