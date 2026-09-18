import Link from "next/link";

import {
  ArrowRight,
  Search,
} from "lucide-react";

type SearchPageProps = {
  searchParams:
    Promise<{
      q?: string | string[];
    }>;
};

function normalizeSearchQuery(
  value:
    string | string[] | undefined,
): string {
  const rawValue =
    Array.isArray(value)
      ? value[0] ?? ""
      : value ?? "";

  return rawValue
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export default async function SearchPage({
  searchParams,
}: SearchPageProps) {
  const params =
    await searchParams;

  const query =
    normalizeSearchQuery(
      params.q,
    );

  const eventsHref =
    query
      ? `/events?q=${encodeURIComponent(
          query,
        )}`
      : "/events";

  return (
    <main className="min-h-[calc(100vh-140px)] bg-[#020609] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#071014] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="h-px bg-gradient-to-r from-transparent via-lime-400/70 to-transparent" />

          <div className="px-5 py-7 sm:px-8 sm:py-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.07] text-lime-300">
              <Search
                className="h-5 w-5"
                aria-hidden="true"
              />
            </div>

            <p className="mt-6 text-[11px] font-black uppercase tracking-[0.18em] text-lime-400">
              Recherche Tikemia
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Rechercher un événement
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
              Recherchez un concert, un festival,
              une conférence, un spectacle ou un
              événement disponible sur Tikemia.
            </p>

            <form
              action="/search"
              method="get"
              role="search"
              className="mt-7 flex flex-col gap-3 sm:flex-row"
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500"
                  aria-hidden="true"
                />

                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Artiste, événement, ville..."
                  aria-label="Rechercher un événement"
                  className="h-13 w-full rounded-2xl border border-white/[0.09] bg-white/[0.035] py-3 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-lime-400/35 focus:ring-4 focus:ring-lime-400/[0.06]"
                />
              </div>

              <button
                type="submit"
                className="flex h-13 shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-500 via-yellow-500 to-orange-500 px-6 text-sm font-black text-white transition hover:brightness-110 active:scale-[0.98]"
              >
                <Search
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                Rechercher
              </button>
            </form>
          </div>
        </section>

        {query ? (
          <section className="mt-5 rounded-[24px] border border-white/[0.08] bg-[#071014] p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
              Recherche
            </p>

            <h2 className="mt-2 text-xl font-black text-white">
              « {query} »
            </h2>

            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Consultez les événements correspondant
              à votre recherche dans le catalogue
              Tikemia.
            </p>

            <Link
              href={eventsHref}
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/[0.07] px-4 text-sm font-bold text-lime-300 transition hover:bg-lime-400/[0.12]"
            >
              Voir les événements

              <ArrowRight
                className="h-4 w-4"
                aria-hidden="true"
              />
            </Link>
          </section>
        ) : (
          <section className="mt-5 rounded-[24px] border border-white/[0.08] bg-[#071014] p-5 text-center sm:p-7">
            <p className="text-sm text-neutral-400">
              Saisissez un mot-clé pour commencer
              votre recherche.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}