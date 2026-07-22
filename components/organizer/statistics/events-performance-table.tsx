import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  MapPin,
  ReceiptText,
  ScanLine,
  TicketCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import type {
  OrganizerStatisticsData,
  StatisticsEventPerformance,
} from "@/lib/organizer/get-organizer-statistics";

type EventsPerformanceTableProps = {
  events: OrganizerStatisticsData["eventPerformance"];
  displayCurrency?: OrganizerStatisticsData["currency"];
};

type EventStatusTone = {
  label: string;
  className: string;
  dotClassName: string;
};

function formatNumber(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(safeValue);
}

function formatPercentage(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;

  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(safeValue)} %`;
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const safeValue = Number.isFinite(value) ? value : 0;

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "XOF" || currency === "XAF"
          ? 0
          : 2,
    }).format(safeValue);
  } catch {
    return `${formatNumber(safeValue)} ${currency}`;
  }
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date non renseignée";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getEventStatusTone(
  status: StatisticsEventPerformance["status"],
): EventStatusTone {
  switch (status) {
    case "PUBLISHED":
      return {
        label: "Publié",
        className:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
        dotClassName: "bg-emerald-400",
      };

    case "DRAFT":
      return {
        label: "Brouillon",
        className:
          "border-neutral-500/25 bg-neutral-500/10 text-neutral-300",
        dotClassName: "bg-neutral-400",
      };

    case "CANCELLED":
      return {
        label: "Annulé",
        className:
          "border-red-500/25 bg-red-500/10 text-red-300",
        dotClassName: "bg-red-400",
      };

    case "COMPLETED":
      return {
        label: "Terminé",
        className:
          "border-sky-500/25 bg-sky-500/10 text-sky-300",
        dotClassName: "bg-sky-400",
      };

    default:
      return {
        label: String(status),
        className:
          "border-white/[0.1] bg-white/[0.04] text-neutral-300",
        dotClassName: "bg-neutral-400",
      };
  }
}

function getPerformanceTone(value: number): {
  textClassName: string;
  progressClassName: string;
} {
  if (value >= 80) {
    return {
      textClassName: "text-emerald-300",
      progressClassName:
        "bg-gradient-to-r from-emerald-500 to-lime-400",
    };
  }

  if (value >= 50) {
    return {
      textClassName: "text-amber-300",
      progressClassName:
        "bg-gradient-to-r from-amber-500 to-orange-400",
    };
  }

  return {
    textClassName: "text-red-300",
    progressClassName:
      "bg-gradient-to-r from-red-500 to-rose-400",
  };
}

function EventCover({
  event,
}: {
  event: StatisticsEventPerformance;
}) {
  if (event.coverImage) {
    return (
      <img
        src={event.coverImage}
        alt=""
        className="h-12 w-12 shrink-0 rounded-xl object-cover"
      />
    );
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025]">
      <CalendarDays
        className="h-5 w-5 text-neutral-600"
        aria-hidden="true"
      />
    </div>
  );
}

function OccupancyCell({
  event,
}: {
  event: StatisticsEventPerformance;
}) {
  const safeRate = Math.min(
    Math.max(
      Number.isFinite(event.occupancyRate)
        ? event.occupancyRate
        : 0,
      0,
    ),
    100,
  );

  const tone = getPerformanceTone(safeRate);

  return (
    <div className="min-w-[150px]">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-xs font-black ${tone.textClassName}`}
        >
          {formatPercentage(safeRate)}
        </span>

        <span className="text-[10px] text-neutral-600">
          {formatNumber(event.ticketsSold)} /{" "}
          {formatNumber(event.capacity)}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.055]">
        <div
          className={`h-full rounded-full ${tone.progressClassName}`}
          style={{
            width: `${safeRate}%`,
          }}
        />
      </div>

      <p className="mt-1.5 text-[10px] text-neutral-600">
        {formatNumber(event.remainingPlaces)} place
        {event.remainingPlaces > 1 ? "s" : ""} restante
        {event.remainingPlaces > 1 ? "s" : ""}
      </p>
    </div>
  );
}

function AttendanceCell({
  event,
}: {
  event: StatisticsEventPerformance;
}) {
  const safeRate = Math.min(
    Math.max(
      Number.isFinite(event.attendanceRate)
        ? event.attendanceRate
        : 0,
      0,
    ),
    100,
  );

  const tone = getPerformanceTone(safeRate);

  return (
    <div className="min-w-[145px]">
      <div className="flex items-center gap-2">
        <ScanLine className="h-3.5 w-3.5 text-sky-400" />

        <span
          className={`text-xs font-black ${tone.textClassName}`}
        >
          {formatPercentage(safeRate)}
        </span>
      </div>

      <p className="mt-1.5 text-[11px] text-neutral-500">
        {formatNumber(event.checkedInParticipants)} présent
        {event.checkedInParticipants > 1 ? "s" : ""}
      </p>

      <p className="mt-1 text-[10px] text-neutral-600">
        {formatNumber(event.participants)} participant
        {event.participants > 1 ? "s" : ""} unique
        {event.participants > 1 ? "s" : ""}
      </p>
    </div>
  );
}

function EventPerformanceRow({
  event,
  displayCurrency,
}: {
  event: StatisticsEventPerformance;
  displayCurrency?: string;
}) {
  const statusTone = getEventStatusTone(event.status);
  const moneyCurrency = displayCurrency ?? event.currency;

  return (
    <tr className="group border-b border-white/[0.055] transition last:border-b-0 hover:bg-white/[0.018]">
      <td className="min-w-[290px] px-4 py-4 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <EventCover event={event} />

          <div className="min-w-0 flex-1">
            <Link
              href={`/organizer/events/${event.id}`}
              className="inline-flex max-w-full items-center gap-1.5 text-sm font-black text-white transition hover:text-emerald-300"
            >
              <span className="truncate">
                {event.title}
              </span>

              <ExternalLink className="h-3 w-3 shrink-0" />
            </Link>

            <p className="mt-1 truncate text-xs font-semibold text-orange-300">
              {event.categoryName}
            </p>

            <div className="mt-2 flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0 text-neutral-600" />

              <span className="truncate text-[11px] text-neutral-500">
                {[event.venueName, event.city, event.country]
                  .filter(Boolean)
                  .join(", ") || "Lieu non renseigné"}
              </span>
            </div>
          </div>
        </div>
      </td>

      <td className="min-w-[155px] px-4 py-4 align-middle">
        <span
          className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold ${statusTone.className}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${statusTone.dotClassName}`}
          />

          {statusTone.label}
        </span>

        <div className="mt-2 flex items-center gap-1.5">
          <Clock3 className="h-3 w-3 text-neutral-600" />

          <span className="text-[11px] text-neutral-500">
            {formatDateTime(event.startsAt)}
          </span>
        </div>
      </td>

      <td className="min-w-[165px] px-4 py-4 align-middle">
        <OccupancyCell event={event} />
      </td>

      <td className="min-w-[150px] px-4 py-4 align-middle">
        <div className="flex items-center gap-2">
          <TicketCheck className="h-4 w-4 text-orange-400" />

          <span className="text-sm font-black text-white">
            {formatNumber(event.ticketsSold)}
          </span>
        </div>

        <p className="mt-1.5 text-[11px] text-neutral-500">
          {formatNumber(event.paidOrders)} commande
          {event.paidOrders > 1 ? "s" : ""} payée
          {event.paidOrders > 1 ? "s" : ""}
        </p>

        <p className="mt-1 text-[10px] text-neutral-600">
          Panier moyen :{" "}
          {formatMoney(event.averageOrderValue, moneyCurrency)}
        </p>
      </td>

      <td className="min-w-[170px] px-4 py-4 align-middle">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-lime-400" />

          <span className="text-sm font-black text-lime-300">
            {formatMoney(event.grossRevenue, moneyCurrency)}
          </span>
        </div>

        <p className="mt-1.5 text-[11px] text-neutral-500">
          Chiffre d’affaires brut
        </p>
      </td>

      <td className="min-w-[165px] px-4 py-4 align-middle">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-orange-400" />

          <span className="text-sm font-black text-orange-300">
            {formatMoney(event.platformFees, moneyCurrency)}
          </span>
        </div>

        <p className="mt-1.5 text-[11px] text-neutral-500">
          Commissions Tikemia
        </p>
      </td>

      <td className="min-w-[170px] px-4 py-4 align-middle">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-emerald-400" />

          <span className="text-sm font-black text-emerald-300">
            {formatMoney(event.netRevenue, moneyCurrency)}
          </span>
        </div>

        <p className="mt-1.5 text-[11px] text-neutral-500">
          Revenu net organisateur
        </p>
      </td>

      <td className="min-w-[160px] px-4 py-4 align-middle">
        <AttendanceCell event={event} />
      </td>

      <td className="min-w-[120px] px-4 py-4 text-right align-middle">
        <Link
          href={`/organizer/events/${event.id}`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 text-xs font-bold text-neutral-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.08] hover:text-emerald-300"
        >
          Détails
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </td>
    </tr>
  );
}

function EventsPerformanceEmptyState() {
  return (
    <div className="flex min-h-[340px] w-full flex-col items-center justify-center px-5 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <TrendingUp className="h-7 w-7 text-neutral-600" />
      </div>

      <h3 className="mt-5 text-lg font-black text-white">
        Aucune performance disponible
      </h3>

      <p className="mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        Les performances de vos événements apparaîtront ici dès qu’une
        commande payée ou un billet sera enregistré.
      </p>

      <Link
        href="/organizer/events"
        className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/15"
      >
        <CalendarDays className="h-4 w-4" />
        Voir mes événements
      </Link>
    </div>
  );
}

export default function EventsPerformanceTable({
  events,
  displayCurrency,
}: EventsPerformanceTableProps) {
  const totalGrossRevenue = events.reduce(
    (sum, event) =>
      sum +
      (Number.isFinite(event.grossRevenue)
        ? event.grossRevenue
        : 0),
    0,
  );

  const totalNetRevenue = events.reduce(
    (sum, event) =>
      sum +
      (Number.isFinite(event.netRevenue)
        ? event.netRevenue
        : 0),
    0,
  );

  const totalTicketsSold = events.reduce(
    (sum, event) =>
      sum +
      (Number.isFinite(event.ticketsSold)
        ? event.ticketsSold
        : 0),
    0,
  );

  const totalParticipants = events.reduce(
    (sum, event) =>
      sum +
      (Number.isFinite(event.participants)
        ? event.participants
        : 0),
    0,
  );

  const fallbackCurrency =
    displayCurrency ??
    events[0]?.currency ??
    "XOF";

  return (
    <section className="relative hidden w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014] lg:block">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.035),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.03),transparent_28%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/[0.08]">
            <TrendingUp
              className="h-4 w-4 text-sky-300"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-white sm:text-lg">
              Performance des événements
            </h2>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Comparez les ventes, les revenus, le remplissage et la présence
              de chaque événement.
            </p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 xl:w-auto xl:grid-cols-4">
          <HeaderMetric
            icon={CalendarDays}
            label="Événements"
            value={formatNumber(events.length)}
            tone="neutral"
          />

          <HeaderMetric
            icon={TicketCheck}
            label="Billets"
            value={formatNumber(totalTicketsSold)}
            tone="orange"
          />

          <HeaderMetric
            icon={UsersRound}
            label="Participants"
            value={formatNumber(totalParticipants)}
            tone="blue"
          />

          <HeaderMetric
            icon={Banknote}
            label="Revenu net"
            value={formatMoney(
              totalNetRevenue,
              fallbackCurrency,
            )}
            tone="green"
          />
        </div>
      </div>

      {events.length === 0 ? (
        <div className="relative">
          <EventsPerformanceEmptyState />
        </div>
      ) : (
        <>
          <div className="relative w-full min-w-0 overflow-x-auto">
            <table className="w-full min-w-[1580px] border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#050c10]">
                  <TableHeader>Événement</TableHeader>
                  <TableHeader>Statut et date</TableHeader>
                  <TableHeader>Remplissage</TableHeader>
                  <TableHeader>Ventes</TableHeader>
                  <TableHeader>Revenu brut</TableHeader>
                  <TableHeader>Commissions</TableHeader>
                  <TableHeader>Revenu net</TableHeader>
                  <TableHeader>Présence</TableHeader>
                  <TableHeader align="right">Action</TableHeader>
                </tr>
              </thead>

              <tbody>
                {events.map((event) => (
                  <EventPerformanceRow
                    key={event.id}
                    event={event}
                    displayCurrency={displayCurrency}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="relative grid w-full min-w-0 gap-3 border-t border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4 xl:px-6">
            <FooterMetric
              icon={CircleDollarSign}
              label="Chiffre d’affaires total"
              value={formatMoney(
                totalGrossRevenue,
                fallbackCurrency,
              )}
              description="Somme brute générée par les événements"
              tone="lime"
            />

            <FooterMetric
              icon={Banknote}
              label="Revenu net total"
              value={formatMoney(
                totalNetRevenue,
                fallbackCurrency,
              )}
              description="Montant net organisateur"
              tone="green"
            />

            <FooterMetric
              icon={TicketCheck}
              label="Billets vendus"
              value={formatNumber(totalTicketsSold)}
              description="Billets valides ou utilisés"
              tone="orange"
            />

            <FooterMetric
              icon={UsersRound}
              label="Participants uniques"
              value={formatNumber(totalParticipants)}
              description="Participants comptabilisés"
              tone="blue"
            />
          </div>
        </>
      )}
    </section>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: string;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function HeaderMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  tone:
    | "neutral"
    | "orange"
    | "blue"
    | "green";
}) {
  const styles = {
    neutral:
      "border-white/[0.08] bg-white/[0.025] text-neutral-300",
    orange:
      "border-orange-500/20 bg-orange-500/[0.055] text-orange-300",
    blue:
      "border-sky-500/20 bg-sky-500/[0.055] text-sky-300",
    green:
      "border-emerald-500/20 bg-emerald-500/[0.055] text-emerald-300",
  }[tone];

  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 ${styles}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />

      <div className="min-w-0">
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">
          {label}
        </p>

        <p className="mt-1 truncate text-xs font-black">
          {value}
        </p>
      </div>
    </div>
  );
}

function FooterMetric({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  description: string;
  tone:
    | "lime"
    | "green"
    | "orange"
    | "blue";
}) {
  const styles = {
    lime:
      "border-lime-500/20 bg-lime-500/[0.055] text-lime-300",
    green:
      "border-emerald-500/20 bg-emerald-500/[0.055] text-emerald-300",
    orange:
      "border-orange-500/20 bg-orange-500/[0.055] text-orange-300",
    blue:
      "border-sky-500/20 bg-sky-500/[0.055] text-sky-300",
  }[tone];

  return (
    <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.11em] text-neutral-600">
          {label}
        </p>

        <p className="mt-1 truncate text-base font-black text-white">
          {value}
        </p>

        <p className="mt-1 truncate text-[10px] text-neutral-600">
          {description}
        </p>
      </div>
    </article>
  );
}