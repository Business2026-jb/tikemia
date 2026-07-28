import { OrderStatus, Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  ExternalLink,
  History,
  MapPin,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  Ticket,
  WalletCards,
  XCircle,
} from "lucide-react";

import { requireClient } from "@/lib/client/auth/require-client";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Mes commandes | Tikemia",
  description:
    "Consultez vos commandes, paiements et billets achetés sur Tikemia.",
};

export const dynamic = "force-dynamic";

type ClientOrdersPageSearchParams = {
  status?: string | string[];
  search?: string | string[];
};

type ClientOrdersPageProps = {
  searchParams?: Promise<ClientOrdersPageSearchParams>;
};

type OrderStatusFilter =
  | "ALL"
  | "PENDING"
  | "PAID"
  | "CANCELLED"
  | "REFUNDED"
  | "FAILED";

const STATUS_FILTERS: Array<{
  value: OrderStatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "Toutes" },
  { value: "PAID", label: "Payées" },
  { value: "PENDING", label: "En attente" },
  { value: "REFUNDED", label: "Remboursées" },
  { value: "CANCELLED", label: "Annulées" },
  { value: "FAILED", label: "Échouées" },
];

function getSingleSearchParam(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value)
    ? value[0]?.trim() ?? ""
    : value?.trim() ?? "";
}

function normalizeOrderStatus(
  value: string,
): OrderStatusFilter {
  const normalizedValue =
    value.trim().toUpperCase();

  if (
    normalizedValue === "PENDING" ||
    normalizedValue === "PAID" ||
    normalizedValue === "CANCELLED" ||
    normalizedValue === "REFUNDED" ||
    normalizedValue === "FAILED"
  ) {
    return normalizedValue;
  }

  return "ALL";
}

function createFilterHref({
  status,
  search,
}: {
  status: OrderStatusFilter;
  search: string;
}): string {
  const params = new URLSearchParams();

  if (status !== "ALL") {
    params.set("status", status);
  }

  if (search.trim()) {
    params.set("search", search.trim());
  }

  const query = params.toString();

  return query
    ? `/account/orders?${query}`
    : "/account/orders";
}

function formatMoney(
  amount: Prisma.Decimal | number,
  currency: string,
): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits:
      currency === "XOF" ? 0 : 2,
    maximumFractionDigits:
      currency === "XOF" ? 0 : 2,
  }).format(Number(amount));
}

function formatDateTime(
  value: Date,
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatEventDate(
  value: Date,
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function getOrderStatusLabel(
  status: OrderStatus,
): string {
const labels: Record<OrderStatus, string> = {
  PENDING: "En attente",
  PROCESSING: "Paiement en cours",
  PAID: "Payée",
  CANCELLED: "Annulée",
  EXPIRED: "Expirée",
  PARTIALLY_REFUNDED: "Partiellement remboursée",
  REFUNDED: "Remboursée",
  FAILED: "Échouée",
};

  return labels[status];
}

function getOrderStatusClassName(
  status: OrderStatus,
): string {
  switch (status) {
    case "PAID":
      return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300";

    case "PENDING":
      return "border-amber-400/20 bg-amber-400/[0.08] text-amber-300";

    case "REFUNDED":
      return "border-violet-400/20 bg-violet-400/[0.08] text-violet-300";

    case "FAILED":
    case "CANCELLED":
      return "border-red-400/20 bg-red-400/[0.08] text-red-300";

    default:
      return "border-white/[0.08] bg-white/[0.03] text-neutral-400";
  }
}

function getOrderStatusIcon(
  status: OrderStatus,
) {
  switch (status) {
    case "PAID":
      return CheckCircle2;

    case "PENDING":
      return Clock3;

    case "REFUNDED":
      return RefreshCw;

    case "FAILED":
      return XCircle;

    case "CANCELLED":
      return CircleAlert;

    default:
      return ReceiptText;
  }
}

function getPaymentStatusLabel(
  status: string | null,
): string {
  const labels: Record<string, string> = {
    PENDING: "Paiement en attente",
    SUCCESS: "Paiement confirmé",
    FAILED: "Paiement échoué",
    REFUNDED: "Paiement remboursé",
  };

  return status
    ? labels[status] ?? status
    : "Aucun paiement";
}

function getPaymentStatusClassName(
  status: string | null,
): string {
  switch (status) {
    case "SUCCESS":
      return "text-emerald-300";

    case "PENDING":
      return "text-amber-300";

    case "REFUNDED":
      return "text-violet-300";

    case "FAILED":
      return "text-red-300";

    default:
      return "text-neutral-500";
  }
}

export default async function ClientOrdersPage({
  searchParams,
}: ClientOrdersPageProps) {
  const { customer } =
    await requireClient(
      "/account/orders",
    );

  const resolvedSearchParams =
    (await searchParams) ?? {};

  const search =
    getSingleSearchParam(
      resolvedSearchParams.search,
    );

  const activeStatus =
    normalizeOrderStatus(
      getSingleSearchParam(
        resolvedSearchParams.status,
      ),
    );

  const orderWhere: Prisma.OrderWhereInput = {
    AND: [
      {
        OR: [
          {
            customerId:
              customer.id,
          },
          {
            customerEmail: {
              equals:
                customer.email,
              mode:
                Prisma.QueryMode.insensitive,
            },
          },
        ],
      },

      ...(activeStatus !== "ALL"
        ? [
            {
              status:
                activeStatus as OrderStatus,
            },
          ]
        : []),

      ...(search
        ? [
            {
              OR: [
                {
                  reference: {
                    contains:
                      search,
                    mode:
                      Prisma.QueryMode.insensitive,
                  },
                },
                {
                  event: {
                    title: {
                      contains:
                        search,
                      mode:
                        Prisma.QueryMode.insensitive,
                    },
                  },
                },
                {
                  payment: {
                    is: {
                      method: {
                        contains:
                          search,
                        mode:
                          Prisma.QueryMode.insensitive,
                      },
                    },
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };

  const orders =
    await prisma.order.findMany({
      where:
        orderWhere,

      orderBy: {
        createdAt:
          "desc",
      },

      select: {
        id: true,
        reference: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        currency: true,
        subtotal: true,
        platformFee: true,
        total: true,
        status: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,

        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            coverImage: true,
            venueName: true,
            city: true,
            country: true,
            startsAt: true,
          },
        },

        payment: {
          select: {
            id: true,
            provider: true,
            method: true,
            status: true,
            amount: true,
            currency: true,
            paidAt: true,
            failureReason: true,
          },
        },

        items: {
          orderBy: {
            id:
              "asc",
          },

          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            platformFee: true,
            total: true,

            ticketType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },

        _count: {
          select: {
            tickets:
              true,
          },
        },
      },
    });

  const totalOrders =
    orders.length;

  const paidOrders =
    orders.filter(
      (order) =>
        order.status === "PAID",
    ).length;

  const pendingOrders =
    orders.filter(
      (order) =>
        order.status === "PENDING",
    ).length;

  const totalSpent =
    orders
      .filter(
        (order) =>
          order.status === "PAID",
      )
      .reduce(
        (sum, order) =>
          sum +
          Number(order.total),
        0,
      );

  const mainCurrency =
    orders.find(
      (order) =>
        order.status === "PAID",
    )?.currency ??
    orders[0]?.currency ??
    "XOF";

  return (
    <div className="w-full min-w-0">
      <section className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#071015] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:p-6 lg:p-7">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/[0.09] blur-[100px]"
        />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-lime-300">
              <ReceiptText className="h-3.5 w-3.5" />
              Espace commandes
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
              Mes commandes
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Consultez vos achats, paiements et billets associés.
            </p>
          </div>

          <Link
            href="/events"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-xs font-black text-white shadow-[0_14px_35px_rgba(34,197,94,0.14)] transition hover:scale-[1.01]"
          >
            Voir les événements
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OrderStatCard
          label="Toutes les commandes"
          value={totalOrders.toLocaleString("fr-FR")}
          icon={ShoppingBag}
          tone="neutral"
        />

        <OrderStatCard
          label="Commandes payées"
          value={paidOrders.toLocaleString("fr-FR")}
          icon={CheckCircle2}
          tone="emerald"
        />

        <OrderStatCard
          label="En attente"
          value={pendingOrders.toLocaleString("fr-FR")}
          icon={Clock3}
          tone="amber"
        />

        <OrderStatCard
          label="Montant payé"
          value={formatMoney(
            totalSpent,
            mainCurrency,
          )}
          icon={WalletCards}
          tone="lime"
        />
      </section>

      <section className="mt-4 rounded-[22px] border border-white/[0.08] bg-[#071015] p-4 sm:p-5">
        <form
          action="/account/orders"
          method="GET"
          className="flex flex-col gap-3 lg:flex-row lg:items-center"
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-neutral-600" />

            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Rechercher une commande, un événement ou un paiement"
              className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#03090d] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/[0.08]"
            />
          </div>

          {activeStatus !== "ALL" && (
            <input
              type="hidden"
              name="status"
              value={activeStatus}
            />
          )}

          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 text-sm font-black text-lime-300 transition hover:bg-emerald-400/[0.12]"
          >
            <Search className="h-4 w-4" />
            Rechercher
          </button>
        </form>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map(
            (filter) => {
              const active =
                activeStatus ===
                filter.value;

              return (
                <Link
                  key={filter.value}
                  href={createFilterHref({
                    status:
                      filter.value,
                    search,
                  })}
                  className={
                    active
                      ? "inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-lime-400/30 bg-lime-500 px-4 text-xs font-black text-[#071000]"
                      : "inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-black text-neutral-500 transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.06] hover:text-white"
                  }
                >
                  {filter.label}
                </Link>
              );
            },
          )}
        </div>
      </section>

      {orders.length > 0 ? (
        <section className="mt-4 grid min-w-0 gap-4">
          {orders.map(
            (order) => (
              <ClientOrderCard
                key={order.id}
                order={order}
              />
            ),
          )}
        </section>
      ) : (
        <EmptyOrdersState
          hasFilters={Boolean(
            search ||
              activeStatus !== "ALL",
          )}
        />
      )}
    </div>
  );
}

type OrderStatCardProps = {
  label: string;
  value: string;
  icon: typeof ShoppingBag;
  tone:
    | "neutral"
    | "emerald"
    | "amber"
    | "lime";
};

function OrderStatCard({
  label,
  value,
  icon: Icon,
  tone,
}: OrderStatCardProps) {
  const tones = {
    neutral:
      "border-white/[0.08] bg-white/[0.025] text-neutral-400",
    emerald:
      "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300",
    amber:
      "border-amber-400/15 bg-amber-400/[0.06] text-amber-300",
    lime:
      "border-lime-400/15 bg-lime-400/[0.06] text-lime-300",
  };

  return (
    <article className="rounded-[20px] border border-white/[0.08] bg-[#071015] p-4 shadow-[0_15px_45px_rgba(0,0,0,0.16)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl border ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </span>

        <span className="text-right text-xl font-black tracking-[-0.04em] text-white sm:text-2xl">
          {value}
        </span>
      </div>

      <p className="mt-4 text-xs font-black uppercase tracking-[0.11em] text-neutral-600">
        {label}
      </p>
    </article>
  );
}

type ClientOrderCardProps = {
  order: {
    id: string;
    reference: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    currency: string;
    subtotal: Prisma.Decimal;
    platformFee: Prisma.Decimal;
    total: Prisma.Decimal;
    status: OrderStatus;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;

    event: {
      id: string;
      slug: string;
      title: string;
      coverImage: string | null;
      venueName: string;
      city: string;
      country: string;
      startsAt: Date;
    };

    payment: {
      id: string;
      provider: string;
      method: string;
      status: string;
      amount: Prisma.Decimal;
      currency: string;
      paidAt: Date | null;
      failureReason: string | null;
    } | null;

    items: Array<{
      id: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      platformFee: Prisma.Decimal;
      total: Prisma.Decimal;

      ticketType: {
        id: string;
        name: string;
      };
    }>;

    _count: {
      tickets: number;
    };
  };
};

function ClientOrderCard({
  order,
}: ClientOrderCardProps) {
  const StatusIcon =
    getOrderStatusIcon(
      order.status,
    );

  return (
    <article className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#071015] shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      <div className="grid min-w-0 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="relative min-h-[180px] overflow-hidden bg-[#03090d] lg:min-h-full">
          {order.event.coverImage ? (
            <Image
              src={order.event.coverImage}
              alt={order.event.title}
              fill
              sizes="(max-width: 1024px) 100vw, 220px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full min-h-[180px] items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_42%),#03090d]">
              <ReceiptText className="h-14 w-14 text-white/[0.12]" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#071015] via-transparent to-black/20 lg:bg-gradient-to-r" />
        </div>

        <div className="min-w-0 p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black ${getOrderStatusClassName(
                    order.status,
                  )}`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {getOrderStatusLabel(
                    order.status,
                  )}
                </span>

                <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 font-mono text-[10px] font-bold text-neutral-500">
                  {order.reference}
                </span>
              </div>

              <h2 className="mt-4 line-clamp-2 text-xl font-black tracking-[-0.03em] text-white">
                {order.event.title}
              </h2>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-500">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-lime-400" />
                  {formatEventDate(
                    order.event.startsAt,
                  )}
                </span>

                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-orange-400" />
                  {order.event.venueName},{" "}
                  {order.event.city}
                </span>
              </div>
            </div>

            <div className="shrink-0 xl:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-700">
                Total
              </p>

              <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">
                {formatMoney(
                  order.total,
                  order.currency,
                )}
              </p>

              <p className="mt-1 text-[11px] text-neutral-600">
                {order._count.tickets} billet
                {order._count.tickets > 1
                  ? "s"
                  : ""}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.07] bg-[#03090d] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-700">
                Détails
              </p>

              <div className="mt-3 space-y-3">
                {order.items.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-neutral-300">
                          {item.ticketType.name}
                        </p>

                        <p className="mt-1 text-xs text-neutral-600">
                          {item.quantity} ×{" "}
                          {formatMoney(
                            item.unitPrice,
                            order.currency,
                          )}
                        </p>
                      </div>

                      <p className="shrink-0 font-black text-white">
                        {formatMoney(
                          item.total,
                          order.currency,
                        )}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#03090d] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-700">
                Paiement
              </p>

              <div className="mt-3 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-lime-400">
                  <CreditCard className="h-5 w-5" />
                </span>

                <div className="min-w-0">
                  <p
                    className={`text-sm font-black ${getPaymentStatusClassName(
                      order.payment?.status ??
                        null,
                    )}`}
                  >
                    {getPaymentStatusLabel(
                      order.payment?.status ??
                        null,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-neutral-500">
                    {order.payment
                      ? `${order.payment.provider} · ${order.payment.method}`
                      : "Aucune transaction enregistrée"}
                  </p>

                  {order.payment?.failureReason && (
                    <p className="mt-2 text-xs leading-5 text-red-300">
                      {order.payment.failureReason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-neutral-600">
              Commande créée le{" "}
              {formatDateTime(
                order.createdAt,
              )}
              {order.paidAt && (
                <>
                  {" "}
                  · Payée le{" "}
                  {formatDateTime(
                    order.paidAt,
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/events/${order.event.slug}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-black text-neutral-300 transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.06] hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Voir l’événement
              </Link>

              {order._count.tickets > 0 && (
                <Link
                  href={`/account/tickets?search=${encodeURIComponent(
                    order.reference,
                  )}`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/[0.07] px-4 text-xs font-black text-lime-300 transition hover:bg-lime-400/[0.12]"
                >
                  <Ticket className="h-4 w-4" />
                  Voir les billets
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyOrdersState({
  hasFilters,
}: {
  hasFilters: boolean;
}) {
  return (
    <section className="mt-4 rounded-[24px] border border-dashed border-white/[0.1] bg-[#071015] px-5 py-14 text-center sm:px-8 sm:py-20">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/15 bg-lime-400/[0.06] text-lime-300">
        <ShoppingBag className="h-8 w-8" />
      </span>

      <h2 className="mt-6 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
        {hasFilters
          ? "Aucune commande trouvée"
          : "Vous n’avez encore aucune commande"}
      </h2>

      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-neutral-500">
        {hasFilters
          ? "Modifiez votre recherche ou réinitialisez les filtres."
          : "Vos commandes apparaîtront ici après vos achats."}
      </p>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        {hasFilters && (
          <Link
            href="/account/orders"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-xs font-black text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            Réinitialiser les filtres
          </Link>
        )}

        <Link
          href="/events"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-xs font-black text-white"
        >
          Voir les événements
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}