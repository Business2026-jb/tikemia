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
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  MoreHorizontal,
  MousePointerClick,
  Pause,
  Pencil,
  Play,
  SearchX,
  TicketCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import type {
  OrganizerMarketingCampaignItem,
} from "@/lib/organizer/get-organizer-marketing";

export type CampaignsListClientProps = {
  campaigns:
    readonly OrganizerMarketingCampaignItem[];

  currency?: string;
  locale?: string;

  isLoading?: boolean;
  className?: string;

  onViewCampaign?:
    (
      campaign:
        OrganizerMarketingCampaignItem,
    ) => void;

  onEditCampaign?:
    (
      campaign:
        OrganizerMarketingCampaignItem,
    ) => void;

  onDuplicateCampaign?:
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

  onDeleteCampaign?:
    (
      campaign:
        OrganizerMarketingCampaignItem,
    ) => void;
};

type CampaignStatusPresentation = {
  label: string;
  className: string;
  icon:
    typeof Clock3;
};

type CampaignChannelPresentation = {
  label: string;
  shortLabel: string;
};

const STATUS_PRESENTATIONS:
  Record<
    MarketingCampaignStatus,
    CampaignStatusPresentation
  > = {
    DRAFT: {
      label:
        "Brouillon",

      className:
        "border-neutral-400/20 bg-neutral-400/10 text-neutral-300",

      icon:
        Pencil,
    },

    SCHEDULED: {
      label:
        "Programmée",

      className:
        "border-blue-400/20 bg-blue-400/10 text-blue-300",

      icon:
        CalendarClock,
    },

    ACTIVE: {
      label:
        "Active",

      className:
        "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",

      icon:
        BadgeCheck,
    },

    PAUSED: {
      label:
        "Suspendue",

      className:
        "border-amber-400/20 bg-amber-400/10 text-amber-300",

      icon:
        Pause,
    },

    COMPLETED: {
      label:
        "Terminée",

      className:
        "border-violet-400/20 bg-violet-400/10 text-violet-300",

      icon:
        Check,
    },

    ARCHIVED: {
      label:
        "Archivée",

      className:
        "border-rose-400/20 bg-rose-400/10 text-rose-300",

      icon:
        Archive,
    },
  };

const CHANNEL_PRESENTATIONS:
  Record<
    MarketingChannel,
    CampaignChannelPresentation
  > = {
    DIRECT: {
      label:
        "Accès direct",

      shortLabel:
        "Direct",
    },

    FACEBOOK: {
      label:
        "Facebook",

      shortLabel:
        "Facebook",
    },

    INSTAGRAM: {
      label:
        "Instagram",

      shortLabel:
        "Instagram",
    },

    TIKTOK: {
      label:
        "TikTok",

      shortLabel:
        "TikTok",
    },

    WHATSAPP: {
      label:
        "WhatsApp",

      shortLabel:
        "WhatsApp",
    },

    EMAIL: {
      label:
        "E-mail",

      shortLabel:
        "E-mail",
    },

    GOOGLE: {
      label:
        "Google",

      shortLabel:
        "Google",
    },

    TELEGRAM: {
      label:
        "Telegram",

      shortLabel:
        "Telegram",
    },

    LINKEDIN: {
      label:
        "LinkedIn",

      shortLabel:
        "LinkedIn",
    },

    INFLUENCER: {
      label:
        "Influenceur",

      shortLabel:
        "Influenceur",
    },

    PARTNER: {
      label:
        "Partenaire",

      shortLabel:
        "Partenaire",
    },

    AFFILIATE: {
      label:
        "Affiliation",

      shortLabel:
        "Affiliation",
    },

    QR_CODE: {
      label:
        "QR code",

      shortLabel:
        "QR code",
    },

    OTHER: {
      label:
        "Autre",

      shortLabel:
        "Autre",
    },
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

function formatPercentage(
  value: number,
  locale: string,
): string {
  return `${formatNumber(
    value,
    locale,
    2,
  )} %`;
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

function getStatusPresentation(
  status:
    MarketingCampaignStatus,
): CampaignStatusPresentation {
  return STATUS_PRESENTATIONS[
    status
  ];
}

function getChannelPresentation(
  channel:
    MarketingChannel,
): CampaignChannelPresentation {
  return CHANNEL_PRESENTATIONS[
    channel
  ];
}

function StatusBadge({
  status,
}: {
  status:
    MarketingCampaignStatus;
}) {
  const presentation =
    getStatusPresentation(
      status,
    );

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

function LoadingState() {
  return (
    <div className="space-y-3">
      {Array.from(
        {
          length:
            5,
        },
        (
          _,
          index,
        ) => (
          <div
            key={
              index
            }
            className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-white/[0.06]" />

              <div className="min-w-0 flex-1">
                <div className="h-4 w-48 rounded bg-white/[0.06]" />

                <div className="mt-2 h-3 w-64 rounded bg-white/[0.04]" />

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from(
                    {
                      length:
                        4,
                    },
                    (
                      __,
                      itemIndex,
                    ) => (
                      <div
                        key={
                          itemIndex
                        }
                        className="h-12 rounded-xl bg-white/[0.04]"
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.018] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
        <SearchX className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-base font-black text-white">
        Aucune campagne trouvée
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
        Créez une campagne marketing ou modifiez les filtres pour afficher vos campagnes existantes.
      </p>
    </div>
  );
}

function CampaignActions({
  campaign,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onViewCampaign,
  onEditCampaign,
  onDuplicateCampaign,
  onStatusChange,
  onDeleteCampaign,
}: {
  campaign:
    OrganizerMarketingCampaignItem;

  menuOpen:
    boolean;

  onToggleMenu:
    () => void;

  onCloseMenu:
    () => void;

  onViewCampaign?:
    CampaignsListClientProps["onViewCampaign"];

  onEditCampaign?:
    CampaignsListClientProps["onEditCampaign"];

  onDuplicateCampaign?:
    CampaignsListClientProps["onDuplicateCampaign"];

  onStatusChange?:
    CampaignsListClientProps["onStatusChange"];

  onDeleteCampaign?:
    CampaignsListClientProps["onDeleteCampaign"];
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={
          onToggleMenu
        }
        aria-haspopup="menu"
        aria-expanded={
          menuOpen
        }
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:border-white/[0.13] hover:bg-white/[0.06] hover:text-white"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={
              onCloseMenu
            }
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
                onCloseMenu();
                onViewCampaign?.(
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
                onCloseMenu();
                onEditCampaign?.(
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
                onCloseMenu();
                onDuplicateCampaign?.(
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
                  onCloseMenu();
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
                  onCloseMenu();
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
                  onCloseMenu();
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
                onCloseMenu();
                onDeleteCampaign?.(
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
  );
}

function CampaignMobileCard({
  campaign,
  locale,
  currency,
  copiedCampaignId,
  onCopyLink,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onViewCampaign,
  onEditCampaign,
  onDuplicateCampaign,
  onStatusChange,
  onDeleteCampaign,
}: {
  campaign:
    OrganizerMarketingCampaignItem;

  locale:
    string;

  currency:
    string;

  copiedCampaignId:
    string | null;

  onCopyLink:
    (
      campaign:
        OrganizerMarketingCampaignItem,
    ) => void;

  menuOpen:
    boolean;

  onToggleMenu:
    () => void;

  onCloseMenu:
    () => void;

  onViewCampaign?:
    CampaignsListClientProps["onViewCampaign"];

  onEditCampaign?:
    CampaignsListClientProps["onEditCampaign"];

  onDuplicateCampaign?:
    CampaignsListClientProps["onDuplicateCampaign"];

  onStatusChange?:
    CampaignsListClientProps["onStatusChange"];

  onDeleteCampaign?:
    CampaignsListClientProps["onDeleteCampaign"];
}) {
  const channel =
    getChannelPresentation(
      campaign.channel,
    );

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.022] p-4 shadow-[0_15px_45px_rgba(0,0,0,0.16)] lg:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={
                campaign.status
              }
            />

            <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold text-neutral-400">
              {
                channel.shortLabel
              }
            </span>
          </div>

          <h3 className="mt-3 truncate text-base font-black text-white">
            {
              campaign.name
            }
          </h3>

          <p className="mt-1 truncate text-xs font-medium text-neutral-500">
            {
              campaign.eventTitle
            }
          </p>
        </div>

        <CampaignActions
          campaign={
            campaign
          }
          menuOpen={
            menuOpen
          }
          onToggleMenu={
            onToggleMenu
          }
          onCloseMenu={
            onCloseMenu
          }
          onViewCampaign={
            onViewCampaign
          }
          onEditCampaign={
            onEditCampaign
          }
          onDuplicateCampaign={
            onDuplicateCampaign
          }
          onStatusChange={
            onStatusChange
          }
          onDeleteCampaign={
            onDeleteCampaign
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Visites
          </p>

          <p className="mt-1 text-sm font-black text-white">
            {formatNumber(
              campaign.visits,
              locale,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Commandes
          </p>

          <p className="mt-1 text-sm font-black text-white">
            {formatNumber(
              campaign.orders,
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
              campaign.currency ||
                currency,
              locale,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Conversion
          </p>

          <p className="mt-1 text-sm font-black text-white">
            {formatPercentage(
              campaign.conversionRate,
              locale,
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
        <div className="min-w-0 text-[11px] text-neutral-500">
          <p>
            Début :{" "}
            <span className="font-semibold text-neutral-400">
              {formatDate(
                campaign.startsAt,
                locale,
              )}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onCopyLink(
              campaign,
            );
          }}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-xs font-bold text-neutral-300 hover:border-emerald-400/25 hover:bg-emerald-400/[0.07] hover:text-emerald-300"
        >
          {copiedCampaignId ===
          campaign.id ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copié
            </>
          ) : (
            <>
              <Link2 className="h-3.5 w-3.5" />
              Copier le lien
            </>
          )}
        </button>
      </div>
    </article>
  );
}

export default function CampaignsListClient({
  campaigns,
  currency = "XOF",
  locale = "fr-FR",
  isLoading = false,
  className,
  onViewCampaign,
  onEditCampaign,
  onDuplicateCampaign,
  onStatusChange,
  onDeleteCampaign,
}: CampaignsListClientProps) {
  const [
    openMenuId,
    setOpenMenuId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    copiedCampaignId,
    setCopiedCampaignId,
  ] =
    useState<string | null>(
      null,
    );

  const normalizedCurrency =
    currency
      .trim()
      .toUpperCase() ||
    "XOF";

  const sortedCampaigns =
    useMemo(
      () =>
        [...campaigns].sort(
          (
            left,
            right,
          ) =>
            new Date(
              right.createdAt,
            ).getTime() -
            new Date(
              left.createdAt,
            ).getTime(),
        ),
      [
        campaigns,
      ],
    );

  async function copyTrackingLink(
    campaign:
      OrganizerMarketingCampaignItem,
  ) {
    try {
      await navigator.clipboard.writeText(
        campaign.trackingUrl,
      );

      setCopiedCampaignId(
        campaign.id,
      );

      window.setTimeout(
        () => {
          setCopiedCampaignId(
            (
              current,
            ) =>
              current ===
              campaign.id
                ? null
                : current,
          );
        },
        2_000,
      );
    } catch {
      setCopiedCampaignId(
        null,
      );
    }
  }

  return (
    <section
      aria-labelledby="campaigns-list-title"
      className={joinClassNames(
        "w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071014] shadow-[0_20px_65px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-white/[0.07] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
            Campagnes
          </p>

          <h2
            id="campaigns-list-title"
            className="mt-1 text-lg font-black tracking-[-0.025em] text-white sm:text-xl"
          >
            Liste des campagnes marketing
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500 sm:text-sm">
            Consultez les performances, liens de suivi et statuts de vos campagnes.
          </p>
        </div>

        <span className="inline-flex w-fit items-center rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[11px] font-bold text-neutral-400">
          {formatNumber(
            sortedCampaigns.length,
            locale,
          )}{" "}
          campagne
          {sortedCampaigns.length >
          1
            ? "s"
            : ""}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <LoadingState />
        ) : sortedCampaigns.length ===
          0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="space-y-3 lg:hidden">
              {sortedCampaigns.map(
                (
                  campaign,
                ) => (
                  <CampaignMobileCard
                    key={
                      campaign.id
                    }
                    campaign={
                      campaign
                    }
                    locale={
                      locale
                    }
                    currency={
                      normalizedCurrency
                    }
                    copiedCampaignId={
                      copiedCampaignId
                    }
                    onCopyLink={
                      copyTrackingLink
                    }
                    menuOpen={
                      openMenuId ===
                      campaign.id
                    }
                    onToggleMenu={() => {
                      setOpenMenuId(
                        (
                          current,
                        ) =>
                          current ===
                          campaign.id
                            ? null
                            : campaign.id,
                      );
                    }}
                    onCloseMenu={() => {
                      setOpenMenuId(
                        null,
                      );
                    }}
                    onViewCampaign={
                      onViewCampaign
                    }
                    onEditCampaign={
                      onEditCampaign
                    }
                    onDuplicateCampaign={
                      onDuplicateCampaign
                    }
                    onStatusChange={
                      onStatusChange
                    }
                    onDeleteCampaign={
                      onDeleteCampaign
                    }
                  />
                ),
              )}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1120px] border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    {[
                      "Campagne",
                      "Canal",
                      "Statut",
                      "Visites",
                      "Commandes",
                      "Billets",
                      "Revenus",
                      "Conversion",
                      "Période",
                      "",
                    ].map(
                      (
                        label,
                      ) => (
                        <th
                          key={
                            label ||
                            "actions"
                          }
                          className="border-b border-white/[0.07] px-3 pb-3 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600"
                        >
                          {
                            label
                          }
                        </th>
                      ),
                    )}
                  </tr>
                </thead>

                <tbody>
                  {sortedCampaigns.map(
                    (
                      campaign,
                    ) => {
                      const channel =
                        getChannelPresentation(
                          campaign.channel,
                        );

                      return (
                        <tr
                          key={
                            campaign.id
                          }
                          className="group"
                        >
                          <td className="border-b border-white/[0.055] px-3 py-4">
                            <div className="min-w-[220px] max-w-[300px]">
                              <button
                                type="button"
                                onClick={() => {
                                  onViewCampaign?.(
                                    campaign,
                                  );
                                }}
                                className="block max-w-full truncate text-left text-sm font-black text-white hover:text-emerald-300"
                              >
                                {
                                  campaign.name
                                }
                              </button>

                              <p className="mt-1 truncate text-[11px] font-medium text-neutral-500">
                                {
                                  campaign.eventTitle
                                }
                              </p>

                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void copyTrackingLink(
                                      campaign,
                                    );
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[10px] font-bold text-neutral-500 hover:border-emerald-400/20 hover:bg-emerald-400/[0.06] hover:text-emerald-300"
                                >
                                  {copiedCampaignId ===
                                  campaign.id ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}

                                  {copiedCampaignId ===
                                  campaign.id
                                    ? "Copié"
                                    : "Copier le lien"}
                                </button>

                                <a
                                  href={
                                    campaign.trackingUrl
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-600 hover:text-emerald-300"
                                >
                                  Ouvrir
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          </td>

                          <td className="border-b border-white/[0.055] px-3 py-4">
                            <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold text-neutral-400">
                              {
                                channel.label
                              }
                            </span>
                          </td>

                          <td className="border-b border-white/[0.055] px-3 py-4">
                            <StatusBadge
                              status={
                                campaign.status
                              }
                            />
                          </td>

                          <td className="border-b border-white/[0.055] px-3 py-4 text-sm font-black text-white">
                            <span className="inline-flex items-center gap-1.5">
                              <MousePointerClick className="h-3.5 w-3.5 text-cyan-400" />

                              {formatNumber(
                                campaign.visits,
                                locale,
                              )}
                            </span>
                          </td>

                          <td className="border-b border-white/[0.055] px-3 py-4 text-sm font-black text-white">
                            {formatNumber(
                              campaign.orders,
                              locale,
                            )}
                          </td>

                          <td className="border-b border-white/[0.055] px-3 py-4 text-sm font-black text-white">
                            <span className="inline-flex items-center gap-1.5">
                              <TicketCheck className="h-3.5 w-3.5 text-emerald-400" />

                              {formatNumber(
                                campaign.tickets,
                                locale,
                              )}
                            </span>
                          </td>

                          <td className="border-b border-white/[0.055] px-3 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm font-black text-white">
                              <CircleDollarSign className="h-3.5 w-3.5 text-amber-400" />

                              {formatMoney(
                                campaign.revenue,
                                campaign.currency ||
                                  normalizedCurrency,
                                locale,
                              )}
                            </span>
                          </td>

                          <td className="border-b border-white/[0.055] px-3 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm font-black text-white">
                              <TrendingUp className="h-3.5 w-3.5 text-violet-400" />

                              {formatPercentage(
                                campaign.conversionRate,
                                locale,
                              )}
                            </span>
                          </td>

                          <td className="border-b border-white/[0.055] px-3 py-4">
                            <div className="min-w-[120px] text-[11px] leading-5 text-neutral-500">
                              <p>
                                Début :{" "}
                                <span className="font-semibold text-neutral-400">
                                  {formatDate(
                                    campaign.startsAt,
                                    locale,
                                  )}
                                </span>
                              </p>

                              <p>
                                Fin :{" "}
                                <span className="font-semibold text-neutral-400">
                                  {formatDate(
                                    campaign.endsAt,
                                    locale,
                                  )}
                                </span>
                              </p>
                            </div>
                          </td>

                          <td className="border-b border-white/[0.055] px-3 py-4 text-right">
                            <CampaignActions
                              campaign={
                                campaign
                              }
                              menuOpen={
                                openMenuId ===
                                campaign.id
                              }
                              onToggleMenu={() => {
                                setOpenMenuId(
                                  (
                                    current,
                                  ) =>
                                    current ===
                                    campaign.id
                                      ? null
                                      : campaign.id,
                                );
                              }}
                              onCloseMenu={() => {
                                setOpenMenuId(
                                  null,
                                );
                              }}
                              onViewCampaign={
                                onViewCampaign
                              }
                              onEditCampaign={
                                onEditCampaign
                              }
                              onDuplicateCampaign={
                                onDuplicateCampaign
                              }
                              onStatusChange={
                                onStatusChange
                              }
                              onDeleteCampaign={
                                onDeleteCampaign
                              }
                            />
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}