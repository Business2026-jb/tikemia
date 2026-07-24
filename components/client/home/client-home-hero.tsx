import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Search,
  Sparkles,
  Ticket,
} from "lucide-react";

export type ClientHomeHeroProps = {
  title?: string;
  description?: string;

  backgroundImage?: string;
  backgroundImageAlt?: string;

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
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function formatCount(value: number | undefined): string {
  const normalizedValue =
    typeof value === "number" &&
    Number.isFinite(value)
      ? Math.max(Math.trunc(value), 0)
      : 0;

  return new Intl.NumberFormat("fr-FR").format(
    normalizedValue,
  );
}

export default function ClientHomeHero({
  title = "Tous les événements",
  description =
    "Découvrez les meilleurs concerts, festivals, conférences, spectacles et expériences près de chez vous.",

  backgroundImage = "/images/client/home/events-hero.jpg",
  backgroundImageAlt =
    "Public assistant à un événement Tikemia",

  totalEvents = 0,
  totalCities = 0,
  totalCategories = 0,

  primaryActionHref = "#client-home-filters",
  primaryActionLabel = "Trouver un événement",

  secondaryActionHref = "/events",
  secondaryActionLabel = "Voir tous les événements",

  searchAnchorHref = "#client-home-filters",

  className,
}: ClientHomeHeroProps) {
  const stats = [
    {
      id: "events",
      label: "Événements",
      value: formatCount(totalEvents),
      icon: CalendarDays,
    },
    {
      id: "cities",
      label: "Villes",
      value: formatCount(totalCities),
      icon: MapPin,
    },
    {
      id: "categories",
      label: "Catégories",
      value: formatCount(totalCategories),
      icon: Ticket,
    },
  ];

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
          src={backgroundImage}
          alt={backgroundImageAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        <div className="absolute inset-0 bg-black/58" />

        <div className="absolute inset-0 bg-gradient-to-r from-[#03070a] via-[#03070a]/78 to-[#03070a]/25" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#03070a] via-transparent to-black/20" />

        <div
          aria-hidden="true"
          className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-emerald-500/[0.12] blur-[110px]"
        />

        <div
          aria-hidden="true"
          className="absolute right-0 top-0 h-80 w-80 rounded-full bg-orange-500/[0.09] blur-[120px]"
        />
      </div>

      <div className="relative mx-auto flex min-h-[440px] w-full max-w-[1600px] items-center px-4 py-14 sm:min-h-[500px] sm:px-5 sm:py-16 lg:min-h-[560px] lg:px-8 lg:py-20 xl:min-h-[600px]">
        <div className="w-full max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-500/20 bg-lime-500/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-lime-300 backdrop-blur-md sm:text-[11px]">
            <Sparkles className="h-3.5 w-3.5" />
            Billetterie Tikemia
          </div>

          <h1
            id="client-home-hero-title"
            className="mt-5 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl lg:text-7xl"
          >
            {title}
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-neutral-300 sm:text-base sm:leading-8 lg:text-lg">
            {description}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={primaryActionHref}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_16px_38px_rgba(132,204,22,0.16)] transition hover:brightness-110 active:scale-[0.99] sm:h-13 sm:px-6"
            >
              <Search className="h-4 w-4" />

              {primaryActionLabel}

              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>

            <Link
              href={secondaryActionHref}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/[0.14] bg-white/[0.06] px-5 text-sm font-black text-white backdrop-blur-md transition hover:border-white/[0.24] hover:bg-white/[0.1] active:scale-[0.99] sm:h-13 sm:px-6"
            >
              {secondaryActionLabel}
            </Link>
          </div>

          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <article
                  key={stat.id}
                  className="min-w-0 rounded-2xl border border-white/[0.1] bg-black/25 px-3 py-3 backdrop-blur-md sm:px-4 sm:py-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.06] text-neutral-300">
                      <Icon className="h-4 w-4" />
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-white sm:text-xl">
                        {stat.value}
                      </p>

                      <p className="truncate text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-500 sm:text-[10px]">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-4 pb-4 sm:px-5 lg:px-8">
        <Link
          href={searchAnchorHref}
          className="group flex min-h-16 w-full items-center gap-3 rounded-2xl border border-white/[0.1] bg-[#071014]/90 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition hover:border-lime-500/20 sm:min-h-18 sm:px-5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.08] text-lime-300">
            <Search className="h-4.5 w-4.5" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-white">
              Rechercher un événement
            </span>

            <span className="mt-0.5 block truncate text-[11px] text-neutral-600 sm:text-xs">
              Artiste, organisateur, ville, lieu ou catégorie
            </span>
          </span>

          <ArrowRight className="h-4 w-4 shrink-0 text-neutral-600 transition group-hover:translate-x-0.5 group-hover:text-lime-300" />
        </Link>
      </div>
    </section>
  );
}