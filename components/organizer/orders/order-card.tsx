"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
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

type OrderCardProps = {
  order: OrganizerOrderListItem;
};

type StatusStyle = {
  label: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  badge: string;
  iconWrapper: string;
  iconColor: string;
};

const ORDER_STATUS_STYLES: Record<
  OrganizerOrderListItem["status"],
  StatusStyle
> = {
  PENDING: {
    label: "En attente",
    icon: Clock3,
    badge:
      "border-amber-500/25 bg-amber-500/[0.08] text-amber-300",
    iconWrapper:
      "border-amber-500/25 bg-amber-500/10",
    iconColor:
      "text-amber-400",
  },

  PAID: {
    label: "Payée",
    icon: BadgeCheck,
    badge:
      "border-emerald-500/25 bg-emerald-500/[0.08] text-lime-400",
    iconWrapper:
      "border-emerald-500/25 bg-emerald-500/10",
    iconColor:
      "text-lime-400",
  },

  CANCELLED: {
    label: "Annulée",
    icon: XCircle,
    badge:
      "border-red-500/25 bg-red-500/[0.08] text-red-400",
    iconWrapper:
      "border-red-500/25 bg-red-500/10",
    iconColor:
      "text-red-400",
  },

  REFUNDED: {
    label: "Remboursée",
    icon: RefreshCcw,
    badge:
      "border-violet-500/25 bg-violet-500/[0.08] text-violet-400",
    iconWrapper:
      "border-violet-500/25 bg-violet-500/10",
    iconColor:
      "text-violet-400",
  },

  FAILED: {
    label: "Échouée",
    icon: XCircle,
    badge:
      "border-red-500/25 bg-red-500/[0.08] text-red-400",
    iconWrapper:
      "border-red-500/25 bg-red-500/10",
    iconColor:
      "text-red-400",
  },
};

const PAYMENT_STATUS_STYLES = {
  PENDING: {
    label: "Paiement en attente",
    className:
      "border-amber-500/20 bg-amber-500/[0.07] text-amber-300",
  },

  SUCCESS: {
    label: "Paiement réussi",
    className:
      "border-emerald-500/20 bg-emerald-500/[0.07] text-lime-400",
  },

  FAILED: {
    label: "Paiement échoué",
    className:
      "border-red-500/20 bg-red-500/[0.07] text-red-400",
  },

  REFUNDED: {
    label: "Paiement remboursé",
    className:
      "border-violet-500/20 bg-violet-500/[0.07] text-violet-400",
  },
} as const;

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Non renseigné";
  }

  const date =
    new Date(value);

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
  const date =
    new Date(value);

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
        weekday:
          "short",
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

function normalizeLabel(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized =
    value?.trim() ?? "";

  return normalized || fallback;
}

export default function OrderCard({
  order,
}: OrderCardProps) {
  const statusStyle =
    ORDER_STATUS_STYLES[
      order.status
    ];

  const StatusIcon =
    statusStyle.icon;

  const paymentStyle =
    order.payment
      ? PAYMENT_STATUS_STYLES[
          order.payment.status
        ]
      : null;

  const ticketsLabel =
    order.ticketSummary.total > 1
      ? "billets"
      : "billet";

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition duration-200 hover:border-white/[0.13]">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${statusStyle.iconWrapper}`}
          >
            <StatusIcon
              className={`h-5 w-5 ${statusStyle.iconColor}`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${statusStyle.badge}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {statusStyle.label}
              </span>

              <span className="rounded-full border border-orange-500/20 bg-orange-500/[0.06] px-2.5 py-1 text-[10px] font-black text-orange-300">
                {order.currency}
              </span>

              {order.customer.isGuest && (
                <span className="rounded-full border border-sky-500/20 bg-sky-500/[0.06] px-2.5 py-1 text-[10px] font-black text-sky-300">
                  Achat invité
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="truncate text-sm font-black text-white">
                Commande {order.reference}
              </h3>

              <span className="text-[11px] text-neutral-600">
                {formatDateTime(
                  order.createdAt,
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {paymentStyle && (
            <span
              className={`inline-flex h-9 items-center rounded-xl border px-3 text-[10px] font-black ${paymentStyle.className}`}
            >
              {paymentStyle.label}
            </span>
          )}

          <Link
            href={`/organizer/orders/${order.id}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 text-xs font-black text-lime-400 transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
          >
            Voir la commande
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_340px]">
        <section className="border-b border-white/[0.07] p-4 sm:p-5 xl:border-b-0 xl:border-r">
          <SectionTitle
            icon={CalendarDays}
            title="Événement"
            description="Informations liées à cette commande"
          />

          <div className="mt-4 flex gap-4">
            <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              {order.event.coverImage ? (
                <Image
                  src={order.event.coverImage}
                  alt={order.event.title}
                  fill
                  sizes="104px"
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <CalendarDays className="h-8 w-8 text-neutral-700" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <Link
                href={`/organizer/events/${order.event.id}`}
                className="line-clamp-2 text-sm font-black leading-5 text-white transition hover:text-lime-400"
              >
                {order.event.title}
              </Link>

              <div className="mt-3 space-y-2">
                <InfoLine
                  icon={CalendarDays}
                  value={formatEventDate(
                    order.event.startsAt,
                    order.event.timezone,
                  )}
                />

                <InfoLine
                  icon={MapPin}
                  value={`${order.event.venueName}, ${order.event.city}, ${order.event.country}`}
                />
              </div>

              <Link
                href={`/organizer/events/${order.event.id}`}
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-neutral-500 transition hover:text-lime-400"
              >
                Ouvrir l’événement
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniValue
              label="Billets"
              value={order.ticketSummary.total.toLocaleString(
                "fr-FR",
              )}
            />

            <MiniValue
              label="Types"
              value={order.items.length.toLocaleString(
                "fr-FR",
              )}
            />

            <MiniValue
              label="Devise"
              value={order.currency}
            />
          </div>
        </section>

        <section className="border-b border-white/[0.07] p-4 sm:p-5 xl:border-b-0 xl:border-r">
          <SectionTitle
            icon={UserRound}
            title="Acheteur"
            description="Coordonnées enregistrées au moment de l’achat"
          />

          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-violet-500/25 bg-violet-500/10">
                <UserRound className="h-5 w-5 text-violet-400" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  {normalizeLabel(
                    order.customer.name,
                    "Acheteur Tikemia",
                  )}
                </p>

                <p className="mt-1 text-[11px] text-neutral-600">
                  {order.customer.isGuest
                    ? "Client invité"
                    : "Client enregistré"}
                </p>
              </div>

              {!order.customer.isGuest && (
                <ShieldCheck className="h-4 w-4 shrink-0 text-lime-400" />
              )}
            </div>

            <div className="mt-4 space-y-2.5">
              <ContactLine
                icon={Mail}
                value={normalizeLabel(
                  order.customer.email,
                  "E-mail non renseigné",
                )}
                href={
                  order.customer.email
                    ? `mailto:${order.customer.email}`
                    : undefined
                }
              />

              <ContactLine
                icon={Phone}
                value={normalizeLabel(
                  order.customer.phone,
                  "Téléphone non renseigné",
                )}
                href={
                  order.customer.phone
                    ? `tel:${order.customer.phone}`
                    : undefined
                }
              />

              <ContactLine
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

          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
              Billets achetés
            </p>

            <div className="mt-2 space-y-2">
              {order.items.map(
                (item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-neutral-300">
                        {item.ticketTypeName}
                      </p>

                      <p className="mt-0.5 text-[10px] text-neutral-600">
                        {item.quantity.toLocaleString(
                          "fr-FR",
                        )}{" "}
                        ×{" "}
                        {formatMoney({
                          amount:
                            item.unitPrice,
                          currency:
                            order.currency,
                        })}
                      </p>
                    </div>

                    <span className="shrink-0 text-xs font-black text-white">
                      {formatMoney({
                        amount:
                          item.subtotal,
                        currency:
                          order.currency,
                      })}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        <aside className="p-4 sm:p-5">
          <SectionTitle
            icon={ReceiptText}
            title="Paiement"
            description="Résumé financier de la commande"
          />

          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <MoneyRow
              label="Sous-total"
              value={formatMoney({
                amount:
                  order.subtotal,
                currency:
                  order.currency,
              })}
            />

            <MoneyRow
              label="Commission Tikemia"
              value={formatMoney({
                amount:
                  order.platformFee,
                currency:
                  order.currency,
              })}
              valueClassName="text-orange-400"
            />

            <MoneyRow
              label="Total facturé"
              value={formatMoney({
                amount:
                  order.total,
                currency:
                  order.currency,
              })}
            />

            <div className="my-3 border-t border-dashed border-white/[0.08]" />

            <MoneyRow
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
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/10 p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-neutral-500" />

              <p className="text-xs font-black text-neutral-300">
                Détails du paiement
              </p>
            </div>

            {order.payment ? (
              <div className="mt-3 space-y-2.5">
                <DetailLine
                  label="Prestataire"
                  value={normalizeLabel(
                    order.payment.provider,
                    "Non renseigné",
                  )}
                />

                <DetailLine
                  label="Moyen"
                  value={normalizeLabel(
                    order.payment.method,
                    "Non renseigné",
                  )}
                />

                <DetailLine
                  label="Référence"
                  value={normalizeLabel(
                    order.payment.providerReference,
                    "Non disponible",
                  )}
                />

                <DetailLine
                  label="Paiement"
                  value={formatDateTime(
                    order.payment.paidAt,
                  )}
                />
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-white/[0.08] px-3 py-4 text-center">
                <CreditCard className="mx-auto h-5 w-5 text-neutral-700" />

                <p className="mt-2 text-[11px] leading-5 text-neutral-600">
                  Aucun paiement associé à cette commande.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <TicketState
              label="Valides"
              value={order.ticketSummary.valid}
              icon={CheckCircle2}
              tone="green"
            />

            <TicketState
              label="Utilisés"
              value={order.ticketSummary.used}
              icon={TicketCheck}
              tone="blue"
            />

            <TicketState
              label="Annulés"
              value={order.ticketSummary.cancelled}
              icon={XCircle}
              tone="red"
            />

            <TicketState
              label="Remboursés"
              value={order.ticketSummary.refunded}
              icon={RefreshCcw}
              tone="violet"
            />
          </div>
        </aside>
      </div>

      <footer className="flex flex-col gap-3 border-t border-white/[0.07] bg-white/[0.012] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-neutral-600">
          <span>
            Créée le{" "}
            <strong className="font-bold text-neutral-400">
              {formatDateTime(
                order.createdAt,
              )}
            </strong>
          </span>

          <span>
            Payée le{" "}
            <strong className="font-bold text-neutral-400">
              {formatDateTime(
                order.paidAt,
              )}
            </strong>
          </span>

          <span>
            {order.ticketSummary.total.toLocaleString(
              "fr-FR",
            )}{" "}
            {ticketsLabel}
          </span>
        </div>

        <Link
          href={`/organizer/orders/${order.id}`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[11px] font-black text-neutral-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.06] hover:text-white"
        >
          Détails complets
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </footer>
    </article>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-lime-400" />

        <h4 className="text-xs font-black uppercase tracking-[0.1em] text-neutral-300">
          {title}
        </h4>
      </div>

      <p className="mt-1 text-[10px] leading-4 text-neutral-600">
        {description}
      </p>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-600" />

      <span className="line-clamp-2 text-[11px] leading-4 text-neutral-500">
        {value}
      </span>
    </div>
  );
}

function ContactLine({
  icon: Icon,
  value,
  href,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-600" />

      <span className="truncate text-[11px] text-neutral-500">
        {value}
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="flex min-w-0 items-center gap-2 transition hover:text-lime-400"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {content}
    </div>
  );
}

function MiniValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-center">
      <p className="text-[9px] uppercase tracking-[0.1em] text-neutral-700">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-black text-neutral-300">
        {value}
      </p>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  valueClassName = "text-white",
  strong = false,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span
        className={`text-[11px] ${
          strong
            ? "font-black text-neutral-300"
            : "text-neutral-600"
        }`}
      >
        {label}
      </span>

      <span
        className={`text-right ${
          strong
            ? "text-sm"
            : "text-xs"
        } font-black ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[10px] text-neutral-600">
        {label}
      </span>

      <span className="max-w-[180px] break-words text-right text-[10px] font-bold text-neutral-300">
        {value}
      </span>
    </div>
  );
}

function TicketState({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{
    className?: string;
  }>;
  tone:
    | "green"
    | "blue"
    | "red"
    | "violet";
}) {
  const tones = {
    green: {
      wrapper:
        "border-emerald-500/15 bg-emerald-500/[0.04]",
      icon:
        "text-lime-400",
    },
    blue: {
      wrapper:
        "border-sky-500/15 bg-sky-500/[0.04]",
      icon:
        "text-sky-400",
    },
    red: {
      wrapper:
        "border-red-500/15 bg-red-500/[0.04]",
      icon:
        "text-red-400",
    },
    violet: {
      wrapper:
        "border-violet-500/15 bg-violet-500/[0.04]",
      icon:
        "text-violet-400",
    },
  } as const;

  const style =
    tones[tone];

  return (
    <div
      className={`rounded-xl border p-3 ${style.wrapper}`}
    >
      <Icon
        className={`h-4 w-4 ${style.icon}`}
      />

      <p className="mt-2 text-sm font-black text-white">
        {value.toLocaleString(
          "fr-FR",
        )}
      </p>

      <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-neutral-600">
        {label}
      </p>
    </div>
  );
}