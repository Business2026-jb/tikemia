"use client";

import {
  AlertTriangle,
  CalendarDays,
  LoaderCircle,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import PromotionPriorityBadge from "./promotion-priority-badge";
import PromotionStatusBadge from "./promotion-status-badge";

type PromotionDetail =
  Awaited<
    ReturnType<
      typeof import(
        "@/lib/admin/promotions/get-admin-promotion"
      ).getAdminPromotion
    >
  >;

function date(
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

export default function PromotionDetailsDialog({
  promotionId,
  open,
  onClose,
}: {
  promotionId:
    string | null;
  open:
    boolean;
  onClose:
    () => void;
}) {
  const [promotion, setPromotion] =
    useState<PromotionDetail | null>(null);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState("");

  useEffect(() => {
    if (
      !open ||
      !promotionId
    ) {
      setPromotion(null);
      setLoading(false);
      setError("");
      return;
    }

    const id =
      promotionId;
    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setPromotion(null);

      try {
        const response =
          await fetch(
            `/api/admin/promotions/${encodeURIComponent(
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
              PromotionDetail;
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
                  "Impossible de charger la promotion.",
          );
        }

        setPromotion(
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
            : "Impossible de charger la promotion.",
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
  }, [open, promotionId]);

  if (
    !open ||
    !promotionId
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
              Promotion d’événement
            </p>

            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
              Détails de la promotion
            </h2>

            <p className="mt-1 text-xs text-neutral-600">
              {promotionId}
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

          {promotion ? (
            <div className="space-y-4">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Statut
                  </p>
                  <div className="mt-3">
                    <PromotionStatusBadge
                      status={promotion.status}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Priorité
                  </p>
                  <div className="mt-3">
                    <PromotionPriorityBadge
                      score={promotion.priorityScore}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Source
                  </p>
                  <p className="mt-2 text-lg font-black text-white">
                    {promotion.source}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Mise en avant
                  </p>
                  <p className="mt-2 text-lg font-black text-white">
                    {promotion.event.isFeatured
                      ? "Active"
                      : "Inactive"}
                  </p>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <Megaphone className="h-4 w-4 text-fuchsia-300" />
                    Événement
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Titre"
                      value={promotion.event.title}
                    />
                    <Info
                      label="Catégorie"
                      value={promotion.event.category?.name}
                    />
                    <Info
                      label="Statut"
                      value={promotion.event.status}
                    />
                    <Info
                      label="Lieu"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-neutral-600" />
                          {promotion.event.venueName},{" "}
                          {promotion.event.city}
                        </span>
                      }
                    />
                    <Info
                      label="Début"
                      value={date(
                        promotion.event.startsAt,
                      )}
                    />
                    <Info
                      label="Fin"
                      value={date(
                        promotion.event.endsAt,
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
                      value={promotion.organizer.fullName}
                    />
                    <Info
                      label="Entreprise"
                      value={promotion.organizer.profile?.businessName}
                    />
                    <Info
                      label="E-mail"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-neutral-600" />
                          {promotion.organizer.email}
                        </span>
                      }
                    />
                    <Info
                      label="Téléphone"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-neutral-600" />
                          {promotion.organizer.phone}
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
                    Période de promotion
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Début"
                      value={date(
                        promotion.startsAt,
                      )}
                    />
                    <Info
                      label="Fin"
                      value={date(
                        promotion.endsAt,
                      )}
                    />
                    <Info
                      label="Activée le"
                      value={date(
                        promotion.activatedAt,
                      )}
                    />
                    <Info
                      label="Suspendue le"
                      value={date(
                        promotion.pausedAt,
                      )}
                    />
                    <Info
                      label="Annulée le"
                      value={date(
                        promotion.canceledAt,
                      )}
                    />
                    <Info
                      label="Motif"
                      value={promotion.cancellationReason}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <WalletCards className="h-4 w-4 text-emerald-300" />
                    Abonnement et paiement
                  </h3>

                  {promotion.subscription ? (
                    <div className="mt-5 space-y-4">
                      <Info
                        label="Plan"
                        value={promotion.subscription.plan.name}
                      />
                      <Info
                        label="Statut abonnement"
                        value={promotion.subscription.status}
                      />
                      <Info
                        label="Prix"
                        value={`${promotion.subscription.plan.price} ${promotion.subscription.plan.currency}`}
                      />
                      <Info
                        label="Paiements"
                        value={promotion.subscription.payments.length}
                      />
                    </div>
                  ) : (
                    <p className="mt-5 text-sm text-neutral-600">
                      Promotion créée sans abonnement associé.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="font-black text-white">
                  Historique administratif
                </h3>

                <div className="mt-4 space-y-3">
                  {promotion.auditLogs.length > 0 ? (
                    promotion.auditLogs.map(
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
                              {date(log.createdAt)}
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
