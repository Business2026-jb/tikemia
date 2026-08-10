"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  ShoppingBag,
  TicketCheck,
} from "lucide-react";

import type {
  AdminOrderListItem,
  GetAdminOrdersResult,
} from "@/lib/admin/orders/get-admin-orders";

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
  FAILED: "Échouée",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  SUCCESS: "Réussi",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
};

function formatMoney(
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
      dateStyle:
        "medium",
      timeStyle:
        "short",
    },
  ).format(date);
}

function orderStatusClass(
  status: string,
): string {
  switch (status) {
    case "PAID":
      return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300";

    case "PENDING":
      return "border-amber-400/20 bg-amber-400/[0.08] text-amber-300";

    case "REFUNDED":
      return "border-sky-400/20 bg-sky-400/[0.08] text-sky-300";

    case "FAILED":
      return "border-red-400/20 bg-red-400/[0.08] text-red-300";

    case "CANCELLED":
      return "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300";

    default:
      return "border-white/10 bg-white/[0.05] text-neutral-300";
  }
}

function paymentStatusClass(
  status: string,
): string {
  switch (status) {
    case "SUCCESS":
      return "text-emerald-300";

    case "PENDING":
      return "text-amber-300";

    case "REFUNDED":
      return "text-sky-300";

    case "FAILED":
      return "text-red-300";

    default:
      return "text-neutral-400";
  }
}

function DesktopRow({
  order,
  onOpen,
}: {
  order: AdminOrderListItem;
  onOpen: (
    order: AdminOrderListItem,
  ) => void;
}) {
  return (
    <tr className="border-t border-white/[0.06] align-top transition hover:bg-white/[0.025]">
      <td className="px-4 py-4">
        <div className="min-w-[145px]">
          <p className="font-bold text-white">
            {order.reference}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {formatDate(
              order.createdAt,
            )}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[190px]">
          <p className="font-semibold text-neutral-100">
            {order.customer.name}
          </p>

          <p className="mt-1 truncate text-xs text-neutral-500">
            {order.customer.email}
          </p>

          <p className="mt-0.5 text-xs text-neutral-600">
            {order.customer.phone}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[210px]">
          <p className="font-semibold text-neutral-100">
            {order.event.title}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {order.event.city},{" "}
            {order.event.country}
          </p>

          <p className="mt-0.5 text-xs text-neutral-600">
            {formatDate(
              order.event.startsAt,
            )}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[180px]">
          <p className="font-semibold text-neutral-100">
            {order.organizer.name}
          </p>

          <p className="mt-1 truncate text-xs text-neutral-500">
            {order.organizer.email}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[130px]">
          <p className="font-black text-white">
            {formatMoney(
              order.amounts.total,
              order.amounts.currency,
            )}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            Commission :{" "}
            {formatMoney(
              order.amounts
                .platformFee,
              order.amounts
                .currency,
            )}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${orderStatusClass(
            order.status,
          )}`}
        >
          {ORDER_STATUS_LABELS[
            order.status
          ] ?? order.status}
        </span>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[150px]">
          {order.payment ? (
            <>
              <p className="font-semibold text-neutral-200">
                {
                  order.payment
                    .method
                }
              </p>

              <p
                className={`mt-1 text-xs font-bold ${paymentStatusClass(
                  order.payment
                    .status,
                )}`}
              >
                {PAYMENT_STATUS_LABELS[
                  order.payment
                    .status
                ] ??
                  order.payment
                    .status}
              </p>

              <p className="mt-0.5 text-xs text-neutral-600">
                {
                  order.payment
                    .provider
                }
              </p>
            </>
          ) : (
            <span className="text-sm text-neutral-600">
              Aucun paiement
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-4 text-right">
        <p className="font-bold text-white">
          {order.tickets.total}
        </p>

        <p className="mt-1 text-xs text-neutral-500">
          {order.tickets.used} utilisé
          {order.tickets.used > 1
            ? "s"
            : ""}
        </p>
      </td>

      <td className="px-4 py-4 text-right">
        <button
          type="button"
          onClick={() =>
            onOpen(order)
          }
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-bold text-neutral-300 transition hover:bg-white/[0.07] hover:text-white"
        >
          <Eye className="h-3.5 w-3.5" />
          Voir
        </button>
      </td>
    </tr>
  );
}

function MobileCard({
  order,
  onOpen,
}: {
  order: AdminOrderListItem;
  onOpen: (
    order: AdminOrderListItem,
  ) => void;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#081115] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">
            {order.reference}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {formatDate(
              order.createdAt,
            )}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${orderStatusClass(
            order.status,
          )}`}
        >
          {ORDER_STATUS_LABELS[
            order.status
          ] ?? order.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Client
          </p>

          <p className="mt-1 font-semibold text-neutral-200">
            {order.customer.name}
          </p>

          <p className="truncate text-xs text-neutral-500">
            {order.customer.email}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Événement
          </p>

          <p className="mt-1 font-semibold text-neutral-200">
            {order.event.title}
          </p>

          <p className="text-xs text-neutral-500">
            {order.event.city},{" "}
            {order.event.country}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Organisateur
          </p>

          <p className="mt-1 font-semibold text-neutral-200">
            {order.organizer.name}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/[0.06] pt-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Paiement
          </p>

          <p className="mt-1 text-xs text-neutral-300">
            {order.payment
              ?.method ??
              "Aucun paiement"}
          </p>

          {order.payment ? (
            <p
              className={`text-xs font-bold ${paymentStatusClass(
                order.payment
                  .status,
              )}`}
            >
              {PAYMENT_STATUS_LABELS[
                order.payment
                  .status
              ] ??
                order.payment
                  .status}
            </p>
          ) : null}
        </div>

        <div className="text-right">
          <p className="text-lg font-black text-white">
            {formatMoney(
              order.amounts.total,
              order.amounts
                .currency,
            )}
          </p>

          <p className="text-xs text-neutral-500">
            {order.tickets.total} billet
            {order.tickets.total > 1
              ? "s"
              : ""}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          onOpen(order)
        }
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-black text-neutral-200 transition hover:bg-white/[0.07]"
      >
        <Eye className="h-4 w-4" />
        Voir la commande
      </button>
    </article>
  );
}

export default function OrdersTable({
  data,
  disabled,
  onNavigate,
  onOpenOrder,
}: {
  data: GetAdminOrdersResult;
  disabled: boolean;
  onNavigate: (
    changes: Record<string, string | null>,
  ) => void;
  onOpenOrder: (
    order: AdminOrderListItem,
  ) => void;
}) {
  const pageStart =
    data.pagination.totalItems ===
    0
      ? 0
      : (
          data.pagination.page -
          1
        ) *
          data.pagination
            .pageSize +
        1;

  const pageEnd =
    Math.min(
      data.pagination.page *
        data.pagination
          .pageSize,
      data.pagination
        .totalItems,
    );

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#071014]">
      <div className="flex flex-col gap-3 border-b border-white/[0.07] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-black text-white">
            Toutes les commandes
          </h2>

          <p className="mt-1 text-xs text-neutral-500">
            {data.pagination
              .totalItems.toLocaleString(
                "fr-FR",
              )}{" "}
            résultat
            {data.pagination
              .totalItems >
            1
              ? "s"
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Paiements
          </span>

          <span className="inline-flex items-center gap-1.5">
            <TicketCheck className="h-3.5 w-3.5" />
            Billets
          </span>

          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Événements
          </span>
        </div>
      </div>

      {data.orders.length ===
      0 ? (
        <div className="flex min-h-[330px] flex-col items-center justify-center px-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
            <ShoppingBag className="h-6 w-6 text-neutral-500" />
          </div>

          <h3 className="mt-4 font-black text-white">
            Aucune commande trouvée
          </h3>

          <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
            Aucune commande ne correspond actuellement aux critères sélectionnés.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 p-3 md:hidden">
            {data.orders.map(
              (order) => (
                <MobileCard
                  key={order.id}
                  order={order}
                  onOpen={
                    onOpenOrder
                  }
                />
              ),
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1360px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-white/[0.025] text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
                  <th className="px-4 py-3">
                    Commande
                  </th>
                  <th className="px-4 py-3">
                    Client
                  </th>
                  <th className="px-4 py-3">
                    Événement
                  </th>
                  <th className="px-4 py-3">
                    Organisateur
                  </th>
                  <th className="px-4 py-3">
                    Montant
                  </th>
                  <th className="px-4 py-3">
                    Statut
                  </th>
                  <th className="px-4 py-3">
                    Paiement
                  </th>
                  <th className="px-4 py-3 text-right">
                    Billets
                  </th>
                  <th className="px-4 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.orders.map(
                  (order) => (
                    <DesktopRow
                      key={order.id}
                      order={order}
                      onOpen={
                        onOpenOrder
                      }
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 border-t border-white/[0.07] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-neutral-500">
          Affichage {pageStart}–
          {pageEnd} sur{" "}
          {data.pagination
            .totalItems.toLocaleString(
              "fr-FR",
            )}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={
              data.pagination.page <=
                1 ||
              disabled
            }
            onClick={() =>
              onNavigate({
                page:
                  String(
                    Math.max(
                      1,
                      data.pagination
                        .page - 1,
                    ),
                  ),
              })
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-neutral-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="min-w-[90px] text-center text-xs font-bold text-neutral-400">
            Page{" "}
            {data.pagination.page} /{" "}
            {
              data.pagination
                .totalPages
            }
          </span>

          <button
            type="button"
            disabled={
              data.pagination.page >=
                data.pagination
                  .totalPages ||
              disabled
            }
            onClick={() =>
              onNavigate({
                page:
                  String(
                    Math.min(
                      data.pagination
                        .totalPages,
                      data.pagination
                        .page + 1,
                    ),
                  ),
              })
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-neutral-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
