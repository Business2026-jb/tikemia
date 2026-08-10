"use client";

import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type {
  AdminCustomerListItem,
} from "@/components/admin/customers/admin-customers-page";

type CustomerDetails = Readonly<{
  id: string;
  accountType: "REGISTERED" | "GUEST";
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  country: string | null;
  countryCode: string | null;
  dialCode: string | null;
  emailVerified: boolean;
  isActive: boolean;
  registeredAt: string | null;
  firstPurchaseAt: string;
  lastPurchaseAt: string;
  statistics: Readonly<{
    orders: number;
    paidOrders: number;
    refundedOrders: number;
    tickets: number;
    validTickets: number;
    usedTickets: number;
    totalSpentByCurrency: Readonly<
      Record<string, string>
    >;
  }>;
  recentOrders: readonly Readonly<{
    id: string;
    reference: string;
    status: string;
    currency: string;
    subtotal: string;
    platformFee: string;
    total: string;
    paidAt: string | null;
    createdAt: string;
    event: Readonly<{
      id: string;
      title: string;
      slug: string;
      coverImage: string | null;
      venueName: string;
      city: string;
      country: string;
      startsAt: string;
    }>;
    payment: Readonly<{
      provider: string;
      method: string;
      status: string;
      paidAt: string | null;
    }> | null;
    ticketsCount: number;
  }>[];
}>;

type ApiResponse =
  | {
      success: true;
      data: CustomerDetails;
    }
  | {
      success: false;
      error?: {
        message?: string;
      };
    };

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function formatMoney(
  amount: string,
  currency: string,
): string {
  const value =
    Number(amount);

  if (!Number.isFinite(value)) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits:
          currency === "XOF"
            ? 0
            : 2,
      },
    ).format(value);
  } catch {
    return `${value.toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

function orderStatusLabel(
  status: string,
): string {
  const labels:
    Record<string, string> = {
      PENDING:
        "En attente",
      PAID:
        "Payée",
      CANCELLED:
        "Annulée",
      CANCELED:
        "Annulée",
      FAILED:
        "Échouée",
      EXPIRED:
        "Expirée",
      REFUNDED:
        "Remboursée",
      PARTIALLY_REFUNDED:
        "Remb. partiel",
    };

  return (
    labels[status] ||
    status
  );
}

export default function CustomerDetailsDialog({
  customer,
  open,
  onClose,
}: {
  customer: AdminCustomerListItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [details, setDetails] =
    useState<CustomerDetails | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (
      !open ||
      !customer
    ) {
      setDetails(null);
      setLoading(false);
      setError("");
      return;
    }

    const customerId =
      customer.id;

    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setDetails(null);

      try {
        const response =
          await fetch(
            `/api/admin/customers/${encodeURIComponent(
              customerId,
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

        const contentType =
          response.headers.get(
            "content-type",
          ) ?? "";

        if (
          !contentType.includes(
            "application/json",
          )
        ) {
          throw new Error(
            "Le serveur a renvoyé une réponse invalide.",
          );
        }

        const payload =
          (await response.json()) as ApiResponse;

        if (
          !response.ok ||
          !payload.success
        ) {
          throw new Error(
            !payload.success
              ? payload.error?.message ||
                  "Impossible de charger le client."
              : "Impossible de charger le client.",
          );
        }

        setDetails(
          payload.data,
        );
      } catch (caught) {
        if (
          caught instanceof DOMException &&
          caught.name === "AbortError"
        ) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger le client.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [
    customer,
    open,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    onClose,
    open,
  ]);

  if (
    !open ||
    !customer
  ) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Détails du client"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="relative max-h-[94vh] w-full max-w-4xl overflow-hidden rounded-t-[26px] border border-white/[0.08] bg-[#071014] shadow-2xl sm:rounded-[26px]">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-5 sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-black text-white">
                {customer.fullName}
              </h2>

              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-neutral-400">
                {customer.accountType ===
                "REGISTERED"
                  ? "Compte Tikemia"
                  : "Acheteur invité"}
              </span>
            </div>

            <p className="mt-1 truncate text-xs text-neutral-500">
              {customer.email}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(94vh-88px)] overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="text-center">
                <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-emerald-300" />
                <p className="mt-3 text-sm font-bold text-neutral-500">
                  Chargement…
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex gap-3 rounded-2xl border border-red-400/15 bg-red-400/[0.055] p-4 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              {error}
            </div>
          ) : details ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <ReceiptText className="h-4 w-4 text-blue-300" />
                  <p className="mt-3 text-2xl font-black text-white">
                    {details.statistics.orders.toLocaleString(
                      "fr-FR",
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-600">
                    Commandes
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <Ticket className="h-4 w-4 text-emerald-300" />
                  <p className="mt-3 text-2xl font-black text-white">
                    {details.statistics.tickets.toLocaleString(
                      "fr-FR",
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-600">
                    Billets
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <BadgeCheck className="h-4 w-4 text-lime-300" />
                  <p className="mt-3 text-2xl font-black text-white">
                    {details.statistics.validTickets.toLocaleString(
                      "fr-FR",
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-600">
                    Billets valides
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <CircleDollarSign className="h-4 w-4 text-amber-300" />
                  <div className="mt-3 space-y-1">
                    {Object.entries(
                      details.statistics
                        .totalSpentByCurrency,
                    ).length > 0 ? (
                      Object.entries(
                        details.statistics
                          .totalSpentByCurrency,
                      ).map(
                        ([
                          currency,
                          amount,
                        ]) => (
                          <p
                            key={currency}
                            className="text-sm font-black text-white"
                          >
                            {formatMoney(
                              amount,
                              currency,
                            )}
                          </p>
                        ),
                      )
                    ) : (
                      <p className="text-2xl font-black text-white">
                        0
                      </p>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-600">
                    Total dépensé
                  </p>
                </div>
              </section>

              <section className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <h3 className="text-sm font-black text-white">
                    Coordonnées
                  </h3>

                  <div className="mt-4 space-y-3 text-xs">
                    <p className="flex items-center gap-3 text-neutral-400">
                      <Mail className="h-4 w-4 shrink-0 text-neutral-600" />
                      <span className="break-all">
                        {details.email}
                      </span>
                    </p>

                    <p className="flex items-center gap-3 text-neutral-400">
                      <Phone className="h-4 w-4 shrink-0 text-neutral-600" />
                      {details.phone ||
                        "Non renseigné"}
                    </p>

                    <p className="flex items-center gap-3 text-neutral-400">
                      <MapPin className="h-4 w-4 shrink-0 text-neutral-600" />
                      {details.country ||
                        "Non renseigné"}
                    </p>

                    <p className="flex items-center gap-3 text-neutral-400">
                      <UserRound className="h-4 w-4 shrink-0 text-neutral-600" />
                      {details.emailVerified
                        ? "E-mail vérifié"
                        : "E-mail non vérifié"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <h3 className="text-sm font-black text-white">
                    Activité
                  </h3>

                  <div className="mt-4 space-y-3 text-xs">
                    <p className="flex items-center justify-between gap-3">
                      <span className="text-neutral-600">
                        Premier achat
                      </span>
                      <span className="font-bold text-neutral-300">
                        {formatDateTime(
                          details.firstPurchaseAt,
                        )}
                      </span>
                    </p>

                    <p className="flex items-center justify-between gap-3">
                      <span className="text-neutral-600">
                        Dernier achat
                      </span>
                      <span className="font-bold text-neutral-300">
                        {formatDateTime(
                          details.lastPurchaseAt,
                        )}
                      </span>
                    </p>

                    <p className="flex items-center justify-between gap-3">
                      <span className="text-neutral-600">
                        Billets utilisés
                      </span>
                      <span className="font-bold text-neutral-300">
                        {details.statistics.usedTickets.toLocaleString(
                          "fr-FR",
                        )}
                      </span>
                    </p>

                    <p className="flex items-center justify-between gap-3">
                      <span className="text-neutral-600">
                        Remboursements
                      </span>
                      <span className="font-bold text-neutral-300">
                        {details.statistics.refundedOrders.toLocaleString(
                          "fr-FR",
                        )}
                      </span>
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-5">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-emerald-300" />
                  <h3 className="text-sm font-black text-white">
                    Commandes récentes
                  </h3>
                </div>

                <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.06]">
                  {details.recentOrders.length >
                  0 ? (
                    <div className="divide-y divide-white/[0.055]">
                      {details.recentOrders.map(
                        (order) => (
                          <div
                            key={order.id}
                            className="flex flex-col gap-3 bg-white/[0.015] p-4 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-white">
                                {order.event.title}
                              </p>
                              <p className="mt-1 text-[11px] text-neutral-600">
                                {order.reference} ·{" "}
                                {order.event.city} ·{" "}
                                {formatDateTime(
                                  order.createdAt,
                                )}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[10px] font-black text-neutral-400">
                                {order.ticketsCount} billet
                                {order.ticketsCount >
                                1
                                  ? "s"
                                  : ""}
                              </span>

                              <span className="rounded-full border border-emerald-400/12 bg-emerald-400/[0.045] px-2.5 py-1 text-[10px] font-black text-emerald-300">
                                {orderStatusLabel(
                                  order.status,
                                )}
                              </span>

                              <span className="text-xs font-black text-white">
                                {formatMoney(
                                  order.total,
                                  order.currency,
                                )}
                              </span>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-neutral-600">
                      Aucune commande récente.
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
