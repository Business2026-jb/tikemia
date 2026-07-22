"use client";

import type {
  MarketingCampaignStatus,
  MarketingChannel,
} from "@prisma/client";
import {
  Archive,
  BadgeCheck,
  CalendarClock,
  Check,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  MoreHorizontal,
  MousePointerClick,
  Pause,
  Pencil,
  Play,
  TicketCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  useState,
} from "react";

import type {
  OrganizerMarketingCampaignItem,
} from "@/lib/organizer/get-organizer-marketing";

export type CampaignCardProps = {
  campaign:
    OrganizerMarketingCampaignItem;

  currency?: string;
  locale?: string;

  className?: string;

  onView?:
    (
      campaign:
        OrganizerMarketingCampaignItem,
    ) => void;

  onEdit?:
    (
      campaign:
        OrganizerMarketingCampaignItem,
    ) => void;

  onDuplicate?:
    (
      campaign:
        OrganizerMarketingCampaignItem,
    ) => void;

  onStatusChange?:
    (
      campaign:
        OrganizerMarketingCampaignItem,
      status:
        MarketingCampaignStatus,
    ) => void;

  onDelete?:
    (
      campaign:
        OrganizerMarketingCampaignItem,
    ) => void;
};

type StatusPresentation = {
  label: string;
  icon:
    typeof BadgeCheck;
  className: string;
};

const STATUS_PRESENTATIONS:
  Record<
    MarketingCampaignStatus,
    StatusPresentation
  > = {
    DRAFT: {
      label:
        "Brouillon",
      icon:
        Pencil,
      className:
        "border-neutral-400/20 bg-neutral-400/10 text-neutral-300",
    },
    SCHEDULED: {
      label:
        "Programmée",
      icon:
        CalendarClock,
      className:
        "border-blue-400/20 bg-blue-400/10 text-blue-300",
    },
    ACTIVE: {
      label:
        "Active",
      icon:
        BadgeCheck,
      className:
        "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    },
    PAUSED: {
      label:
        "Suspendue",
      icon:
        Pause,
      className:
        "border-amber-400/20 bg-amber-400/10 text-amber-300",
    },
    COMPLETED: {
      label:
        "Terminée",
      icon:
        Check,
      className:
        "border-violet-400/20 bg-violet-400/10 text-violet-300",
    },
    ARCHIVED: {
      label:
        "Archivée",
      icon:
        Archive,
      className:
        "border-rose-400/20 bg-rose-400/10 text-rose-300",
    },
  };

const CHANNEL_LABELS:
  Record<
    MarketingChannel,
    string
  > = {
    DIRECT:
      "Accès direct",
    FACEBOOK:
      "Facebook",
    INSTAGRAM:
      "Instagram",
    TIKTOK:
      "TikTok",
    WHATSAPP:
      "WhatsApp",
    EMAIL:
      "E-mail",
    GOOGLE:
      "Google",
    TELEGRAM:
      "Telegram",
    LINKEDIN:
      "LinkedIn",
    INFLUENCER:
      "Influenceur",
    PARTNER:
      "Partenaire",
    AFFILIATE:
      "Affiliation",
    QR_CODE:
      "QR code",
    OTHER:
      "Autre",
  };

function joinClassNames(
  ...values:
    Array<
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

function toSafeNumber(
  value: number,
): number {
  return Number.isFinite(
    value,
  )
    ? Math.max(
        value,
        0,
      )
    : 0;
}

function formatNumber(
  value: number,
  locale: string,
  maximumFractionDigits =
    0,
): string {
  return new Intl.NumberFormat(
    locale,
    {
      maximumFractionDigits,
    },
  ).format(
    toSafeNumber(
      value,
    ),
  );
}

function formatMoney(
  value: number,
  currency: string,
  locale: string,
): string {
  const amount =
    toSafeNumber(
      value,
    );

  try {
    return new Intl.NumberFormat(
      locale,
      {
        style:
          "currency",
        currency,
        minimumFractionDigits:
          currency ===
            "XOF" ||
          currency ===
            "XAF"
            ? 0
            : 2,
        maximumFractionDigits:
          currency ===
            "XOF" ||
          currency ===
            "XAF"
            ? 0
            : 2,
      },
    ).format(
      amount,
    );
  } catch {
    return `${formatNumber(
      amount,
      locale,
    )} ${currency}`;
  }
}

function formatDate(
  value:
    | string
    | null,
  locale: string,
): string {
  if (!value) {
    return "Non définie";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      day:
        "2-digit",
      month:
        "short",
      year:
        "numeric",
    },
  ).format(
    date,
  );
}

function StatusBadge({
  status,
}: {
  status:
    MarketingCampaignStatus;
}) {
  const presentation =
    STATUS_PRESENTATIONS[
      status
    ];

  const Icon =
    presentation.icon;

  return (
    <span
      className={joinClassNames(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]",
        presentation.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {
        presentation.label
      }
    </span>
  );
}

export default function CampaignCard({
  campaign,
  currency = "XOF",
  locale = "fr-FR",
  className,
  onView,
  onEdit,
  onDuplicate,
  onStatusChange,
  onDelete,
}: CampaignCardProps) {
  const [
    menuOpen,
    setMenuOpen,
  ] =
    useState(false);

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  const normalizedCurrency =
    (
      campaign.currency ||
      currency
    )
      .trim()
      .toUpperCase() ||
    "XOF";

  async function copyTrackingLink() {
    try {
      await navigator.clipboard.writeText(
        campaign.trackingUrl,
      );

      setCopied(
        true,
      );

      window.setTimeout(
        () => {
          setCopied(
            false,
          );
        },
        2_000,
      );
    } catch {
      setCopied(
        false,
      );
    }
  }

  return (
    <article
      className={joinClassNames(
        "relative overflow-visible rounded-2xl border border-white/[0.08] bg-[#081014] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-white/[0.13] sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={
                campaign.status
              }
            />

            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold text-neutral-400">
              <Link2 className="h-3 w-3" />
              {
                CHANNEL_LABELS[
                  campaign.channel
                ]
              }
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              onView?.(
                campaign,
              );
            }}
            className="mt-3 block max-w-full truncate text-left text-base font-black text-white transition hover:text-emerald-300"
          >
            {
              campaign.name
            }
          </button>

          <p className="mt-1 truncate text-xs font-medium text-neutral-500">
            {
              campaign.eventTitle
            }
          </p>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={
              menuOpen
            }
            aria-label={`Actions pour ${campaign.name}`}
            onClick={() => {
              setMenuOpen(
                (
                  current,
                ) =>
                  !current,
              );
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:border-white/[0.13] hover:bg-white/[0.06] hover:text-white"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => {
                  setMenuOpen(
                    false,
                  );
                }}
                className="fixed inset-0 z-20 cursor-default"
              />

              <div
                role="menu"
                className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0b1519] p-1.5 shadow-2xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(
                      false,
                    );
                    onView?.(
                      campaign,
                    );
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-neutral-300 hover:bg-white/[0.05] hover:text-white"
                >
                  <Eye className="h-4 w-4" />
                  Voir les détails
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(
                      false,
                    );
                    onEdit?.(
                      campaign,
                    );
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-neutral-300 hover:bg-white/[0.05] hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                  Modifier
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(
                      false,
                    );
                    onDuplicate?.(
                      campaign,
                    );
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-neutral-300 hover:bg-white/[0.05] hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                  Dupliquer
                </button>

                <div className="my-1 h-px bg-white/[0.07]" />

                {campaign.status ===
                "ACTIVE" ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(
                        false,
                      );
                      onStatusChange?.(
                        campaign,
                        "PAUSED",
                      );
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-amber-300 hover:bg-amber-400/[0.08]"
                  >
                    <Pause className="h-4 w-4" />
                    Suspendre
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(
                        false,
                      );
                      onStatusChange?.(
                        campaign,
                        "ACTIVE",
                      );
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-emerald-300 hover:bg-emerald-400/[0.08]"
                  >
                    <Play className="h-4 w-4" />
                    Activer
                  </button>
                )}

                {campaign.status !==
                  "ARCHIVED" && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(
                        false,
                      );
                      onStatusChange?.(
                        campaign,
                        "ARCHIVED",
                      );
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-neutral-300 hover:bg-white/[0.05] hover:text-white"
                  >
                    <Archive className="h-4 w-4" />
                    Archiver
                  </button>
                )}

                <div className="my-1 h-px bg-white/[0.07]" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(
                      false,
                    );
                    onDelete?.(
                      campaign,
                    );
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-300 hover:bg-rose-400/[0.08]"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Visites
          </p>

          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-black text-white">
            <MousePointerClick className="h-3.5 w-3.5 text-cyan-400" />
            {formatNumber(
              campaign.visits,
              locale,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Billets
          </p>

          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-black text-white">
            <TicketCheck className="h-3.5 w-3.5 text-emerald-400" />
            {formatNumber(
              campaign.tickets,
              locale,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Revenus
          </p>

          <p className="mt-1 truncate text-sm font-black text-white">
            {formatMoney(
              campaign.revenue,
              normalizedCurrency,
              locale,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Conversion
          </p>

          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-black text-white">
            <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
            {formatNumber(
              campaign.conversionRate,
              locale,
              2,
            )}{" "}
            %
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Période
          </p>

          <p className="mt-1 text-xs font-semibold leading-5 text-neutral-400">
            {formatDate(
              campaign.startsAt,
              locale,
            )}{" "}
            →{" "}
            {formatDate(
              campaign.endsAt,
              locale,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Budget
          </p>

          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-black text-neutral-300">
            <CircleDollarSign className="h-3.5 w-3.5 text-amber-400" />

            {campaign.budget ===
            null
              ? "Non défini"
              : formatMoney(
                  campaign.budget,
                  normalizedCurrency,
                  locale,
                )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            void copyTrackingLink();
          }}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-xs font-bold text-neutral-300 transition hover:border-emerald-400/25 hover:bg-emerald-400/[0.07] hover:text-emerald-300"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Lien copié
            </>
          ) : (
            <>
              <Link2 className="h-3.5 w-3.5" />
              Copier le lien
            </>
          )}
        </button>

        <a
          href={
            campaign.trackingUrl
          }
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-xs font-bold text-neutral-300 transition hover:border-white/[0.13] hover:bg-white/[0.06] hover:text-white"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ouvrir le lien
        </a>
      </div>
    </article>
  );
}