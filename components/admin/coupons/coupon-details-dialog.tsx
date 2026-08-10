"use client";

import {
  AlertTriangle,
  CalendarDays,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  ShoppingCart,
  TicketPercent,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import CouponStatusBadge from "./coupon-status-badge";
import CouponTypeBadge from "./coupon-type-badge";

type CouponDetail =
  Awaited<
    ReturnType<
      typeof import(
        "@/lib/admin/coupons/get-admin-coupon"
      ).getAdminCoupon
    >
  >;

function formatDate(
  value:
    | Date
    | string
    | null
    | undefined,
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
        "medium",
      timeStyle:
        "short",
    },
  ).format(parsed);
}

function Info({
  label,
  value,
}: {
  label:
    string;
  value:
    ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-600">
        {label}
      </p>

      <div className="mt-1 break-words text-sm font-semibold text-neutral-300">
        {value || "-"}
      </div>
    </div>
  );
}

export default function CouponDetailsDialog({
  couponId,
  open,
  onClose,
}: {
  couponId:
    string | null;
  open:
    boolean;
  onClose:
    () => void;
}) {
  const [coupon, setCoupon] =
    useState<CouponDetail | null>(
      null,
    );
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState("");

  useEffect(() => {
    if (
      !open ||
      !couponId
    ) {
      setCoupon(null);
      setLoading(false);
      setError("");
      return;
    }

    const id =
      couponId;

    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setCoupon(null);

      try {
        const response =
          await fetch(
            `/api/admin/coupons/${encodeURIComponent(
              id,
            )}`,
            {
              cache:
                "no-store",
              signal:
                controller.signal,
            },
          );

        const payload =
          (await response.json()) as {
            success?:
              boolean;
            data?:
              CouponDetail;
            error?:
              | string
              | {
                  message?:
                    string;
                };
          };

        if (
          !response.ok ||
          !payload.success ||
          !payload.data
        ) {
          throw new Error(
            typeof payload.error ===
            "string"
              ? payload.error
              : payload.error?.message ||
                  "Impossible de charger le code promo.",
          );
        }

        setCoupon(
          payload.data,
        );
      } catch (caught) {
        if (
          controller.signal
            .aborted
        ) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger le code promo.",
        );
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () =>
      controller.abort();
  }, [open, couponId]);

  if (
    !open ||
    !couponId
  ) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[24px] border border-white/[0.09] bg-[#070b0e] shadow-2xl">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#070b0e]/95 p-5 backdrop-blur sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300">
              Code promo
            </p>

            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
              Détails du coupon
            </h2>

            <p className="mt-1 text-xs text-neutral-600">
              {couponId}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-fuchsia-300" />
            </div>
          ) : null}

          {error ? (
            <div className="flex gap-3 rounded-2xl border border-red-400/15 bg-red-400/[0.06] p-4 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {coupon ? (
            <div className="space-y-4">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Statut
                  </p>

                  <div className="mt-3">
                    <CouponStatusBadge
                      status={coupon.status}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Type
                  </p>

                  <div className="mt-3">
                    <CouponTypeBadge
                      type={coupon.discountType}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Code
                  </p>

                  <p className="mt-2 text-lg font-black tracking-wide text-white">
                    {coupon.code}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Utilisations
                  </p>

                  <p className="mt-2 text-lg font-black text-white">
                    {coupon.currentUses}
                    {" / "}
                    {coupon.maximumUses ??
                      "∞"}
                  </p>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <TicketPercent className="h-4 w-4 text-fuchsia-300" />
                    Règles du coupon
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Réduction"
                      value={
                        coupon.discountType ===
                        "PERCENTAGE"
                          ? `${coupon.discountValue} %`
                          : `${coupon.discountValue} ${coupon.event.currency}`
                      }
                    />

                    <Info
                      label="Montant minimum"
                      value={
                        coupon.minimumOrderAmount
                          ? `${coupon.minimumOrderAmount} ${coupon.event.currency}`
                          : "Aucun"
                      }
                    />

                    <Info
                      label="Plafond"
                      value={
                        coupon.maximumDiscount
                          ? `${coupon.maximumDiscount} ${coupon.event.currency}`
                          : "Aucun"
                      }
                    />

                    <Info
                      label="Par client"
                      value={
                        coupon.usesPerCustomer ??
                        "Illimité"
                      }
                    />

                    <Info
                      label="Début"
                      value={formatDate(
                        coupon.startsAt,
                      )}
                    />

                    <Info
                      label="Expiration"
                      value={formatDate(
                        coupon.expiresAt,
                      )}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <UserRound className="h-4 w-4 text-sky-300" />
                    Organisateur
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Nom"
                      value={coupon.organizer.fullName}
                    />

                    <Info
                      label="Entreprise"
                      value={coupon.organizer.profile?.businessName}
                    />

                    <Info
                      label="E-mail"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-neutral-600" />
                          {coupon.organizer.email}
                        </span>
                      }
                    />

                    <Info
                      label="Téléphone"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-neutral-600" />
                          {coupon.organizer.phone}
                        </span>
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <CalendarDays className="h-4 w-4 text-amber-300" />
                    Événement
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Titre"
                      value={coupon.event.title}
                    />

                    <Info
                      label="Statut"
                      value={coupon.event.status}
                    />

                    <Info
                      label="Lieu"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-neutral-600" />
                          {coupon.event.venueName},{" "}
                          {coupon.event.city}
                        </span>
                      }
                    />

                    <Info
                      label="Début"
                      value={formatDate(
                        coupon.event.startsAt,
                      )}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <ShoppingCart className="h-4 w-4 text-emerald-300" />
                    Dernières utilisations
                  </h3>

                  <div className="mt-4 space-y-3">
                    {coupon.usages.length >
                    0 ? (
                      coupon.usages
                        .slice(
                          0,
                          8,
                        )
                        .map(
                          (
                            usage,
                          ) => (
                            <div
                              key={usage.id}
                              className="rounded-xl border border-white/[0.06] bg-black/20 p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-white">
                                  {usage.order.reference}
                                </p>

                                <p className="text-xs font-black text-emerald-300">
                                  -{usage.discountAmount}{" "}
                                  {usage.currency}
                                </p>
                              </div>

                              <p className="mt-1 text-xs text-neutral-600">
                                {usage.customerEmail ||
                                  "Client"}
                                {" · "}
                                {formatDate(
                                  usage.usedAt,
                                )}
                              </p>
                            </div>
                          ),
                        )
                    ) : (
                      <p className="text-sm text-neutral-600">
                        Aucune utilisation enregistrée.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="font-black text-white">
                  Historique administratif
                </h3>

                <div className="mt-4 space-y-3">
                  {coupon.auditLogs.length >
                  0 ? (
                    coupon.auditLogs.map(
                      (log) => (
                        <div
                          key={log.id}
                          className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-black text-white">
                              {log.action}
                            </p>

                            <p className="text-xs text-neutral-600">
                              {formatDate(
                                log.createdAt,
                              )}
                            </p>
                          </div>

                          <p className="mt-2 text-xs leading-5 text-neutral-500">
                            {log.reason ||
                              "Aucun motif renseigné."}
                          </p>
                        </div>
                      ),
                    )
                  ) : (
                    <p className="text-sm text-neutral-600">
                      Aucun historique disponible.
                    </p>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
