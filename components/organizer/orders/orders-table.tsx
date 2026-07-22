"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  TicketCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  formatMoney,
} from "@/lib/localization/format-money";
import type {
  OrganizerOrderListItem,
} from "@/lib/organizer/get-organizer-orders";

type OrdersTableProps = {
  orders: OrganizerOrderListItem[];
};

type OrderStatusStyle = {
  label: string;
  badge: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
};

const ORDER_STATUS_STYLES: Record<
  OrganizerOrderListItem["status"],
  OrderStatusStyle
> = {
  PENDING: {
    label: "En attente",
    badge:
      "border-amber-500/25 bg-amber-500/[0.08] text-amber-300",
    icon: Clock3,
  },

  PAID: {
    label: "Payée",
    badge:
      "border-emerald-500/25 bg-emerald-500/[0.08] text-lime-400",
    icon: BadgeCheck,
  },

  CANCELLED: {
    label: "Annulée",
    badge:
      "border-red-500/25 bg-red-500/[0.08] text-red-400",
    icon: XCircle,
  },

  REFUNDED: {
    label: "Remboursée",
    badge:
      "border-violet-500/25 bg-violet-500/[0.08] text-violet-400",
    icon: RefreshCcw,
  },

  FAILED: {
    label: "Échouée",
    badge:
      "border-red-500/25 bg-red-500/[0.08] text-red-400",
    icon: XCircle,
  },
};

const PAYMENT_STATUS_STYLES = {
  PENDING:
    "border-amber-500/20 bg-amber-500/[0.07] text-amber-300",
  SUCCESS:
    "border-emerald-500/20 bg-emerald-500/[0.07] text-lime-400",
  FAILED:
    "border-red-500/20 bg-red-500/[0.07] text-red-400",
  REFUNDED:
    "border-violet-500/20 bg-violet-500/[0.07] text-violet-400",
} as const;

const PAYMENT_STATUS_LABELS = {
  PENDING: "En attente",
  SUCCESS: "Réussi",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
} as const;

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Non renseigné";
  }

  const date = new Date(value);

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
      day:
        "2-digit",
      month:
        "short",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
    },
  ).format(date);
}

function formatEventDate(
  value: string,
  timezone: string,
): string {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date indisponible";
  }

  try {
    return new Intl.DateTimeFormat(
      "fr-FR",
      {
        day:
          "2-digit",
        month:
          "short",
        year:
          "numeric",
        hour:
          "2-digit",
        minute:
          "2-digit",
        timeZone:
          timezone,
      },
    ).format(date);
  } catch {
    return formatDateTime(value);
  }
}

function normalizeValue(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized =
    value?.trim() ?? "";

  return normalized || fallback;
}

export default function OrdersTable({
  orders,
}: OrdersTableProps) {
  if (orders.length === 0) {
    return null;
  }

  return (
    <section className="hidden overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.16)] 2xl:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1480px] border-collapse">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.018] text-left">
              <TableHead>
                Commande
              </TableHead>

              <TableHead>
                Acheteur
              </TableHead>

              <TableHead>
                Événement
              </TableHead>

              <TableHead>
                Billets
              </TableHead>

              <TableHead>
                Paiement
              </TableHead>

              <TableHead>
                Montants
              </TableHead>

              <TableHead>
                Statut
              </TableHead>

              <TableHead align="right">
                Action
              </TableHead>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/[0.055]">
            {orders.map(
              (order) => {
                const statusStyle =
                  ORDER_STATUS_STYLES[
                    order.status
                  ];

                const StatusIcon =
                  statusStyle.icon;

                return (
                  <tr
                    key={order.id}
                    className="group align-top transition hover:bg-white/[0.018]"
                  >
                    <TableCell>
                      <div className="min-w-[180px]">
                        <p className="text-xs font-black text-white">
                          {order.reference}
                        </p>

                        <p className="mt-1 text-[10px] text-neutral-600">
                          {formatDateTime(
                            order.createdAt,
                          )}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-orange-500/20 bg-orange-500/[0.06] px-2 py-0.5 text-[9px] font-black text-orange-300">
                            {order.currency}
                          </span>

                          {order.customer.isGuest && (
                            <span className="rounded-full border border-sky-500/20 bg-sky-500/[0.06] px-2 py-0.5 text-[9px] font-black text-sky-300">
                              Invité
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="min-w-[220px]">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-500/25 bg-violet-500/10">
                            <UserRound className="h-4 w-4 text-violet-400" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-white">
                              {normalizeValue(
                                order.customer.name,
                                "Acheteur Tikemia",
                              )}
                            </p>

                            <div className="mt-2 space-y-1.5">
                              <ContactInfo
                                icon={Mail}
                                value={normalizeValue(
                                  order.customer.email,
                                  "E-mail non renseigné",
                                )}
                              />

                              <ContactInfo
                                icon={Phone}
                                value={normalizeValue(
                                  order.customer.phone,
                                  "Téléphone non renseigné",
                                )}
                              />

                              <ContactInfo
                                icon={MapPin}
                                value={
                                  order.customer.country
                                    ? `${order.customer.country}${
                                        order.customer.countryCode
                                          ? ` (${order.customer.countryCode})`
                                          : ""
                                      }`
                                    : "Pays non renseigné"
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex min-w-[260px] items-start gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
                          {order.event.coverImage ? (
                            <Image
                              src={order.event.coverImage}
                              alt={order.event.title}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <CalendarDays className="h-5 w-5 text-neutral-700" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <Link
                            href={`/organizer/events/${order.event.id}`}
                            className="line-clamp-2 text-xs font-black leading-5 text-white transition hover:text-lime-400"
                          >
                            {order.event.title}
                          </Link>

                          <p className="mt-1.5 text-[10px] text-neutral-600">
                            {formatEventDate(
                              order.event.startsAt,
                              order.event.timezone,
                            )}
                          </p>

                          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-neutral-600">
                            {order.event.venueName}
                            {", "}
                            {order.event.city}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="min-w-[170px]">
                        <div className="flex items-center gap-2">
                          <TicketCheck className="h-4 w-4 text-sky-400" />

                          <span className="text-xs font-black text-white">
                            {order.ticketSummary.total.toLocaleString(
                              "fr-FR",
                            )}
                          </span>
                        </div>

                        <div className="mt-2 space-y-1.5">
                          {order.items
                            .slice(0, 2)
                            .map(
                              (item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-3 text-[10px]"
                                >
                                  <span className="max-w-[110px] truncate text-neutral-500">
                                    {item.ticketTypeName}
                                  </span>

                                  <span className="font-black text-neutral-300">
                                    ×
                                    {item.quantity.toLocaleString(
                                      "fr-FR",
                                    )}
                                  </span>
                                </div>
                              ),
                            )}

                          {order.items.length > 2 && (
                            <p className="text-[10px] font-bold text-neutral-700">
                              +
                              {order.items.length -
                                2}{" "}
                              autre
                              {order.items.length -
                                2 >
                              1
                                ? "s"
                                : ""}
                            </p>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          <TicketBadge
                            label="Valides"
                            value={order.ticketSummary.valid}
                            tone="green"
                          />

                          <TicketBadge
                            label="Utilisés"
                            value={order.ticketSummary.used}
                            tone="blue"
                          />
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="min-w-[190px]">
                        {order.payment ? (
                          <>
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${
                                PAYMENT_STATUS_STYLES[
                                  order.payment.status
                                ]
                              }`}
                            >
                              {
                                PAYMENT_STATUS_LABELS[
                                  order.payment.status
                                ]
                              }
                            </span>

                            <div className="mt-2 space-y-1.5">
                              <PaymentInfo
                                label="Prestataire"
                                value={normalizeValue(
                                  order.payment.provider,
                                  "Non renseigné",
                                )}
                              />

                              <PaymentInfo
                                label="Moyen"
                                value={normalizeValue(
                                  order.payment.method,
                                  "Non renseigné",
                                )}
                              />

                              <PaymentInfo
                                label="Référence"
                                value={normalizeValue(
                                  order.payment.providerReference,
                                  "Non disponible",
                                )}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/[0.08] px-3 py-3 text-center">
                            <CreditCard className="mx-auto h-4 w-4 text-neutral-700" />

                            <p className="mt-1.5 text-[10px] text-neutral-600">
                              Aucun paiement
                            </p>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="min-w-[210px] space-y-2">
                        <MoneyLine
                          label="Sous-total"
                          value={formatMoney({
                            amount:
                              order.subtotal,
                            currency:
                              order.currency,
                          })}
                        />

                        <MoneyLine
                          label="Commission"
                          value={formatMoney({
                            amount:
                              order.platformFee,
                            currency:
                              order.currency,
                          })}
                          valueClassName="text-orange-400"
                        />

                        <MoneyLine
                          label="Net organisateur"
                          value={formatMoney({
                            amount:
                              order.organizerNet,
                            currency:
                              order.currency,
                          })}
                          valueClassName="text-lime-400"
                          strong
                        />

                        <MoneyLine
                          label="Total facturé"
                          value={formatMoney({
                            amount:
                              order.total,
                            currency:
                              order.currency,
                          })}
                        />
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="min-w-[130px]">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${statusStyle.badge}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusStyle.label}
                        </span>

                        <div className="mt-3 space-y-1.5">
                          <StatusLine
                            icon={CheckCircle2}
                            label="Valides"
                            value={order.ticketSummary.valid}
                            className="text-lime-400"
                          />

                          <StatusLine
                            icon={TicketCheck}
                            label="Utilisés"
                            value={order.ticketSummary.used}
                            className="text-sky-400"
                          />

                          {(order.ticketSummary.cancelled > 0 ||
                            order.ticketSummary.refunded > 0) && (
                            <StatusLine
                              icon={RefreshCcw}
                              label="Annulés"
                              value={
                                order.ticketSummary.cancelled +
                                order.ticketSummary.refunded
                              }
                              className="text-red-400"
                            />
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell align="right">
                      <div className="flex min-w-[120px] justify-end">
                        <Link
                          href={`/organizer/orders/${order.id}`}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 text-[10px] font-black text-lime-400 transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
                        >
                          Détails
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </TableCell>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TableHead({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600 ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`px-4 py-4 ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </td>
  );
}

function ContactInfo({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-3 w-3 shrink-0 text-neutral-700" />

      <span className="truncate text-[10px] text-neutral-600">
        {value}
      </span>
    </div>
  );
}

function PaymentInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[9px] text-neutral-700">
        {label}
      </span>

      <span className="max-w-[110px] break-words text-right text-[9px] font-bold text-neutral-400">
        {value}
      </span>
    </div>
  );
}

function MoneyLine({
  label,
  value,
  valueClassName = "text-neutral-300",
  strong = false,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span
        className={`text-[10px] ${
          strong
            ? "font-bold text-neutral-400"
            : "text-neutral-700"
        }`}
      >
        {label}
      </span>

      <span
        className={`max-w-[120px] break-words text-right ${
          strong
            ? "text-[11px]"
            : "text-[10px]"
        } font-black ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

function TicketBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone:
    | "green"
    | "blue";
}) {
  const classes =
    tone === "green"
      ? "border-emerald-500/15 bg-emerald-500/[0.04] text-lime-400"
      : "border-sky-500/15 bg-sky-500/[0.04] text-sky-400";

  return (
    <span
      title={label}
      className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${classes}`}
    >
      {value.toLocaleString(
        "fr-FR",
      )}
    </span>
  );
}

function StatusLine({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon
        className={`h-3 w-3 ${className}`}
      />

      <span className="text-[9px] text-neutral-700">
        {label}
      </span>

      <span className="text-[9px] font-black text-neutral-400">
        {value.toLocaleString(
          "fr-FR",
        )}
      </span>
    </div>
  );
}