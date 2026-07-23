"use client";

import {
  Crown,
  Gem,
  Layers3,
  Sparkles,
} from "lucide-react";

import SubscriptionPlanCard from "@/components/organizer/promotions/subscription-plan-card";
import type { OrganizerSubscriptionPlan } from "@/lib/organizer/promotions/get-subscription-plans";

type SubscriptionPlansGridProps = {
  plans: OrganizerSubscriptionPlan[];
  currentPlanId?: string | null;
  recommendedPlanCode?: string | null;
  popularPlanCode?: string | null;
  selectedPlanId?: string | null;
  disabled?: boolean;
  onSelectPlan?: (
    plan: OrganizerSubscriptionPlan,
  ) => void;
};

function normalizeCode(
  value: string | null | undefined,
): string {
  return value?.trim().toUpperCase() ?? "";
}

function getDefaultRecommendedPlanId(
  plans: OrganizerSubscriptionPlan[],
): string | null {
  if (plans.length === 0) {
    return null;
  }

  const publicActivePlans =
    plans.filter(
      (plan) =>
        plan.isActive &&
        plan.isPublic,
    );

  if (
    publicActivePlans.length === 0
  ) {
    return null;
  }

  const sortedPlans = [
    ...publicActivePlans,
  ].sort((first, second) => {
    if (
      second.priorityScore !==
      first.priorityScore
    ) {
      return (
        second.priorityScore -
        first.priorityScore
      );
    }

    if (
      second.maxBoostedEvents !==
      first.maxBoostedEvents
    ) {
      return (
        second.maxBoostedEvents -
        first.maxBoostedEvents
      );
    }

    return first.sortOrder -
      second.sortOrder;
  });

  return sortedPlans[0]?.id ?? null;
}

function getDefaultPopularPlanId(
  plans: OrganizerSubscriptionPlan[],
  recommendedPlanId: string | null,
): string | null {
  const candidates =
    plans.filter(
      (plan) =>
        plan.isActive &&
        plan.isPublic &&
        plan.id !==
          recommendedPlanId,
    );

  if (candidates.length === 0) {
    return null;
  }

  const sortedByPosition = [
    ...candidates,
  ].sort((first, second) => {
    if (
      first.sortOrder !==
      second.sortOrder
    ) {
      return (
        first.sortOrder -
        second.sortOrder
      );
    }

    return first.price -
      second.price;
  });

  const middleIndex =
    Math.floor(
      sortedByPosition.length / 2,
    );

  return (
    sortedByPosition[middleIndex]
      ?.id ??
    sortedByPosition[0]?.id ??
    null
  );
}

export default function SubscriptionPlansGrid({
  plans,
  currentPlanId = null,
  recommendedPlanCode = null,
  popularPlanCode = null,
  selectedPlanId = null,
  disabled = false,
  onSelectPlan,
}: SubscriptionPlansGridProps) {
  const normalizedRecommendedCode =
    normalizeCode(
      recommendedPlanCode,
    );

  const normalizedPopularCode =
    normalizeCode(
      popularPlanCode,
    );

  const recommendedPlanId =
    normalizedRecommendedCode
      ? plans.find(
          (plan) =>
            normalizeCode(
              plan.code,
            ) ===
            normalizedRecommendedCode,
        )?.id ??
        getDefaultRecommendedPlanId(
          plans,
        )
      : getDefaultRecommendedPlanId(
          plans,
        );

  const popularPlanId =
    normalizedPopularCode
      ? plans.find(
          (plan) =>
            normalizeCode(
              plan.code,
            ) ===
            normalizedPopularCode,
        )?.id ??
        getDefaultPopularPlanId(
          plans,
          recommendedPlanId,
        )
      : getDefaultPopularPlanId(
          plans,
          recommendedPlanId,
        );

  if (plans.length === 0) {
    return (
      <section
        aria-labelledby="subscription-plans-title"
        className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.28)] sm:p-6"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-orange-500/[0.04]" />

        <div className="relative flex flex-col items-center justify-center py-8 text-center sm:py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-neutral-400">
            <Layers3 className="h-6 w-6" />
          </div>

          <h2
            id="subscription-plans-title"
            className="mt-4 text-lg font-black tracking-[-0.025em] text-white"
          >
            Aucune formule disponible
          </h2>

          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500">
            Les formules de Visibilité Premium ne sont pas encore disponibles dans votre devise.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="subscription-plans-title"
      className="w-full"
    >
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-lime-400">
              <Sparkles className="h-4.5 w-4.5" />
            </div>

            <div>
              <h2
                id="subscription-plans-title"
                className="text-lg font-black tracking-[-0.025em] text-white sm:text-xl"
              >
                Choisissez votre formule
              </h2>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Sélectionnez le niveau de visibilité adapté à vos événements.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LegendBadge
            variant="recommended"
            label="Recommandée"
          />

          <LegendBadge
            variant="popular"
            label="Populaire"
          />
        </div>
      </div>

      <div
        className={`grid gap-4 ${
          plans.length === 1
            ? "grid-cols-1"
            : plans.length === 2
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1 md:grid-cols-2 2xl:grid-cols-3"
        }`}
      >
        {plans.map((plan) => {
          const isCurrentPlan =
            currentPlanId === plan.id;

          const isRecommended =
            recommendedPlanId ===
            plan.id;

          const isPopular =
            popularPlanId === plan.id &&
            !isRecommended;

          const isProcessing =
            selectedPlanId ===
            plan.id;

          return (
            <SubscriptionPlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={
                isCurrentPlan
              }
              isRecommended={
                isRecommended
              }
              isPopular={isPopular}
              isProcessing={
                isProcessing
              }
              disabled={disabled}
              onSelect={onSelectPlan}
            />
          );
        })}
      </div>
    </section>
  );
}

function LegendBadge({
  variant,
  label,
}: {
  variant:
    | "recommended"
    | "popular";
  label: string;
}) {
  const isRecommended =
    variant === "recommended";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] ${
        isRecommended
          ? "border-emerald-500/25 bg-emerald-500/10 text-lime-400"
          : "border-orange-500/25 bg-orange-500/10 text-orange-300"
      }`}
    >
      {isRecommended ? (
        <Crown className="h-3 w-3" />
      ) : (
        <Gem className="h-3 w-3" />
      )}

      {label}
    </span>
  );
}