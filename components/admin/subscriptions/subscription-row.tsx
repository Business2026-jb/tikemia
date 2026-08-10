"use client";

import {
  Ban,
  CalendarPlus,
  Eye,
  PauseCircle,
  PlayCircle,
  Repeat2,
} from "lucide-react";

import type { AdminSubscriptionListItem } from "@/lib/admin/subscriptions/get-admin-subscriptions";

import SubscriptionPlanBadge from "./subscription-plan-badge";
import SubscriptionStatusBadge from "./subscription-status-badge";

function formatMoney(amount: string, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatDate(value: Date | string | null) {
  if (!value) return "-";

  const date =
    value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
  }).format(date);
}

export default function SubscriptionRow({
  subscription,
  onOpen,
  onActivate,
  onSuspend,
  onCancel,
  onExtend,
  onChangePlan,
}: {
  subscription: AdminSubscriptionListItem;
  onOpen: (subscriptionId: string) => void;
  onActivate: (subscription: AdminSubscriptionListItem) => void;
  onSuspend: (subscription: AdminSubscriptionListItem) => void;
  onCancel: (subscription: AdminSubscriptionListItem) => void;
  onExtend: (subscription: AdminSubscriptionListItem) => void;
  onChangePlan: (subscription: AdminSubscriptionListItem) => void;
}) {
  const canActivate =
    subscription.status !== "ACTIVE" &&
    subscription.status !== "CANCELLED";

  const canSuspend =
    subscription.status === "ACTIVE" ||
    subscription.status === "PAST_DUE";

  const canCancel =
    subscription.status !== "CANCELLED";

  const canExtend =
    subscription.status !== "CANCELLED";

  return (
    <tr className="border-t border-white/[0.055] transition hover:bg-white/[0.018]">
      <td className="px-4 py-4">
        <div className="min-w-[190px]">
          <p className="font-black text-white">
            {subscription.organizer.businessName ||
              subscription.organizer.fullName}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {subscription.organizer.email}
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {subscription.organizer.phone}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="space-y-2">
          <SubscriptionPlanBadge
            name={subscription.plan.name}
            code={subscription.plan.code}
          />
          <p className="text-xs text-neutral-600">
            {subscription.plan.billingPeriod}
          </p>
        </div>
      </td>

      <td className="px-4 py-4 text-right">
        <p className="whitespace-nowrap font-black text-white">
          {formatMoney(
            subscription.plan.price,
            subscription.plan.currency,
          )}
        </p>
      </td>

      <td className="px-4 py-4">
        <SubscriptionStatusBadge
          status={subscription.status}
        />
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[150px] text-xs text-neutral-500">
          <p>Début : {formatDate(subscription.startsAt)}</p>
          <p className="mt-1">
            Fin : {formatDate(subscription.endsAt)}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            subscription.autoRenew
              ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300"
              : "border-white/[0.08] bg-white/[0.03] text-neutral-500"
          }`}
        >
          <Repeat2 className="h-3.5 w-3.5" />
          {subscription.autoRenew ? "Auto" : "Manuel"}
        </span>
      </td>

      <td className="px-4 py-4">
        <div className="flex min-w-[330px] flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpen(subscription.id)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-extrabold text-neutral-400 hover:bg-white/[0.05] hover:text-white"
          >
            <Eye className="h-3.5 w-3.5" />
            Voir
          </button>

          {canActivate ? (
            <button
              type="button"
              onClick={() => onActivate(subscription)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-3 text-xs font-extrabold text-emerald-300 hover:bg-emerald-400/[0.12]"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Activer
            </button>
          ) : null}

          {canSuspend ? (
            <button
              type="button"
              onClick={() => onSuspend(subscription)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/[0.07] px-3 text-xs font-extrabold text-sky-300 hover:bg-sky-400/[0.12]"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Suspendre
            </button>
          ) : null}

          {canExtend ? (
            <button
              type="button"
              onClick={() => onExtend(subscription)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-3 text-xs font-extrabold text-amber-300 hover:bg-amber-400/[0.12]"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Prolonger
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onChangePlan(subscription)}
            disabled={subscription.status === "CANCELLED"}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-400/[0.07] px-3 text-xs font-extrabold text-violet-300 hover:bg-violet-400/[0.12] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Repeat2 className="h-3.5 w-3.5" />
            Changer
          </button>

          {canCancel ? (
            <button
              type="button"
              onClick={() => onCancel(subscription)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.07] px-3 text-xs font-extrabold text-red-300 hover:bg-red-400/[0.12]"
            >
              <Ban className="h-3.5 w-3.5" />
              Annuler
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
