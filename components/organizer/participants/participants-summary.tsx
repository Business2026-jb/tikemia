import {
  Ban,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  RefreshCcw,
  ScanLine,
  TicketCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

import type { OrganizerParticipantsSummary } from "@/lib/organizer/get-organizer-participants";

type ParticipantsSummaryProps = {
  summary: OrganizerParticipantsSummary;
};

type SummaryCardProps = {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  tone:
    | "green"
    | "blue"
    | "orange"
    | "violet"
    | "red"
    | "neutral";
  highlight?: boolean;
};

const toneStyles = {
  green: {
    iconContainer:
      "border-emerald-500/25 bg-emerald-500/10",
    icon:
      "text-emerald-400",
    value:
      "text-emerald-300",
    glow:
      "from-emerald-500/10 via-transparent to-transparent",
  },

  blue: {
    iconContainer:
      "border-sky-500/25 bg-sky-500/10",
    icon:
      "text-sky-400",
    value:
      "text-sky-300",
    glow:
      "from-sky-500/10 via-transparent to-transparent",
  },

  orange: {
    iconContainer:
      "border-orange-500/25 bg-orange-500/10",
    icon:
      "text-orange-400",
    value:
      "text-orange-300",
    glow:
      "from-orange-500/10 via-transparent to-transparent",
  },

  violet: {
    iconContainer:
      "border-violet-500/25 bg-violet-500/10",
    icon:
      "text-violet-400",
    value:
      "text-violet-300",
    glow:
      "from-violet-500/10 via-transparent to-transparent",
  },

  red: {
    iconContainer:
      "border-red-500/25 bg-red-500/10",
    icon:
      "text-red-400",
    value:
      "text-red-300",
    glow:
      "from-red-500/10 via-transparent to-transparent",
  },

  neutral: {
    iconContainer:
      "border-white/10 bg-white/[0.045]",
    icon:
      "text-neutral-300",
    value:
      "text-white",
    glow:
      "from-white/[0.035] via-transparent to-transparent",
  },
} as const;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercentage(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
  highlight = false,
}: SummaryCardProps) {
  const styles = toneStyles[tone];

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] ${
        highlight
          ? "border-emerald-500/20 bg-[#09130f]"
          : "border-white/[0.075] bg-[#071014]"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.glow} opacity-80`}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            {title}
          </p>

          <p
            className={`mt-3 truncate text-2xl font-black tracking-tight sm:text-[28px] ${styles.value}`}
          >
            {value}
          </p>

          <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-500">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${styles.iconContainer}`}
        >
          <Icon
            className={`h-5 w-5 ${styles.icon}`}
            aria-hidden="true"
          />
        </div>
      </div>
    </article>
  );
}

function AttendanceProgress({
  checkedIn,
  expected,
  attendanceRate,
}: {
  checkedIn: number;
  expected: number;
  attendanceRate: number;
}) {
  const safeRate = Math.min(
    Math.max(attendanceRate, 0),
    100,
  );

  const totalEligible = checkedIn + expected;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-500/15 bg-[#07110d] p-5">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.08] via-transparent to-lime-500/[0.03]" />

      <div className="relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
                <ScanLine className="h-4 w-4 text-emerald-400" />
              </div>

              <div>
                <h2 className="text-sm font-bold text-white">
                  Taux de présence
                </h2>

                <p className="mt-0.5 text-xs text-neutral-500">
                  Progression des entrées validées
                </p>
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <p className="text-3xl font-black tracking-tight text-emerald-300">
              {formatPercentage(safeRate)}%
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              {formatNumber(checkedIn)} présent
              {checkedIn > 1 ? "s" : ""} sur{" "}
              {formatNumber(totalEligible)}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-400 transition-all duration-500"
              style={{
                width: `${safeRate}%`,
              }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-neutral-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />

              <span>
                {formatNumber(checkedIn)} entrée
                {checkedIn > 1 ? "s" : ""} validée
                {checkedIn > 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex items-center gap-2 text-neutral-500">
              <span className="h-2 w-2 rounded-full bg-orange-400" />

              <span>
                {formatNumber(expected)} participant
                {expected > 1 ? "s" : ""} attendu
                {expected > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ParticipantsSummary({
  summary,
}: ParticipantsSummaryProps) {
  const cards: SummaryCardProps[] = [
    {
      title: "Billets enregistrés",
      value: formatNumber(summary.totalTickets),
      description:
        "Nombre total de billets correspondant aux filtres appliqués.",
      icon: TicketCheck,
      tone: "neutral",
    },

    {
      title: "Participants attendus",
      value: formatNumber(summary.expectedParticipants),
      description:
        "Billets valides qui n’ont pas encore été utilisés à l’entrée.",
      icon: Clock3,
      tone: "orange",
    },

    {
      title: "Présents",
      value: formatNumber(summary.checkedInParticipants),
      description:
        "Participants dont le billet a déjà été validé ou scanné.",
      icon: UserRoundCheck,
      tone: "green",
      highlight: true,
    },

    {
      title: "Non enregistrés",
      value: formatNumber(summary.notCheckedInParticipants),
      description:
        "Participants valides qui ne sont pas encore passés au contrôle.",
      icon: ScanLine,
      tone: "blue",
    },

    {
      title: "Participants uniques",
      value: formatNumber(summary.uniqueParticipants),
      description:
        "Nombre d’adresses e-mail distinctes parmi les détenteurs de billets.",
      icon: UsersRound,
      tone: "violet",
    },

    {
      title: "Achats invités",
      value: formatNumber(summary.guestParticipants),
      description:
        "Participants ayant acheté sans disposer d’un compte Tikemia.",
      icon: CircleUserRound,
      tone: "neutral",
    },

    {
      title: "Comptes enregistrés",
      value: formatNumber(summary.registeredParticipants),
      description:
        "Participants reliés à un compte client Tikemia existant.",
      icon: CheckCircle2,
      tone: "green",
    },

    {
      title: "Billets annulés",
      value: formatNumber(summary.cancelledTickets),
      description:
        "Billets désactivés qui ne peuvent plus être utilisés à l’entrée.",
      icon: Ban,
      tone: "red",
    },

    {
      title: "Billets remboursés",
      value: formatNumber(summary.refundedTickets),
      description:
        "Billets associés à une commande ou une opération remboursée.",
      icon: RefreshCcw,
      tone: "violet",
    },
  ];

  return (
    <div className="space-y-5">
      <AttendanceProgress
        checkedIn={summary.checkedInParticipants}
        expected={summary.expectedParticipants}
        attendanceRate={summary.attendanceRate}
      />

      <section
        aria-label="Résumé des participants"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        {cards.map((card) => (
          <SummaryCard
            key={card.title}
            {...card}
          />
        ))}
      </section>
    </div>
  );
}