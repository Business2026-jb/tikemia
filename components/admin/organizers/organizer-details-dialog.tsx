"use client";

import {
  Activity,
  BadgeCheck,
  Banknote,
  Building2,
  CalendarDays,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Ticket,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  AdminOrganizerListItem,
} from "@/lib/admin/organizers/get-admin-organizers";

import OrganizerBlueBadgeCard from "./organizer-blue-badge-card";
import OrganizerStatusBadge from "./organizer-status-badge";

type OrganizerDetails = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  dialCode: string;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string | Date;

  profile: {
    businessName?: string | null;
    businessType?: string | null;
    description?: string | null;
    city?: string | null;
    address?: string | null;
    website?: string | null;
    hasBlueBadge?: boolean;
    blueBadgeGrantedAt?: string | Date | null;
  } | null;

  statistics: {
    events: {
      total: number;
      PUBLISHED?: number;
    };

    orders: {
      total: number;
      paid: number;
    };

    tickets: {
      total: number;
    };

    revenue: {
      currency: string;
      subtotal: string;
      platformFee: string;
      total: string;
    };

    payouts: {
      total: number;
      netAmount: string;
      currency: string;
    };
  };

  recentEvents: Array<{
    id: string;
    title: string;
    status: string;
    startsAt: string | Date;
    city: string;
    country: string;

    _count: {
      orders: number;
      tickets: number;
      ticketTypes: number;
    };
  }>;
};

function money(
  value: string,
  currency: string,
): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${value} ${currency}`;
  }

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      },
    ).format(amount);
  } catch {
    return `${amount.toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

function formatDate(
  value: string | Date,
  style: "long" | "medium" = "medium",
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date indisponible";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: style,
    },
  ).format(date);
}

export default function OrganizerDetailsDialog({
  organizer,
  open,
  onClose,
}: {
  organizer: AdminOrganizerListItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [details, setDetails] =
    useState<OrganizerDetails | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (
      !open ||
      !organizer
    ) {
      setDetails(null);
      setLoading(false);
      setError("");

      return;
    }

    /*
     * On récupère l'identifiant ici afin que TypeScript
     * sache avec certitude qu'il ne peut pas être null
     * dans la fonction asynchrone.
     */
    const organizerId =
      organizer.id;

    const controller =
      new AbortController();

    let active =
      true;

    async function load() {
      setLoading(true);
      setError("");
      setDetails(null);

      try {
        const response =
          await fetch(
            `/api/admin/organizers/${encodeURIComponent(
              organizerId,
            )}`,
            {
              method: "GET",
              cache: "no-store",
              signal:
                controller.signal,

              headers: {
                Accept:
                  "application/json",
              },
            },
          );

        let payload: {
          success?: boolean;
          data?: OrganizerDetails;
          error?: string;
          message?: string;
        };

        try {
          payload =
            (await response.json()) as {
              success?: boolean;
              data?: OrganizerDetails;
              error?: string;
              message?: string;
            };
        } catch {
          throw new Error(
            "Le serveur a renvoyé une réponse invalide.",
          );
        }

        if (
          !response.ok ||
          !payload.success ||
          !payload.data
        ) {
          throw new Error(
            payload.error ||
              payload.message ||
              "Impossible de charger les détails.",
          );
        }

        if (!active) {
          return;
        }

        setDetails(
          payload.data,
        );
      } catch (caught) {
        if (
          caught instanceof DOMException &&
          caught.name ===
            "AbortError"
        ) {
          return;
        }

        if (!active) {
          return;
        }

        setDetails(null);

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger les détails.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active =
        false;

      controller.abort();
    };
  }, [
    open,
    organizer,
  ]);

  if (
    !open ||
    !organizer
  ) {
    return null;
  }

  const currentOrganizer =
    organizer;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="organizer-details-title"
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#070b0d] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-600">
              Fiche organisateur
            </p>

            <h2
              id="organizer-details-title"
              className="mt-1 truncate text-xl font-black text-white"
            >
              {currentOrganizer.profile
                ?.businessName ||
                currentOrganizer.fullName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fiche organisateur"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] text-neutral-500 transition hover:bg-white/[0.04] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-82px)] overflow-y-auto p-5">
          {loading ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3">
              <LoaderCircle className="h-6 w-6 animate-spin text-emerald-400" />

              <p className="text-sm text-neutral-600">
                Chargement des informations...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.06] p-4 text-sm text-red-300">
              {error}
            </div>
          ) : details ? (
            <div className="space-y-5">
              <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-black text-white">
                      {details.fullName}
                    </p>

                    {details.profile
                      ?.hasBlueBadge ? (
                      <BadgeCheck className="h-4 w-4 text-sky-400" />
                    ) : null}

                    <OrganizerStatusBadge
                      isActive={
                        details.isActive
                      }
                      emailVerified={
                        details.emailVerified
                      }
                      compact
                    />
                  </div>

                  <p className="mt-1 text-sm text-neutral-500">
                    {details.profile
                      ?.businessName ||
                      "Compte organisateur"}
                  </p>
                </div>

                <p className="shrink-0 text-xs text-neutral-600">
                  Inscrit le{" "}
                  {formatDate(
                    details.createdAt,
                    "long",
                  )}
                </p>
              </div>

              <OrganizerBlueBadgeCard
                organizerId={details.id}
                organizerName={
                  details.profile?.businessName ||
                  details.fullName
                }
                organizerEmail={details.email}
                hasBlueBadge={Boolean(
                  details.profile?.hasBlueBadge,
                )}
                blueBadgeGrantedAt={
                  details.profile?.blueBadgeGrantedAt
                    ? new Date(
                        details.profile.blueBadgeGrantedAt,
                      ).toISOString()
                    : null
                }
                onUpdated={(badge) => {
                  setDetails((current) => {
                    if (!current) {
                      return current;
                    }

                    return {
                      ...current,
                      profile: current.profile
                        ? {
                            ...current.profile,
                            hasBlueBadge:
                              badge.hasBlueBadge,
                            blueBadgeGrantedAt:
                              badge.blueBadgeGrantedAt,
                          }
                        : {
                            hasBlueBadge:
                              badge.hasBlueBadge,
                            blueBadgeGrantedAt:
                              badge.blueBadgeGrantedAt,
                          },
                    };
                  });
                }}
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <CalendarDays className="h-4 w-4 text-emerald-400" />

                  <p className="mt-3 text-lg font-black text-white">
                    {
                      details.statistics
                        .events.total
                    }
                  </p>

                  <p className="mt-1 text-xs text-neutral-600">
                    Événements
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <WalletCards className="h-4 w-4 text-emerald-400" />

                  <p className="mt-3 text-lg font-black text-white">
                    {
                      details.statistics
                        .orders.total
                    }
                  </p>

                  <p className="mt-1 text-xs text-neutral-600">
                    Commandes
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <Ticket className="h-4 w-4 text-emerald-400" />

                  <p className="mt-3 text-lg font-black text-white">
                    {
                      details.statistics
                        .tickets.total
                    }
                  </p>

                  <p className="mt-1 text-xs text-neutral-600">
                    Billets
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <Banknote className="h-4 w-4 text-emerald-400" />

                  <p className="mt-3 break-words text-lg font-black text-white">
                    {money(
                      details.statistics
                        .revenue.total,
                      details.statistics
                        .revenue.currency,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-neutral-600">
                    Revenus
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-black text-white">
                    <Building2 className="h-4 w-4 text-emerald-400" />

                    Informations
                  </h3>

                  <div className="mt-4 space-y-3 text-sm">
                    <p className="flex items-start gap-3 break-all text-neutral-400">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" />

                      {details.email}
                    </p>

                    <p className="flex items-center gap-3 text-neutral-400">
                      <Phone className="h-4 w-4 shrink-0 text-neutral-600" />

                      {[
                        details.dialCode,
                        details.phone,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </p>

                    <p className="flex items-start gap-3 text-neutral-400">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" />

                      {[
                        details.profile
                          ?.city,
                        details.country,
                      ]
                        .filter(Boolean)
                        .join(", ") ||
                        "Localisation non renseignée"}
                    </p>

                    {details.profile
                      ?.address ? (
                      <p className="pl-7 text-neutral-500">
                        {
                          details.profile
                            .address
                        }
                      </p>
                    ) : null}

                    {details.profile
                      ?.businessType ? (
                      <p className="text-neutral-500">
                        Type :{" "}
                        {
                          details.profile
                            .businessType
                        }
                      </p>
                    ) : null}

                    {details.profile
                      ?.website ? (
                      <p className="break-all text-neutral-500">
                        Site :{" "}
                        {
                          details.profile
                            .website
                        }
                      </p>
                    ) : null}

                    {details.profile
                      ?.description ? (
                      <p className="border-t border-white/[0.06] pt-3 leading-6 text-neutral-500">
                        {
                          details.profile
                            .description
                        }
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-black text-white">
                    <Activity className="h-4 w-4 text-emerald-400" />

                    Activité
                  </h3>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/[0.025] p-3">
                      <p className="text-lg font-black text-white">
                        {
                          details.statistics
                            .orders.paid
                        }
                      </p>

                      <p className="text-xs text-neutral-600">
                        Commandes payées
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.025] p-3">
                      <p className="text-lg font-black text-white">
                        {
                          details.statistics
                            .payouts.total
                        }
                      </p>

                      <p className="text-xs text-neutral-600">
                        Retraits
                      </p>
                    </div>

                    <div className="col-span-2 rounded-xl bg-white/[0.025] p-3">
                      <p className="text-lg font-black text-white">
                        {money(
                          details.statistics
                            .payouts
                            .netAmount,
                          details.statistics
                            .payouts
                            .currency,
                        )}
                      </p>

                      <p className="text-xs text-neutral-600">
                        Montant net des retraits
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] p-4">
                <h3 className="text-sm font-black text-white">
                  Événements récents
                </h3>

                <div className="mt-3 divide-y divide-white/[0.06]">
                  {details.recentEvents
                    .length > 0 ? (
                    details.recentEvents.map(
                      (event) => (
                        <div
                          key={event.id}
                          className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-neutral-200">
                              {
                                event.title
                              }
                            </p>

                            <p className="mt-1 text-xs text-neutral-600">
                              {[
                                event.city,
                                event.country,
                              ]
                                .filter(
                                  Boolean,
                                )
                                .join(
                                  ", ",
                                )}

                              {" · "}

                              {formatDate(
                                event.startsAt,
                              )}
                            </p>
                          </div>

                          <div className="shrink-0 text-xs text-neutral-500">
                            {
                              event._count
                                .tickets
                            }{" "}
                            billet(s) ·{" "}
                            {
                              event._count
                                .orders
                            }{" "}
                            commande(s)
                          </div>
                        </div>
                      ),
                    )
                  ) : (
                    <p className="py-6 text-center text-sm text-neutral-600">
                      Aucun événement.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[260px] items-center justify-center">
              <p className="text-sm text-neutral-600">
                Aucune information disponible.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}