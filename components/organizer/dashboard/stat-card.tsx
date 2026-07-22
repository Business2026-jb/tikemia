import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Minus,
} from "lucide-react";

type StatCardTone =
  | "green"
  | "orange"
  | "blue"
  | "purple"
  | "yellow";

type StatTrendDirection = "up" | "down" | "stable";

type OrganizerStatCardProps = {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  tone?: StatCardTone;
  trend?: {
    direction: StatTrendDirection;
    percentage: number | null;
    label?: string;
  };
  miniChart?: number[];
};

const toneStyles: Record<
  StatCardTone,
  {
    iconWrapper: string;
    icon: string;
    glow: string;
    line: string;
    point: string;
  }
> = {
  green: {
    iconWrapper:
      "border-emerald-500/25 bg-emerald-500/10",
    icon: "text-lime-400",
    glow: "bg-emerald-500/10",
    line: "bg-gradient-to-r from-emerald-500 via-lime-400 to-green-300",
    point: "bg-lime-400",
  },
  orange: {
    iconWrapper:
      "border-orange-500/25 bg-orange-500/10",
    icon: "text-orange-400",
    glow: "bg-orange-500/10",
    line: "bg-gradient-to-r from-orange-600 via-orange-400 to-amber-300",
    point: "bg-orange-400",
  },
  blue: {
    iconWrapper:
      "border-sky-500/25 bg-sky-500/10",
    icon: "text-sky-400",
    glow: "bg-sky-500/10",
    line: "bg-gradient-to-r from-sky-600 via-sky-400 to-cyan-300",
    point: "bg-sky-400",
  },
  purple: {
    iconWrapper:
      "border-violet-500/25 bg-violet-500/10",
    icon: "text-violet-400",
    glow: "bg-violet-500/10",
    line: "bg-gradient-to-r from-violet-600 via-violet-400 to-fuchsia-300",
    point: "bg-violet-400",
  },
  yellow: {
    iconWrapper:
      "border-amber-500/25 bg-amber-500/10",
    icon: "text-amber-400",
    glow: "bg-amber-500/10",
    line: "bg-gradient-to-r from-yellow-500 via-amber-400 to-orange-300",
    point: "bg-amber-400",
  },
};

function formatTrendPercentage(
  percentage: number | null,
): string {
  if (percentage === null) {
    return "Nouveau";
  }

  const absoluteValue = Math.abs(percentage);

  return `${absoluteValue.toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  })}%`;
}

function TrendIcon({
  direction,
}: {
  direction: StatTrendDirection;
}) {
  if (direction === "up") {
    return <ArrowUpRight className="h-4 w-4" />;
  }

  if (direction === "down") {
    return <ArrowDownRight className="h-4 w-4" />;
  }

  return <Minus className="h-4 w-4" />;
}

function MiniChart({
  values,
  tone,
}: {
  values: number[];
  tone: StatCardTone;
}) {
  const safeValues =
    values.length >= 2 ? values : [0, 0, 0, 0, 0, 0];

  const minimum = Math.min(...safeValues);
  const maximum = Math.max(...safeValues);
  const range = maximum - minimum || 1;

  const points = safeValues.map((value, index) => {
    const x =
      safeValues.length === 1
        ? 50
        : (index / (safeValues.length - 1)) * 100;

    const normalizedValue = (value - minimum) / range;
    const y = 88 - normalizedValue * 68;

    return `${x},${y}`;
  });

  const lastPoint = points.at(-1)?.split(",") ?? ["100", "50"];

  return (
    <div
      aria-hidden="true"
      className="relative h-12 w-[92px] shrink-0 overflow-hidden"
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          className={toneStyles[tone].icon}
        />

        <circle
          cx={lastPoint[0]}
          cy={lastPoint[1]}
          r="3.5"
          className={toneStyles[tone].point}
        />
      </svg>

      <div
        className={`absolute inset-x-0 bottom-0 h-4 rounded-full opacity-20 blur-md ${toneStyles[tone].glow}`}
      />
    </div>
  );
}

export default function OrganizerStatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "green",
  trend,
  miniChart,
}: OrganizerStatCardProps) {
  const styles = toneStyles[tone];

  const trendTextColor =
    trend?.direction === "up"
      ? "text-lime-400"
      : trend?.direction === "down"
        ? "text-red-400"
        : "text-neutral-500";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.13] sm:p-5">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-60 blur-3xl ${styles.glow}`}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${styles.iconWrapper}`}
            >
              <Icon className={`h-5 w-5 ${styles.icon}`} />
            </div>

            <p className="min-w-0 truncate text-sm font-semibold text-neutral-300">
              {title}
            </p>
          </div>

          <p className="mt-4 break-words text-[26px] font-black leading-none tracking-[-0.035em] text-white sm:text-[30px]">
            {value}
          </p>
        </div>

        {miniChart && miniChart.length > 0 ? (
          <MiniChart values={miniChart} tone={tone} />
        ) : (
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-neutral-700 transition group-hover:translate-x-0.5 group-hover:text-neutral-500" />
        )}
      </div>

      <div className="relative mt-5 flex min-h-6 items-center justify-between gap-3">
        {trend ? (
          <div
            className={`flex min-w-0 items-center gap-1.5 text-xs font-semibold ${trendTextColor}`}
          >
            <TrendIcon direction={trend.direction} />

            <span>
              {trend.direction === "up" && "+"}
              {trend.direction === "down" && "-"}
              {formatTrendPercentage(trend.percentage)}
            </span>

            <span className="truncate font-normal text-neutral-500">
              {trend.label ?? "sur la période précédente"}
            </span>
          </div>
        ) : description ? (
          <p className="truncate text-xs text-neutral-500">
            {description}
          </p>
        ) : (
          <span className="text-xs text-neutral-600">
            Données actualisées
          </span>
        )}
      </div>

      <div className="absolute inset-x-5 bottom-0 h-px overflow-hidden">
        <div
          className={`h-full w-0 transition-all duration-500 group-hover:w-full ${styles.line}`}
        />
      </div>
    </article>
  );
}