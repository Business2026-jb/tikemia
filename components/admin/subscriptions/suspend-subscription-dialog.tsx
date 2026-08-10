"use client";

import {
  LoaderCircle,
  PauseCircle,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type {
  AdminSubscriptionListItem,
} from "@/lib/admin/subscriptions/get-admin-subscriptions";

export default function SuspendSubscriptionDialog({
  subscription,
  open,
  onClose,
  onSuccess,
}: {
  subscription:
    | AdminSubscriptionListItem
    | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (
    message: string,
  ) => void;
}) {
  const [
    reason,
    setReason,
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
      setSubmitting(false);
      setError("");
    }
  }, [open]);

  if (
    !open ||
    !subscription
  ) {
    return null;
  }

  const currentSubscription =
    subscription;

  const canSubmit =
    reason.trim().length >= 5 &&
    !submitting;

  async function submit() {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/subscriptions/${encodeURIComponent(
            currentSubscription.id,
          )}/suspend`,
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
                "Impossible de suspendre l’abonnement.",
        );
      }

      onSuccess(
        payload.message ||
          "L’abonnement a été suspendu.",
      );

      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible de suspendre l’abonnement.",
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

      <div className="relative z-10 w-full max-w-lg rounded-[24px] border border-sky-400/15 bg-[#070b0e] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/15 bg-sky-400/[0.07] text-sky-300">
            <PauseCircle className="h-5 w-5" />
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
          Suspendre l’abonnement
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Les privilèges seront désactivés temporairement et un e-mail sera envoyé.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Motif obligatoire
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
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/30"
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
            onClick={
              onClose
            }
            disabled={
              submitting
            }
            className="h-11 rounded-xl border border-white/[0.08] px-5 text-sm font-bold text-neutral-400"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={
              submit
            }
            disabled={
              !canSubmit
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-sky-500 px-5 text-sm font-black text-black disabled:opacity-40"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <PauseCircle className="h-4 w-4" />
            )}

            Suspendre
          </button>
        </div>
      </div>
    </div>
  );
}