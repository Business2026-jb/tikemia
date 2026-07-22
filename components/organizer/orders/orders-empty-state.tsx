"use client";

import {
  CalendarDays,
  FileText,
  FilterX,
  Plus,
  ReceiptText,
  SearchX,
  ShoppingBag,
  TicketCheck,
} from "lucide-react";
import Link from "next/link";

type OrdersEmptyStateProps = {
  hasFilters?: boolean;
  hasEvents?: boolean;
  title?: string;
  description?: string;
  onResetFilters?: () => void;
};

export default function OrdersEmptyState({
  hasFilters = false,
  hasEvents = true,
  title,
  description,
  onResetFilters,
}: OrdersEmptyStateProps) {
  const content = getEmptyStateContent({
    hasFilters,
    hasEvents,
    title,
    description,
  });

  const Icon =
    content.icon;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className="relative px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.08),transparent_45%)]" />

        <div className="relative mx-auto max-w-[620px] text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-emerald-500/25 bg-emerald-500/10 shadow-[0_18px_45px_rgba(34,197,94,0.08)]">
            <Icon className="h-9 w-9 text-lime-400" />
          </div>

          <div className="mt-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
              <ShoppingBag className="h-3.5 w-3.5" />
              Commandes Tikemia
            </span>

            <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">
              {content.title}
            </h2>

            <p className="mx-auto mt-3 max-w-[520px] text-sm leading-6 text-neutral-500">
              {content.description}
            </p>
          </div>

          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {hasFilters ? (
              <>
                {onResetFilters && (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.05] px-5 text-xs font-black text-red-400 transition hover:border-red-500/35 hover:bg-red-500/10"
                  >
                    <FilterX className="h-4 w-4" />
                    Réinitialiser les filtres
                  </button>
                )}

                <Link
                  href="/organizer/orders"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 text-xs font-black text-neutral-300 transition hover:border-white/[0.15] hover:text-white"
                >
                  <SearchX className="h-4 w-4" />
                  Voir toutes les commandes
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/organizer/events/create"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-xs font-black text-white shadow-[0_14px_40px_rgba(34,197,94,0.16)] transition hover:scale-[1.01]"
                >
                  <Plus className="h-4 w-4" />
                  Créer un événement
                </Link>

                <Link
                  href="/organizer/events"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 text-xs font-black text-neutral-300 transition hover:border-white/[0.15] hover:text-white"
                >
                  <CalendarDays className="h-4 w-4" />
                  Voir mes événements
                </Link>
              </>
            )}
          </div>

          <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
            <EmptyStateFeature
              icon={ReceiptText}
              title="Commandes centralisées"
              description="Toutes les ventes et paiements seront regroupés ici."
            />

            <EmptyStateFeature
              icon={TicketCheck}
              title="Billets suivis"
              description="Les billets valides, utilisés ou remboursés restent visibles."
            />

            <EmptyStateFeature
              icon={FileText}
              title="Rapports exportables"
              description="Les exports CSV, Excel et PDF seront disponibles."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function getEmptyStateContent({
  hasFilters,
  hasEvents,
  title,
  description,
}: {
  hasFilters: boolean;
  hasEvents: boolean;
  title?: string;
  description?: string;
}) {
  if (title || description) {
    return {
      title:
        title ??
        "Aucune commande disponible",

      description:
        description ??
        "Aucune donnée ne correspond actuellement à cette vue.",

      icon:
        hasFilters
          ? SearchX
          : ShoppingBag,
    };
  }

  if (hasFilters) {
    return {
      title:
        "Aucune commande ne correspond aux filtres",

      description:
        "Modifiez la recherche, les dates, le statut, l’événement ou la devise pour retrouver les commandes recherchées.",

      icon:
        SearchX,
    };
  }

  if (!hasEvents) {
    return {
      title:
        "Créez votre premier événement",

      description:
        "Les commandes apparaîtront automatiquement ici dès que vos événements seront publiés et que des clients commenceront à acheter des billets.",

      icon:
        CalendarDays,
    };
  }

  return {
    title:
      "Aucune commande enregistrée",

    description:
      "Les commandes, paiements, acheteurs et billets vendus apparaîtront ici dès qu’une première vente sera réalisée.",

    icon:
      ShoppingBag,
  };
}

function EmptyStateFeature({
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
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
        <Icon className="h-4 w-4 text-neutral-500" />
      </div>

      <h3 className="mt-3 text-xs font-black text-neutral-300">
        {title}
      </h3>

      <p className="mt-1.5 text-[11px] leading-5 text-neutral-600">
        {description}
      </p>
    </article>
  );
}