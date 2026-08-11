"use client";

import {
  AlertCircle,
  Loader2,
  Send,
  X,
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

export default function ForwardRefundDialog({
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

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSubmitting(true);
    setErrorMessage("");

    try {
      const response =
        await fetch(
          `/api/organizer/refunds/${encodeURIComponent(
            refund.id,
          )}/forward`,
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
        await readJson(
          response,
        );

      if (!response.ok) {
        throw new Error(
          payload?.error
            ?.message ??
          payload?.message ??
          "Impossible de transmettre la demande à Tikemia.",
        );
      }

      onClose();

      await onComplete(
        payload?.message ??
        "La demande a été transmise à Tikemia.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de transmettre la demande.",
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
        className="w-full max-w-lg overflow-hidden rounded-[26px] border border-white/[0.10] bg-[#071015] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-lime-300">
              Validation organisateur
            </p>

            <h3 className="mt-1 text-xl font-black text-white">
              Transmettre à Tikemia
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
          <p className="text-sm leading-6 text-neutral-400">
            Vous confirmez que cette demande peut être examinée par Tikemia pour la décision finale et l’exécution éventuelle du remboursement.
          </p>

          <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
            <p className="text-sm font-black text-white">
              {
                refund.event
                  .title
              }
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              {
                refund.customer
                  .name
              } · {
                refund.reference
              }
            </p>
          </div>

          <div>
            <label
              htmlFor="forward-refund-note"
              className="text-xs font-black uppercase tracking-[0.1em] text-neutral-500"
            >
              Note pour Tikemia
            </label>

            <textarea
              id="forward-refund-note"
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
              disabled={
                submitting
              }
              placeholder="Ajoutez une observation utile si nécessaire…"
              className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-[#050b0f] p-3 text-sm leading-6 text-white outline-none placeholder:text-neutral-700 focus:border-lime-400/35"
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
            className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-black disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Transmission…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Confirmer la transmission
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
