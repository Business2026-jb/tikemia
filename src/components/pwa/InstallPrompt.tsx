
"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { useCallback, useEffect, useState } from "react";

/**
 * ============================================================
 * TIKEMIA — INSTALLATION PWA
 * ============================================================
 *
 * Fichier :
 * src/components/pwa/InstallPrompt.tsx
 *
 * Fonctionnalités :
 * - Installation Android et PC si disponible
 * - Instructions iPhone / iPad
 * - Français et anglais
 * - Détection de l'application déjà installée
 * - Fermeture et rappel après 7 jours
 * - Enregistrement du service worker
 * - Aucune dépendance supplémentaire
 * - Aucun stockage de données personnelles
 *
 * ============================================================
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;

  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

type Language = "fr" | "en";
type Platform = "ios" | "android" | "desktop";

const DISMISS_KEY = "tikemia:pwa:install-dismissed-until";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;
const SHOW_DELAY = 4000;

const TEXT = {
  fr: {
    title: "Installez TIKEMIA",
    description:
      "Retrouvez vos billets, événements et cagnottes directement depuis votre téléphone.",
    install: "Installer l'application",
    installing: "Ouverture de l'installation...",
    later: "Plus tard",
    close: "Fermer",
    free: "Accès rapide",
    tickets: "Vos billets et QR codes",
    events: "Vos événements",
    donations: "Vos cagnottes",
    iosTitle: "Ajouter TIKEMIA à l'écran d'accueil",
    iosDescription:
      "Installez TIKEMIA sur votre iPhone ou iPad en quelques étapes.",
    iosStep1: "Ouvrez le menu de partage de votre navigateur.",
    iosStep2:
      'Choisissez « Sur l’écran d’accueil » ou « Ajouter à l’écran d’accueil ».',
    iosStep3: 'Appuyez sur « Ajouter » pour terminer.',
    iosHelp: "Comment installer ?",
    androidTitle: "Installer TIKEMIA sur Android",
    androidStep1:
      "Ouvrez le menu de votre navigateur (⋮).",
    androidStep2:
      'Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».',
    androidStep3: "Confirmez l'installation.",
    androidHelp: "Voir les instructions",
    desktopTitle: "Installer TIKEMIA",
    desktopStep1:
      "Ouvrez le menu de votre navigateur.",
    desktopStep2:
      "Choisissez l'option d'installation de TIKEMIA, si elle est disponible.",
    desktopHelp: "Comment installer ?",
    done: "Terminé",
  },

  en: {
    title: "Install TIKEMIA",
    description:
      "Access your tickets, events and fundraisers directly from your phone.",
    install: "Install the app",
    installing: "Opening installation...",
    later: "Later",
    close: "Close",
    free: "Quick access",
    tickets: "Tickets and QR codes",
    events: "Your events",
    donations: "Your fundraisers",
    iosTitle: "Add TIKEMIA to your Home Screen",
    iosDescription:
      "Install TIKEMIA on your iPhone or iPad in a few steps.",
    iosStep1: "Open your browser's Share menu.",
    iosStep2: 'Select "Add to Home Screen".',
    iosStep3: 'Tap "Add" to finish.',
    iosHelp: "How to install",
    androidTitle: "Install TIKEMIA on Android",
    androidStep1:
      "Open your browser menu (⋮).",
    androidStep2:
      'Choose "Install app" or "Add to Home screen".',
    androidStep3: "Confirm the installation.",
    androidHelp: "View instructions",
    desktopTitle: "Install TIKEMIA",
    desktopStep1: "Open your browser menu.",
    desktopStep2:
      "Choose the option to install TIKEMIA, if available.",
    desktopHelp: "How to install",
    done: "Done",
  },
} as const;

/**
 * Détection de la langue.
 * Le français reste la langue par défaut.
 */
function detectLanguage(): Language {
  if (typeof window === "undefined") {
    return "fr";
  }

  const pathname = window.location.pathname.toLowerCase();

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return "en";
  }

  if (pathname === "/fr" || pathname.startsWith("/fr/")) {
    return "fr";
  }

  const documentLang =
    document.documentElement.lang.toLowerCase();

  return documentLang.startsWith("en") ? "en" : "fr";
}

/**
 * Détection du système.
 */
function detectPlatform(): Platform {
  if (typeof window === "undefined") {
    return "desktop";
  }

  const userAgent = navigator.userAgent;

  const isIOS =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (
      /Macintosh/i.test(userAgent) &&
      navigator.maxTouchPoints > 1
    );

  if (isIOS) {
    return "ios";
  }

  if (/Android/i.test(userAgent)) {
    return "android";
  }

  return "desktop";
}

/**
 * Vérifie si TIKEMIA fonctionne déjà
 * comme application installée.
 */
function isInstalled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const standalone = window.matchMedia(
    "(display-mode: standalone)"
  ).matches;

  const fullscreen = window.matchMedia(
    "(display-mode: fullscreen)"
  ).matches;

  const iosStandalone = (
    navigator as Navigator & {
      standalone?: boolean;
    }
  ).standalone === true;

  return standalone || fullscreen || iosStandalone;
}

/**
 * Vérifie si le client a demandé
 * de ne pas revoir l'invitation.
 */
function isDismissed(): boolean {
  try {
    const stored = window.localStorage.getItem(
      DISMISS_KEY
    );

    if (!stored) {
      return false;
    }

    const until = Number(stored);

    if (!Number.isFinite(until) || until <= Date.now()) {
      window.localStorage.removeItem(DISMISS_KEY);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Mémorise le choix "Plus tard".
 */
function saveDismissal(): void {
  try {
    const until = Date.now() + DISMISS_DURATION;

    window.localStorage.setItem(
      DISMISS_KEY,
      String(until)
    );
  } catch {
    // L'installation reste fonctionnelle
    // même si le stockage local est indisponible.
  }
}

/**
 * Certaines pages ne doivent pas
 * être interrompues par une invitation.
 */
function isRestrictedPage(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const pathname = window.location.pathname.toLowerCase();

  const restrictedPrefixes = [
    "/account",
    "/admin",
    "/organizer",
    "/api",
    "/checkout",
    "/payment",
    "/paiement",
    "/auth",
    "/login",
    "/register",
    "/connexion",
    "/inscription",
  ];

  const prefixes = ["", "/fr", "/en"];

  return prefixes.some((localePrefix) =>
    restrictedPrefixes.some((prefix) => {
      const fullPath = `${localePrefix}${prefix}`;

      return (
        pathname === fullPath ||
        pathname.startsWith(`${fullPath}/`)
      );
    })
  );
}

export default function InstallPrompt() {
  const pathname = usePathname();
  const [language, setLanguage] = useState<Language>("fr");

  const [platform, setPlatform] =
    useState<Platform>("desktop");

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [ready, setReady] = useState(false);

  const [visible, setVisible] = useState(false);

  const [showGuide, setShowGuide] = useState(false);

  const [installing, setInstalling] = useState(false);

  const [alreadyInstalled, setAlreadyInstalled] =
    useState(false);

  const t = TEXT[language];

  /**
   * Initialisation côté navigateur.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLanguage(detectLanguage());
      setPlatform(detectPlatform());
      setAlreadyInstalled(isInstalled());
      setReady(true);
    }, SHOW_DELAY);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  /**
   * Suivi de la langue du document.
   */
  useEffect(() => {
    const updateLanguage = () => {
      setLanguage(detectLanguage());
    };

    const observer = new MutationObserver(updateLanguage);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });

    window.addEventListener("popstate", updateLanguage);

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "popstate",
        updateLanguage
      );
    };
  }, []);

  /**
   * Enregistrement du service worker.
   *
   * En production uniquement.
   * sw.js doit exister dans public/.
   *
   * Le service worker doit rester léger
   * et ne pas mettre en cache les API privées.
   */
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    ) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register(
          "/sw.js",
          {
            scope: "/",
            updateViaCache: "none",
          }
        );
      } catch (error) {
        console.error(
          "[TIKEMIA PWA] Service worker:",
          error
        );
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
      return;
    }

    window.addEventListener(
      "load",
      registerServiceWorker,
      { once: true }
    );

    return () => {
      window.removeEventListener(
        "load",
        registerServiceWorker
      );
    };
  }, []);

  /**
   * Écoute de l'installation native.
   *
   * beforeinstallprompt est disponible
   * uniquement dans certains navigateurs.
   */
  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      if (isInstalled()) {
        return;
      }

      setDeferredPrompt(
        event as BeforeInstallPromptEvent
      );
    };

    const handleAppInstalled = () => {
      setAlreadyInstalled(true);
      setDeferredPrompt(null);
      setVisible(false);
      setShowGuide(false);

      try {
        window.localStorage.removeItem(DISMISS_KEY);
      } catch {
        // Aucun traitement nécessaire.
      }
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled
      );
    };
  }, []);

  /**
   * Détermine si l'invitation peut apparaître.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
    if (!ready || alreadyInstalled || isInstalled()) {
      setVisible(false);
      return;
    }

    if (isRestrictedPage() || isDismissed()) {
      setVisible(false);
      return;
    }

    // Android : installation native ou guide manuel.
    // iOS : instructions d'ajout à l'écran d'accueil.
    // PC : seulement si installation native proposée.
    const canShow =
      platform === "ios" ||
      platform === "android" ||
      deferredPrompt !== null;

    setVisible(canShow);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    ready,
    alreadyInstalled,
    platform,
    deferredPrompt,
    pathname,
  ]);

  /**
   * Fermer l'invitation pour 7 jours.
   */
  const dismiss = useCallback(() => {
    saveDismissal();
    setVisible(false);
    setShowGuide(false);
  }, []);

  /**
   * Installation native quand le navigateur
   * fournit beforeinstallprompt.
   */
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      setShowGuide(true);
      return;
    }

    if (installing) {
      return;
    }

    setInstalling(true);

    try {
      // L'appel doit être déclenché
      // directement par le clic utilisateur.
      await deferredPrompt.prompt();

      const choice = await deferredPrompt.userChoice;

      setDeferredPrompt(null);

      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        // Ne pas relancer immédiatement
        // une invitation refusée.
        saveDismissal();
        setVisible(false);
      }
    } catch (error) {
      console.error(
        "[TIKEMIA PWA] Installation:",
        error
      );

      setDeferredPrompt(null);
      setShowGuide(true);
    } finally {
      setInstalling(false);
    }
  }, [deferredPrompt, installing]);

  /**
   * Aucun affichage si l'application est déjà
   * installée ou si l'invitation est masquée.
   */
  if (!visible || alreadyInstalled || isRestrictedPage()) {
    return null;
  }

  const guideTitle =
    platform === "ios"
      ? t.iosTitle
      : platform === "android"
        ? t.androidTitle
        : t.desktopTitle;

  const guideSteps =
    platform === "ios"
      ? [
          t.iosStep1,
          t.iosStep2,
          t.iosStep3,
        ]
      : platform === "android"
        ? [
            t.androidStep1,
            t.androidStep2,
            t.androidStep3,
          ]
        : [
            t.desktopStep1,
            t.desktopStep2,
          ];

  return (
    <section
      aria-label={t.title}
      className="
        fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-4 right-4 z-999
        mx-auto w-auto max-w-97.5
        overflow-hidden rounded-2xl
        border border-slate-200
        bg-white text-slate-900
        shadow-[0_14px_55px_rgba(15,23,42,0.22)]
        sm:bottom-6 sm:left-auto sm:right-6 sm:w-97.5
      "
    >
      {/* Bande d'identité TIKEMIA */}
      <div className="h-1 bg-[#087A32]" />

      <div className="p-4 sm:p-5">
        {/* En-tête */}
        <div className="flex items-start gap-3">
          <div
            className="
              flex h-15 w-15 shrink-0
              items-center justify-center
              overflow-hidden rounded-2xl
              border border-slate-100
              bg-white shadow-sm
            "
          >
            {/* Icône officielle TIKEMIA */}
            <Image
              src="/icons/icon-192.png"
              alt="TIKEMIA"
              width={60}
              height={60}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#087A32]">
              TIKEMIA
            </p>

            <h2 className="mt-1 text-[17px] font-bold leading-tight text-[#10243A]">
              {t.title}
            </h2>

            <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
              {t.description}
            </p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label={t.close}
            title={t.close}
            className="
              flex h-8 w-8 shrink-0
              items-center justify-center
              rounded-full text-slate-500
              transition-colors
              hover:bg-slate-100
              focus-visible:outline-2
              focus-visible:outline-offset-2
              focus-visible:outline-[#087A32]
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Avantages */}
        {!showGuide && (
          <div className="mt-4 rounded-xl bg-[#F4F9F6] px-3 py-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-[#087A32]">
              <span className="h-2 w-2 rounded-full bg-[#087A32]" />
              {t.free}
            </div>

            <div className="space-y-2">
              {[
                t.tickets,
                t.events,
                t.donations,
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#087A32"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0"
                  >
                    <path d="m5 12 4 4L19 6" />
                  </svg>

                  <span className="text-xs text-slate-700">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions d'installation */}
        {showGuide && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-[13px] font-bold text-[#10243A]">
              {guideTitle}
            </h3>

            {platform === "ios" && (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {t.iosDescription}
              </p>
            )}

            <ol className="mt-3 space-y-3">
              {guideSteps.map((step, index) => (
                <li
                  key={`${index}-${step}`}
                  className="flex items-start gap-2"
                >
                  <span
                    className="
                      flex h-6 w-6 shrink-0
                      items-center justify-center
                      rounded-full bg-[#087A32]
                      text-[11px] font-bold text-white
                    "
                  >
                    {index + 1}
                  </span>

                  <span className="pt-1 text-xs leading-relaxed text-slate-700">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 space-y-2">
          {showGuide ? (
            <button
              type="button"
              onClick={dismiss}
              className="
                flex min-h-11 w-full
                items-center justify-center
                rounded-xl bg-[#087A32]
                px-4 text-sm font-semibold
                text-white transition-colors
                hover:bg-[#066629]
                focus-visible:outline-2
                focus-visible:outline-offset-2
                focus-visible:outline-[#087A32]
              "
            >
              {t.done}
            </button>
          ) : deferredPrompt ? (
            <button
              type="button"
              onClick={() => void handleInstall()}
              disabled={installing}
              className="
                flex min-h-11 w-full
                items-center justify-center gap-2
                rounded-xl bg-[#087A32]
                px-4 text-sm font-semibold
                text-white transition-colors
                hover:bg-[#066629]
                disabled:cursor-not-allowed
                disabled:opacity-70
                focus-visible:outline-2
                focus-visible:outline-offset-2
                focus-visible:outline-[#087A32]
              "
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
              </svg>

              {installing ? t.installing : t.install}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="
                flex min-h-11 w-full
                items-center justify-center gap-2
                rounded-xl bg-[#087A32]
                px-4 text-sm font-semibold
                text-white transition-colors
                hover:bg-[#066629]
                focus-visible:outline-2
                focus-visible:outline-offset-2
                focus-visible:outline-[#087A32]
              "
            >
              {platform === "ios"
                ? t.iosHelp
                : platform === "android"
                  ? t.androidHelp
                  : t.desktopHelp}
            </button>
          )}

          {!showGuide && (
            <button
              type="button"
              onClick={dismiss}
              className="
                min-h-9 w-full rounded-lg
                text-xs font-medium text-slate-500
                transition-colors hover:bg-slate-50
                hover:text-slate-700
                focus-visible:outline-2
                focus-visible:outline-offset-2
                focus-visible:outline-[#087A32]
              "
            >
              {t.later}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
