import { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Drama,
  Dumbbell,
  Film,
  GraduationCap,
  Laugh,
  Music2,
  Palette,
  Search,
  Sparkles,
  Tag,
  Theater,
  Ticket,
  Utensils,
  UsersRound,
} from "lucide-react";

import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Catégories d’événements | Tikemia",
  description:
    "Explorez les catégories d’événements disponibles sur Tikemia.",
};

export const dynamic = "force-dynamic";

type CategoriesPageSearchParams = {
  search?: string | string[];
};

type CategoriesPageProps = {
  searchParams?: Promise<CategoriesPageSearchParams>;
};

function getSingleSearchParam(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value)
    ? value[0]?.trim() ?? ""
    : value?.trim() ?? "";
}

function getCategoryIcon(
  categoryName: string,
  iconValue: string | null,
) {
  const source = `${categoryName} ${iconValue ?? ""}`
    .trim()
    .toLowerCase();

  if (
    source.includes("concert") ||
    source.includes("musique") ||
    source.includes("music")
  ) {
    return Music2;
  }

  if (source.includes("festival")) {
    return Sparkles;
  }

  if (
    source.includes("sport") ||
    source.includes("fitness")
  ) {
    return Dumbbell;
  }

  if (
    source.includes("cinéma") ||
    source.includes("cinema") ||
    source.includes("film")
  ) {
    return Film;
  }

  if (
    source.includes("humour") ||
    source.includes("comédie") ||
    source.includes("comedie")
  ) {
    return Laugh;
  }

  if (
    source.includes("théâtre") ||
    source.includes("theatre")
  ) {
    return Theater;
  }

  if (
    source.includes("culture") ||
    source.includes("art")
  ) {
    return Palette;
  }

  if (
    source.includes("formation") ||
    source.includes("conférence") ||
    source.includes("conference")
  ) {
    return GraduationCap;
  }

  if (
    source.includes("gastronomie") ||
    source.includes("food") ||
    source.includes("cuisine")
  ) {
    return Utensils;
  }

  if (
    source.includes("famille") ||
    source.includes("enfant")
  ) {
    return UsersRound;
  }

  if (source.includes("spectacle")) {
    return Drama;
  }

  return Tag;
}

function formatEventDate(
  value: Date,
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function CategoriesPage({
  searchParams,
}: CategoriesPageProps) {
  const resolvedSearchParams =
    (await searchParams) ?? {};

  const search = getSingleSearchParam(
    resolvedSearchParams.search,
  );

  const categoryWhere: Prisma.EventCategoryWhereInput = {
    isActive: true,

    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              description: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }
      : {}),
  };

  const categories =
    await prisma.eventCategory.findMany({
      where: categoryWhere,

      orderBy: [
        {
          name: "asc",
        },
      ],

      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,

        _count: {
          select: {
            events: {
              where: {
                status: "PUBLISHED",
              },
            },
          },
        },

        events: {
          where: {
            status: "PUBLISHED",
          },

          orderBy: [
            {
              startsAt: "asc",
            },
          ],

          take: 3,

          select: {
            id: true,
            slug: true,
            title: true,
            coverImage: true,
            city: true,
            country: true,
            startsAt: true,
          },
        },
      },
    });

  const totalPublishedEvents =
    categories.reduce(
      (total, category) =>
        total + category._count.events,
      0,
    );

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
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-8 lg:py-10 lg:pb-12 xl:px-10">
          <section className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#071015] px-5 py-7 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:px-7 sm:py-9 lg:px-9 lg:py-11">
            <div
              aria-hidden="true"
              className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-500/[0.09] blur-[110px]"
            />

            <div
              aria-hidden="true"
              className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-orange-500/[0.06] blur-[120px]"
            />

            <div className="relative max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-lime-300">
                <Ticket className="h-3.5 w-3.5" />
                Catégories Tikemia
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl lg:text-5xl">
                Trouvez l’événement qui vous correspond
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-400 sm:text-base">
                Parcourez les catégories et découvrez les événements actuellement publiés sur Tikemia.
              </p>

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-500">
                <span>
                  {categories.length} catégorie
                  {categories.length > 1 ? "s" : ""}
                </span>

                <span>
                  {totalPublishedEvents} événement
                  {totalPublishedEvents > 1 ? "s" : ""} publié
                  {totalPublishedEvents > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-[22px] border border-white/[0.08] bg-[#071015] p-4 sm:p-5">
            <form
              action="/categories"
              method="GET"
              className="flex flex-col gap-3 sm:flex-row"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-neutral-600" />

                <input
                  type="search"
                  name="search"
                  defaultValue={search}
                  placeholder="Rechercher une catégorie"
                  className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#03090d] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/[0.08]"
                />
              </div>

              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 text-sm font-black text-lime-300 transition hover:bg-emerald-400/[0.12] sm:w-auto"
              >
                <Search className="h-4 w-4" />
                Rechercher
              </button>
            </form>
          </section>

          {categories.length > 0 ? (
            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                />
              ))}
            </section>
          ) : (
            <section className="mt-5 rounded-[24px] border border-dashed border-white/[0.1] bg-[#071015] px-5 py-14 text-center sm:px-8 sm:py-20">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/15 bg-lime-400/[0.06] text-lime-300">
                <Tag className="h-8 w-8" />
              </span>

              <h2 className="mt-6 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
                Aucune catégorie trouvée
              </h2>

              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-neutral-500">
                Modifiez votre recherche pour afficher les catégories disponibles.
              </p>

              {search && (
                <Link
                  href="/categories"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-xs font-black text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Réinitialiser la recherche
                </Link>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}

type CategoryCardProps = {
  category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;

    _count: {
      events: number;
    };

    events: Array<{
      id: string;
      slug: string;
      title: string;
      coverImage: string | null;
      city: string;
      country: string;
      startsAt: Date;
    }>;
  };
};

function CategoryCard({
  category,
}: CategoryCardProps) {
  const Icon = getCategoryIcon(
    category.name,
    category.icon,
  );

  const primaryEvent =
    category.events[0];

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#071015] shadow-[0_20px_60px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-emerald-400/20">
      <div className="relative aspect-[16/9] overflow-hidden bg-[#03090d]">
        {primaryEvent?.coverImage ? (
          <Image
            src={primaryEvent.coverImage}
            alt={category.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_44%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_44%),#03090d]">
            <Icon className="h-16 w-16 text-white/[0.14]" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#071015] via-black/10 to-transparent" />

        <span className="absolute left-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.1] bg-black/35 text-lime-300 backdrop-blur-xl">
          <Icon className="h-6 w-6" />
        </span>

        <span className="absolute bottom-4 right-4 rounded-full border border-white/[0.1] bg-black/40 px-3 py-1.5 text-[10px] font-black text-white backdrop-blur-xl">
          {category._count.events} événement
          {category._count.events > 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-xl font-black tracking-[-0.03em] text-white">
          {category.name}
        </h2>

        <p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-500">
          {category.description?.trim() ||
            `Découvrez les événements disponibles dans la catégorie ${category.name}.`}
        </p>

        {category.events.length > 0 && (
          <div className="mt-5 space-y-3 border-t border-white/[0.07] pt-4">
            {category.events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className="flex min-w-0 items-start gap-3 rounded-xl p-2 transition hover:bg-white/[0.03]"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-lime-400">
                  <CalendarDays className="h-4 w-4" />
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-xs font-black text-neutral-300">
                    {event.title}
                  </span>

                  <span className="mt-1 block truncate text-[11px] text-neutral-600">
                    {formatEventDate(event.startsAt)} · {event.city}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}

        <Link
          href={`/categories/${category.slug}`}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/[0.07] px-4 text-xs font-black text-lime-300 transition hover:bg-lime-400/[0.12]"
        >
          Voir les événements
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}