import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Search,
  Sparkles,
} from "lucide-react";

export type ClientHomeHeroProps = {
  title?: string;
  description?: string;

  backgroundImage?: string;
  backgroundImageAlt?: string;

  /**
   * Conservés pour garantir la compatibilité avec app/page.tsx.
   * Les statistiques ne sont volontairement plus affichées dans le hero.
   */
  totalEvents?: number;
  totalCities?: number;
  totalCategories?: number;

  primaryActionHref?: string;
  primaryActionLabel?: string;

  secondaryActionHref?: string;
  secondaryActionLabel?: string;

  searchAnchorHref?: string;

  className?: string;
};

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

export default function ClientHomeHero({
  title = "Tous les événements",

  description =
    "Découvrez les meilleurs concerts, festivals, conférences, spectacles et expériences près de chez vous.",

  backgroundImage =
    "/images/client/home/events-hero.png",

  backgroundImageAlt =
    "Public assistant à un événement Tikemia",

  primaryActionHref =
    "#client-home-filters",

  primaryActionLabel =
    "Trouver un événement",

  secondaryActionHref =
    "/events",

  secondaryActionLabel =
    "Voir tous les événements",

  searchAnchorHref =
    "#client-home-filters",

  className,
}: ClientHomeHeroProps) {
  return (
    <section
      aria-labelledby="client-home-hero-title"
      className={cn(
        "relative isolate w-full overflow-hidden border-b border-white/[0.08] bg-[#03070a]",
        className,
      )}
    >
      <div className="absolute inset-0">
        <Image
          src={
            backgroundImage
          }
          alt={
            backgroundImageAlt
          }
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        <div className="absolute inset-0 bg-black/64 sm:bg-black/58" />

        <div className="absolute inset-0 bg-gradient-to-r from-[#03070a] via-[#03070a]/88 to-[#03070a]/28" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#03070a] via-[#03070a]/16 to-black/24" />

        <div
          aria-hidden="true"
          className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-emerald-500/[0.1] blur-[105px]"
        />

        <div
          aria-hidden="true"
          className="absolute right-0 top-0 h-72 w-72 rounded-full bg-orange-500/[0.07] blur-[115px]"
        />
      </div>

      <div className="relative mx-auto flex min-h-[360px] w-full max-w-[1600px] items-center px-4 pb-8 pt-8 sm:min-h-[430px] sm:px-5 sm:pb-10 sm:pt-12 lg:min-h-[500px] lg:px-8 lg:py-16 xl:min-h-[530px]">
        <div className="w-full max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-500/20 bg-lime-500/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-lime-300 backdrop-blur-md sm:text-[11px]">
            <Sparkles
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />

            Billetterie Tikemia
          </div>

          <h1
            id="client-home-hero-title"
            className="mt-4 max-w-4xl text-[36px] font-black leading-[0.98] tracking-[-0.045em] text-white min-[390px]:text-[40px] sm:mt-5 sm:text-5xl md:text-6xl lg:text-7xl"
          >
            {
              title
            }
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300 sm:mt-5 sm:text-base sm:leading-8 lg:text-lg">
            {
              description
            }
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:items-center">
            <Link
              href={
                primaryActionHref
              }
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_16px_38px_rgba(132,204,22,0.16)] transition hover:brightness-110 active:scale-[0.99] sm:w-auto sm:px-6"
            >
              <Search
                aria-hidden="true"
                className="h-4 w-4"
              />

              {
                primaryActionLabel
              }

              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 transition group-hover:translate-x-0.5"
              />
            </Link>

            <Link
              href={
                secondaryActionHref
              }
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/[0.14] bg-white/[0.06] px-5 text-sm font-black text-white backdrop-blur-md transition hover:border-white/[0.24] hover:bg-white/[0.1] active:scale-[0.99] sm:w-auto sm:px-6"
            >
              {
                secondaryActionLabel
              }
            </Link>
          </div>
        </div>
      </div>

      {/*
        Cette barre reste disponible sur tablette et ordinateur.
        Elle est masquée sur mobile afin d’éviter une répétition avec
        la section de filtres située immédiatement après le hero.
      */}
      <div className="relative mx-auto hidden w-full max-w-[1600px] px-5 pb-5 sm:block lg:px-8">
        <Link
          href={
            searchAnchorHref
          }
          className="group flex min-h-14 w-full items-center gap-3 rounded-2xl border border-white/[0.1] bg-[#071014]/94 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition hover:border-lime-500/20 sm:px-5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.08] text-lime-300">
            <Search
              aria-hidden="true"
              className="h-[18px] w-[18px]"
            />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-white">
              Rechercher un événement
            </span>

            <span className="mt-0.5 block truncate text-xs text-neutral-600">
              Artiste, organisateur, ville, lieu ou catégorie
            </span>
          </span>

          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-neutral-600 transition group-hover:translate-x-0.5 group-hover:text-lime-300"
          />
        </Link>
      </div>
    </section>
  );
}