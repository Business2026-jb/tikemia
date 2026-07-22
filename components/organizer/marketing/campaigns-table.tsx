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

export type CampaignsTableProps = {
  campaigns:
    readonly OrganizerMarketingCampaignItem[];

  currency?: string;
  locale?: string;

  isLoading?: boolean;
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

type ChannelPresentation = {
  label: string;
  shortLabel: string;
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

const CHANNEL_PRESENTATIONS:
  Record<
    MarketingChannel,
    ChannelPresentation
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

function TableLoadingState() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] border-separate border-spacing-0">
        <thead>
          <tr>
            {Array.from(
              {
                length:
                  10,
              },
              (
                _,
                index,
              ) => (
                <th
                  key={
                    index
                  }
                  className="border-b border-white/[0.07] px-3 pb-3"
                >
                  <div className="h-3 w-20 animate-pulse rounded bg-white/[0.06]" />
                </th>
              ),
            )}
          </tr>
        </thead>

        <tbody>
          {Array.from(
            {
              length:
                5,
            },
            (
              _,
              rowIndex,
            ) => (
              <tr
                key={
                  rowIndex
                }
              >
                {Array.from(
                  {
                    length:
                      10,
                  },
                  (
                    __,
                    cellIndex,
                  ) => (
                    <td
                      key={
                        cellIndex
                      }
                      className="border-b border-white/[0.055] px-3 py-4"
                    >
                      <div className="h-4 animate-pulse rounded bg-white/[0.05]" />
                    </td>
                  ),
                )}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.018] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
        <SearchX className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-base font-black text-white">
        Aucune campagne disponible
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
        Créez une campagne marketing ou modifiez vos filtres pour afficher des résultats.
      </p>
    </div>
  );
}

function ActionsMenu({
  campaign,
  isOpen,
  onToggle,
  onClose,
  onView,
  onEdit,
  onDuplicate,
  onStatusChange,
  onDelete,
}: {
  campaign:
    OrganizerMarketingCampaignItem;

  isOpen:
    boolean;

  onToggle:
    () => void;

  onClose:
    () => void;

  onView?:
    CampaignsTableProps["onView"];

  onEdit?:
    CampaignsTableProps["onEdit"];

  onDuplicate?:
    CampaignsTableProps["onDuplicate"];

  onStatusChange?:
    CampaignsTableProps["onStatusChange"];

  onDelete?:
    CampaignsTableProps["onDelete"];
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={
          onToggle
        }
        aria-haspopup="menu"
        aria-expanded={
          isOpen
        }
        aria-label={`Actions pour ${campaign.name}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:border-white/[0.13] hover:bg-white/[0.06] hover:text-white"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={
              onClose
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
                onClose();
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
                onClose();
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
                onClose();
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
                  onClose();
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
                  onClose();
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
                  onClose();
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
                onClose();
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
  );
}

export default function CampaignsTable({
  campaigns,
  currency = "XOF",
  locale = "fr-FR",
  isLoading = false,
  className,
  onView,
  onEdit,
  onDuplicate,
  onStatusChange,
  onDelete,
}: CampaignsTableProps) {
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
      aria-labelledby="campaigns-table-title"
      className={joinClassNames(
        "w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071014] shadow-[0_20px_65px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-white/[0.07] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
            Tableau détaillé
          </p>

          <h2
            id="campaigns-table-title"
            className="mt-1 text-lg font-black tracking-[-0.025em] text-white sm:text-xl"
          >
            Campagnes marketing
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500 sm:text-sm">
            Consultez les performances, liens de suivi et actions disponibles.
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
          <TableLoadingState />
        ) : sortedCampaigns.length ===
          0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] border-separate border-spacing-0">
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
                        scope="col"
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
                      CHANNEL_PRESENTATIONS[
                        campaign.channel
                      ];

                    return (
                      <tr
                        key={
                          campaign.id
                        }
                        className="group"
                      >
                        <td className="border-b border-white/[0.055] px-3 py-4">
                          <div className="min-w-[240px] max-w-[320px]">
                            <button
                              type="button"
                              onClick={() => {
                                onView?.(
                                  campaign,
                                );
                              }}
                              className="block max-w-full truncate text-left text-sm font-black text-white transition hover:text-emerald-300"
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
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[10px] font-bold text-neutral-500 transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.06] hover:text-emerald-300"
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
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-600 transition hover:text-emerald-300"
                              >
                                Ouvrir
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </td>

                        <td className="border-b border-white/[0.055] px-3 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold text-neutral-400">
                            <Link2 className="h-3 w-3" />
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

                        <td className="border-b border-white/[0.055] px-3 py-4">
                          <span className="inline-flex items-center gap-1.5 text-sm font-black text-white">
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

                        <td className="border-b border-white/[0.055] px-3 py-4">
                          <span className="inline-flex items-center gap-1.5 text-sm font-black text-white">
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
                          <div className="min-w-[130px] text-[11px] leading-5 text-neutral-500">
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
                          <ActionsMenu
                            campaign={
                              campaign
                            }
                            isOpen={
                              openMenuId ===
                              campaign.id
                            }
                            onToggle={() => {
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
                            onClose={() => {
                              setOpenMenuId(
                                null,
                              );
                            }}
                            onView={
                              onView
                            }
                            onEdit={
                              onEdit
                            }
                            onDuplicate={
                              onDuplicate
                            }
                            onStatusChange={
                              onStatusChange
                            }
                            onDelete={
                              onDelete
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
        )}
      </div>
    </section>
  );
}