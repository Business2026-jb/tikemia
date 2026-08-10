"use client";

import {
  LoaderCircle,
  X,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type {
  AdminPayoutListItem,
} from "@/lib/admin/payouts/get-admin-payouts";

export default function RejectPayoutDialog({
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
    reason,
    setReason,
  ] = useState("");

  const [
    adminNote,
    setAdminNote,
  ] = useState("");

  const [
    supportMessage,
    setSupportMessage,
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
      setReason("");
      setAdminNote("");
      setSupportMessage("");
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

  const currentPayout =
    payout;

  const canSubmit =
    reason.trim().length >=
      5 &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/payouts/${encodeURIComponent(
            currentPayout.id,
          )}/reject`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                reason:
                  reason.trim(),

                adminNote:
                  adminNote.trim() ||
                  null,

                supportMessage:
                  supportMessage.trim() ||
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
                "Impossible de refuser ce retrait.",
        );
      }

      onSuccess(
        payload.message ||
          "Le retrait a été refusé.",
      );

      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible de refuser ce retrait.",
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

      <div className="relative z-10 w-full max-w-lg rounded-[24px] border border-red-400/15 bg-[#070b0e] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/15 bg-red-400/[0.07] text-red-300">
            <XCircle className="h-5 w-5" />
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
          Refuser le retrait
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Le motif sera communiqué à l’organisateur par e-mail.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Motif du refus *
          </span>

          <textarea
            value={
              reason
            }
            onChange={(
              event,
            ) =>
              setReason(
                event.target.value,
              )
            }
            rows={
              4
            }
            maxLength={
              2000
            }
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-red-400/30"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-bold text-neutral-400">
            Note interne
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
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-red-400/30"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-bold text-neutral-400">
            Message d’accompagnement
          </span>

          <textarea
            value={
              supportMessage
            }
            onChange={(
              event,
            ) =>
              setSupportMessage(
                event.target.value,
              )
            }
            rows={
              3
            }
            maxLength={
              1000
            }
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-red-400/30"
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
              !canSubmit
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-5 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}

            Confirmer le refus
          </button>
        </div>
      </div>
    </div>
  );
}