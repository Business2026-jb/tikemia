
"use client";
import { VerifiedBadge } from "@/components/public/PublicNavigation";

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


import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import publicFr from "@/i18n/fr.json";
import publicEn from "@/i18n/en.json";
const publicDictionaries = { fr: publicFr.organizerLanding, en: publicEn.organizerLanding };

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ScanLine,
  Bell,
  Languages,
  ChevronDown,
  Menu,
  Settings,
  UserRound,
  UsersRound,
  UserRoundPlus,
  X,
} from "lucide-react";

import {
  defaultLocale,
  i18nConfig,
  normalizeLocale,
  type Locale,
} from "@/i18n/config";

/* ============================================
   TIKEMIA — ORGANIZER HEADER

   PC :
   - Logo officiel TIKEMIA
   - Badge Espace Organisateur
   - Notifications
   - Profil organisateur
   - Menus déroulants

   MOBILE :
   - Hamburger à gauche
   - Logo centré
   - Notifications à droite
   - Avatar à droite

   Compatible avec OrganizerSidebar
   Responsive / Français / Anglais
============================================ */

/* ============================================
   TYPES
============================================ */

export type OrganizerNotification = {
  id: string;
  title: string;
  description?: string;
  href?: string;
  unread?: boolean;
};

export type OrganizerHeaderProps = {
  onMenuClick?: () => void;
  mobileMenuOpen?: boolean;
  locale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
  organizerName?: string | null;
  blueBadgeEnabled?: boolean;
  organizerRole?: string | null;
  avatarUrl?: string | null;
  notifications?: OrganizerNotification[];
  className?: string;
};

/* ============================================
   ROUTES
============================================ */

const ROUTES = {
  dashboard: "/organizer/dashboard",
  profile: "/organizer/dashboard/profile",
  settings: "/organizer/dashboard/settings",
} as const;

/* ============================================
   TRADUCTIONS
============================================ */

const TEXT = {
  fr: {
    organizerSpace: "Espace Organisateur",
    organizer: "Organisateur",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    notifications: "Notifications",
    noNotifications: "Aucune notification",
    profile: "Mon profil",
    settings: "Paramètres",
    account: "Compte organisateur",
    switchLanguage: "Passer en anglais",
    close: "Fermer",
  },
  en: {
    organizerSpace: "Organizer Space",
    organizer: "Organizer",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    notifications: "Notifications",
    noNotifications: "No notifications",
    profile: "My profile",
    settings: "Settings",
    account: "Organizer account",
    switchLanguage: "Switch to French",
    close: "Close",
  },
} as const;

type OpenPanel = "notifications" | "profile" | null;

/* ============================================
   UTILITAIRES
============================================ */

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "O";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return (
    parts[0].slice(0, 1) +
    parts[parts.length - 1].slice(0, 1)
  ).toUpperCase();
}

function getSafeName(
  name: string | null | undefined,
  fallback: string
): string {
  const normalized = name?.trim();

  return normalized || fallback;
}

function isInternalPath(
  value: string | undefined
): value is string {
  if (!value) {
    return false;
  }

  return (
    value.startsWith("/organizer/dashboard") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.includes("\n") &&
    !value.includes("\r")
  );
}

/* ============================================
   PETIT AVATAR RÉUTILISABLE
============================================ */

function OrganizerAvatar({
  name,
  avatarUrl,
  size = "normal",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "normal" | "small";
}) {
  const dimensions =
    size === "small"
      ? "size-10"
      : "size-11 sm:size-12";

  const [failedUrl, setFailedUrl] = useState<string | null>(null);



  return (
    <span
      aria-hidden="true"
      className={[
        "relative flex shrink-0",
        "items-center justify-center",
        "overflow-hidden rounded-full",
        "border-2 border-white",
        "bg-[#e9f7e7]",
        "text-sm font-extrabold",
        "text-[#07522c]",
        "shadow-sm",
        dimensions,
      ].join(" ")}
    >
      {avatarUrl && failedUrl !== avatarUrl ? (
        // La photo peut provenir d'un domaine
        // distant non déclaré dans Next.js.
        // L'image est traitée comme une URL
        // fournie par le système de profil.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(avatarUrl)}
        />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}

/* ============================================
   COMPOSANT PRINCIPAL
============================================ */

export default function OrganizerHeader({
  onMenuClick,
  mobileMenuOpen = false,
  locale,
  onLocaleChange,
  organizerName,
  blueBadgeEnabled = false,
  organizerRole,
  avatarUrl,
  notifications = [],
  className = "",
}: OrganizerHeaderProps) {
  const pathname = usePathname();

  const storedLocale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => defaultLocale);
  const currentLocale = locale ?? storedLocale;

  const [panelPath, setPanelPath] = useState(pathname);
  const [openPanel, setOpenPanel] =
    useState<OpenPanel>(null);

  const notificationsRef =
    useRef<HTMLDivElement>(null);

  const profileRef =
    useRef<HTMLDivElement>(null);

  const t = TEXT[currentLocale];

  const displayName = getSafeName(
    organizerName,
    t.organizer
  );

  const displayRole = getSafeName(
    organizerRole,
    t.organizer
  );

  const unreadCount = notifications.filter(
    (notification) => notification.unread === true
  ).length;

  /* ==========================================
     SYNCHRONISATION DE LA LANGUE
  ========================================== */



  /* ==========================================
     FERMER LES MENUS À LA NAVIGATION
  ========================================== */

  if (panelPath !== pathname) {
    setPanelPath(pathname);
    setOpenPanel(null);
  }

  /* ==========================================
     FERMER AU CLIC EXTÉRIEUR / ESCAPE
  ========================================== */

  useEffect(() => {
    if (!openPanel) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      const currentRef =
        openPanel === "notifications"
          ? notificationsRef.current
          : profileRef.current;

      if (
        currentRef &&
        !currentRef.contains(target)
      ) {
        setOpenPanel(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    }

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [openPanel]);

  /* ==========================================
     OUVERTURE / FERMETURE
  ========================================== */

  function togglePanel(panel: OpenPanel) {
    setOpenPanel((current) =>
      current === panel ? null : panel
    );
  }

  function closePanel() {
    setOpenPanel(null);
  }

  /* ==========================================
     CONTENU DES NOTIFICATIONS
  ========================================== */

  function renderNotifications(): ReactNode {
    return (
      <>
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-extrabold text-[#073f25]">
            {t.notifications}
          </h2>

          <button
            type="button"
            onClick={closePanel}
            aria-label={t.close}
            className="flex size-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 px-5 py-7 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-green-50 text-green-800">
              <Bell size={25} />
            </span>

            <p className="text-sm font-medium text-gray-600">
              {t.noNotifications}
            </p>
          </div>
        ) : (
          <div className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain py-1">
            {notifications.map((notification) => {
              const content = (
                <div className="flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-green-50">
                  <span
                    className={[
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      notification.unread
                        ? "bg-green-600"
                        : "bg-gray-200",
                    ].join(" ")}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="wrap-break-word text-sm font-bold text-gray-900">
                      {notification.title}
                    </p>

                    {notification.description && (
                      <p className="mt-1 wrap-break-word text-xs leading-relaxed text-gray-600">
                        {notification.description}
                      </p>
                    )}
                  </div>
                </div>
              );

              return isInternalPath(
                notification.href
              ) ? (
                <Link
                  key={notification.id}
                  href={notification.href}
                  onClick={closePanel}
                  className="block"
                >
                  {content}
                </Link>
              ) : (
                <div key={notification.id}>
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  /* ==========================================
     CONTENU DU PROFIL
  ========================================== */

  function renderProfile(): ReactNode {
    return (
      <>
        <div className="border-b border-gray-100 px-4 py-4">
          <div className="flex items-center gap-3">
            <OrganizerAvatar
              name={displayName}
              avatarUrl={avatarUrl}
              size="small"
            />

            <div className="min-w-0 flex-1">
              <p className=" text-sm font-extrabold text-gray-950 flex min-w-0 items-center gap-1">
                <span className="min-w-0 truncate">{displayName}</span>{blueBadgeEnabled && <VerifiedBadge />}
              </p>

              <p className="truncate text-xs text-gray-600">
                {displayRole}
              </p>
            </div>
          </div>
        </div>

        <div className="p-2">
          <Link
            href={ROUTES.profile}
            onClick={closePanel}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-green-50 hover:text-green-800"
          >
            <UserRound size={19} />
            {t.profile}
          </Link>

          <Link
            href={ROUTES.settings}
            onClick={closePanel}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-green-50 hover:text-green-800"
          >
            <Settings size={19} />
            {t.settings}
          </Link>
        </div>
      </>
    );
  }

  /* ==========================================
     AFFICHAGE PRINCIPAL
  ========================================== */

  return (
    <header
      className={[
        "sticky top-0 z-40",
        "w-full min-w-0",
        "border-b border-gray-200",
        "bg-white",
        "shadow-[0_2px_12px_rgba(0,0,0,0.04)]",
        className,
      ].join(" ")}
    >
      <div className="grid h-16 w-full min-w-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center justify-between gap-2 lg:flex px-3 sm:px-5 lg:h-20 lg:gap-4 lg:px-6 xl:px-8">
        {/* ====================================
            GAUCHE PC :
            LOGO + BADGE
        ==================================== */}

        <div className="hidden min-w-0 items-center gap-4 lg:flex xl:gap-6">
          <Link
            href={ROUTES.dashboard}
            aria-label="TIKEMIA"
            className="relative block h-13 w-40 shrink-0 xl:w-48"
          >
            <Image
              src="/logo/logo.png"
              alt="TIKEMIA"
              fill
              priority
              sizes="(min-width: 1280px) 192px, 160px"
              className="object-contain"
            />
          </Link>

          <span className="inline-flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-full bg-[#eaf9e8] px-4 text-sm font-extrabold text-[#074c28]">
            <UsersRound
              size={21}
              strokeWidth={2}
              aria-hidden="true"
            />
            {t.organizerSpace}
          </span>
        </div>

        {/* ====================================
            GAUCHE MOBILE :
            MENU HAMBURGER
        ==================================== */}

        <button
          type="button"
          onClick={onMenuClick}
          aria-label={
            mobileMenuOpen
              ? t.closeMenu
              : t.openMenu
          }
          aria-expanded={mobileMenuOpen}
          aria-controls="organizer-mobile-navigation"
          className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-lg text-[#132238] transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-green-700 lg:hidden"
        >
          {mobileMenuOpen ? (
            <X size={25} />
          ) : (
            <Menu size={25} />
          )}
        </button>

        {/* ====================================
            LOGO CENTRÉ SUR MOBILE
        ==================================== */}

        <Link
          href={ROUTES.dashboard}
          aria-label="TIKEMIA"
          className="relative h-11 w-full max-w-39.5 justify-self-center sm:absolute sm:left-1/2 sm:w-39.5 sm:-translate-x-1/2 lg:hidden"
        >
          <Image
            src="/logo/logo.png"
            alt="TIKEMIA"
            fill
            priority
            sizes="(max-width: 374px) 108px, (max-width: 640px) 140px, 158px"
            className="object-contain"
          />
        </Link>

        {/* ====================================
            DROITE :
            NOTIFICATIONS + PROFIL
        ==================================== */}

        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1 sm:gap-3 lg:gap-4">
          <Link href="/organizer/dashboard/scan" aria-label={locale === "en" ? "Ticket scanner" : "Scan des billets"} className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-green-700 px-2.5 text-sm font-semibold text-white hover:bg-green-800"><ScanLine size={20} aria-hidden="true" /><span className="hidden sm:inline">Scan</span></Link>
          {/* NOTIFICATIONS */}

          <div
            ref={notificationsRef}
            className="relative"
          >
            <button
              type="button"
              onClick={() =>
                togglePanel("notifications")
              }
              aria-label={
                unreadCount > 0
                  ? `${t.notifications} (${unreadCount})`
                  : t.notifications
              }
              aria-expanded={
                openPanel === "notifications"
              }
              aria-haspopup="dialog"
              aria-controls="organizer-notifications-panel"
              className="relative flex size-10 items-center justify-center rounded-full text-[#132238] transition-colors hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-700 sm:size-11"
            >
              <Bell
                size={25}
                strokeWidth={1.9}
                aria-hidden="true"
              />

              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex min-h-3 min-w-3 items-center justify-center rounded-full border-2 border-white bg-red-500 px-0.5 text-[8px] font-bold leading-none text-white">
                  {unreadCount > 9
                    ? "9+"
                    : unreadCount > 1
                      ? unreadCount
                      : ""}
                </span>
              )}
            </button>

            {openPanel === "notifications" && (
              <div
                id="organizer-notifications-panel"
                role="dialog"
                aria-label={t.notifications}
                className="fixed inset-x-3 top-27 z-50 w-auto sm:absolute sm:inset-x-auto sm:top-[calc(100%+12px)] sm:w-92.5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_45px_rgba(0,0,0,0.16)] sm:right-0"
              >
                {renderNotifications()}
              </div>
            )}
          </div>

          {onLocaleChange && (
            <button
              type="button"
              onClick={() => onLocaleChange(currentLocale === "fr" ? "en" : "fr")}
              aria-label={t.switchLanguage}
              title={t.switchLanguage}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 text-sm font-semibold text-[#132238] transition-colors hover:border-green-700 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 sm:px-3"
            >
              <Languages size={19} className="hidden sm:block" aria-hidden="true" />
              <span>{currentLocale.toUpperCase()}</span>
            </button>
          )}

          {/* SÉPARATEUR PC */}

          <div
            aria-hidden="true"
            className="hidden h-9 w-px bg-gray-200 lg:block"
          />

          {/* PROFIL */}

          <div
            ref={profileRef}
            className="relative"
          >
            <button
              type="button"
              onClick={() =>
                togglePanel("profile")
              }
              aria-label={t.account}
              aria-expanded={
                openPanel === "profile"
              }
              aria-haspopup="menu"
              aria-controls="organizer-profile-panel"
              className="flex min-w-0 items-center gap-2 rounded-xl p-0.5 text-left transition-colors hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-700 lg:gap-3 lg:pr-2"
            >
              <OrganizerAvatar
                name={displayName}
                avatarUrl={avatarUrl}
              />

              <div className="hidden min-w-0 max-w-42 flex-col lg:flex">
                <span className="truncate text-sm font-extrabold text-gray-950">
                  {displayName}{blueBadgeEnabled && <VerifiedBadge />}
                </span>

                <span className="truncate text-xs font-medium text-gray-600">
                  {displayRole}
                </span>
              </div>

              <ChevronDown
                size={19}
                aria-hidden="true"
                className={[
                  "hidden shrink-0 text-gray-700",
                  "transition-transform lg:block",
                  openPanel === "profile"
                    ? "rotate-180"
                    : "",
                ].join(" ")}
              />
            </button>

            {openPanel === "profile" && (
              <div
                id="organizer-profile-panel"
                role="menu"
                aria-label={t.account}
                className="absolute top-[calc(100%+12px)] right-0 z-50 w-[min(90vw,280px)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_45px_rgba(0,0,0,0.16)]"
              >
                {renderProfile()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================
          BADGE ESPACE ORGANISATEUR MOBILE

          Placé sous le logo et l'en-tête,
          comme sur l'architecture mobile.
      ==================================== */}

      <div className="flex justify-center pb-2 lg:hidden">
        <span className="inline-flex h-7 items-center gap-2 rounded-full bg-[#eaf9e8] px-4 text-xs font-bold text-[#074c28]">
          <UsersRound
            size={16}
            aria-hidden="true"
          />
          {t.organizerSpace}
        </span>
      </div>
    </header>
  );
}


/** En-tete commun des pages publiques organisateur ; le dashboard conserve son en-tete. */
export function OrganizerPublicHeader({ locale, onLocaleChange }: { locale?: Locale; onLocaleChange?: (locale: Locale) => void }) {
  const storedLocale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => defaultLocale);
  const language = locale ?? storedLocale;
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const t = publicDictionaries[language];
  const ROUTES = { home: "/organizer", login: "/organizer/login", register: "/organizer/register" };
  const navigation = [
    { label: t.home, href: ROUTES.home, active: pathname === ROUTES.home },
    { label: t.features, href: ROUTES.home + "#fonctionnalites", active: false },
    { label: t.pricing, href: ROUTES.home + "#tarifs", active: false },
    { label: t.support, href: ROUTES.home + "#assistance", active: false },
  ];
  function changeLanguage(next: Locale) {
    try { window.localStorage.setItem(i18nConfig.storageKey, next); } catch { /* The page keeps its selected locale. */ }
    document.documentElement.lang = next;
    onLocaleChange?.(next);
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent("tikemia:locale-changed", { detail: { locale: next } }));
    setMenuOpen(false);
  }
  function toggleLanguage() { changeLanguage(language === "fr" ? "en" : "fr"); }
  function closeMenu() { setMenuOpen(false); }
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  return (      <header className="relative z-50 w-full border-b border-gray-100 bg-white shadow-sm">

        {/* ====================================
            HEADER PC
        ==================================== */}

        <div className="hidden h-18 w-full items-center justify-between gap-4 px-6 xl:flex 2xl:px-12">

          {/* Logo + Espace Organisateur */}

          <div className="flex shrink-0 items-center gap-3">

            <Link
              href={ROUTES.home}
              aria-label="TIKEMIA"
              className="relative block h-12 w-44"
            >
              <Image
                src="/logo/logo.png"
                alt="TIKEMIA"
                fill
                priority
                sizes="176px"
                className="object-contain"
              />
            </Link>

            <span className="whitespace-nowrap rounded-r-xl bg-linear-to-b from-green-500 to-green-800 px-3 py-2 text-xs font-extrabold text-white shadow-sm 2xl:text-sm">
              {t.organizer}
            </span>

          </div>

          {/* Navigation PC */}

          <nav
            aria-label="Navigation organisateur"
            className="flex min-w-0 items-center gap-4 2xl:gap-7"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "whitespace-nowrap border-b-2 py-2",
                  "text-xs font-bold transition-colors",
                  "hover:text-green-700",
                  "2xl:text-sm",
                  item.active
                    ? "border-green-600 text-green-900"
                    : "border-transparent text-gray-950",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Actions PC */}

          <div className="flex shrink-0 items-center gap-2">

            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={
                language === "fr"
                  ? "Switch to English"
                  : "Passer en français"
              }
              className="flex h-10 items-center gap-1 rounded-full border border-gray-200 px-3 text-xs font-bold transition-colors hover:bg-gray-50"
            >
              <Languages size={17} />
              <span>{language.toUpperCase()}</span>
            </button>

            <Link
              href={ROUTES.login}
              className="flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-green-800 bg-white px-4 text-xs font-extrabold text-gray-950 transition-colors hover:bg-green-50"
            >
              <UserRound size={18} />
              {t.login}
            </Link>

            <Link
              href={ROUTES.register}
              className="flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-linear-to-b from-green-500 to-green-800 px-4 text-xs font-extrabold text-white shadow-md transition-all hover:brightness-110"
            >
              <UserRoundPlus size={18} />
              {t.signup}
            </Link>

          </div>

        </div>

        {/* ====================================
            HEADER MOBILE / TABLETTE
        ==================================== */}

        <div className="relative flex h-16 w-full items-center justify-between px-4 sm:px-6 xl:hidden">

          {/* Trois barres à gauche */}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={
              menuOpen
                ? language === "fr"
                  ? "Fermer le menu"
                  : "Close menu"
                : language === "fr"
                  ? "Ouvrir le menu"
                  : "Open menu"
            }
            aria-expanded={menuOpen}
            aria-controls="tikemia-mobile-menu"
            className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-950 transition-colors hover:bg-gray-100"
          >
            {menuOpen ? (
              <X size={26} strokeWidth={2.5} />
            ) : (
              <Menu size={26} strokeWidth={2.5} />
            )}
          </button>

          {/* Logo centré */}

          <Link
            href={ROUTES.home}
            aria-label="TIKEMIA"
            className="absolute left-1/2 flex h-12 w-40 -translate-x-1/2 items-center justify-center max-[380px]:w-28"
          >
            <Image
              src="/logo/logo.png"
              alt="TIKEMIA"
              fill
              priority
              sizes="(max-width: 380px) 112px, 160px"
              className="object-contain"
            />
          </Link>

          {/* ====================================
              LANGUE + COMPTE À DROITE
          ==================================== */}

          <div className="relative z-10 flex shrink-0 items-center gap-2 max-[380px]:gap-1">

            {/* Bouton FR / EN */}

            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={
                language === "fr"
                  ? "Switch to English"
                  : "Passer en français"
              }
              title={
                language === "fr"
                  ? "English"
                  : "Français"
              }
              className="flex h-10 min-w-10 items-center justify-center rounded-full border border-gray-200 bg-white px-2 text-xs font-bold text-gray-950 transition-colors hover:border-green-600 hover:bg-green-50"
            >
              {language.toUpperCase()}
            </button>

            {/* Icône de connexion */}

            <Link
              href={ROUTES.login}
              aria-label={t.login}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-green-700 text-green-950 transition-colors hover:bg-green-50"
            >
              <UserRound
                size={25}
                strokeWidth={2}
              />
            </Link>

          </div>

        </div>

        {/* ====================================
            MENU MOBILE DÉROULANT
        ==================================== */}

        {menuOpen && (
          <nav
            id="tikemia-mobile-menu"
            aria-label="Navigation mobile organisateur"
            className="absolute inset-x-0 top-full z-50 border-t border-gray-100 bg-white px-4 py-4 shadow-xl xl:hidden"
          >

            <div className="mb-3 rounded-lg bg-green-50 px-3 py-3 text-sm font-extrabold text-green-900">
              {t.organizer}
            </div>

            <div className="flex flex-col gap-1">

              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="rounded-lg px-3 py-3 text-sm font-bold transition-colors hover:bg-green-50"
                >
                  {item.label}
                </Link>
              ))}

              {/* Choix de langue dans le menu */}

              <div className="mt-2 flex items-center justify-between border-t border-gray-100 px-3 py-3">

                <span className="flex items-center gap-2 text-sm font-bold">
                  <Languages size={18} />
                  {language === "fr"
                    ? "Langue"
                    : "Language"}
                </span>

                <div className="flex gap-2">

                  <button
                    type="button"
                    onClick={() => changeLanguage("fr")}
                    aria-pressed={language === "fr"}
                    className={[
                      "rounded-full px-4 py-2 text-xs font-extrabold",
                      language === "fr"
                        ? "bg-green-700 text-white"
                        : "border border-gray-200 bg-white text-gray-950",
                    ].join(" ")}
                  >
                    FR
                  </button>

                  <button
                    type="button"
                    onClick={() => changeLanguage("en")}
                    aria-pressed={language === "en"}
                    className={[
                      "rounded-full px-4 py-2 text-xs font-extrabold",
                      language === "en"
                        ? "bg-green-700 text-white"
                        : "border border-gray-200 bg-white text-gray-950",
                    ].join(" ")}
                  >
                    EN
                  </button>

                </div>

              </div>

              <Link
                href={ROUTES.login}
                onClick={closeMenu}
                className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-full border border-green-700 font-bold text-green-900"
              >
                <UserRound size={19} />
                {t.login}
              </Link>

              <Link
                href={ROUTES.register}
                onClick={closeMenu}
                className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-full bg-linear-to-b from-green-500 to-green-800 font-bold text-white"
              >
                <UserRoundPlus size={19} />
                {t.signup}
              </Link>

            </div>

          </nav>
        )}

      </header>);
}
