"use client";

import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Crown,
  MapPin,
  Medal,
  ReceiptText,
  Sparkles,
  TicketCheck,
  Trophy,
  UsersRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type {
  ComponentType,
  ReactNode,
} from "react";

import type {
  OrganizerStatisticsData,
  StatisticsDistributionItem,
  StatisticsEventPerformance,
  StatisticsPaymentMethodItem,
  StatisticsSalesPoint,
} from "@/lib/organizer/get-organizer-statistics";

type TopPerformersProps = {
  data: OrganizerStatisticsData["topPerformers"];
  currency: OrganizerStatisticsData["currency"];
  title?: string;
  description?: string;
};

type PerformerTone =
  | "green"
  | "orange"
  | "blue"
  | "violet"
  | "amber"
  | "neutral";

type PerformerCardProps = {
  icon: ComponentType<{
    className?: string;
  }>;
  eyebrow: string;
  title: string;
  description: string;
  value: string;
  secondaryValue?: string;
  tone: PerformerTone;
  href?: string;
  footer?: ReactNode;
  featured?: boolean;
};

const TONE_STYLES: Record<
  PerformerTone,
  {
    border: string;
    background: string;
    glow: string;
    iconBox: string;
    icon: string;
    value: string;
    badge: string;
  }
> = {
  green: {
    border: "border-emerald-500/20",
    background:
      "bg-[linear-gradient(145deg,rgba(5,24,17,0.98),rgba(7,16,20,0.98))]",
    glow:
      "from-emerald-500/[0.13] via-emerald-500/[0.025] to-transparent",
    iconBox:
      "border-emerald-500/25 bg-emerald-500/10",
    icon: "text-emerald-300",
    value: "text-emerald-300",
    badge:
      "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300",
  },

  orange: {
    border: "border-orange-500/20",
    background:
      "bg-[linear-gradient(145deg,rgba(29,15,7,0.97),rgba(7,16,20,0.98))]",
    glow:
      "from-orange-500/[0.13] via-orange-500/[0.025] to-transparent",
    iconBox:
      "border-orange-500/25 bg-orange-500/10",
    icon: "text-orange-300",
    value: "text-orange-300",
    badge:
      "border-orange-500/20 bg-orange-500/[0.08] text-orange-300",
  },

  blue: {
    border: "border-sky-500/20",
    background:
      "bg-[linear-gradient(145deg,rgba(5,20,29,0.97),rgba(7,16,20,0.98))]",
    glow:
      "from-sky-500/[0.13] via-sky-500/[0.025] to-transparent",
    iconBox:
      "border-sky-500/25 bg-sky-500/10",
    icon: "text-sky-300",
    value: "text-sky-300",
    badge:
      "border-sky-500/20 bg-sky-500/[0.08] text-sky-300",
  },

  violet: {
    border: "border-violet-500/20",
    background:
      "bg-[linear-gradient(145deg,rgba(22,13,30,0.97),rgba(7,16,20,0.98))]",
    glow:
      "from-violet-500/[0.13] via-violet-500/[0.025] to-transparent",
    iconBox:
      "border-violet-500/25 bg-violet-500/10",
    icon: "text-violet-300",
    value: "text-violet-300",
    badge:
      "border-violet-500/20 bg-violet-500/[0.08] text-violet-300",
  },

  amber: {
    border: "border-amber-500/20",
    background:
      "bg-[linear-gradient(145deg,rgba(28,21,7,0.97),rgba(7,16,20,0.98))]",
    glow:
      "from-amber-500/[0.13] via-amber-500/[0.025] to-transparent",
    iconBox:
      "border-amber-500/25 bg-amber-500/10",
    icon: "text-amber-300",
    value: "text-amber-300",
    badge:
      "border-amber-500/20 bg-amber-500/[0.08] text-amber-300",
  },

  neutral: {
    border: "border-white/[0.075]",
    background:
      "bg-[linear-gradient(145deg,rgba(10,20,25,0.98),rgba(7,16,20,0.98))]",
    glow:
      "from-white/[0.055] via-white/[0.012] to-transparent",
    iconBox:
      "border-white/[0.09] bg-white/[0.035]",
    icon: "text-neutral-300",
    value: "text-white",
    badge:
      "border-white/[0.08] bg-white/[0.025] text-neutral-400",
  },
};

function safeNumber(value: number): number {
  return Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
}

function formatPercentage(value: number): string {
  const safeValue = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 100)
    : 0;

  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(safeValue)} %`;
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const safeValue = safeNumber(value);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "XOF" ||
        currency === "XAF"
          ? 0
          : 2,
    }).format(safeValue);
  } catch {
    return `${formatNumber(safeValue)} ${currency}`;
  }
}

function formatDate(value: string): string {
  const date = new Date(
    value.includes("T")
      ? value
      : `${value}T12:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return "Date non renseignée";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function normalizeLabel(value: string): string {
  const normalized = value
    .trim()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .toLowerCase();

  if (!normalized) {
    return "Non renseigné";
  }

  return normalized.replace(
    /(^|\s)\S/g,
    (character) => character.toUpperCase(),
  );
}

function EventFooter({
  event,
}: {
  event: StatisticsEventPerformance;
}) {
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-3">
      <SmallMetric
        label="Billets"
        value={formatNumber(event.ticketsSold)}
      />

      <SmallMetric
        label="Remplissage"
        value={formatPercentage(event.occupancyRate)}
      />

      <SmallMetric
        label="Présence"
        value={formatPercentage(event.attendanceRate)}
      />
    </div>
  );
}

function DistributionFooter({
  item,
}: {
  item: StatisticsDistributionItem;
}) {
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-3">
      <SmallMetric
        label="Billets"
        value={formatNumber(item.ticketsSold)}
      />

      <SmallMetric
        label="Commandes"
        value={formatNumber(item.count)}
      />

      <SmallMetric
        label="Part"
        value={formatPercentage(item.percentage)}
      />
    </div>
  );
}

function PaymentFooter({
  item,
}: {
  item: StatisticsPaymentMethodItem;
}) {
  const successRate =
    item.payments > 0
      ? (safeNumber(item.successfulPayments) /
          safeNumber(item.payments)) *
        100
      : 0;

  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-3">
      <SmallMetric
        label="Paiements"
        value={formatNumber(item.payments)}
      />

      <SmallMetric
        label="Réussite"
        value={formatPercentage(successRate)}
      />

      <SmallMetric
        label="Part"
        value={formatPercentage(item.percentage)}
      />
    </div>
  );
}

function SalesDayFooter({
  day,
}: {
  day: StatisticsSalesPoint;
}) {
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-3">
      <SmallMetric
        label="Billets"
        value={formatNumber(day.ticketsSold)}
      />

      <SmallMetric
        label="Commandes"
        value={formatNumber(day.paidOrders)}
      />

      <SmallMetric
        label="Participants"
        value={formatNumber(day.participants)}
      />
    </div>
  );
}

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.065] bg-[#050c10] px-3 py-2.5">
      <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-600">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-black text-white">
        {value}
      </p>
    </div>
  );
}

function PerformerCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  value,
  secondaryValue,
  tone,
  href,
  footer,
  featured = false,
}: PerformerCardProps) {
  const styles = TONE_STYLES[tone];

  const content = (
    <article
      className={`group relative h-full min-w-0 overflow-hidden rounded-2xl border p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.15] sm:p-5 ${styles.border} ${styles.background} ${
        featured
          ? "shadow-[0_24px_80px_rgba(132,204,22,0.08)]"
          : "shadow-[0_18px_55px_rgba(0,0,0,0.16)]"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.glow}`}
      />

      <div className="relative flex h-full min-h-[250px] flex-col">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <span
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${styles.badge}`}
            >
              <Medal className="h-3 w-3 shrink-0" />

              <span className="truncate">
                {eyebrow}
              </span>
            </span>

            <h3 className="mt-3 line-clamp-2 text-base font-black leading-snug text-white sm:text-lg">
              {title}
            </h3>
          </div>

          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${styles.iconBox}`}
          >
            <Icon
              className={`h-5 w-5 ${styles.icon}`}
              aria-hidden="true"
            />
          </div>
        </div>

        <p className="mt-3 line-clamp-3 text-[11px] leading-5 text-neutral-500">
          {description}
        </p>

        <div className="mt-5">
          <p
            className={`break-words text-2xl font-black leading-tight tracking-tight ${styles.value}`}
          >
            {value}
          </p>

          {secondaryValue && (
            <p className="mt-1.5 text-[11px] font-semibold text-neutral-500">
              {secondaryValue}
            </p>
          )}
        </div>

        {footer && (
          <div className="mt-auto pt-5">
            {footer}
          </div>
        )}
      </div>
    </article>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="block h-full min-w-0"
    >
      {content}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.012] px-5 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <Trophy className="h-7 w-7 text-neutral-600" />
      </div>

      <h3 className="mt-5 text-lg font-black text-white">
        Aucun meilleur résultat disponible
      </h3>

      <p className="mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        Les meilleures performances apparaîtront ici dès que vos événements
        enregistreront des ventes, des participants et des paiements.
      </p>
    </div>
  );
}

export default function TopPerformers({
  data,
  currency,
  title = "Meilleures performances",
  description =
    "Identifiez immédiatement les événements, marchés, journées et moyens de paiement les plus performants.",
}: TopPerformersProps) {
  const hasData = Boolean(
    data.bestRevenueEvent ||
      data.mostAttendedEvent ||
      data.bestSellingTicketType ||
      data.bestSalesDay ||
      data.topCountry ||
      data.topCity ||
      data.topPaymentMethod,
  );

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.055),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(132,204,22,0.035),transparent_28%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/[0.08]">
            <Trophy className="h-4 w-4 text-amber-300" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-white sm:text-lg">
              {title}
            </h2>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {description}
            </p>
          </div>
        </div>

        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.07] px-3 py-1.5 text-[10px] font-bold text-amber-300">
          <Sparkles className="h-3.5 w-3.5" />
          Analyse automatique Tikemia
        </span>
      </div>

      <div className="relative w-full min-w-0 p-4 sm:p-5 xl:p-6">
        {!hasData ? (
          <EmptyState />
        ) : (
          <div className="grid w-full min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {data.bestRevenueEvent && (
              <PerformerCard
                icon={Crown}
                eyebrow="Événement le plus rentable"
                title={data.bestRevenueEvent.title}
                description={[
                  data.bestRevenueEvent.categoryName,
                  data.bestRevenueEvent.city,
                  data.bestRevenueEvent.country,
                ]
                  .filter(Boolean)
                  .join(" • ")}
                value={formatMoney(
                  data.bestRevenueEvent.netRevenue,
                  data.bestRevenueEvent.currency ??
                    currency,
                )}
                secondaryValue={`Brut : ${formatMoney(
                  data.bestRevenueEvent.grossRevenue,
                  data.bestRevenueEvent.currency ??
                    currency,
                )}`}
                tone="green"
                href={`/organizer/events/${data.bestRevenueEvent.id}`}
                featured
                footer={
                  <EventFooter
                    event={data.bestRevenueEvent}
                  />
                }
              />
            )}

            {data.mostAttendedEvent && (
              <PerformerCard
                icon={UsersRound}
                eyebrow="Événement le plus fréquenté"
                title={data.mostAttendedEvent.title}
                description={[
                  data.mostAttendedEvent.venueName,
                  data.mostAttendedEvent.city,
                  data.mostAttendedEvent.country,
                ]
                  .filter(Boolean)
                  .join(" • ")}
                value={`${formatNumber(
                  data.mostAttendedEvent.checkedInParticipants,
                )} présents`}
                secondaryValue={`${formatNumber(
                  data.mostAttendedEvent.participants,
                )} participants uniques`}
                tone="blue"
                href={`/organizer/events/${data.mostAttendedEvent.id}`}
                footer={
                  <EventFooter
                    event={data.mostAttendedEvent}
                  />
                }
              />
            )}

            {data.bestSellingTicketType && (
              <PerformerCard
                icon={TicketCheck}
                eyebrow="Type de billet le plus vendu"
                title={data.bestSellingTicketType.name}
                description={
                  data.bestSellingTicketType.eventTitle
                }
                value={`${formatNumber(
                  data.bestSellingTicketType.quantity,
                )} billets`}
                secondaryValue={formatMoney(
                  data.bestSellingTicketType.grossRevenue,
                  currency,
                )}
                tone="orange"
                href={
                  data.bestSellingTicketType.eventId
                    ? `/organizer/events/${data.bestSellingTicketType.eventId}`
                    : undefined
                }
                footer={
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    <SmallMetric
                      label="Quantité vendue"
                      value={formatNumber(
                        data.bestSellingTicketType.quantity,
                      )}
                    />

                    <SmallMetric
                      label="Revenu brut"
                      value={formatMoney(
                        data.bestSellingTicketType.grossRevenue,
                        currency,
                      )}
                    />
                  </div>
                }
              />
            )}

            {data.bestSalesDay && (
              <PerformerCard
                icon={CalendarDays}
                eyebrow="Meilleure journée de vente"
                title={formatDate(
                  data.bestSalesDay.date,
                )}
                description="Journée ayant généré le chiffre d’affaires brut le plus élevé."
                value={formatMoney(
                  data.bestSalesDay.grossRevenue,
                  currency,
                )}
                secondaryValue={`Net : ${formatMoney(
                  data.bestSalesDay.netRevenue,
                  currency,
                )}`}
                tone="amber"
                footer={
                  <SalesDayFooter
                    day={data.bestSalesDay}
                  />
                }
              />
            )}

            {data.topCountry && (
              <PerformerCard
                icon={MapPin}
                eyebrow="Pays le plus performant"
                title={data.topCountry.label}
                description="Marché géographique générant la plus forte activité sur la période."
                value={formatMoney(
                  data.topCountry.grossRevenue,
                  currency,
                )}
                secondaryValue={`Net : ${formatMoney(
                  data.topCountry.netRevenue,
                  currency,
                )}`}
                tone="violet"
                footer={
                  <DistributionFooter
                    item={data.topCountry}
                  />
                }
              />
            )}

            {data.topCity && (
              <PerformerCard
                icon={MapPin}
                eyebrow="Ville la plus performante"
                title={data.topCity.label}
                description="Ville concentrant le plus fort volume de ventes parmi les événements analysés."
                value={formatMoney(
                  data.topCity.grossRevenue,
                  currency,
                )}
                secondaryValue={`${formatNumber(
                  data.topCity.ticketsSold,
                )} billets vendus`}
                tone="blue"
                footer={
                  <DistributionFooter
                    item={data.topCity}
                  />
                }
              />
            )}

            {data.topPaymentMethod && (
              <PerformerCard
                icon={WalletCards}
                eyebrow="Moyen de paiement dominant"
                title={normalizeLabel(
                  data.topPaymentMethod.method,
                )}
                description={`Prestataire : ${normalizeLabel(
                  data.topPaymentMethod.provider,
                )}`}
                value={formatMoney(
                  data.topPaymentMethod.amount,
                  currency,
                )}
                secondaryValue={`${formatNumber(
                  data.topPaymentMethod.successfulPayments,
                )} paiements réussis`}
                tone="green"
                footer={
                  <PaymentFooter
                    item={data.topPaymentMethod}
                  />
                }
              />
            )}

            <PerformerCard
              icon={ReceiptText}
              eyebrow="Lecture rapide"
              title="Synthèse des meilleurs résultats"
              description="Cette zone regroupe automatiquement les performances les plus importantes pour faciliter vos décisions."
              value="Vue consolidée"
              secondaryValue="Événements, ventes, marchés et paiements"
              tone="neutral"
              footer={
                <div className="grid min-w-0 gap-2 sm:grid-cols-3">
                  <SmallMetric
                    label="Événements"
                    value={
                      data.bestRevenueEvent ||
                      data.mostAttendedEvent
                        ? "Analysés"
                        : "Aucun"
                    }
                  />

                  <SmallMetric
                    label="Marchés"
                    value={
                      data.topCountry ||
                      data.topCity
                        ? "Analysés"
                        : "Aucun"
                    }
                  />

                  <SmallMetric
                    label="Paiements"
                    value={
                      data.topPaymentMethod
                        ? "Analysés"
                        : "Aucun"
                    }
                  />
                </div>
              }
            />
          </div>
        )}
      </div>

      {data.bestRevenueEvent && (
        <div className="relative grid w-full min-w-0 gap-3 border-t border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4 xl:px-6">
          <FooterMetric
            icon={Banknote}
            label="Meilleur revenu net"
            value={formatMoney(
              data.bestRevenueEvent.netRevenue,
              data.bestRevenueEvent.currency ??
                currency,
            )}
            description={data.bestRevenueEvent.title}
            tone="green"
          />

          <FooterMetric
            icon={CircleDollarSign}
            label="Meilleur revenu brut"
            value={formatMoney(
              data.bestRevenueEvent.grossRevenue,
              data.bestRevenueEvent.currency ??
                currency,
            )}
            description="Événement le plus rentable"
            tone="lime"
          />

          <FooterMetric
            icon={TicketCheck}
            label="Billets vendus"
            value={formatNumber(
              data.bestRevenueEvent.ticketsSold,
            )}
            description="Sur le meilleur événement"
            tone="orange"
          />

          <FooterMetric
            icon={UsersRound}
            label="Participants présents"
            value={formatNumber(
              data.bestRevenueEvent.checkedInParticipants,
            )}
            description="Entrées validées"
            tone="blue"
          />
        </div>
      )}
    </section>
  );
}

function FooterMetric({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: ComponentType<{
    className?: string;
  }>;
  label: string;
  value: string;
  description: string;
  tone:
    | "green"
    | "lime"
    | "orange"
    | "blue";
}) {
  const styles = {
    green:
      "border-emerald-500/20 bg-emerald-500/[0.055] text-emerald-300",
    lime:
      "border-lime-500/20 bg-lime-500/[0.055] text-lime-300",
    orange:
      "border-orange-500/20 bg-orange-500/[0.055] text-orange-300",
    blue:
      "border-sky-500/20 bg-sky-500/[0.055] text-sky-300",
  }[tone];

  return (
    <article
      className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 ${styles}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-[#071014]">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">
          {label}
        </p>

        <p className="mt-1 truncate text-sm font-black">
          {value}
        </p>

        <p className="mt-1 truncate text-[9px] text-neutral-600">
          {description}
        </p>
      </div>
    </article>
  );
}