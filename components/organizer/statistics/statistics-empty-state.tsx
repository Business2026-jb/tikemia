import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  LineChart,
  Plus,
  RefreshCcw,
  Sparkles,
  TicketCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type {
  ComponentType,
  ReactNode,
} from "react";

type StatisticsEmptyStateProps = {
  title?: string;
  description?: string;
  eventCount?: number;
  hasActiveFilters?: boolean;
  createEventHref?: string;
  eventsHref?: string;
  resetHref?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
};

type PreviewTone =
  | "green"
  | "orange"
  | "blue"
  | "violet";

type PreviewItem = {
  key: string;
  label: string;
  description: string;
  icon: ComponentType<{
    className?: string;
  }>;
  tone: PreviewTone;
};

const PREVIEW_ITEMS: PreviewItem[] = [
  {
    key: "revenue",
    label: "Revenus",
    description:
      "Chiffre d’affaires brut, commissions et revenu net.",
    icon: CircleDollarSign,
    tone: "green",
  },
  {
    key: "tickets",
    label: "Billets",
    description:
      "Billets vendus, utilisés, annulés et remboursés.",
    icon: TicketCheck,
    tone: "orange",
  },
  {
    key: "participants",
    label: "Participants",
    description:
      "Participants uniques, attendus et entrées validées.",
    icon: UsersRound,
    tone: "blue",
  },
  {
    key: "payments",
    label: "Paiements",
    description:
      "Méthodes utilisées, réussites, échecs et remboursements.",
    icon: CreditCard,
    tone: "violet",
  },
];

const PREVIEW_TONES: Record<
  PreviewTone,
  {
    wrapper: string;
    iconBox: string;
    icon: string;
  }
> = {
  green: {
    wrapper:
      "border-emerald-500/18 bg-emerald-500/[0.04]",
    iconBox:
      "border-emerald-500/22 bg-emerald-500/[0.08]",
    icon: "text-emerald-300",
  },

  orange: {
    wrapper:
      "border-orange-500/18 bg-orange-500/[0.04]",
    iconBox:
      "border-orange-500/22 bg-orange-500/[0.08]",
    icon: "text-orange-300",
  },

  blue: {
    wrapper:
      "border-sky-500/18 bg-sky-500/[0.04]",
    iconBox:
      "border-sky-500/22 bg-sky-500/[0.08]",
    icon: "text-sky-300",
  },

  violet: {
    wrapper:
      "border-violet-500/18 bg-violet-500/[0.04]",
    iconBox:
      "border-violet-500/22 bg-violet-500/[0.08]",
    icon: "text-violet-300",
  },
};

function safeCount(value: number | undefined): number {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    Math.trunc(value),
    0,
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(safeCount(value));
}

function PreviewCard({
  item,
}: {
  item: PreviewItem;
}) {
  const Icon = item.icon;
  const styles =
    PREVIEW_TONES[item.tone];

  return (
    <article
      className={`flex min-w-0 items-start gap-3 rounded-2xl border p-4 ${styles.wrapper}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.iconBox}`}
      >
        <Icon
          className={`h-4 w-4 ${styles.icon}`}
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0">
        <h3 className="text-sm font-black text-white">
          {item.label}
        </h3>

        <p className="mt-1 text-[11px] leading-5 text-neutral-500">
          {item.description}
        </p>
      </div>
    </article>
  );
}

function DefaultPrimaryAction({
  href,
}: {
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.1] px-5 text-sm font-black text-emerald-300 transition hover:border-emerald-400/45 hover:bg-emerald-500/[0.16] sm:w-auto"
    >
      <Plus className="h-4 w-4" />
      Créer un événement
    </Link>
  );
}

function DefaultSecondaryAction({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: ComponentType<{
    className?: string;
  }>;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-sm font-bold text-neutral-300 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white sm:w-auto"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export default function StatisticsEmptyState({
  title,
  description,
  eventCount,
  hasActiveFilters = false,
  createEventHref =
    "/organizer/events/create",
  eventsHref =
    "/organizer/events",
  resetHref =
    "/organizer/statistics",
  primaryAction,
  secondaryAction,
}: StatisticsEmptyStateProps) {
  const normalizedEventCount =
    safeCount(eventCount);

  const hasEvents =
    normalizedEventCount > 0;

  const resolvedTitle =
    title ??
    (
      hasActiveFilters
        ? "Aucune donnée pour ces filtres"
        : hasEvents
          ? "Aucune activité statistique"
          : "Vos statistiques commenceront ici"
    );

  const resolvedDescription =
    description ??
    (
      hasActiveFilters
        ? "La période, l’événement ou la devise sélectionnée ne contient aucune vente exploitable. Réinitialisez les filtres ou choisissez une autre période."
        : hasEvents
          ? "Vos événements existent déjà, mais aucune commande payée ou aucun billet valide n’a encore été enregistré sur la période sélectionnée."
          : "Créez et publiez votre premier événement. Les ventes, revenus, participants et performances seront ensuite calculés automatiquement."
    );

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.06),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.04),transparent_30%)]" />

      <div className="relative grid min-h-[580px] w-full min-w-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <div className="flex min-w-0 flex-col justify-center px-4 py-10 sm:px-6 sm:py-12 lg:px-8 xl:px-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] shadow-[0_20px_60px_rgba(16,185,129,0.08)]">
            {hasActiveFilters ? (
              <RefreshCcw className="h-7 w-7 text-emerald-300" />
            ) : (
              <BarChart3 className="h-7 w-7 text-emerald-300" />
            )}
          </div>

          <div className="mt-6 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1 text-[10px] font-bold text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                Centre d’analyse Tikemia
              </span>

              {hasEvents && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/[0.07] px-3 py-1 text-[10px] font-bold text-sky-300">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatNumber(
                    normalizedEventCount,
                  )}{" "}
                  événement
                  {normalizedEventCount > 1
                    ? "s"
                    : ""}
                </span>
              )}
            </div>

            <h2 className="mt-5 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
              {resolvedTitle}
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-500 sm:text-base">
              {resolvedDescription}
            </p>
          </div>

          <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
            {primaryAction ??
              (
                hasActiveFilters
                  ? (
                      <DefaultPrimaryActionForReset
                        href={resetHref}
                      />
                    )
                  : (
                      <DefaultPrimaryAction
                        href={createEventHref}
                      />
                    )
              )}

            {secondaryAction ??
              (
                hasActiveFilters
                  ? (
                      <DefaultSecondaryAction
                        href={eventsHref}
                        label="Voir mes événements"
                        icon={CalendarDays}
                      />
                    )
                  : hasEvents
                    ? (
                        <DefaultSecondaryAction
                          href={eventsHref}
                          label="Gérer mes événements"
                          icon={CalendarDays}
                        />
                      )
                    : (
                        <DefaultSecondaryAction
                          href={eventsHref}
                          label="Voir les événements"
                          icon={CalendarDays}
                        />
                      )
              )}
          </div>

          <div className="mt-8 grid w-full min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PREVIEW_ITEMS.map((item) => (
              <PreviewCard
                key={item.key}
                item={item}
              />
            ))}
          </div>
        </div>

        <div className="relative min-w-0 border-t border-white/[0.07] bg-[#050c10] p-4 sm:p-6 lg:border-l lg:border-t-0 xl:p-8">
          <div className="flex h-full min-h-[420px] flex-col justify-center">
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#071014] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.28)] sm:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.07),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(132,204,22,0.05),transparent_34%)]" />

              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-600">
                      Aperçu du tableau de bord
                    </p>

                    <p className="mt-1 text-sm font-black text-white">
                      Statistiques en temps réel
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/[0.08]">
                    <LineChart className="h-4 w-4 text-violet-300" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <MockMetric
                    label="Revenu net"
                    icon={CircleDollarSign}
                    tone="green"
                  />

                  <MockMetric
                    label="Billets vendus"
                    icon={TicketCheck}
                    tone="orange"
                  />

                  <MockMetric
                    label="Participants"
                    icon={UsersRound}
                    tone="blue"
                  />

                  <MockMetric
                    label="Paiements"
                    icon={CreditCard}
                    tone="violet"
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-white/[0.07] bg-[#050c10] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-white">
                      Évolution des ventes
                    </p>

                    <span className="text-[10px] font-semibold text-neutral-600">
                      Données futures
                    </span>
                  </div>

                  <div className="mt-5 flex h-32 items-end gap-2">
                    {[36, 58, 44, 72, 54, 82, 68, 90, 74, 96].map(
                      (height, index) => (
                        <div
                          key={`${height}-${index}`}
                          className="flex h-full min-w-0 flex-1 items-end"
                        >
                          <div
                            className="w-full rounded-t-md bg-gradient-to-t from-emerald-500/40 via-lime-400/45 to-orange-400/55"
                            style={{
                              height: `${height}%`,
                            }}
                          />
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.035] p-4">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />

                  <p className="text-[11px] leading-5 text-neutral-500">
                    Les données apparaissent automatiquement après les premières commandes payées et les premiers billets émis.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.015] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                  Prochaine étape
                </p>

                <p className="mt-1 truncate text-xs font-bold text-white">
                  {hasActiveFilters
                    ? "Réinitialiser les filtres"
                    : hasEvents
                      ? "Obtenir les premières ventes"
                      : "Créer le premier événement"}
                </p>
              </div>

              <ArrowRight className="h-4 w-4 shrink-0 text-neutral-500" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DefaultPrimaryActionForReset({
  href,
}: {
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.1] px-5 text-sm font-black text-emerald-300 transition hover:border-emerald-400/45 hover:bg-emerald-500/[0.16] sm:w-auto"
    >
      <RefreshCcw className="h-4 w-4" />
      Réinitialiser les filtres
    </Link>
  );
}

function MockMetric({
  label,
  icon: Icon,
  tone,
}: {
  label: string;
  icon: ComponentType<{
    className?: string;
  }>;
  tone:
    | "green"
    | "orange"
    | "blue"
    | "violet";
}) {
  const styles = {
    green:
      "border-emerald-500/18 bg-emerald-500/[0.04] text-emerald-300",
    orange:
      "border-orange-500/18 bg-orange-500/[0.04] text-orange-300",
    blue:
      "border-sky-500/18 bg-sky-500/[0.04] text-sky-300",
    violet:
      "border-violet-500/18 bg-violet-500/[0.04] text-violet-300",
  }[tone];

  return (
    <div
      className={`min-w-0 rounded-2xl border p-3 ${styles}`}
    >
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-4 w-4 shrink-0" />

        <span className="h-2 w-10 rounded-full bg-current opacity-20" />
      </div>

      <p className="mt-4 truncate text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">
        {label}
      </p>

      <div className="mt-2 h-5 w-20 max-w-full rounded-md bg-current opacity-15" />
    </div>
  );
}