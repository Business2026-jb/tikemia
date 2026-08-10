"use client";

import {
  CalendarDays,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  TicketCheck,
  UserRound,
  X,
} from "lucide-react";

import type {
  AdminOrderListItem,
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

export default function OrderDetailsDialog({
  order,
  open,
  onClose,
}: {
  order:
    | AdminOrderListItem
    | null;
  open: boolean;
  onClose: () => void;
}) {
  if (
    !open ||
    !order
  ) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-order-details-title"
        className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/[0.09] bg-[#071014] shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#071014]/95 p-5 backdrop-blur-xl sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
              Commande Tikemia
            </p>

            <h2
              id="admin-order-details-title"
              className="mt-2 text-xl font-black text-white sm:text-2xl"
            >
              {order.reference}
            </h2>

            <p className="mt-1 text-xs text-neutral-500">
              Créée le{" "}
              {formatDate(
                order.createdAt,
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-neutral-500 transition hover:bg-white/[0.07] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-emerald-300" />
                <h3 className="text-sm font-black text-white">
                  Client
                </h3>
              </div>

              <p className="mt-4 font-bold text-neutral-100">
                {order.customer.name}
              </p>

              <div className="mt-3 space-y-2 text-xs text-neutral-500">
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  {order.customer.email}
                </p>

                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  {order.customer.phone}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-emerald-300" />
                <h3 className="text-sm font-black text-white">
                  Événement
                </h3>
              </div>

              <p className="mt-4 font-bold text-neutral-100">
                {order.event.title}
              </p>

              <div className="mt-3 space-y-2 text-xs text-neutral-500">
                <p className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  {order.event.city},{" "}
                  {order.event.country}
                </p>

                <p className="flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(
                    order.event.startsAt,
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <h3 className="text-sm font-black text-white">
              Organisateur
            </h3>

            <p className="mt-3 font-bold text-neutral-100">
              {order.organizer.name}
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              {order.organizer.email}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2">
              <TicketCheck className="h-4 w-4 text-emerald-300" />
              <h3 className="text-sm font-black text-white">
                Billets commandés
              </h3>
            </div>

            <div className="mt-4 space-y-3">
              {order.items.map(
                (item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-bold text-neutral-100">
                        {
                          item.ticketTypeName
                        }
                      </p>

                      <p className="mt-1 text-xs text-neutral-500">
                        Quantité :{" "}
                        {
                          item.quantity
                        }{" "}
                        · Prix unitaire :{" "}
                        {formatMoney(
                          item.unitPrice,
                          order.amounts
                            .currency,
                        )}
                      </p>
                    </div>

                    <p className="font-black text-white">
                      {formatMoney(
                        item.total,
                        order.amounts
                          .currency,
                      )}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-emerald-300" />
                <h3 className="text-sm font-black text-white">
                  Montants
                </h3>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-neutral-500">
                    Sous-total
                  </span>

                  <span className="font-bold text-neutral-200">
                    {formatMoney(
                      order.amounts
                        .subtotal,
                      order.amounts
                        .currency,
                    )}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-neutral-500">
                    Commission Tikemia
                  </span>

                  <span className="font-bold text-neutral-200">
                    {formatMoney(
                      order.amounts
                        .platformFee,
                      order.amounts
                        .currency,
                    )}
                  </span>
                </div>

                <div className="flex justify-between gap-4 border-t border-white/[0.07] pt-3">
                  <span className="font-black text-white">
                    Total
                  </span>

                  <span className="font-black text-emerald-300">
                    {formatMoney(
                      order.amounts
                        .total,
                      order.amounts
                        .currency,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-300" />
                <h3 className="text-sm font-black text-white">
                  Paiement
                </h3>
              </div>

              {order.payment ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">
                      Statut
                    </span>

                    <span className="font-bold text-neutral-200">
                      {
                        PAYMENT_STATUS_LABELS[
                          order.payment
                            .status
                        ] ??
                        order.payment
                          .status
                      }
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">
                      Méthode
                    </span>

                    <span className="font-bold text-neutral-200">
                      {
                        order.payment
                          .method
                      }
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">
                      Prestataire
                    </span>

                    <span className="font-bold text-neutral-200">
                      {
                        order.payment
                          .provider
                      }
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">
                      Référence
                    </span>

                    <span className="max-w-[55%] break-all text-right font-bold text-neutral-200">
                      {order.payment
                        .providerReference ??
                        "—"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">
                      Payé le
                    </span>

                    <span className="font-bold text-neutral-200">
                      {formatDate(
                        order.payment
                          .paidAt,
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-neutral-500">
                  Aucun paiement n’est associé à cette commande.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                Statut commande
              </p>

              <p className="mt-2 text-sm font-black text-white">
                {
                  ORDER_STATUS_LABELS[
                    order.status
                  ] ??
                  order.status
                }
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                Billets
              </p>

              <p className="mt-2 text-sm font-black text-white">
                {order.tickets.total}
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                Utilisés
              </p>

              <p className="mt-2 text-sm font-black text-white">
                {order.tickets.used}
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                Date paiement
              </p>

              <p className="mt-2 text-sm font-black text-white">
                {formatDate(
                  order.paidAt,
                )}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
