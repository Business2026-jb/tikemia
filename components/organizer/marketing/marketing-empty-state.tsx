"use client";

import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  CircleAlert,
  FilterX,
  Megaphone,
  Plus,
  RefreshCw,
  SearchX,
  Sparkles,
} from "lucide-react";

export type MarketingEmptyStateVariant =
  | "campaigns"
  | "promo-codes"
  | "filtered"
  | "error"
  | "generic";

export type MarketingEmptyStateAction = {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
};

export type MarketingEmptyStateProps = {
  variant?: MarketingEmptyStateVariant;

  title?: string;
  description?: string;

  primaryAction?: MarketingEmptyStateAction;
  secondaryAction?: MarketingEmptyStateAction;

  className?: string;
  compact?: boolean;
};

type EmptyStatePreset = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconContainerClassName: string;
  iconClassName: string;
};

const PRESETS: Record<
  MarketingEmptyStateVariant,
  EmptyStatePreset
> = {
  campaigns: {
    eyebrow: "Campagnes marketing",
    title: "Aucune campagne pour le moment",
    description:
      "Créez votre première campagne pour générer un lien de suivi, mesurer les visites et attribuer les ventes à vos actions marketing.",
    icon: Megaphone,
    iconContainerClassName:
      "border-emerald-400/20 bg-emerald-400/[0.08]",
    iconClassName:
      "text-emerald-300",
  },

  "promo-codes": {
    eyebrow: "Codes promotionnels",
    title: "Aucun code promo disponible",
    description:
      "Créez un code promo pour proposer une réduction, contrôler ses limites d’utilisation et suivre les revenus générés.",
    icon: BadgePercent,
    iconContainerClassName:
      "border-amber-400/20 bg-amber-400/[0.08]",
    iconClassName:
      "text-amber-300",
  },

  filtered: {
    eyebrow: "Aucun résultat",
    title: "Aucun élément ne correspond aux filtres",
    description:
      "Modifiez la recherche, la période, l’événement, le canal ou le statut pour afficher davantage de résultats.",
    icon: FilterX,
    iconContainerClassName:
      "border-cyan-400/20 bg-cyan-400/[0.08]",
    iconClassName:
      "text-cyan-300",
  },

  error: {
    eyebrow: "Chargement impossible",
    title: "Une erreur est survenue",
    description:
      "Les données marketing n’ont pas pu être chargées. Vérifiez votre connexion puis relancez l’actualisation.",
    icon: CircleAlert,
    iconContainerClassName:
      "border-rose-400/20 bg-rose-400/[0.08]",
    iconClassName:
      "text-rose-300",
  },

  generic: {
    eyebrow: "Marketing",
    title: "Aucune donnée disponible",
    description:
      "Les informations apparaîtront ici dès que votre activité marketing commencera à générer des données.",
    icon: SearchX,
    iconContainerClassName:
      "border-violet-400/20 bg-violet-400/[0.08]",
    iconClassName:
      "text-violet-300",
  },
};

function joinClassNames(
  ...values: Array<
    string |
    false |
    null |
    undefined
  >
): string {
  return values
    .filter(Boolean)
    .join(" ");
}

function ActionButton({
  action,
  variant,
}: {
  action: MarketingEmptyStateAction;
  variant: "primary" | "secondary";
}) {
  const Icon =
    action.icon ??
    (
      variant === "primary"
        ? Plus
        : RefreshCw
    );

  return (
    <button
      type="button"
      onClick={
        action.onClick
      }
      disabled={
        action.disabled
      }
      className={joinClassNames(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary"
          ? "border-emerald-400/30 bg-emerald-400 text-[#03120c] hover:bg-emerald-300"
          : "border-white/[0.08] bg-white/[0.035] text-neutral-300 hover:border-white/[0.13] hover:bg-white/[0.06] hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" />

      {
        action.label
      }
    </button>
  );
}

export default function MarketingEmptyState({
  variant = "generic",
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  compact = false,
}: MarketingEmptyStateProps) {
  const preset =
    PRESETS[variant];

  const Icon =
    preset.icon;

  return (
    <section
      role={
        variant === "error"
          ? "alert"
          : "status"
      }
      aria-live={
        variant === "error"
          ? "assertive"
          : "polite"
      }
      className={joinClassNames(
        "relative w-full min-w-0 overflow-hidden rounded-2xl border border-dashed border-white/[0.09] bg-[#071014] shadow-[0_18px_55px_rgba(0,0,0,0.16)]",
        compact
          ? "px-5 py-8"
          : "px-5 py-12 sm:px-8 sm:py-16",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.06),transparent_45%)]" />

      <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
        <div
          className={joinClassNames(
            "flex items-center justify-center rounded-2xl border",
            compact
              ? "h-12 w-12"
              : "h-16 w-16",
            preset.iconContainerClassName,
          )}
        >
          <Icon
            className={joinClassNames(
              compact
                ? "h-5 w-5"
                : "h-7 w-7",
              preset.iconClassName,
            )}
          />
        </div>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />

          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
            {
              preset.eyebrow
            }
          </span>
        </div>

        <h2
          className={joinClassNames(
            "mt-4 font-black tracking-[-0.03em] text-white",
            compact
              ? "text-lg"
              : "text-xl sm:text-2xl",
          )}
        >
          {
            title ??
            preset.title
          }
        </h2>

        <p
          className={joinClassNames(
            "mt-2 max-w-lg leading-6 text-neutral-500",
            compact
              ? "text-xs"
              : "text-sm",
          )}
        >
          {
            description ??
            preset.description
          }
        </p>

        {(
          primaryAction ||
          secondaryAction
        ) && (
          <div className="mt-6 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
            {primaryAction && (
              <ActionButton
                action={
                  primaryAction
                }
                variant="primary"
              />
            )}

            {secondaryAction && (
              <ActionButton
                action={
                  secondaryAction
                }
                variant="secondary"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}