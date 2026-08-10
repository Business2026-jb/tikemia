"use client";

import {
  CalendarPlus,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type {
  AdminSubscriptionListItem,
} from "@/lib/admin/subscriptions/get-admin-subscriptions";

type ExtendSubscriptionDialogProps = {
  subscription: AdminSubscriptionListItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

type ExtendSubscriptionApiResponse = {
  success?: boolean;
  message?: string;
  error?:
    | {
        message?: string;
      }
    | string;
};

export default function ExtendSubscriptionDialog({
  subscription,
  open,
  onClose,
  onSuccess,
}: ExtendSubscriptionDialogProps) {
  const [additionalDays, setAdditionalDays] =
    useState("30");

  const [reactivateIfExpired, setReactivateIfExpired] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!open) {
      setAdditionalDays("30");
      setReactivateIfExpired(true);
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

  const days =
    Number(
      additionalDays,
    );

  const canSubmit =
    Number.isInteger(
      days,
    ) &&
    days >= 1 &&
    days <= 3650 &&
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
          )}/extend`,
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
                additionalDays:
                  days,

                reactivateIfExpired,
              }),
          },
        );

      let payload:
        ExtendSubscriptionApiResponse;

      try {
        payload =
          (await response.json()) as ExtendSubscriptionApiResponse;
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
              "Impossible de prolonger l’abonnement.";

        throw new Error(
          message,
        );
      }

      onSuccess(
        payload.message ||
          "L’abonnement a été prolongé.",
      );

      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible de prolonger l’abonnement.",
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
        aria-labelledby="extend-subscription-title"
        className="relative z-10 w-full max-w-lg rounded-[24px] border border-amber-400/15 bg-[#070b0e] p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-400/[0.07] text-amber-300">
            <CalendarPlus className="h-5 w-5" />
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
          id="extend-subscription-title"
          className="mt-5 text-xl font-black text-white"
        >
          Prolonger l’abonnement
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Ajoutez une durée supplémentaire au plan actuel.
          L’organisateur recevra automatiquement un e-mail de confirmation.
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

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Nombre de jours supplémentaires
          </span>

          <input
            type="number"
            min={1}
            max={3650}
            step={1}
            value={additionalDays}
            disabled={submitting}
            onChange={(
              event,
            ) => {
              setAdditionalDays(
                event.target.value,
              );

              if (error) {
                setError("");
              }
            }}
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none transition focus:border-amber-400/30 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <p className="mt-2 text-xs text-neutral-600">
            La durée doit être comprise entre 1 et 3650 jours.
          </p>
        </label>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <input
            type="checkbox"
            checked={reactivateIfExpired}
            disabled={submitting}
            onChange={(
              event,
            ) => {
              setReactivateIfExpired(
                event.target.checked,
              );

              if (error) {
                setError("");
              }
            }}
            className="mt-1"
          />

          <span>
            <span className="block text-sm font-bold text-neutral-300">
              Réactiver si l’abonnement est expiré
            </span>

            <span className="mt-1 block text-xs leading-5 text-neutral-600">
              Tikemia remettra automatiquement le statut sur actif lors de
              la prolongation.
            </span>
          </span>
        </label>

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
            disabled={!canSubmit}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-black text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="h-4 w-4" />
            )}

            {submitting
              ? "Prolongation..."
              : `Prolonger de ${Number.isInteger(days) ? days : 0} jour${
                  days > 1 ? "s" : ""
                }`}
          </button>
        </div>
      </div>
    </div>
  );
}