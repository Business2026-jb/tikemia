"use client";

import type {
  MarketingCampaignStatus,
  MarketingChannel,
  PromoCodeStatus,
} from "@prisma/client";
import {
  BadgePercent,
  CalendarDays,
  ChevronDown,
  Download,
  Filter,
  Megaphone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

export type MarketingToolbarPeriod =
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export type MarketingToolbarView =
  | "campaigns"
  | "promo-codes";

export type MarketingToolbarEventOption = {
  id: string;
  title: string;
};

export type MarketingToolbarCampaignOption = {
  id: string;
  name: string;
};

export type MarketingToolbarFilters = {
  search: string;
  period: MarketingToolbarPeriod;
  startsAt: string;
  endsAt: string;
  eventId: string;
  campaignId: string;
  channel: MarketingChannel | "";
  campaignStatus: MarketingCampaignStatus | "";
  promoCodeStatus: PromoCodeStatus | "";
};

export type MarketingToolbarProps = {
  filters: MarketingToolbarFilters;

  activeView?: MarketingToolbarView;

  events?: readonly MarketingToolbarEventOption[];
  campaigns?: readonly MarketingToolbarCampaignOption[];

  isRefreshing?: boolean;
  isExporting?: boolean;

  campaignCount?: number;
  promoCodeCount?: number;

  onFiltersChange:
    (
      filters: MarketingToolbarFilters,
    ) => void;

  onViewChange?:
    (
      view: MarketingToolbarView,
    ) => void;

  onCreateCampaign?:
    () => void;

  onCreatePromoCode?:
    () => void;

  onRefresh?:
    () => void;

  onExport?:
    () => void;

  className?: string;
};

type SelectOption = {
  value: string;
  label: string;
};

const PERIOD_OPTIONS: readonly SelectOption[] = [
  {
    value: "7d",
    label: "7 derniers jours",
  },
  {
    value: "30d",
    label: "30 derniers jours",
  },
  {
    value: "90d",
    label: "90 derniers jours",
  },
  {
    value: "this_month",
    label: "Ce mois",
  },
  {
    value: "last_month",
    label: "Mois précédent",
  },
  {
    value: "this_year",
    label: "Cette année",
  },
  {
    value: "custom",
    label: "Période personnalisée",
  },
];

const CHANNEL_OPTIONS: readonly SelectOption[] = [
  {
    value: "",
    label: "Tous les canaux",
  },
  {
    value: "DIRECT",
    label: "Accès direct",
  },
  {
    value: "FACEBOOK",
    label: "Facebook",
  },
  {
    value: "INSTAGRAM",
    label: "Instagram",
  },
  {
    value: "TIKTOK",
    label: "TikTok",
  },
  {
    value: "WHATSAPP",
    label: "WhatsApp",
  },
  {
    value: "EMAIL",
    label: "E-mail",
  },
  {
    value: "GOOGLE",
    label: "Google",
  },
  {
    value: "TELEGRAM",
    label: "Telegram",
  },
  {
    value: "LINKEDIN",
    label: "LinkedIn",
  },
  {
    value: "INFLUENCER",
    label: "Influenceur",
  },
  {
    value: "PARTNER",
    label: "Partenaire",
  },
  {
    value: "AFFILIATE",
    label: "Affiliation",
  },
  {
    value: "QR_CODE",
    label: "QR code",
  },
  {
    value: "OTHER",
    label: "Autre",
  },
];

const CAMPAIGN_STATUS_OPTIONS: readonly SelectOption[] = [
  {
    value: "",
    label: "Tous les statuts",
  },
  {
    value: "DRAFT",
    label: "Brouillon",
  },
  {
    value: "SCHEDULED",
    label: "Programmée",
  },
  {
    value: "ACTIVE",
    label: "Active",
  },
  {
    value: "PAUSED",
    label: "Suspendue",
  },
  {
    value: "COMPLETED",
    label: "Terminée",
  },
  {
    value: "ARCHIVED",
    label: "Archivée",
  },
];

const PROMO_STATUS_OPTIONS: readonly SelectOption[] = [
  {
    value: "",
    label: "Tous les statuts",
  },
  {
    value: "DRAFT",
    label: "Brouillon",
  },
  {
    value: "SCHEDULED",
    label: "Programmé",
  },
  {
    value: "ACTIVE",
    label: "Actif",
  },
  {
    value: "EXPIRED",
    label: "Expiré",
  },
  {
    value: "DISABLED",
    label: "Désactivé",
  },
  {
    value: "ARCHIVED",
    label: "Archivé",
  },
];

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

function createEmptyFilters(): MarketingToolbarFilters {
  return {
    search: "",
    period: "30d",
    startsAt: "",
    endsAt: "",
    eventId: "",
    campaignId: "",
    channel: "",
    campaignStatus: "",
    promoCodeStatus: "",
  };
}

function countActiveFilters(
  filters: MarketingToolbarFilters,
): number {
  let count = 0;

  if (filters.search.trim()) {
    count += 1;
  }

  if (filters.period !== "30d") {
    count += 1;
  }

  if (filters.eventId) {
    count += 1;
  }

  if (filters.campaignId) {
    count += 1;
  }

  if (filters.channel) {
    count += 1;
  }

  if (filters.campaignStatus) {
    count += 1;
  }

  if (filters.promoCodeStatus) {
    count += 1;
  }

  if (filters.startsAt) {
    count += 1;
  }

  if (filters.endsAt) {
    count += 1;
  }

  return count;
}

function ToolbarSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange:
    (
      value: string,
    ) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="min-w-0"
    >
      <span className="sr-only">
        {label}
      </span>

      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(
            event,
          ) => {
            onChange(
              event.target.value,
            );
          }}
          disabled={disabled}
          className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#0a1216] px-3 pr-9 text-sm font-semibold text-neutral-200 outline-none transition focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {options.map(
            (
              option,
            ) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {
                  option.label
                }
              </option>
            ),
          )}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
      </div>
    </label>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled = false,
  variant = "secondary",
  title,
}: {
  children:
    React.ReactNode;
  onClick?:
    () => void;
  disabled?:
    boolean;
  variant?:
    | "primary"
    | "secondary"
    | "ghost";
  title?:
    string;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      title={
        title
      }
      className={joinClassNames(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant ===
          "primary"
          ? "border-emerald-400/30 bg-emerald-400 text-[#03120c] hover:bg-emerald-300"
          : variant ===
              "ghost"
            ? "border-transparent bg-transparent text-neutral-400 hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-white"
            : "border-white/[0.08] bg-white/[0.035] text-neutral-200 hover:border-white/[0.13] hover:bg-white/[0.06]",
      )}
    >
      {children}
    </button>
  );
}

export default function MarketingToolbar({
  filters,
  activeView = "campaigns",
  events = [],
  campaigns = [],
  isRefreshing = false,
  isExporting = false,
  campaignCount = 0,
  promoCodeCount = 0,
  onFiltersChange,
  onViewChange,
  onCreateCampaign,
  onCreatePromoCode,
  onRefresh,
  onExport,
  className,
}: MarketingToolbarProps) {
  const [
    mobileFiltersOpen,
    setMobileFiltersOpen,
  ] =
    useState(false);

  const activeFilterCount =
    useMemo(
      () =>
        countActiveFilters(
          filters,
        ),
      [
        filters,
      ],
    );

  const eventOptions =
    useMemo<
      SelectOption[]
    >(
      () => [
        {
          value: "",
          label:
            "Tous les événements",
        },
        ...events.map(
          (
            event,
          ) => ({
            value:
              event.id,
            label:
              event.title,
          }),
        ),
      ],
      [
        events,
      ],
    );

  const campaignOptions =
    useMemo<
      SelectOption[]
    >(
      () => [
        {
          value: "",
          label:
            "Toutes les campagnes",
        },
        ...campaigns.map(
          (
            campaign,
          ) => ({
            value:
              campaign.id,
            label:
              campaign.name,
          }),
        ),
      ],
      [
        campaigns,
      ],
    );

  function updateFilter<
    Key extends keyof MarketingToolbarFilters,
  >(
    key: Key,
    value:
      MarketingToolbarFilters[Key],
  ) {
    onFiltersChange({
      ...filters,
      [key]:
        value,
    });
  }

  function resetFilters() {
    onFiltersChange(
      createEmptyFilters(),
    );
  }

  return (
    <section
      aria-label="Outils marketing"
      className={joinClassNames(
        "w-full min-w-0 rounded-2xl border border-white/[0.08] bg-[#071014] shadow-[0_18px_55px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      <div className="border-b border-white/[0.07] p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <SlidersHorizontal className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                  Gestion marketing
                </p>

                <h2 className="truncate text-lg font-black tracking-[-0.025em] text-white">
                  Campagnes et promotions
                </h2>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500">
              Recherchez, filtrez, exportez et créez vos actions marketing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ToolbarButton
              onClick={
                onRefresh
              }
              disabled={
                isRefreshing
              }
              title="Actualiser les données"
            >
              <RefreshCw
                className={joinClassNames(
                  "h-4 w-4",
                  isRefreshing &&
                    "animate-spin",
                )}
              />
              <span className="hidden sm:inline">
                Actualiser
              </span>
            </ToolbarButton>

            <ToolbarButton
              onClick={
                onExport
              }
              disabled={
                isExporting
              }
              title="Exporter les données"
            >
              <Download
                className={joinClassNames(
                  "h-4 w-4",
                  isExporting &&
                    "animate-pulse",
                )}
              />
              <span className="hidden sm:inline">
                Exporter
              </span>
            </ToolbarButton>

            <ToolbarButton
              onClick={
                onCreatePromoCode
              }
            >
              <BadgePercent className="h-4 w-4" />
              <span className="hidden sm:inline">
                Code promo
              </span>
            </ToolbarButton>

            <ToolbarButton
              variant="primary"
              onClick={
                onCreateCampaign
              }
            >
              <Plus className="h-4 w-4" />
              Créer une campagne
            </ToolbarButton>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex w-full rounded-xl border border-white/[0.08] bg-black/20 p-1 lg:w-auto">
              <button
                type="button"
                onClick={() => {
                  onViewChange?.(
                    "campaigns",
                  );
                }}
                className={joinClassNames(
                  "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-xs font-extrabold transition lg:flex-none",
                  activeView ===
                    "campaigns"
                    ? "bg-emerald-400 text-[#03120c] shadow-sm"
                    : "text-neutral-400 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <Megaphone className="h-4 w-4" />
                Campagnes
                <span className={joinClassNames(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  activeView ===
                    "campaigns"
                    ? "bg-black/10"
                    : "bg-white/[0.06]",
                )}>
                  {
                    campaignCount
                  }
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onViewChange?.(
                    "promo-codes",
                  );
                }}
                className={joinClassNames(
                  "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-xs font-extrabold transition lg:flex-none",
                  activeView ===
                    "promo-codes"
                    ? "bg-emerald-400 text-[#03120c] shadow-sm"
                    : "text-neutral-400 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <Tag className="h-4 w-4" />
                Codes promo
                <span className={joinClassNames(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  activeView ===
                    "promo-codes"
                    ? "bg-black/10"
                    : "bg-white/[0.06]",
                )}>
                  {
                    promoCodeCount
                  }
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileFiltersOpen(
                  (
                    current,
                  ) =>
                    !current,
                );
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 text-sm font-bold text-neutral-200 lg:hidden"
            >
              <Filter className="h-4 w-4" />
              Filtres

              {activeFilterCount >
                0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1.5 py-0.5 text-[10px] font-black text-[#03120c]">
                  {
                    activeFilterCount
                  }
                </span>
              )}
            </button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />

            <input
              type="search"
              value={
                filters.search
              }
              onChange={(
                event,
              ) => {
                updateFilter(
                  "search",
                  event.target.value,
                );
              }}
              placeholder={
                activeView ===
                "campaigns"
                  ? "Rechercher une campagne, un événement ou une source…"
                  : "Rechercher un code promo ou un événement…"
              }
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0a1216] pl-10 pr-10 text-sm font-medium text-white outline-none placeholder:text-neutral-600 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
            />

            {filters.search && (
              <button
                type="button"
                onClick={() => {
                  updateFilter(
                    "search",
                    "",
                  );
                }}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/[0.05] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div
            className={joinClassNames(
              "grid min-w-0 gap-3 lg:grid",
              mobileFiltersOpen
                ? "grid"
                : "hidden",
              "lg:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6",
            )}
          >
            <ToolbarSelect
              id="marketing-period"
              label="Période"
              value={
                filters.period
              }
              options={
                PERIOD_OPTIONS
              }
              onChange={(
                value,
              ) => {
                updateFilter(
                  "period",
                  value as MarketingToolbarPeriod,
                );
              }}
            />

            <ToolbarSelect
              id="marketing-event"
              label="Événement"
              value={
                filters.eventId
              }
              options={
                eventOptions
              }
              onChange={(
                value,
              ) => {
                onFiltersChange({
                  ...filters,
                  eventId:
                    value,
                  campaignId:
                    "",
                });
              }}
            />

            <ToolbarSelect
              id="marketing-campaign"
              label="Campagne"
              value={
                filters.campaignId
              }
              options={
                campaignOptions
              }
              onChange={(
                value,
              ) => {
                updateFilter(
                  "campaignId",
                  value,
                );
              }}
            />

            <ToolbarSelect
              id="marketing-channel"
              label="Canal"
              value={
                filters.channel
              }
              options={
                CHANNEL_OPTIONS
              }
              onChange={(
                value,
              ) => {
                updateFilter(
                  "channel",
                  value as MarketingToolbarFilters["channel"],
                );
              }}
            />

            {activeView ===
            "campaigns" ? (
              <ToolbarSelect
                id="marketing-campaign-status"
                label="Statut de campagne"
                value={
                  filters.campaignStatus
                }
                options={
                  CAMPAIGN_STATUS_OPTIONS
                }
                onChange={(
                  value,
                ) => {
                  updateFilter(
                    "campaignStatus",
                    value as MarketingToolbarFilters["campaignStatus"],
                  );
                }}
              />
            ) : (
              <ToolbarSelect
                id="marketing-promo-status"
                label="Statut du code promo"
                value={
                  filters.promoCodeStatus
                }
                options={
                  PROMO_STATUS_OPTIONS
                }
                onChange={(
                  value,
                ) => {
                  updateFilter(
                    "promoCodeStatus",
                    value as MarketingToolbarFilters["promoCodeStatus"],
                  );
                }}
              />
            )}

            <div className="flex items-center">
              <ToolbarButton
                variant="ghost"
                onClick={
                  resetFilters
                }
                disabled={
                  activeFilterCount ===
                  0
                }
              >
                <RotateCcw className="h-4 w-4" />
                Réinitialiser
              </ToolbarButton>
            </div>
          </div>

          {filters.period ===
            "custom" && (
            <div className="grid gap-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.025] p-3 sm:grid-cols-2 lg:max-w-2xl">
              <label className="min-w-0">
                <span className="mb-1.5 flex items-center gap-2 text-[11px] font-bold text-neutral-400">
                  <CalendarDays className="h-3.5 w-3.5 text-emerald-400" />
                  Date de début
                </span>

                <input
                  type="date"
                  value={
                    filters.startsAt
                  }
                  onChange={(
                    event,
                  ) => {
                    updateFilter(
                      "startsAt",
                      event.target.value,
                    );
                  }}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0a1216] px-3 text-sm font-semibold text-neutral-200 outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
                />
              </label>

              <label className="min-w-0">
                <span className="mb-1.5 flex items-center gap-2 text-[11px] font-bold text-neutral-400">
                  <CalendarDays className="h-3.5 w-3.5 text-emerald-400" />
                  Date de fin
                </span>

                <input
                  type="date"
                  value={
                    filters.endsAt
                  }
                  min={
                    filters.startsAt ||
                    undefined
                  }
                  onChange={(
                    event,
                  ) => {
                    updateFilter(
                      "endsAt",
                      event.target.value,
                    );
                  }}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0a1216] px-3 text-sm font-semibold text-neutral-200 outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
                />
              </label>
            </div>
          )}

          {activeFilterCount >
            0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
              <span className="inline-flex items-center gap-2 text-[11px] font-bold text-neutral-500">
                <Filter className="h-3.5 w-3.5" />
                {
                  activeFilterCount
                } filtre
                {activeFilterCount >
                1
                  ? "s"
                  : ""}{" "}
                actif
                {activeFilterCount >
                1
                  ? "s"
                  : ""}
              </span>

              <button
                type="button"
                onClick={
                  resetFilters
                }
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-emerald-400 hover:bg-emerald-400/[0.06]"
              >
                Tout effacer
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}