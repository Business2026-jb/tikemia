
"use client";

import { OrganizerPublicHeader } from "@/components/organizer/OrganizerHeader";

import { useSyncExternalStore } from "react";

function subscribeLocale(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readStoredLocale(): Locale {
  try {
    return normalizeLocale(window.localStorage.getItem(i18nConfig.storageKey) ?? defaultLocale);
  } catch {
    return defaultLocale;
  }
}


import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Heart,
  QrCode,
  Ticket,
  UserRound,
  UserRoundPlus,
  Wallet,
  Zap,
} from "lucide-react";

import fr from "@/i18n/fr.json";
import en from "@/i18n/en.json";

import {
  defaultLocale,
  i18nConfig,
  normalizeLocale,
  type Locale,
} from "@/i18n/config";

/* ==========================================
   TIKEMIA — ACCUEIL ESPACE ORGANISATEUR

   Route : /organizer

   Responsive : Mobile / Tablette / PC
   Langues : Français / Anglais
   Styles : Tailwind CSS + globals.css
========================================== */

const dictionaries = {
  fr: fr.organizerLanding,
  en: en.organizerLanding,
};

const ROUTES = {
  home: "/organizer",
  login: "/organizer/login",
  register: "/organizer/register",
};

export default function OrganizerPage() {
  /* ==========================================
     LANGUES ET MENU MOBILE
  ========================================== */

  const storedLocale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => defaultLocale);
  const [selectedLocale, setLanguage] = useState<Locale | null>(null);
  const language = selectedLocale ?? storedLocale;

const t = dictionaries[language];



  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function changeLanguage(nextLanguage: Locale) {
    setLanguage(nextLanguage);

    try {
      window.localStorage.setItem(
        i18nConfig.storageKey,
        nextLanguage
      );
    } catch {
      // La traduction reste opérationnelle.
    }
  }

  

  

  /* ==========================================
     NAVIGATION
  ========================================== */

  

  /* ==========================================
     AVANTAGES
  ========================================== */

  const benefits = [
    {
      label: t.fastPublishing,
      icon: Zap,
      color: "#ffb900",
    },
    {
      label: t.qrTickets,
      icon: QrCode,
      color: "#079b08",
    },
    {
      label: t.realtimeTracking,
      icon: ChartNoAxesColumnIncreasing,
      color: "#079b08",
    },
    {
      label: t.securePayments,
      icon: Wallet,
      color: "#f52228",
    },
  ];

  /* ==========================================
     ÉTAPES
  ========================================== */

  const steps = [
    {
      label: t.step1,
      short: t.step1Short,
      icon: UserRoundPlus,
      color: "#079b08",
    },
    {
      label: t.step2,
      short: t.step2Short,
      icon: CalendarDays,
      color: "#004b20",
    },
    {
      label: t.step3,
      short: t.step3Short,
      icon: Ticket,
      color: "#ffb900",
    },
    {
      label: t.step4,
      short: t.step4Short,
      icon: ChartNoAxesColumnIncreasing,
      color: "#079b08",
    },
  ];

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-white text-gray-950">

      {/* ======================================
          HEADER GLOBAL
      ====================================== */}

      <OrganizerPublicHeader locale={language} onLocaleChange={changeLanguage} />

      {/* ======================================
          CONTENU PRINCIPAL
      ====================================== */}

      <main className="w-full">

        {/* ====================================
            BANNIÈRE PRINCIPALE
        ==================================== */}

        <section className="relative isolate w-full overflow-hidden bg-green-950">

          {/* Image de fond */}

          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat max-sm:bg-position-[65%_center]"
            style={{
              backgroundImage:
                "url('/images/orgaccueil.png')",
            }}
          />

          {/* Dégradé de lisibilité */}

          <div className="absolute inset-0 bg-linear-to-r from-[#003b28]/95 via-[#003b2c]/75 to-transparent lg:from-[#003b28]/90 lg:via-[#003b2c]/45" />

          {/* Contenu */}

          <div className="relative z-10 flex min-h-80 w-full items-center px-5 pt-7 pb-12 sm:px-10 lg:min-h-96 lg:px-[6%]">

            <div className="w-full max-w-xl">

              {/* Logo dans la bannière */}

              <div className="relative mb-3 h-16 w-60 sm:h-20 sm:w-72">
                <Image
                  src="/logo/logo.png"
                  alt="TIKEMIA"
                  fill
                  sizes="(max-width: 640px) 240px, 288px"
                  className="object-contain object-left"
                />
              </div>

              {/* Titre jaune */}

              <div className="mb-5 inline-flex max-w-full rounded-full bg-linear-to-r from-yellow-300 to-yellow-400 px-5 py-2 text-xl font-black text-black shadow-md sm:text-3xl">
                {t.organizer}
              </div>

              {/* Texte 1 */}

              <div className="flex flex-col gap-3">

                <div className="flex items-center gap-3 text-lg font-extrabold text-white sm:text-2xl">

                  <Ticket
                    size={34}
                    strokeWidth={2.5}
                    className="shrink-0 text-yellow-400"
                  />

                  <span>
                    {t.publishEvents}
                  </span>

                </div>

                {/* Texte 2 */}

                <div className="flex items-center gap-3 text-lg font-extrabold text-white sm:text-2xl">

                  <Heart
                    size={34}
                    strokeWidth={2.5}
                    className="shrink-0 text-red-500"
                  />

                  <span>
                    {t.launchCampaigns}
                  </span>

                </div>

              </div>

              {/* Boutons */}

              <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">

                <Link
                  href={ROUTES.register}
                  className="flex min-h-13 items-center justify-center gap-3 rounded-full border-2 border-white bg-linear-to-b from-green-500 to-green-800 px-5 text-center text-sm font-extrabold text-white shadow-lg transition-all hover:brightness-110 sm:text-base"
                >
                  <UserRoundPlus size={23} />
                  <span>{t.signupNow}</span>
                  <ArrowRight size={20} />
                </Link>

                <Link
                  href={ROUTES.login}
                  className="flex min-h-13 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-extrabold text-gray-950 shadow-md transition-colors hover:bg-gray-100 sm:text-base"
                >
                  <UserRound size={22} />
                  {t.login}
                </Link>

              </div>

            </div>

          </div>

          {/* Vague sous la bannière */}

          <svg
            aria-hidden="true"
            viewBox="0 0 1440 70"
            preserveAspectRatio="none"
            className="absolute bottom-0 left-0 z-20 h-10 w-full sm:h-14"
          >
            <path
              d="M0 18 C150 87 300 36 470 56 S800 65 1000 52 S1250 -10 1440 20 L1440 70 L0 70 Z"
              fill="#ffcf00"
            />

            <path
              d="M0 28 C150 95 300 48 470 63 S800 75 1000 61 S1250 3 1440 31 L1440 70 L0 70 Z"
              fill="#ffffff"
            />
          </svg>

        </section>

        {/* ====================================
            FONCTIONNALITÉS
        ==================================== */}

        <section
          id="fonctionnalites"
          className="w-full px-3 pt-3 sm:px-6 lg:px-10"
        >

          <div className="grid w-full grid-cols-2 gap-3 rounded-2xl bg-white p-3 shadow-lg sm:p-4 lg:grid-cols-4 lg:gap-0">

            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;

              return (
                <div
                  key={benefit.label}
                  className={[
                    "flex min-h-24 flex-col items-center justify-center gap-2",
                    "rounded-xl bg-gray-50 px-2 py-3 text-center",
                    "sm:min-h-20",
                    "lg:flex-row lg:bg-transparent",
                    index !== benefits.length - 1
                      ? "lg:border-r lg:border-gray-200"
                      : "",
                  ].join(" ")}
                >

                  <Icon
                    size={34}
                    strokeWidth={2.4}
                    style={{
                      color: benefit.color,
                    }}
                    className="shrink-0"
                  />

                  <span className="text-xs leading-snug font-extrabold text-gray-950 sm:text-sm lg:text-base">
                    {benefit.label}
                  </span>

                </div>
              );
            })}

          </div>

        </section>

        {/* ====================================
            COMMENT ÇA MARCHE
        ==================================== */}

        <section className="w-full px-3 pt-6 pb-5 sm:px-6 lg:px-10">

          <h2 className="text-center text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
            {t.howItWorks}
          </h2>

          <div className="mx-auto mt-2 mb-5 h-1.5 w-14 rounded-full bg-green-600" />

          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">

            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.short}
                  className="relative flex min-w-0"
                >

                  <div className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl bg-gray-50 px-1 py-3 text-center shadow-sm sm:min-h-36 sm:px-3">

                    <Icon
                      size={30}
                      strokeWidth={2.2}
                      style={{
                        color: step.color,
                      }}
                      className="sm:size-11"
                    />

                    {/* Texte mobile */}

                    <span className="text-[11px] leading-tight font-extrabold sm:hidden">
                      {index + 1}. {step.short}
                    </span>

                    {/* Texte PC */}

                    <span className="hidden text-sm leading-snug font-extrabold sm:block lg:text-base">
                      {index + 1}. {step.label}
                    </span>

                  </div>

                  {/* Flèche */}

                  {index < steps.length - 1 && (
                    <ChevronRight
                      aria-hidden="true"
                      size={19}
                      strokeWidth={2.5}
                      className="absolute top-1/2 -right-3 z-10 hidden sm:block -translate-y-1/2 rounded-full bg-white text-green-950 sm:-right-4 sm:size-7"
                    />
                  )}

                </div>
              );
            })}

          </div>

        </section>

        {/* ====================================
            BANNIÈRE FINALE
        ==================================== */}

        <section
          id="tarifs"
          className="w-full px-3 pt-1 pb-4 sm:px-6 lg:px-10"
        >

          <div className="flex w-full flex-col items-center justify-between gap-4 rounded-2xl bg-[#004632] px-5 py-5 text-center sm:flex-row sm:px-8 sm:text-left">

            <div className="flex items-center gap-4">

              <Ticket
                size={54}
                strokeWidth={2}
                className="hidden shrink-0 -rotate-12 text-yellow-400 sm:block"
              />

              <h2 className="text-lg leading-tight font-extrabold text-white sm:text-2xl">
                {t.ready}
              </h2>

            </div>

            <Link
              href={ROUTES.register}
              className="flex min-h-13 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-yellow-400 px-6 text-sm font-extrabold text-black shadow-md transition-colors hover:bg-yellow-300 sm:w-auto sm:text-base"
            >
              <UserRoundPlus size={23} />
              {t.signupNow}
            </Link>

          </div>

        </section>

        {/* ====================================
            VAGUES DÉCORATIVES
        ==================================== */}

        <div className="relative h-10 w-full overflow-hidden bg-white sm:h-14">

          <svg
            aria-hidden="true"
            viewBox="0 0 1440 90"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >

            <path
              d="M0 12 C180 100 280 30 480 65 S780 72 1000 49 S1250 15 1440 30 L1440 90 L0 90 Z"
              fill="#ffcf00"
            />

            <path
              d="M0 42 C190 105 330 50 500 78 S840 73 1040 62 S1290 22 1440 54 L1440 90 L0 90 Z"
              fill="#008c14"
            />

            <path
              d="M1080 65 C1220 30 1330 55 1440 27 L1440 90 L1080 90 Z"
              fill="#f52228"
            />

          </svg>

        </div>

        {/* Ancre réservée à la navigation future */}

        <div
          id="assistance"
          className="sr-only"
          aria-hidden="true"
        />

      </main>

    </div>
  );
}
