"use client";

import {
  Archive,
  CalendarPlus,
  Eye,
  PauseCircle,
  Pencil,
  PlayCircle,
} from "lucide-react";

import type {
  AdminCouponListItem,
} from "@/lib/admin/coupons/get-admin-coupons";

import CouponStatusBadge from "./coupon-status-badge";
import CouponTypeBadge from "./coupon-type-badge";

function formatDate(
  value:
    Date | string | null,
) {
  if (!value) return "-";

  const parsed =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle:
        "short",
      timeStyle:
        "short",
    },
  ).format(parsed);
}

function formatDiscount(
  coupon:
    AdminCouponListItem,
) {
  if (
    coupon.discountType ===
    "PERCENTAGE"
  ) {
    return `${Number(
      coupon.discountValue,
    ).toLocaleString(
      "fr-FR",
      {
        maximumFractionDigits:
          2,
      },
    )} %`;
  }

  return `${Number(
    coupon.discountValue,
  ).toLocaleString(
    "fr-FR",
    {
      maximumFractionDigits:
        2,
    },
  )} ${coupon.event.currency}`;
}

export default function CouponRow({
  coupon,
  onOpen,
  onActivate,
  onSuspend,
  onCancel,
  onExtend,
  onUpdate,
}: {
  coupon:
    AdminCouponListItem;
  onOpen:
    (id: string) => void;
  onActivate:
    (
      coupon:
        AdminCouponListItem,
    ) => void;
  onSuspend:
    (
      coupon:
        AdminCouponListItem,
    ) => void;
  onCancel:
    (
      coupon:
        AdminCouponListItem,
    ) => void;
  onExtend:
    (
      coupon:
        AdminCouponListItem,
    ) => void;
  onUpdate:
    (
      coupon:
        AdminCouponListItem,
    ) => void;
}) {
  return (
    <tr className="border-t border-white/[0.055] transition hover:bg-white/[0.018]">
      <td className="px-4 py-4">
        <div className="min-w-[160px]">
          <p className="font-black tracking-wide text-white">
            {coupon.code}
          </p>

          <p className="mt-1 text-xs text-neutral-600">
            {coupon.description ||
              "Sans description"}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="flex min-w-[240px] items-center gap-3">
          <div className="h-12 w-16 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
            {coupon.event.coverImage ? (
              <img
                src={coupon.event.coverImage}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>

          <div>
            <p className="font-black text-white">
              {coupon.event.title}
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              {coupon.event.city},{" "}
              {coupon.event.country}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[190px]">
          <p className="font-bold text-neutral-200">
            {coupon.organizer.businessName ||
              coupon.organizer.fullName}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {coupon.organizer.email}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <CouponTypeBadge
          type={coupon.discountType}
        />
      </td>

      <td className="px-4 py-4">
        <p className="font-black text-emerald-300">
          {formatDiscount(
            coupon,
          )}
        </p>

        {coupon.minimumOrderAmount ? (
          <p className="mt-1 text-[11px] text-neutral-600">
            Minimum :{" "}
            {Number(
              coupon.minimumOrderAmount,
            ).toLocaleString(
              "fr-FR",
            )}{" "}
            {coupon.event.currency}
          </p>
        ) : null}
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[130px]">
          <p className="font-bold text-white">
            {coupon.currentUses.toLocaleString(
              "fr-FR",
            )}
            {" / "}
            {coupon.maximumUses ??
              "∞"}
          </p>

          <p className="mt-1 text-[11px] text-neutral-600">
            Par client :{" "}
            {coupon.usesPerCustomer ??
              "∞"}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[180px] text-xs text-neutral-500">
          <p>
            Début :{" "}
            {formatDate(
              coupon.startsAt,
            )}
          </p>

          <p className="mt-1">
            Fin :{" "}
            {formatDate(
              coupon.expiresAt,
            )}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <CouponStatusBadge
          status={coupon.status}
        />
      </td>

      <td className="px-4 py-4">
        <div className="flex min-w-[390px] flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() =>
              onOpen(
                coupon.id,
              )
            }
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-extrabold text-neutral-400 hover:bg-white/[0.05] hover:text-white"
          >
            <Eye className="h-3.5 w-3.5" />
            Voir
          </button>

          {coupon.status ===
            "DISABLED" ||
          coupon.status ===
            "SCHEDULED" ? (
            <button
              type="button"
              onClick={() =>
                onActivate(
                  coupon,
                )
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-3 text-xs font-extrabold text-emerald-300 hover:bg-emerald-400/[0.12]"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Activer
            </button>
          ) : null}

          {coupon.status ===
            "ACTIVE" ||
          coupon.status ===
            "SCHEDULED" ? (
            <button
              type="button"
              onClick={() =>
                onSuspend(
                  coupon,
                )
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/[0.07] px-3 text-xs font-extrabold text-sky-300 hover:bg-sky-400/[0.12]"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Suspendre
            </button>
          ) : null}

          {coupon.status !==
            "ARCHIVED" ? (
            <>
              <button
                type="button"
                onClick={() =>
                  onExtend(
                    coupon,
                  )
                }
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-3 text-xs font-extrabold text-amber-300 hover:bg-amber-400/[0.12]"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                Prolonger
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdate(
                    coupon,
                  )
                }
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/[0.07] px-3 text-xs font-extrabold text-fuchsia-300 hover:bg-fuchsia-400/[0.12]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Modifier
              </button>

              <button
                type="button"
                onClick={() =>
                  onCancel(
                    coupon,
                  )
                }
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
