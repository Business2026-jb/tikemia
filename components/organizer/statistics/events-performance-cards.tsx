import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  ExternalLink,
  MapPin,
  ReceiptText,
  ScanLine,
  TicketCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

import type {
  OrganizerStatisticsData,
  StatisticsEventPerformance,
} from "@/lib/organizer/get-organizer-statistics";

type EventsPerformanceCardsProps = {
  events: OrganizerStatisticsData["eventPerformance"];
  displayCurrency?: OrganizerStatisticsData["currency"];
};

type EventStatusPresentation = {
  label: string;
  className: string;
  dotClassName: string;
};

type MetricTone =
  | "green"
  | "lime"
  | "orange"
  | "blue"
  | "violet"
  | "neutral";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0)} %`;
}

function formatMoney(value: number, currency: string): string {
  const safeValue = Number.isFinite(value) ? value : 0;

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "XOF" || currency === "XAF" ? 0 : 2,
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

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}

function getEventStatusPresentation(
  status: StatisticsEventPerformance["status"],
): EventStatusPresentation {
  switch (status) {
    case "PENDING":
      return {
        label: "En attente",
        className:
          "border-amber-500/25 bg-amber-500/10 text-amber-300",
        dotClassName: "bg-amber-400",
      };
    case "DRAFT":
      return {
        label: "Brouillon",
        className:
          "border-neutral-500/25 bg-neutral-500/10 text-neutral-300",
        dotClassName: "bg-neutral-400",
      };
    case "PUBLISHED":
      return {
        label: "Publié",
        className:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
        dotClassName: "bg-emerald-400",
      };
    case "SUSPENDED":
      return {
        label: "Suspendu",
        className:
          "border-orange-500/25 bg-orange-500/10 text-orange-300",
        dotClassName: "bg-orange-400",
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

function getPerformanceStyles(value: number) {
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

function EventCover({ event }: { event: StatisticsEventPerformance }) {
  if (event.coverImage) {
    return (
      <img
        src={event.coverImage}
        alt=""
        className="h-16 w-16 shrink-0 rounded-2xl object-cover sm:h-20 sm:w-20"
      />
    );
  }

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025] sm:h-20 sm:w-20">
      <CalendarDays className="h-6 w-6 text-neutral-600" />
    </div>
  );
}

function PerformanceProgress({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  const safeValue = clampPercentage(value);
  const styles = getPerformanceStyles(safeValue);

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
          {label}
        </span>
        <strong className={`shrink-0 text-xs font-black ${styles.textClassName}`}>
          {formatPercentage(safeValue)}
        </strong>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.055]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${styles.progressClassName}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>

      <p className="mt-1.5 truncate text-[10px] text-neutral-600">
        {detail}
      </p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
}) {
  const styles: Record<MetricTone, string> = {
    green:
      "border-emerald-500/18 bg-emerald-500/[0.045] text-emerald-300",
    lime:
      "border-lime-500/18 bg-lime-500/[0.045] text-lime-300",
    orange:
      "border-orange-500/18 bg-orange-500/[0.045] text-orange-300",
    blue:
      "border-sky-500/18 bg-sky-500/[0.045] text-sky-300",
    violet:
      "border-violet-500/18 bg-violet-500/[0.045] text-violet-300",
    neutral:
      "border-white/[0.07] bg-white/[0.018] text-neutral-300",
  };

  return (
    <article className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 ${styles[tone]}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-[#071014]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-600">
          {label}
        </p>
        <p className="mt-1 truncate text-sm font-black">{value}</p>
        <p className="mt-1 truncate text-[9px] text-neutral-600">{detail}</p>
      </div>
    </article>
  );
}

function EventPerformanceCard({
  event,
  displayCurrency,
}: {
  event: StatisticsEventPerformance;
  displayCurrency?: string;
}) {
  const status = getEventStatusPresentation(event.status);
  const moneyCurrency = displayCurrency ?? event.currency;

  return (
    <article className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014] shadow-[0_18px_55px_rgba(0,0,0,0.16)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(132,204,22,0.045),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.03),transparent_30%)]" />

      <div className="relative border-b border-white/[0.07] p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <EventCover event={event} />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Link
                  href={`/organizer/events/${event.id}`}
                  className="inline-flex max-w-full items-center gap-1.5 text-base font-black text-white transition hover:text-emerald-300"
                >
                  <span className="truncate">{event.title}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </Link>
                <p className="mt-1 truncate text-xs font-bold text-orange-300">
                  {event.categoryName}
                </p>
              </div>

              <span className={`inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold ${status.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dotClassName}`} />
                {status.label}
              </span>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                <span className="truncate text-[11px] text-neutral-500">
                  {formatDateTime(event.startsAt)}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                <span className="truncate text-[11px] text-neutral-500">
                  {[event.venueName, event.city, event.country]
                    .filter(Boolean)
                    .join(", ") || "Lieu non renseigné"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative grid min-w-0 gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <Metric
          icon={TicketCheck}
          label="Billets vendus"
          value={formatNumber(event.ticketsSold)}
          detail={`${formatNumber(event.remainingPlaces)} places restantes`}
          tone="orange"
        />
        <Metric
          icon={UsersRound}
          label="Participants"
          value={formatNumber(event.participants)}
          detail={`${formatNumber(event.checkedInParticipants)} entrées validées`}
          tone="blue"
        />
        <Metric
          icon={CircleDollarSign}
          label="Revenu brut"
          value={formatMoney(event.grossRevenue, moneyCurrency)}
          detail={`${formatNumber(event.paidOrders)} commandes payées`}
          tone="lime"
        />
        <Metric
          icon={Banknote}
          label="Revenu net"
          value={formatMoney(event.netRevenue, moneyCurrency)}
          detail={`Panier moyen : ${formatMoney(event.averageOrderValue, moneyCurrency)}`}
          tone="green"
        />
      </div>

      <div className="relative space-y-4 border-t border-white/[0.07] px-4 py-4 sm:px-5">
        <PerformanceProgress
          label="Taux de remplissage"
          value={event.occupancyRate}
          detail={`${formatNumber(event.ticketsSold)} billets sur ${formatNumber(event.capacity)} places`}
        />
        <PerformanceProgress
          label="Taux de présence"
          value={event.attendanceRate}
          detail={`${formatNumber(event.checkedInParticipants)} entrées validées`}
        />
      </div>

      <div className="relative grid min-w-0 gap-2 border-t border-white/[0.07] bg-[#050c10] p-4 sm:grid-cols-3">
        <Metric
          icon={ReceiptText}
          label="Commission"
          value={formatMoney(event.platformFees, moneyCurrency)}
          detail="Frais Tikemia"
          tone="orange"
        />
        <Metric
          icon={ScanLine}
          label="Présence"
          value={formatPercentage(event.attendanceRate)}
          detail="Taux de contrôle"
          tone="blue"
        />
        <Link
          href={`/organizer/events/${event.id}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/15"
        >
          Voir les détails
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[340px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-[#071014] px-5 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <TrendingUp className="h-7 w-7 text-neutral-600" />
      </div>
      <h3 className="mt-5 text-lg font-black text-white">
        Aucune performance disponible
      </h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        Les performances apparaîtront ici dès qu’une commande payée ou un billet sera enregistré.
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

export default function EventsPerformanceCards({
  events,
  displayCurrency,
}: EventsPerformanceCardsProps) {
  const totalTickets = events.reduce(
    (sum, event) => sum + (Number.isFinite(event.ticketsSold) ? event.ticketsSold : 0),
    0,
  );
  const totalParticipants = events.reduce(
    (sum, event) => sum + (Number.isFinite(event.participants) ? event.participants : 0),
    0,
  );
  const totalNetRevenue = events.reduce(
    (sum, event) => sum + (Number.isFinite(event.netRevenue) ? event.netRevenue : 0),
    0,
  );
  const fallbackCurrency = displayCurrency ?? events[0]?.currency ?? "XOF";

  return (
    <section className="w-full min-w-0 lg:hidden">
      <div className="mb-4 flex w-full min-w-0 flex-col gap-4 rounded-2xl border border-white/[0.075] bg-[#071014] p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/[0.08]">
            <TrendingUp className="h-4 w-4 text-sky-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-black text-white">
              Performance des événements
            </h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Vue adaptée aux mobiles et tablettes.
            </p>
          </div>
        </div>

        <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryMetric label="Événements" value={formatNumber(events.length)} tone="neutral" />
          <SummaryMetric label="Billets" value={formatNumber(totalTickets)} tone="orange" />
          <SummaryMetric label="Participants" value={formatNumber(totalParticipants)} tone="blue" />
          <SummaryMetric label="Revenu net" value={formatMoney(totalNetRevenue, fallbackCurrency)} tone="green" />
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid w-full min-w-0 gap-4 md:grid-cols-2">
          {events.map((event) => (
            <EventPerformanceCard
              key={event.id}
              event={event}
              displayCurrency={displayCurrency}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "orange" | "blue" | "green";
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
    <article className={`min-w-0 rounded-xl border px-3 py-3 ${styles}`}>
      <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">
        {label}
      </p>
      <p className="mt-1.5 truncate text-sm font-black">{value}</p>
    </article>
  );
}