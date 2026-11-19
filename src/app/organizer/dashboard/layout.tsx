
"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { defaultLocale, i18nConfig, normalizeLocale, type Locale } from "@/i18n/config";

function subscribeLocale(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("tikemia:locale-changed", onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener("tikemia:locale-changed", onChange); };
}

function readStoredLocale(): Locale {
  try {
    return normalizeLocale(window.localStorage.getItem(i18nConfig.storageKey) ?? defaultLocale);
  } catch {
    return defaultLocale;
  }
}

import OrganizerHeader from "@/components/organizer/OrganizerHeader";
import OrganizerSidebar from "@/components/organizer/OrganizerSidebar";

/* ============================================
   TIKEMIA — LAYOUT ORGANISATEUR

   Route :
   /organizer/dashboard

   Structure commune :
   - En-tête organisateur
   - Menu vertical PC
   - Menu hamburger mobile
   - Navigation inférieure mobile
   - Zone de contenu pleine largeur

   Next.js App Router
   TypeScript
   Tailwind CSS 4
   Responsive Mobile / Tablette / PC
============================================ */

/* ============================================
   TYPES
============================================ */

type OrganizerDashboardLayoutProps = {
  children: ReactNode;
};

/* ============================================
   COMPOSANT PRINCIPAL
============================================ */

function OrganizerDashboardContent({
  children,
}: OrganizerDashboardLayoutProps) {
  /* ==========================================
     ÉTAT DU MENU MOBILE
  ========================================== */

  const [access, setAccess] = useState<"checking" | "authorized" | "error">("checking");
  const [identity, setIdentity] = useState<{ name: string; avatarUrl: string | null; blueBadgeEnabled: boolean }>({ name: "", avatarUrl: null, blueBadgeEnabled: false });

  const storedLocale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => defaultLocale);
  const [selectedLocale, setSelectedLocale] = useState<Locale | null>(null);
  const locale = selectedLocale ?? storedLocale;
  const [logoutStatus, setLogoutStatus] = useState<"idle" | "pending" | "error">("idle");
  const logoutLock = useRef(false);

  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;
    let refreshing = false;
    const refresh = () => {
      if (refreshing || stopped) return;
      refreshing = true;
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      const timeout = window.setTimeout(() => controller?.abort(), 20000);
      const options = { credentials: "same-origin" as const, cache: "no-store" as const, signal, headers: { "Accept-Language": locale } };
      return Promise.all([
        fetch("/api/organizer/settings/profile", options).then(async response => {
          if (signal.aborted) return null;
          if (response.status === 401 || response.status === 403) {
            setAccess("checking");
            window.location.replace("/organizer/login");
            return null;
          }
          if (!response.ok) throw new Error("SESSION_CHECK_FAILED");
          const result = await response.json();
          if (!result.success) throw new Error("SESSION_CHECK_FAILED");
          setAccess("authorized");
          return result;
        }),
        fetch("/api/organizer/settings/profile/avatar", options).then(response => response.ok ? response.json() : null),
      ]).then(([result, photo]) => {
        if (stopped || signal.aborted) return;
        const profile = result?.success ? result.profile : null;
        setIdentity(previous => ({
          name: profile ? profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.organizationName || "" : previous.name,
          blueBadgeEnabled: profile ? profile.blueBadgeEnabled === true : previous.blueBadgeEnabled,
          avatarUrl: photo?.success ? photo.avatar?.url ?? null : previous.avatarUrl,
        }));
      }).catch(() => { if (!stopped) setAccess("error"); }).finally(() => { refreshing = false; window.clearTimeout(timeout); });
    };
    const refreshVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    const timer = window.setInterval(refreshVisible, 15_000);
    window.addEventListener("tikemia:organizer-avatar-updated", refreshVisible);
    window.addEventListener("tikemia:organizer-profile-updated", refreshVisible);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => { stopped = true; controller?.abort(); window.clearInterval(timer); window.removeEventListener("tikemia:organizer-avatar-updated", refreshVisible); window.removeEventListener("tikemia:organizer-profile-updated", refreshVisible); window.removeEventListener("focus", refreshVisible); document.removeEventListener("visibilitychange", refreshVisible); };
  }, [locale]);

  const changeLocale = useCallback((nextLocale: Locale) => {
    setSelectedLocale(nextLocale);
    try {
      window.localStorage.setItem(i18nConfig.storageKey, nextLocale);
      setSelectedLocale(null);
    } catch {
      // Le choix reste actif si le stockage est indisponible.
    }
    window.dispatchEvent(new Event("storage"));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const logout = useCallback(async () => {
    if (logoutLock.current) return;
    logoutLock.current = true;
    setLogoutStatus("pending");
    try {
      const response = await fetch("/api/organizer/verify-email", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("LOGOUT_FAILED");
      window.location.replace("/organizer");
    } catch {
      setLogoutStatus("error");
      logoutLock.current = false;
    }
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  /* ==========================================
     OUVERTURE DU MENU
  ========================================== */

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((previous) => !previous);
  }, []);

  /* ==========================================
     FERMETURE DU MENU
  ========================================== */

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  /* ==========================================
     FERMER LE MENU LORS DU PASSAGE EN PC

     Si l'utilisateur ouvre le menu mobile,
     puis agrandit son écran, le menu mobile
     doit se fermer automatiquement.
  ========================================== */

  useEffect(() => {
    const desktopQuery = window.matchMedia(
      "(min-width: 1024px)"
    );

    function handleScreenChange(
      event: MediaQueryListEvent
    ) {
      if (event.matches) {
        setMobileMenuOpen(false);
      }
    }

    desktopQuery.addEventListener(
      "change",
      handleScreenChange
    );

    return () => {
      desktopQuery.removeEventListener(
        "change",
        handleScreenChange
      );
    };
  }, []);

  /* ==========================================
     AFFICHAGE
  ========================================== */

  if (access !== "authorized") return <div role="status" className="flex min-h-dvh w-full flex-col items-center justify-center gap-3 bg-[#f8faf9] p-4 text-center"><p>{access === "error" ? "Impossible de vérifier la session." : "Vérification de la session..."}</p>{access === "error" && <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-green-700 px-5 py-3 text-white">Réessayer</button>}</div>;

  return (
    <div
      id="tikemia-organizer-dashboard"
      className="
        flex
        h-dvh
        min-h-0
        w-full
        min-w-0
        flex-col
        overflow-hidden
        bg-[#f8faf9]
        text-[#142138]
      "
    >
      {/* ======================================
          EN-TÊTE ORGANISATEUR

          Pleine largeur :
          - Logo TIKEMIA
          - Badge Espace Organisateur
          - Hamburger mobile
          - Notifications
          - Profil
      ====================================== */}

      <div className="relative z-40 w-full shrink-0">
        <OrganizerHeader
          organizerName={identity.name}
          blueBadgeEnabled={identity.blueBadgeEnabled}
          avatarUrl={identity.avatarUrl}
          locale={locale}
          onLocaleChange={changeLocale}
          mobileMenuOpen={mobileMenuOpen}
          onMenuClick={toggleMobileMenu}
        />
      </div>

      {/* ======================================
          ESPACE PRINCIPAL

          PC :
          Menu gauche + contenu droit.

          MOBILE :
          Contenu pleine largeur.
          Le menu mobile et la barre du bas
          sont gérés par OrganizerSidebar.
      ====================================== */}

      <div
        className="
          relative
          flex
          min-h-0
          w-full
          min-w-0
          flex-1
          overflow-hidden
        "
      >
        {/* ====================================
            MENU LATÉRAL

            PC :
            Largeur 240 px, pleine hauteur.

            MOBILE :
            Drawer + navigation fixe.
        ==================================== */}

        <OrganizerSidebar
          locale={locale}
          onLogout={logout}
          loggingOut={logoutStatus === "pending"}
          logoutFailed={logoutStatus === "error"}
          mobileOpen={mobileMenuOpen}
          onMobileClose={closeMobileMenu}
        />

        {/* ====================================
            ZONE DE CONTENU

            Occupe toute la largeur restante.

            PC :
            Défilement indépendant du menu.

            MOBILE :
            Espacement inférieur réservé
            à la barre de navigation fixe.
        ==================================== */}

        <div
          id="organizer-main-content"
          className="
            relative
            flex
            min-h-0
            min-w-0
            flex-1
            flex-col
            overflow-x-hidden
            overflow-y-auto
            overscroll-contain
            bg-[#f8faf9]
            mb-[calc(64px+env(safe-area-inset-bottom))]
            lg:mb-0
          "
        >
          <div
            className="
              flex
              min-h-0
              w-full
              min-w-0
              flex-1
              flex-col
            "
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrganizerDashboardLayout(props: OrganizerDashboardLayoutProps) {
  return <Suspense fallback={<div className="min-h-dvh bg-white" aria-busy="true" />}><OrganizerDashboardContent {...props} /></Suspense>;
}
