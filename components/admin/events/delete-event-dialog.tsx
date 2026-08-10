"use client";

import {
  AlertTriangle,
  LoaderCircle,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { AdminEventRowData } from "./event-row";

type DeleteEventDialogProps = {
  event: AdminEventRowData | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function DeleteEventDialog({
  event,
  open,
  onClose,
  onSuccess,
}: DeleteEventDialogProps) {
  const [confirmationTitle, setConfirmationTitle] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmationTitle("");
      setReason("");
      setSubmitting(false);
      setError("");
    }
  }, [open]);

  if (!open || !event) return null;

  const eventId = event.id;
  const eventTitle = event.title;

  const canSubmit =
    confirmationTitle.trim() === eventTitle.trim() && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/delete`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmationTitle: confirmationTitle.trim(),
            reason: reason.trim() || null,
          }),
        },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string | { message?: string };
      };

      if (!response.ok || !payload.success) {
        const message =
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.message;

        throw new Error(message || "Impossible de supprimer l’événement.");
      }

      onSuccess();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible de supprimer l’événement.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fermer"
        onClick={submitting ? undefined : onClose}
        className="absolute inset-0"
      />

      <div className="relative z-10 w-full max-w-lg rounded-[24px] border border-red-400/15 bg-[#090b0c] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/15 bg-red-400/[0.07] text-red-300">
            <ShieldAlert className="h-5 w-5" />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-5 text-xl font-black text-white">
          Supprimer l’événement
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Cette opération est sensible. Vérifiez l’événement avant de confirmer
          sa suppression.
        </p>

        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="text-sm font-black text-white">{eventTitle}</p>
          <p className="mt-1 text-xs text-neutral-500">{eventId}</p>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Recopiez exactement le titre de l’événement
          </span>
          <input
            value={confirmationTitle}
            onChange={(inputEvent) =>
              setConfirmationTitle(inputEvent.target.value)
            }
            placeholder={eventTitle}
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-red-400/30"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-bold text-neutral-400">
            Motif de suppression
          </span>
          <textarea
            value={reason}
            onChange={(inputEvent) => setReason(inputEvent.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Motif facultatif..."
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 p-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-red-400/30"
          />
        </label>

        {error ? (
          <div className="mt-4 flex gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 rounded-xl border border-white/[0.08] px-5 text-sm font-bold text-neutral-400 hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-5 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Supprimer définitivement
          </button>
        </div>
      </div>
    </div>
  );
}
