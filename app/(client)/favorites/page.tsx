"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Heart,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type FavoriteCategory = {
  id: string;
  name: string;
  slug: string;
};

type FavoriteEvent = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  coverImage: string | null;
  venueName: string;
  city: string;
  country: string;
  startsAt: string;
  endsAt: string | null;
  currency: string;
  category: FavoriteCategory | null;
  lowestPrice: string | null;
  isFree: boolean;
  isUpcoming: boolean;
  availableTicketsCount: number;
};

type FavoriteItem = {
  id: string;
  createdAt: string;
  event: FavoriteEvent;
};

type FavoritesApiResponse = {
  success: boolean;
  message?: string;
  code?: string;
  summary?: {
    count: number;
  };
  favorites?: FavoriteItem[];
};

type RemoveFavoriteApiResponse = {
  success: boolean;
  message?: string;
  code?: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPrice(
  amount: string | null,
  currency: string,
  isFree: boolean,
): string {
  if (isFree) {
    return "Gratuit";
  }

  if (!amount) {
    return "Prix indisponible";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits:
      currency === "XOF" ? 0 : 2,
    maximumFractionDigits:
      currency === "XOF" ? 0 : 2,
  }).format(Number(amount));
}

export default function FavoritesPage() {
  const [favorites, setFavorites] =
    useState<FavoriteItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [removingEventId, setRemovingEventId] =
    useState<string | null>(null);

  const [query, setQuery] =
    useState("");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const loadFavorites =
    useCallback(async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const response =
          await fetch("/api/client/favorites", {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          });

        const data =
          (await response.json()) as FavoritesApiResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Impossible de charger vos favoris.",
          );
        }

        setFavorites(data.favorites ?? []);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Impossible de charger vos favoris.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  const filteredFavorites =
    useMemo(() => {
      const normalized =
        query.trim().toLowerCase();

      if (!normalized) {
        return favorites;
      }

      return favorites.filter(({ event }) => {
        const searchableText = [
          event.title,
          event.city,
          event.country,
          event.venueName,
          event.category?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalized);
      });
    }, [favorites, query]);

  async function removeFavorite(
    eventId: string,
  ) {
    setRemovingEventId(eventId);
    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          `/api/client/favorites/${encodeURIComponent(
            eventId,
          )}`,
          {
            method: "DELETE",
            headers: {
              Accept: "application/json",
            },
          },
        );

      const data =
        (await response.json()) as RemoveFavoriteApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Impossible de retirer cet événement.",
        );
      }

      setFavorites((current) =>
        current.filter(
          (favorite) =>
            favorite.event.id !== eventId,
        ),
      );

      setMessage(
        data.message ||
          "Événement retiré de vos favoris.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Impossible de retirer cet événement.",
      );
    } finally {
      setRemovingEventId(null);
    }
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 767px) {
              body footer {
                display: none !important;
              }
            }
          `,
        }}
      />

      <main className="min-h-screen w-full bg-[#03070a] text-white">
        <div className="w-full px-4 py-5 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-8 lg:py-9 lg:pb-12 xl:px-10">
          <section className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#071015] p-5 sm:p-6 lg:p-8">
            <div
              aria-hidden="true"
              className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-rose-500/[0.08] blur-[110px]"
            />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-400/15 bg-rose-400/[0.07] text-rose-300">
                    <Heart className="h-5 w-5 fill-current" />
                  </span>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-400">
                      Sélection personnelle
                    </p>

                    <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                      Mes favoris
                    </h1>
                  </div>
                </div>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-500">
                  Retrouvez les événements que vous avez enregistrés.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-700">
                    Événements
                  </p>

                  <p className="mt-1 text-xl font-black text-white">
                    {favorites.length}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void loadFavorites(true)
                  }
                  disabled={refreshing}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-neutral-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                  aria-label="Actualiser les favoris"
                >
                  <RefreshCw
                    className={
                      refreshing
                        ? "h-4 w-4 animate-spin"
                        : "h-4 w-4"
                    }
                  />
                </button>
              </div>
            </div>
          </section>

          {(error || message) && (
            <div
              className={
                error
                  ? "mt-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-4 text-sm text-red-200"
                  : "mt-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4 text-sm text-emerald-200"
              }
            >
              {error ? (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <Heart className="mt-0.5 h-5 w-5 shrink-0" />
              )}

              <p className="leading-6">
                {error || message}
              </p>
            </div>
          )}

          <section className="mt-5 rounded-[22px] border border-white/[0.08] bg-[#071015] p-4 sm:p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-neutral-600" />

              <input
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                type="search"
                placeholder="Rechercher dans mes favoris"
                className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#03090d] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-400/40 focus:ring-4 focus:ring-lime-400/[0.07]"
              />
            </div>
          </section>

          {loading ? (
            <section className="mt-5 flex min-h-[360px] items-center justify-center rounded-[22px] border border-white/[0.08] bg-[#071015]">
              <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
            </section>
          ) : filteredFavorites.length === 0 ? (
            <section className="mt-5 flex min-h-[420px] flex-col items-center justify-center rounded-[22px] border border-dashed border-white/[0.1] bg-[#071015] px-5 py-12 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/15 bg-rose-400/[0.06] text-rose-300">
                <Heart className="h-8 w-8" />
              </span>

              <h2 className="mt-5 text-xl font-black text-white">
                {favorites.length === 0
                  ? "Aucun favori"
                  : "Aucun résultat"}
              </h2>

              <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
                {favorites.length === 0
                  ? "Ajoutez des événements à vos favoris pour les retrouver ici."
                  : "Aucun événement ne correspond à votre recherche."}
              </p>

              {favorites.length === 0 ? (
                <Link
                  href="/events"
                  className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white"
                >
                  Explorer les événements
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-sm font-black text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Réinitialiser la recherche
                </button>
              )}
            </section>
          ) : (
            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredFavorites.map(
                ({ id, event }) => (
                  <article
                    key={id}
                    className="group overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#071015] transition hover:-translate-y-0.5 hover:border-white/[0.14]"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-[#03090d]">
                      {event.coverImage ? (
                        <Image
                          src={event.coverImage}
                          alt={event.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          className="object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Ticket className="h-12 w-12 text-white/[0.1]" />
                        </div>
                      )}

                      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
                        {event.category ? (
                          <span className="rounded-full border border-white/[0.12] bg-black/50 px-3 py-1 text-[10px] font-black text-white backdrop-blur-md">
                            {event.category.name}
                          </span>
                        ) : (
                          <span />
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            void removeFavorite(event.id)
                          }
                          disabled={
                            removingEventId === event.id
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.12] bg-black/55 text-white backdrop-blur-md transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                          aria-label="Retirer des favoris"
                        >
                          {removingEventId === event.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5">
                      <h2 className="line-clamp-2 text-lg font-black leading-6 text-white">
                        {event.title}
                      </h2>

                      {event.shortDescription && (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">
                          {event.shortDescription}
                        </p>
                      )}

                      <div className="mt-4 space-y-2.5">
                        <p className="flex items-center gap-2 text-xs text-neutral-400">
                          <CalendarDays className="h-4 w-4 shrink-0 text-lime-400" />
                          <span>
                            {formatDate(event.startsAt)} ·{" "}
                            {formatTime(event.startsAt)}
                          </span>
                        </p>

                        <p className="flex items-center gap-2 text-xs text-neutral-400">
                          <MapPin className="h-4 w-4 shrink-0 text-orange-400" />
                          <span className="line-clamp-1">
                            {event.venueName}, {event.city}
                          </span>
                        </p>
                      </div>

                      <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/[0.07] pt-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-700">
                            À partir de
                          </p>

                          <p className="mt-1 text-base font-black text-lime-400">
                            {formatPrice(
                              event.lowestPrice,
                              event.currency,
                              event.isFree,
                            )}
                          </p>
                        </div>

                        <Link
                          href={`/events/${event.slug}`}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/[0.07] px-4 text-xs font-black text-lime-300 transition hover:bg-lime-400/[0.12]"
                        >
                          Voir
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </article>
                ),
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}