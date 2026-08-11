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
  OrganizerRefundDetail,
} from "@/components/organizer/refunds/organizer-refunds-page";

type ApiPayload =
  Readonly<{
    success?: boolean;
    message?: string;
    error?: Readonly<{
      code?: string;
      message?: string;
    }>;
  }>;

async function readJson(
  response: Response,
): Promise<ApiPayload | null> {
  try {
    return await response.json() as ApiPayload;
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
    OrganizerRefundDetail;
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

  async function handleSubmit(
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
          `/api/organizer/refunds/${encodeURIComponent(
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
        await readJson(
          response,
        );

      if (!response.ok) {
        throw new Error(
          payload?.error
            ?.message ??
          payload?.message ??
          "Impossible de refuser la demande.",
        );
      }

      onClose();

      await onComplete(
        payload?.message ??
        "La demande de remboursement a été refusée.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de refuser la demande.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <form
        onSubmit={
          handleSubmit
        }
        className="w-full max-w-lg overflow-hidden rounded-[26px] border border-red-400/20 bg-[#11080a] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-red-400/10 p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-300">
              Décision organisateur
            </p>

            <h3 className="mt-1 text-xl font-black text-white">
              Refuser la demande
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
            aria-label="Fermer"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-red-400/15 bg-red-400/[0.05] p-4">
            <p className="text-sm font-black text-white">
              Motif obligatoire
            </p>

            <p className="mt-1 text-xs leading-5 text-red-100/65">
              Le client doit recevoir une raison claire et valable. Cette décision sera enregistrée dans le suivi de la demande.
            </p>
          </div>

          <div>
            <label
              htmlFor="reject-refund-reason"
              className="text-xs font-black uppercase tracking-[0.1em] text-neutral-500"
            >
              Raison du refus
            </label>

            <textarea
              id="reject-refund-reason"
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
              disabled={
                submitting
              }
              placeholder="Expliquez précisément pourquoi cette demande ne peut pas être acceptée…"
              className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-[#080406] p-3 text-sm leading-6 text-white outline-none placeholder:text-neutral-700 focus:border-red-400/35"
            />
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {
                errorMessage
              }
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting
            }
            className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-5 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-50"
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
