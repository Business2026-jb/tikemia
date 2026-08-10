"use client";

import {
  LoaderCircle,
  Repeat2,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type {
  AdminSubscriptionListItem,
  GetAdminSubscriptionsResult,
} from "@/lib/admin/subscriptions/get-admin-subscriptions";

export default function ChangeSubscriptionPlanDialog({
  subscription,
  plans,
  open,
  onClose,
  onSuccess,
}: {
  subscription:
    | AdminSubscriptionListItem
    | null;
  plans:
    GetAdminSubscriptionsResult["options"]["plans"];
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
    planId,
    setPlanId,
  ] = useState("");

  const [
    resetPeriod,
    setResetPeriod,
  ] = useState(false);

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
      setPlanId("");
      setResetPeriod(false);
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

  const availablePlans =
    plans.filter(
      (plan) =>
        plan.id !==
        currentSubscription.planId,
    );

  const canSubmit =
    Boolean(planId) &&
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
          )}/change-plan`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                planId,
                resetPeriod,
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
                "Impossible de changer le plan.",
        );
      }

      onSuccess(
        payload.message ||
          "Le plan a été modifié.",
      );

      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible de changer le plan.",
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

      <div className="relative z-10 w-full max-w-lg rounded-[24px] border border-violet-400/15 bg-[#070b0e] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-400/[0.07] text-violet-300">
            <Repeat2 className="h-5 w-5" />
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
          Changer le plan
        </h2>

        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="text-xs text-neutral-500">
            Plan actuel
          </p>

          <p className="mt-1 font-black text-white">
            {
              currentSubscription
                .plan.name
            }
          </p>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Nouveau plan
          </span>

          <select
            value={
              planId
            }
            onChange={(
              event,
            ) =>
              setPlanId(
                event.target.value,
              )
            }
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none focus:border-violet-400/30"
          >
            <option value="">
              Sélectionner
            </option>

            {availablePlans.map(
              (
                plan,
              ) => (
                <option
                  key={
                    plan.id
                  }
                  value={
                    plan.id
                  }
                >
                  {plan.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <input
            type="checkbox"
            checked={
              resetPeriod
            }
            onChange={(
              event,
            ) =>
              setResetPeriod(
                event.target.checked,
              )
            }
            className="mt-1"
          />

          <span className="text-sm leading-6 text-neutral-400">
            Recommencer la période du nouveau plan à partir d’aujourd’hui.
          </span>
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
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-500 px-5 text-sm font-black text-white disabled:opacity-40"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Repeat2 className="h-4 w-4" />
            )}

            Modifier le plan
          </button>
        </div>
      </div>
    </div>
  );
}