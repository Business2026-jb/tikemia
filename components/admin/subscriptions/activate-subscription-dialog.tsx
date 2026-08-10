"use client";

import {
  LoaderCircle,
  PlayCircle,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type {
  AdminSubscriptionListItem,
} from "@/lib/admin/subscriptions/get-admin-subscriptions";

type ActivateSubscriptionDialogProps = {
  subscription: AdminSubscriptionListItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

type ActivateSubscriptionApiResponse = {
  success?: boolean;
  message?: string;
  error?:
    | {
        message?: string;
      }
    | string;
};

export default function ActivateSubscriptionDialog({
  subscription,
  open,
  onClose,
  onSuccess,
}: ActivateSubscriptionDialogProps) {
  const [startsAt, setStartsAt] =
    useState("");

  const [endsAt, setEndsAt] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!open) {
      setStartsAt("");
      setEndsAt("");
      setSubmitting(false);
      setError("");
    }
  }, [
    open,
  ]);

  if (
    !open ||
    !subscription
  ) {
    return null;
  }

  const currentSubscription =
    subscription;

  async function submit() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/subscriptions/${encodeURIComponent(
            currentSubscription.id,
          )}/activate`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            cache:
              "no-store",

            body:
              JSON.stringify({
                startsAt:
                  startsAt ||
                  null,

                endsAt:
                  endsAt ||
                  null,
              }),
          },
        );

      let payload:
        ActivateSubscriptionApiResponse;

      try {
        payload =
          (await response.json()) as ActivateSubscriptionApiResponse;
      } catch {
        payload =
          {};
      }

      if (
        !response.ok ||
        !payload.success
      ) {
        const message =
          typeof payload.error ===
          "string"
            ? payload.error
            : payload.error
                ?.message ||
              payload.message ||
              "Impossible d’activer l’abonnement.";

        throw new Error(
          message,
        );
      }

      onSuccess(
        payload.message ||
          "L’abonnement a été activé.",
      );

      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’activer l’abonnement.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fermer la fenêtre"
        onClick={onClose}
        disabled={submitting}
        className="absolute inset-0 cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activate-subscription-title"
        className="relative z-10 w-full max-w-lg rounded-[24px] border border-emerald-400/15 bg-[#070b0e] p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300">
            <PlayCircle className="h-5 w-5" />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fermer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2
          id="activate-subscription-title"
          className="mt-5 text-xl font-black text-white"
        >
          Activer l’abonnement
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          L’abonnement sera activé et l’organisateur recevra
          automatiquement un e-mail de confirmation.
        </p>

        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="font-black text-white">
            {currentSubscription.organizer.businessName ||
              currentSubscription.organizer.fullName}
          </p>

          <p className="mt-1 text-sm text-violet-300">
            {currentSubscription.plan.name}
          </p>

          <p className="mt-1 text-xs text-neutral-600">
            {currentSubscription.organizer.email}
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold text-neutral-400">
              Date de début facultative
            </span>

            <input
              type="datetime-local"
              value={startsAt}
              disabled={submitting}
              onChange={(
                event,
              ) => {
                setStartsAt(
                  event.target.value,
                );

                if (error) {
                  setError("");
                }
              }}
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none transition focus:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-neutral-400">
              Date de fin facultative
            </span>

            <input
              type="datetime-local"
              value={endsAt}
              disabled={submitting}
              onChange={(
                event,
              ) => {
                setEndsAt(
                  event.target.value,
                );

                if (error) {
                  setError("");
                }
              }}
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none transition focus:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        </div>

        <p className="mt-3 text-xs leading-5 text-neutral-600">
          Si les dates ne sont pas renseignées, Tikemia utilisera la
          période déjà enregistrée ou la durée configurée dans le plan.
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-300"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 rounded-xl border border-white/[0.08] px-5 text-sm font-bold text-neutral-400 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={() => {
              void submit();
            }}
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}

            {submitting
              ? "Activation..."
              : "Confirmer l’activation"}
          </button>
        </div>
      </div>
    </div>
  );
}