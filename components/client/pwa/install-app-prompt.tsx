"use client";

import {
  Download,
  Share,
  Smartphone,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

const DISMISSED_STORAGE_KEY =
  "tikemia-pwa-install-prompt-dismissed";

const DISMISS_DURATION =
  7 * 24 * 60 * 60 * 1000;

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const standaloneMedia =
    window.matchMedia(
      "(display-mode: standalone)",
    ).matches;

  const navigatorStandalone =
    (
      window.navigator as Navigator & {
        standalone?: boolean;
      }
    ).standalone === true;

  return (
    standaloneMedia ||
    navigatorStandalone
  );
}

function isIOSDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent =
    window.navigator.userAgent.toLowerCase();

  const platform =
    window.navigator.platform;

  const touchPoints =
    window.navigator.maxTouchPoints;

  return (
    /iphone|ipad|ipod/.test(
      userAgent,
    ) ||
    (
      platform === "MacIntel" &&
      touchPoints > 1
    )
  );
}

function isSafariBrowser() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent =
    window.navigator.userAgent.toLowerCase();

  return (
    userAgent.includes("safari") &&
    !userAgent.includes("crios") &&
    !userAgent.includes("fxios") &&
    !userAgent.includes("edgios") &&
    !userAgent.includes("chrome")
  );
}

function wasRecentlyDismissed() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const storedValue =
      window.localStorage.getItem(
        DISMISSED_STORAGE_KEY,
      );

    if (!storedValue) {
      return false;
    }

    const dismissedAt =
      Number(storedValue);

    if (
      !Number.isFinite(
        dismissedAt,
      )
    ) {
      window.localStorage.removeItem(
        DISMISSED_STORAGE_KEY,
      );

      return false;
    }

    const stillDismissed =
      Date.now() - dismissedAt <
      DISMISS_DURATION;

    if (!stillDismissed) {
      window.localStorage.removeItem(
        DISMISSED_STORAGE_KEY,
      );
    }

    return stillDismissed;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(
      DISMISSED_STORAGE_KEY,
      String(Date.now()),
    );
  } catch {
    // Le stockage local peut être indisponible.
  }
}

export default function InstallAppPrompt() {
  const [
    installPrompt,
    setInstallPrompt,
  ] =
    useState<BeforeInstallPromptEvent | null>(
      null,
    );

  const [
    visible,
    setVisible,
  ] =
    useState(false);

  const [
    installed,
    setInstalled,
  ] =
    useState(false);

  const [
    showIOSHelp,
    setShowIOSHelp,
  ] =
    useState(false);

  const [
    installing,
    setInstalling,
  ] =
    useState(false);

  const isIOS =
    useMemo(
      () => isIOSDevice(),
      [],
    );

  const isSafari =
    useMemo(
      () => isSafariBrowser(),
      [],
    );

  useEffect(() => {
    if (isStandaloneMode()) {
      setInstalled(true);

      return;
    }

    if (wasRecentlyDismissed()) {
      return;
    }

    const handleBeforeInstallPrompt = (
      event: Event,
    ) => {
      event.preventDefault();

      const promptEvent =
        event as BeforeInstallPromptEvent;

      setInstallPrompt(
        promptEvent,
      );

      setVisible(true);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setShowIOSHelp(false);
      setInstallPrompt(null);

      try {
        window.localStorage.removeItem(
          DISMISSED_STORAGE_KEY,
        );
      } catch {
        // Aucun traitement nécessaire.
      }
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );

    window.addEventListener(
      "appinstalled",
      handleInstalled,
    );

    if (isIOS) {
      const timer =
        window.setTimeout(() => {
          if (
            !isStandaloneMode() &&
            !wasRecentlyDismissed()
          ) {
            setVisible(true);
          }
        }, 1800);

      return () => {
        window.clearTimeout(
          timer,
        );

        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt,
        );

        window.removeEventListener(
          "appinstalled",
          handleInstalled,
        );
      };
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );

      window.removeEventListener(
        "appinstalled",
        handleInstalled,
      );
    };
  }, [isIOS]);

  function closePrompt() {
    rememberDismissal();

    setVisible(false);
    setShowIOSHelp(false);
  }

  async function installApp() {
    if (isIOS) {
      setShowIOSHelp(true);

      return;
    }

    if (!installPrompt) {
      return;
    }

    setInstalling(true);

    try {
      await installPrompt.prompt();

      const choice =
        await installPrompt.userChoice;

      if (
        choice.outcome ===
        "accepted"
      ) {
        setVisible(false);
      } else {
        rememberDismissal();

        setVisible(false);
      }

      setInstallPrompt(null);
    } catch {
      // Le navigateur garde le contrôle
      // de l'installation de la PWA.
    } finally {
      setInstalling(false);
    }
  }

  if (
    installed ||
    !visible
  ) {
    return null;
  }

  return (
    <>
      <div
        className="
          fixed inset-x-0 bottom-0 z-[100]
          px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]
          sm:left-auto sm:right-5 sm:w-[390px]
          sm:px-0 sm:pb-5
        "
      >
        <div
          className="
            overflow-hidden rounded-[24px]
            border border-white/10
            bg-[#07100d]/95
            shadow-[0_24px_80px_rgba(0,0,0,0.55)]
            backdrop-blur-xl
          "
        >
          <div className="relative p-4 sm:p-5">
            <button
              type="button"
              onClick={
                closePrompt
              }
              aria-label="Fermer"
              className="
                absolute right-3 top-3
                flex h-9 w-9
                items-center justify-center
                rounded-full
                border border-white/[0.07]
                bg-white/[0.04]
                text-neutral-500
                transition
                hover:bg-white/[0.08]
                hover:text-white
              "
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-4 pr-9">
              <div
                className="
                  flex h-14 w-14 shrink-0
                  items-center justify-center
                  overflow-hidden rounded-2xl
                  border border-white/10
                  bg-white
                  shadow-lg
                "
              >
                <img
                  src="/icons/icon-192x192.png"
                  alt="Tikemia"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 pt-0.5">
                <p
                  className="
                    text-[10px] font-black
                    uppercase
                    tracking-[0.18em]
                    text-lime-400
                  "
                >
                  Application Tikemia
                </p>

                <h2
                  className="
                    mt-1 text-[17px]
                    font-black
                    leading-tight
                    text-white
                  "
                >
                  Installez Tikemia
                </h2>

                <p
                  className="
                    mt-1.5 text-xs
                    leading-5
                    text-neutral-400
                  "
                >
                  Accédez plus rapidement
                  à vos événements,
                  favoris et billets
                  depuis votre écran
                  d’accueil.
                </p>
              </div>
            </div>

            {!showIOSHelp ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={
                    installApp
                  }
                  disabled={
                    installing
                  }
                  className="
                    inline-flex h-12
                    w-full items-center
                    justify-center gap-2
                    rounded-xl
                    bg-gradient-to-r
                    from-emerald-500
                    via-lime-500
                    to-amber-400
                    px-5 text-sm
                    font-black
                    text-[#07100d]
                    shadow-lg
                    transition
                    hover:brightness-110
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >
                  {isIOS ? (
                    <Share className="h-4 w-4" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}

                  {installing
                    ? "Installation..."
                    : isIOS
                      ? "Installer sur iPhone"
                      : "Installer l’application"}
                </button>

                <p
                  className="
                    mt-3 text-center
                    text-[10px]
                    leading-4
                    text-neutral-600
                  "
                >
                  Installation rapide •
                  Accès depuis votre écran
                  d’accueil
                </p>
              </div>
            ) : (
              <div
                className="
                  mt-4 rounded-2xl
                  border border-white/[0.08]
                  bg-white/[0.035]
                  p-4
                "
              >
                <div className="flex items-center gap-2">
                  <Smartphone
                    className="
                      h-4 w-4
                      text-lime-400
                    "
                  />

                  <p
                    className="
                      text-sm font-black
                      text-white
                    "
                  >
                    Installation sur iPhone
                  </p>
                </div>

                {isSafari ? (
                  <div
                    className="
                      mt-3 space-y-3
                      text-xs
                      leading-5
                      text-neutral-400
                    "
                  >
                    <p>
                      <strong className="text-white">
                        1.
                      </strong>{" "}
                      Appuyez sur le bouton{" "}
                      <span className="font-bold text-white">
                        Partager
                      </span>{" "}
                      dans Safari.
                    </p>

                    <p>
                      <strong className="text-white">
                        2.
                      </strong>{" "}
                      Choisissez{" "}
                      <span className="font-bold text-white">
                        Sur l’écran
                        d’accueil
                      </span>
                      .
                    </p>

                    <p>
                      <strong className="text-white">
                        3.
                      </strong>{" "}
                      Appuyez sur{" "}
                      <span className="font-bold text-white">
                        Ajouter
                      </span>
                      .
                    </p>
                  </div>
                ) : (
                  <div
                    className="
                      mt-3 text-xs
                      leading-5
                      text-neutral-400
                    "
                  >
                    Ouvrez Tikemia dans{" "}
                    <strong className="text-white">
                      Safari
                    </strong>
                    , puis utilisez{" "}
                    <strong className="text-white">
                      Partager → Sur
                      l’écran d’accueil
                    </strong>
                    .
                  </div>
                )}

                <button
                  type="button"
                  onClick={
                    closePrompt
                  }
                  className="
                    mt-4 h-10 w-full
                    rounded-xl
                    border
                    border-white/[0.08]
                    text-xs font-bold
                    text-neutral-400
                    transition
                    hover:bg-white/[0.05]
                    hover:text-white
                  "
                >
                  Compris
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}