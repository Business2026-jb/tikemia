"use client";

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { AdminEventRowData } from "./event-row";

type ModerateEventDialogProps = {
  event: AdminEventRowData | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type ModerationAction = "APPROVE" | "REJECT" | "SUSPEND";

export default function ModerateEventDialog({
  event,
  open,
  onClose,
  onSuccess,
}: ModerateEventDialogProps) {
  const [action, setAction] = useState<ModerationAction | "">("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setAction("");
      setReason("");
      setNotes("");
      setSubmitting(false);
      setError("");
    }
  }, [open]);

  if (!open || !event) return null;

  const eventId = event.id;

  async function handleSubmit() {
    if (!action || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/moderate`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            reason: reason.trim() || null,
            notes: notes.trim() || null,
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

        throw new Error(
          message || "Impossible d’appliquer cette action de modération.",
        );
      }

      onSuccess();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’appliquer cette action de modération.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fermer"
        onClick={submitting ? undefined : onClose}
        className="absolute inset-0"
      />

      <div className="relative z-10 w-full max-w-xl rounded-[24px] border border-white/[0.09] bg-[#090d12] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/[0.08] text-sky-300">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-5 text-xl font-black text-white">
          Modérer l’événement
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {event.title}
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <ActionButton
            active={action === "APPROVE"}
            onClick={() => setAction("APPROVE")}
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Approuver"
          />
          <ActionButton
            active={action === "REJECT"}
            onClick={() => setAction("REJECT")}
            icon={<XCircle className="h-4 w-4" />}
            label="Refuser"
          />
          <ActionButton
            active={action === "SUSPEND"}
            onClick={() => setAction("SUSPEND")}
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Suspendre"
          />
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">Motif</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Motif de la décision..."
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 p-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-sky-400/30"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-bold text-neutral-400">
            Notes internes
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={4000}
            rows={3}
            placeholder="Notes visibles uniquement dans l’administration..."
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 p-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-sky-400/30"
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
            disabled={!action || submitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 text-sm font-black text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${
        active
          ? "border-sky-400/40 bg-sky-400/10 text-sky-200"
          : "border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
