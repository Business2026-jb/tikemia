"use client";

import {
  Archive,
  CalendarPlus,
  CheckCircle2,
  Eye,
  PauseCircle,
  SlidersHorizontal,
  WalletCards,
  XCircle,
} from "lucide-react";

import type {
  AdminMarketingCampaignListItem,
} from "@/lib/admin/marketing/get-admin-marketing-campaigns";

import MarketingChannelBadge from "./marketing-channel-badge";
import MarketingPriorityBadge from "./marketing-priority-badge";
import MarketingStatusBadge from "./marketing-status-badge";

function formatDate(value: Date | string | null) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function MarketingRow({
  campaign,
  onOpen,
  onApprove,
  onReject,
  onSuspend,
  onCancel,
  onExtend,
  onBudget,
  onPriority,
}: {
  campaign: AdminMarketingCampaignListItem;
  onOpen: (id: string) => void;
  onApprove: (item: AdminMarketingCampaignListItem) => void;
  onReject: (item: AdminMarketingCampaignListItem) => void;
  onSuspend: (item: AdminMarketingCampaignListItem) => void;
  onCancel: (item: AdminMarketingCampaignListItem) => void;
  onExtend: (item: AdminMarketingCampaignListItem) => void;
  onBudget: (item: AdminMarketingCampaignListItem) => void;
  onPriority: (item: AdminMarketingCampaignListItem) => void;
}) {
  return (
    <tr className="border-t border-white/[0.055] transition hover:bg-white/[0.018]">
      <td className="px-4 py-4">
        <div className="min-w-[210px]">
          <p className="font-black text-white">{campaign.name}</p>
          <p className="mt-1 text-xs text-neutral-600">
            {campaign.trackingCode}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="flex min-w-[245px] items-center gap-3">
          <div className="h-12 w-16 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
            {campaign.event.coverImage ? (
              <img
                src={campaign.event.coverImage}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>

          <div>
            <p className="font-black text-white">{campaign.event.title}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {campaign.event.city}, {campaign.event.country}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[190px]">
          <p className="font-bold text-neutral-200">
            {campaign.organizer.businessName ||
              campaign.organizer.fullName}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {campaign.organizer.email}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <MarketingChannelBadge channel={campaign.channel} />
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[120px]">
          <p className="font-black text-emerald-300">
            {campaign.budget
              ? `${Number(campaign.budget).toLocaleString("fr-FR")} ${campaign.currency}`
              : "Non défini"}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <MarketingPriorityBadge priority={campaign.priority} />
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[150px] text-xs text-neutral-500">
          <p>Visites : {campaign.metrics.visits}</p>
          <p className="mt-1">Commandes : {campaign.metrics.orders}</p>
          <p className="mt-1">
            Conversion : {campaign.metrics.conversionRate} %
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[180px] text-xs text-neutral-500">
          <p>Début : {formatDate(campaign.startsAt)}</p>
          <p className="mt-1">Fin : {formatDate(campaign.endsAt)}</p>
        </div>
      </td>

      <td className="px-4 py-4">
        <MarketingStatusBadge status={campaign.status} />
      </td>

      <td className="px-4 py-4">
        <div className="flex min-w-[520px] flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpen(campaign.id)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-extrabold text-neutral-400 hover:bg-white/[0.05] hover:text-white"
          >
            <Eye className="h-3.5 w-3.5" />
            Voir
          </button>

          {campaign.status === "DRAFT" ||
          campaign.status === "PAUSED" ||
          campaign.status === "SCHEDULED" ? (
            <button
              type="button"
              onClick={() => onApprove(campaign)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-3 text-xs font-extrabold text-emerald-300 hover:bg-emerald-400/[0.12]"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approuver
            </button>
          ) : null}

          {campaign.status === "DRAFT" ? (
            <button
              type="button"
              onClick={() => onReject(campaign)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.07] px-3 text-xs font-extrabold text-red-300 hover:bg-red-400/[0.12]"
            >
              <XCircle className="h-3.5 w-3.5" />
              Refuser
            </button>
          ) : null}

          {campaign.status === "ACTIVE" ||
          campaign.status === "SCHEDULED" ? (
            <button
              type="button"
              onClick={() => onSuspend(campaign)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/[0.07] px-3 text-xs font-extrabold text-sky-300 hover:bg-sky-400/[0.12]"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Suspendre
            </button>
          ) : null}

          {campaign.status !== "ARCHIVED" ? (
            <>
              <button
                type="button"
                onClick={() => onExtend(campaign)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-3 text-xs font-extrabold text-amber-300 hover:bg-amber-400/[0.12]"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                Prolonger
              </button>

              <button
                type="button"
                onClick={() => onBudget(campaign)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] px-3 text-xs font-extrabold text-cyan-300 hover:bg-cyan-400/[0.12]"
              >
                <WalletCards className="h-3.5 w-3.5" />
                Budget
              </button>

              <button
                type="button"
                onClick={() => onPriority(campaign)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/[0.07] px-3 text-xs font-extrabold text-fuchsia-300 hover:bg-fuchsia-400/[0.12]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Priorité
              </button>

              <button
                type="button"
                onClick={() => onCancel(campaign)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.07] px-3 text-xs font-extrabold text-red-300 hover:bg-red-400/[0.12]"
              >
                <Archive className="h-3.5 w-3.5" />
                Annuler
              </button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
