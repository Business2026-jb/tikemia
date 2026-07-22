"use client";

import {
  Activity,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  ScanLine,
  TicketCheck,
  TicketX,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UsersRound,
} from "lucide-react";
import type { ComponentType } from "react";

import type {
  OrganizerStatisticsData,
  StatisticsTrend,
} from "@/lib/organizer/get-organizer-statistics";

type AttendancePerformanceProps = {
  summary: OrganizerStatisticsData["summary"];
  trend?: StatisticsTrend;
  title?: string;
  description?: string;
};

type AttendanceTone =
  | "green"
  | "orange"
  | "blue"
  | "violet"
  | "red"
  | "neutral";

type AttendanceMetric = {
  key: string;
  label: string;
  value: number;
  description: string;
  icon: ComponentType<{
    className?: string;
  }>;
  tone: AttendanceTone;
};

const TONE_STYLES: Record<
  AttendanceTone,
  {
    wrapper: string;
    iconBox: string;
    icon: string;
    value: string;
    progress: string;
  }
> = {
  green: {
    wrapper:
      "border-emerald-500/18 bg-emerald-500/[0.045]",
    iconBox:
      "border-emerald-500/22 bg-emerald-500/[0.08]",
    icon: "text-emerald-300",
    value: "text-emerald-300",
    progress:
      "bg-gradient-to-r from-emerald-500 to-lime-400",
  },

  orange: {
    wrapper:
      "border-orange-500/18 bg-orange-500/[0.045]",
    iconBox:
      "border-orange-500/22 bg-orange-500/[0.08]",
    icon: "text-orange-300",
    value: "text-orange-300",
    progress:
      "bg-gradient-to-r from-orange-500 to-amber-400",
  },

  blue: {
    wrapper:
      "border-sky-500/18 bg-sky-500/[0.045]",
    iconBox:
      "border-sky-500/22 bg-sky-500/[0.08]",
    icon: "text-sky-300",
    value: "text-sky-300",
    progress:
      "bg-gradient-to-r from-sky-500 to-cyan-400",
  },

  violet: {
    wrapper:
      "border-violet-500/18 bg-violet-500/[0.045]",
    iconBox:
      "border-violet-500/22 bg-violet-500/[0.08]",
    icon: "text-violet-300",
    value: "text-violet-300",
    progress:
      "bg-gradient-to-r from-violet-500 to-fuchsia-400",
  },

  red: {
    wrapper:
      "border-red-500/18 bg-red-500/[0.045]",
    iconBox:
      "border-red-500/22 bg-red-500/[0.08]",
    icon: "text-red-300",
    value: "text-red-300",
    progress:
      "bg-gradient-to-r from-red-500 to-rose-400",
  },

  neutral: {
    wrapper:
      "border-white/[0.07] bg-white/[0.018]",
    iconBox:
      "border-white/[0.08] bg-white/[0.025]",
    icon: "text-neutral-400",
    value: "text-white",
    progress:
      "bg-gradient-to-r from-neutral-500 to-neutral-300",
  },
};

function safeNumber(value: number): number {
  return Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(
    Math.max(value, 0),
    100,
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
}

function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(clampPercentage(value))} %`;
}

function calculatePercentage(
  value: number,
  total: number,
): number {
  const safeValue = safeNumber(value);
  const safeTotal = safeNumber(total);

  if (safeTotal <= 0) {
    return 0;
  }

  return clampPercentage(
    (safeValue / safeTotal) * 100,
  );
}

function getAttendanceQuality(rate: number): {
  label: string;
  description: string;
  className: string;
} {
  const safeRate = clampPercentage(rate);

  if (safeRate >= 90) {
    return {
      label: "Excellente présence",
      description:
        "La quasi-totalité des participants attendus s’est présentée.",
      className:
        "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300",
    };
  }

  if (safeRate >= 75) {
    return {
      label: "Très bonne présence",
      description:
        "La fréquentation est solide sur la période sélectionnée.",
      className:
        "border-lime-500/25 bg-lime-500/[0.08] text-lime-300",
    };
  }

  if (safeRate >= 50) {
    return {
      label: "Présence moyenne",
      description:
        "Une partie importante des détenteurs de billets reste à accueillir.",
      className:
        "border-amber-500/25 bg-amber-500/[0.08] text-amber-300",
    };
  }

  if (safeRate > 0) {
    return {
      label: "Présence faible",
      description:
        "Le taux de contrôle est faible par rapport aux participants attendus.",
      className:
        "border-red-500/25 bg-red-500/[0.08] text-red-300",
    };
  }

  return {
    label: "Aucune entrée enregistrée",
    description:
      "Les premières entrées validées apparaîtront ici dès le début des contrôles.",
    className:
      "border-white/[0.09] bg-white/[0.025] text-neutral-400",
  };
}

function TrendBadge({
  trend,
}: {
  trend?: StatisticsTrend;
}) {
  if (!trend) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-bold text-neutral-500">
        <Activity className="h-3 w-3" />
        Période actuelle
      </span>
    );
  }

  const isUp = trend.direction === "up";
  const isDown = trend.direction === "down";

  const Icon = isUp
    ? TrendingUp
    : isDown
      ? TrendingDown
      : Activity;

  const percentage =
    trend.percentage === null
      ? null
      : Math.abs(trend.percentage);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
        isUp
          ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300"
          : isDown
            ? "border-red-500/20 bg-red-500/[0.08] text-red-300"
            : "border-white/[0.08] bg-white/[0.025] text-neutral-400"
      }`}
    >
      <Icon className="h-3 w-3" />

      {percentage === null
        ? "Nouvelle activité"
        : trend.direction === "stable"
          ? "Stable"
          : `${new Intl.NumberFormat("fr-FR", {
              maximumFractionDigits: 1,
            }).format(percentage)} %`}
    </span>
  );
}

function AttendanceMetricCard({
  metric,
  total,
}: {
  metric: AttendanceMetric;
  total: number;
}) {
  const styles = TONE_STYLES[metric.tone];
  const Icon = metric.icon;
  const percentage = calculatePercentage(
    metric.value,
    total,
  );

  return (
    <article
      className={`min-w-0 rounded-2xl border p-4 ${styles.wrapper}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.iconBox}`}
        >
          <Icon
            className={`h-4 w-4 ${styles.icon}`}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                {metric.label}
              </p>

              <p
                className={`mt-1.5 text-xl font-black ${styles.value}`}
              >
                {formatNumber(metric.value)}
              </p>
            </div>

            <span className="shrink-0 text-[10px] font-bold text-neutral-600">
              {formatPercentage(percentage)}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-neutral-600">
            {metric.description}
          </p>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
            <div
              className={`h-full rounded-full ${styles.progress}`}
              style={{
                width: `${percentage}%`,
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function DistributionRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: AttendanceTone;
}) {
  const styles = TONE_STYLES[tone];
  const percentage = calculatePercentage(
    value,
    total,
  );

  return (
    <div className="min-w-0 rounded-xl border border-white/[0.065] bg-white/[0.015] px-3 py-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="truncate text-[11px] font-semibold text-neutral-400">
          {label}
        </span>

        <div className="flex shrink-0 items-center gap-2">
          <strong
            className={`text-xs font-black ${styles.value}`}
          >
            {formatNumber(value)}
          </strong>

          <span className="text-[10px] text-neutral-600">
            {formatPercentage(percentage)}
          </span>
        </div>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={`h-full rounded-full ${styles.progress}`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

function EmptyAttendanceState() {
  return (
    <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.012] px-5 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <ScanLine className="h-7 w-7 text-neutral-600" />
      </div>

      <h3 className="mt-5 text-lg font-black text-white">
        Aucune donnée de présence
      </h3>

      <p className="mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        Les taux de présence et les entrées validées apparaîtront ici dès que
        des billets valides ou utilisés seront disponibles.
      </p>
    </div>
  );
}

export default function AttendancePerformance({
  summary,
  trend,
  title = "Performance de présence",
  description =
    "Suivez les participants attendus, les entrées validées et la qualité du contrôle d’accès.",
}: AttendancePerformanceProps) {
  const checkedInParticipants = safeNumber(
    summary.checkedInParticipants,
  );

  const expectedParticipants = safeNumber(
    summary.expectedParticipants,
  );

  const participants = safeNumber(
    summary.participants,
  );

  const validTickets = safeNumber(
    summary.validTickets,
  );

  const usedTickets = safeNumber(
    summary.usedTickets,
  );

  const cancelledTickets = safeNumber(
    summary.cancelledTickets,
  );

  const refundedTickets = safeNumber(
    summary.refundedTickets,
  );

  const attendanceBase =
    checkedInParticipants +
    expectedParticipants;

  const attendanceRate = clampPercentage(
    summary.attendanceRate,
  );

  const absentParticipants = Math.max(
    attendanceBase - checkedInParticipants,
    0,
  );

  const ticketTotal =
    validTickets +
    usedTickets +
    cancelledTickets +
    refundedTickets;

  const quality = getAttendanceQuality(
    attendanceRate,
  );

  const metrics: AttendanceMetric[] = [
    {
      key: "checked-in",
      label: "Entrées validées",
      value: checkedInParticipants,
      description:
        "Participants dont le billet a déjà été contrôlé.",
      icon: ScanLine,
      tone: "green",
    },

    {
      key: "expected",
      label: "Participants attendus",
      value: expectedParticipants,
      description:
        "Billets valides qui n’ont pas encore été utilisés.",
      icon: Clock3,
      tone: "orange",
    },

    {
      key: "unique",
      label: "Participants uniques",
      value: participants,
      description:
        "Détenteurs de billets distincts sur la période.",
      icon: UsersRound,
      tone: "blue",
    },

    {
      key: "absent",
      label: "Non présentés",
      value: absentParticipants,
      description:
        "Participants attendus qui ne sont pas encore entrés.",
      icon: TicketX,
      tone: "red",
    },
  ];

  const hasAttendanceData =
    attendanceBase > 0 ||
    participants > 0 ||
    ticketTotal > 0;

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.055),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.035),transparent_30%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
            <CalendarCheck2 className="h-4 w-4 text-emerald-300" />
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

        <TrendBadge trend={trend} />
      </div>

      {!hasAttendanceData ? (
        <div className="relative p-4 sm:p-5 xl:p-6">
          <EmptyAttendanceState />
        </div>
      ) : (
        <>
          <div className="relative grid w-full min-w-0 gap-5 px-4 py-5 sm:px-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)] xl:px-6 xl:py-6">
            <div className="flex min-w-0 flex-col rounded-2xl border border-white/[0.07] bg-[#050c10] p-4 sm:p-5">
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="relative flex h-52 w-52 items-center justify-center rounded-full sm:h-60 sm:w-60">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(#22c55e 0deg ${
                        attendanceRate * 3.6
                      }deg, rgba(255,255,255,0.06) ${
                        attendanceRate * 3.6
                      }deg 360deg)`,
                    }}
                  />

                  <div className="absolute inset-[18px] rounded-full border border-white/[0.07] bg-[#071014] sm:inset-[22px]" />

                  <div className="relative z-10 max-w-[150px]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-600">
                      Taux de présence
                    </p>

                    <p className="mt-2 text-3xl font-black text-emerald-300 sm:text-4xl">
                      {formatPercentage(attendanceRate)}
                    </p>

                    <p className="mt-2 text-[10px] leading-5 text-neutral-500">
                      {formatNumber(checkedInParticipants)} entrée
                      {checkedInParticipants > 1 ? "s" : ""} validée
                      {checkedInParticipants > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div
                  className={`mt-5 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold ${quality.className}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {quality.label}
                  </span>
                </div>

                <p className="mt-3 max-w-sm text-[11px] leading-5 text-neutral-500">
                  {quality.description}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <SmallValue
                  label="Présents"
                  value={checkedInParticipants}
                  tone="green"
                />

                <SmallValue
                  label="Attendus"
                  value={expectedParticipants}
                  tone="orange"
                />
              </div>
            </div>

            <div className="min-w-0">
              <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2">
                {metrics.map((metric) => (
                  <AttendanceMetricCard
                    key={metric.key}
                    metric={metric}
                    total={Math.max(
                      attendanceBase,
                      participants,
                      1,
                    )}
                  />
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.015] p-4 sm:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/[0.08]">
                    <TicketCheck className="h-4 w-4 text-violet-300" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-white">
                      Répartition des billets
                    </h3>

                    <p className="mt-1 text-[10px] leading-5 text-neutral-600">
                      État des billets associés aux participants.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid w-full min-w-0 gap-3 sm:grid-cols-2">
                  <DistributionRow
                    label="Billets utilisés"
                    value={usedTickets}
                    total={Math.max(ticketTotal, 1)}
                    tone="green"
                  />

                  <DistributionRow
                    label="Billets valides"
                    value={validTickets}
                    total={Math.max(ticketTotal, 1)}
                    tone="blue"
                  />

                  <DistributionRow
                    label="Billets annulés"
                    value={cancelledTickets}
                    total={Math.max(ticketTotal, 1)}
                    tone="red"
                  />

                  <DistributionRow
                    label="Billets remboursés"
                    value={refundedTickets}
                    total={Math.max(ticketTotal, 1)}
                    tone="violet"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="relative grid w-full min-w-0 gap-3 border-t border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4 xl:px-6">
            <FooterMetric
              icon={UserCheck}
              label="Participants présents"
              value={formatNumber(
                checkedInParticipants,
              )}
              description="Entrées déjà validées"
              tone="green"
            />

            <FooterMetric
              icon={Clock3}
              label="Participants attendus"
              value={formatNumber(
                expectedParticipants,
              )}
              description="Billets encore utilisables"
              tone="orange"
            />

            <FooterMetric
              icon={UsersRound}
              label="Participants uniques"
              value={formatNumber(participants)}
              description="Détenteurs distincts"
              tone="blue"
            />

            <FooterMetric
              icon={Activity}
              label="Base de présence"
              value={formatNumber(attendanceBase)}
              description="Présents et attendus"
              tone="neutral"
            />
          </div>
        </>
      )}
    </section>
  );
}

function SmallValue({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "orange";
}) {
  const styles =
    tone === "green"
      ? "border-emerald-500/20 bg-emerald-500/[0.055] text-emerald-300"
      : "border-orange-500/20 bg-orange-500/[0.055] text-orange-300";

  return (
    <div
      className={`min-w-0 rounded-xl border px-3 py-3 ${styles}`}
    >
      <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">
        {label}
      </p>

      <p className="mt-1 text-base font-black">
        {formatNumber(value)}
      </p>
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
  icon: ComponentType<{
    className?: string;
  }>;
  label: string;
  value: string;
  description: string;
  tone:
    | "green"
    | "orange"
    | "blue"
    | "neutral";
}) {
  const styles = {
    green:
      "border-emerald-500/20 bg-emerald-500/[0.055] text-emerald-300",
    orange:
      "border-orange-500/20 bg-orange-500/[0.055] text-orange-300",
    blue:
      "border-sky-500/20 bg-sky-500/[0.055] text-sky-300",
    neutral:
      "border-white/[0.08] bg-white/[0.025] text-neutral-300",
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