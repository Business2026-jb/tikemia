"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  Search,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

export type ClientSearchSuggestion = {
  id: string;
  label: string;
  href?: string;
  description?: string | null;
  category?: string | null;
  city?: string | null;
  dateLabel?: string | null;
};

export type ClientSearchPanelProps = {
  open: boolean;
  initialValue?: string;
  suggestions?: ClientSearchSuggestion[];
  popularSearches?: string[];
  searchHref?: string;
  minimumCharacters?: number;
  onClose: () => void;
  onSearch?: (
    query: string,
  ) => void | Promise<void>;
};

const DEFAULT_POPULAR_SEARCHES = [
  "Concert",
  "Festival",
  "Conférence",
  "Spectacle",
  "Cotonou",
  "Abidjan",
  "Dakar",
] as const;

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function normalizeSearchValue(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function createSearchUrl({
  baseUrl,
  query,
}: {
  baseUrl: string;
  query: string;
}): string {
  const separator =
    baseUrl.includes("?")
      ? "&"
      : "?";

  return `${baseUrl}${separator}q=${encodeURIComponent(
    query,
  )}`;
}

export default function ClientSearchPanel({
  open,
  initialValue = "",
  suggestions = [],
  popularSearches = [
    ...DEFAULT_POPULAR_SEARCHES,
  ],
  searchHref = "/search",
  minimumCharacters = 2,
  onClose,
  onSearch,
}: ClientSearchPanelProps) {
  const router = useRouter();

  const [searchValue, setSearchValue] =
    useState(initialValue);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const normalizedValue =
    useMemo(
      () =>
        normalizeSearchValue(
          searchValue,
        ),
      [searchValue],
    );

  const canSubmit =
    normalizedValue.length >=
      minimumCharacters &&
    !isSubmitting;

  const visibleSuggestions =
    useMemo(() => {
      if (!normalizedValue) {
        return suggestions.slice(
          0,
          6,
        );
      }

      const loweredQuery =
        normalizedValue.toLocaleLowerCase(
          "fr",
        );

      return suggestions
        .filter((suggestion) => {
          const searchableValue = [
            suggestion.label,
            suggestion.description,
            suggestion.category,
            suggestion.city,
            suggestion.dateLabel,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase(
              "fr",
            );

          return searchableValue.includes(
            loweredQuery,
          );
        })
        .slice(0, 6);
    }, [
      normalizedValue,
      suggestions,
    ]);

  async function submitSearch(
    value = normalizedValue,
  ): Promise<void> {
    const query =
      normalizeSearchValue(value);

    if (
      query.length <
        minimumCharacters ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (onSearch) {
        await onSearch(query);
      } else {
        router.push(
          createSearchUrl({
            baseUrl:
              searchHref,
            query,
          }),
        );
      }

      onClose();
    } catch (error) {
      console.error(
        "[CLIENT_SEARCH_PANEL_ERROR]",
        error instanceof Error
          ? {
              name:
                error.name,
              message:
                error.message,
            }
          : error,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function selectPopularSearch(
    value: string,
  ): void {
    setSearchValue(value);
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90]",
        open
          ? "pointer-events-auto"
          : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la recherche"
        tabIndex={open ? 0 : -1}
        className={cn(
          "absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300",
          open
            ? "opacity-100"
            : "opacity-0",
        )}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Recherche d’événements"
        className={cn(
          "relative mx-auto mt-3 w-[calc(100%-24px)] max-w-4xl overflow-hidden rounded-3xl border border-white/[0.1] bg-[#071014] shadow-[0_32px_100px_rgba(0,0,0,0.68)] transition-all duration-300 sm:mt-6 sm:w-[calc(100%-40px)] lg:mt-10",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "-translate-y-3 scale-[0.985] opacity-0",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Recherche Tikemia
            </div>

            <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
              Trouvez votre prochain événement
            </h2>

            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-neutral-500 sm:text-sm">
              Recherchez par artiste, événement, ville ou catégorie.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            tabIndex={open ? 0 : -1}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-neutral-300 transition hover:bg-white/[0.06] hover:text-white active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              void submitSearch();
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

              <input
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(
                    event.target.value,
                  )
                }
                type="search"
                name="q"
                maxLength={120}
                autoComplete="off"
                placeholder="Artiste, concert, festival, ville..."
                aria-label="Rechercher un événement"
                tabIndex={open ? 0 : -1}
                className="h-13 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] py-3 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 sm:h-14 sm:text-base"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              tabIndex={open ? 0 : -1}
              className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 sm:h-14"
            >
              <Search className="h-4 w-4" />

              {isSubmitting
                ? "Recherche..."
                : "Rechercher"}
            </button>
          </form>

          {normalizedValue.length >
            0 &&
            normalizedValue.length <
              minimumCharacters && (
              <p className="mt-2 text-[11px] text-orange-300">
                Saisissez au moins{" "}
                {minimumCharacters} caractères.
              </p>
            )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
            <section>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-white">
                    Suggestions
                  </h3>

                  <p className="mt-1 text-[11px] text-neutral-600">
                    Résultats rapides disponibles
                  </p>
                </div>

                {visibleSuggestions.length >
                  0 && (
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-bold text-neutral-500">
                    {
                      visibleSuggestions.length
                    }{" "}
                    résultat
                    {visibleSuggestions.length >
                    1
                      ? "s"
                      : ""}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {visibleSuggestions.length >
                0 ? (
                  visibleSuggestions.map(
                    (
                      suggestion,
                    ) => (
                      <SearchSuggestionItem
                        key={
                          suggestion.id
                        }
                        suggestion={
                          suggestion
                        }
                        query={
                          normalizedValue
                        }
                        searchHref={
                          searchHref
                        }
                        open={open}
                        onClose={
                          onClose
                        }
                      />
                    ),
                  )
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-4 py-8 text-center">
                    <Search className="mx-auto h-6 w-6 text-neutral-700" />

                    <p className="mt-3 text-sm font-black text-white">
                      Aucun résultat rapide
                    </p>

                    <p className="mt-1 text-xs leading-5 text-neutral-600">
                      Lancez la recherche complète pour découvrir tous les événements.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <aside>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-orange-400" />

                  <h3 className="text-sm font-black text-white">
                    Recherches populaires
                  </h3>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {popularSearches.map(
                    (
                      suggestion,
                    ) => (
                      <button
                        key={
                          suggestion
                        }
                        type="button"
                        onClick={() =>
                          selectPopularSearch(
                            suggestion,
                          )
                        }
                        tabIndex={
                          open
                            ? 0
                            : -1
                        }
                        className={cn(
                          "rounded-full border px-3 py-2 text-xs font-semibold transition hover:border-emerald-500/25 hover:bg-emerald-500/[0.07] hover:text-emerald-300 active:scale-95",
                          searchValue ===
                            suggestion
                            ? "border-emerald-500/30 bg-emerald-500/[0.09] text-emerald-300"
                            : "border-white/[0.08] bg-white/[0.025] text-neutral-400",
                        )}
                      >
                        {suggestion}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-sky-500/15 bg-sky-500/[0.04] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/[0.08]">
                    <Ticket className="h-4 w-4 text-sky-300" />
                  </span>

                  <div>
                    <p className="text-xs font-black text-white">
                      Achat avec ou sans compte
                    </p>

                    <p className="mt-1 text-[10px] leading-5 text-neutral-600">
                      Vous pouvez acheter vos billets en mode invité et les retrouver après création de votre compte.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}

function SearchSuggestionItem({
  suggestion,
  query,
  searchHref,
  open,
  onClose,
}: {
  suggestion: ClientSearchSuggestion;
  query: string;
  searchHref: string;
  open: boolean;
  onClose: () => void;
}) {
  const href =
    suggestion.href ||
    createSearchUrl({
      baseUrl:
        searchHref,
      query:
        suggestion.label ||
        query,
    });

  return (
    <Link
      href={href}
      onClick={onClose}
      tabIndex={open ? 0 : -1}
      className="group flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.035] active:scale-[0.995]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
        <CalendarDays className="h-4.5 w-4.5 text-neutral-500 transition group-hover:text-emerald-300" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-white">
          {suggestion.label}
        </span>

        {suggestion.description && (
          <span className="mt-1 line-clamp-2 block text-[11px] leading-5 text-neutral-600">
            {suggestion.description}
          </span>
        )}

        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-600">
          {suggestion.category && (
            <span className="inline-flex items-center gap-1">
              <Ticket className="h-3 w-3" />
              {suggestion.category}
            </span>
          )}

          {suggestion.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {suggestion.city}
            </span>
          )}

          {suggestion.dateLabel && (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              {suggestion.dateLabel}
            </span>
          )}
        </span>
      </span>

      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-neutral-700 transition group-hover:translate-x-0.5 group-hover:text-emerald-300" />
    </Link>
  );
}