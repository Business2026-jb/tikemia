"use client";

import {
  CalendarPlus2,
  FilterX,
  RefreshCcw,
  SearchX,
  TicketCheck,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  useState,
} from "react";

type ParticipantsEmptyStateProps = {
  hasActiveFilters?: boolean;
  eventsCount?: number;
  title?: string;
  description?: string;
};

export default function ParticipantsEmptyState({
  hasActiveFilters = false,
  eventsCount = 0,
  title,
  description,
}: ParticipantsEmptyStateProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const hasEvents =
    eventsCount > 0;

  const resolvedTitle =
    title ??
    (hasActiveFilters
      ? "Aucun participant trouvé"
      : hasEvents
        ? "Aucun participant pour le moment"
        : "Aucun événement disponible");

  const resolvedDescription =
    description ??
    (hasActiveFilters
      ? "Aucun participant ne correspond aux critères actuellement appliqués. Modifiez la recherche ou réinitialisez les filtres."
      : hasEvents
        ? "Les participants apparaîtront ici automatiquement dès qu’un billet sera généré pour une commande confirmée."
        : "Créez et publiez votre premier événement afin de commencer à vendre des billets et recevoir des participants.");

  function handleResetFilters() {
    router.replace(
      pathname,
      {
        scroll:
          false,
      },
    );
  }

  function handleRefresh() {
    setIsRefreshing(
      true,
    );

    router.refresh();

    window.setTimeout(
      () => {
        setIsRefreshing(
          false,
        );
      },
      700,
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.05),transparent_35%)]" />

      <div className="relative flex min-h-[430px] flex-col items-center justify-center px-5 py-12 text-center sm:px-8">
        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-full bg-emerald-500/[0.06] blur-2xl" />

          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.08] shadow-[0_20px_60px_rgba(16,185,129,0.08)]">
            {hasActiveFilters ? (
              <SearchX
                className="h-8 w-8 text-emerald-300"
                aria-hidden="true"
              />
            ) : hasEvents ? (
              <UserRoundSearch
                className="h-8 w-8 text-emerald-300"
                aria-hidden="true"
              />
            ) : (
              <CalendarPlus2
                className="h-8 w-8 text-emerald-300"
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        <div className="mt-7 max-w-xl">
          <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
            {resolvedTitle}
          </h2>

          <p className="mt-3 text-sm leading-6 text-neutral-500 sm:text-[15px]">
            {resolvedDescription}
          </p>
        </div>

        <div className="mt-7 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          {hasActiveFilters ? (
            <>
              <button
                type="button"
                onClick={
                  handleResetFilters
                }
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-300 transition hover:border-emerald-400/45 hover:bg-emerald-500/15 hover:text-emerald-200"
              >
                <FilterX className="h-4 w-4" />

                Réinitialiser les filtres
              </button>

              <button
                type="button"
                onClick={
                  handleRefresh
                }
                disabled={
                  isRefreshing
                }
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-semibold text-neutral-300 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${
                    isRefreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />

                {isRefreshing
                  ? "Actualisation..."
                  : "Actualiser"}
              </button>
            </>
          ) : hasEvents ? (
            <>
              <Link
                href="/organizer/orders"
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-300 transition hover:border-emerald-400/45 hover:bg-emerald-500/15 hover:text-emerald-200"
              >
                <TicketCheck className="h-4 w-4" />

                Voir les commandes
              </Link>

              <button
                type="button"
                onClick={
                  handleRefresh
                }
                disabled={
                  isRefreshing
                }
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-semibold text-neutral-300 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${
                    isRefreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />

                {isRefreshing
                  ? "Actualisation..."
                  : "Actualiser"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/organizer/events/create"
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-300 transition hover:border-emerald-400/45 hover:bg-emerald-500/15 hover:text-emerald-200"
              >
                <CalendarPlus2 className="h-4 w-4" />

                Créer un événement
              </Link>

              <Link
                href="/organizer/events"
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-semibold text-neutral-300 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white"
              >
                <UsersRound className="h-4 w-4" />

                Voir mes événements
              </Link>
            </>
          )}
        </div>

        <div className="mt-10 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          <EmptyStateInformation
            icon={
              TicketCheck
            }
            title="Billets réels"
            description="Seuls les billets générés depuis les commandes Tikemia sont affichés."
          />

          <EmptyStateInformation
            icon={
              UserRoundSearch
            }
            title="Données centralisées"
            description="Les participants, événements, commandes et paiements restent connectés."
          />

          <EmptyStateInformation
            icon={
              RefreshCcw
            }
            title="Mise à jour"
            description="Les nouvelles ventes et validations apparaissent dans cette page."
          />
        </div>
      </div>
    </section>
  );
}

type EmptyStateInformationProps = {
  icon: typeof TicketCheck;
  title: string;
  description: string;
};

function EmptyStateInformation({
  icon: Icon,
  title,
  description,
}: EmptyStateInformationProps) {
  return (
    <article className="rounded-2xl border border-white/[0.065] bg-white/[0.018] p-4 text-left">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025]">
        <Icon
          className="h-4 w-4 text-neutral-400"
          aria-hidden="true"
        />
      </div>

      <h3 className="mt-3 text-xs font-bold text-neutral-300">
        {title}
      </h3>

      <p className="mt-1.5 text-[11px] leading-5 text-neutral-600">
        {description}
      </p>
    </article>
  );
}