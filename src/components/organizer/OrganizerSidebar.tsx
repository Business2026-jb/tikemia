
"use client";

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
  useState,
  type ComponentType,
} from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ArrowLeftRight,
  BanknoteArrowDown,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  CirclePlus,
  Heart,
  House,
  Menu,
  LogOut,
  LoaderCircle,
  Settings,
  Ticket,
  ScanLine,
  UserRound,
  X,
} from "lucide-react";

import {
  defaultLocale,
  i18nConfig,
  normalizeLocale,
  type Locale,
} from "@/i18n/config";

/* ============================================
   TIKEMIA — MENU ORGANISATEUR

   Ordinateur :
   - Menu vertical vert foncé
   - Pleine hauteur
   - Menu actif en vert lumineux

   Mobile :
   - Menu latéral depuis le hamburger
   - Navigation fixe en bas
   - Bouton Publier avec deux options

   Français / Anglais
   Next.js App Router
   Tailwind CSS 4
============================================ */

/* ============================================
   TYPES
============================================ */

type IconComponent = ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

type MenuItem = {
  key: MenuKey;
  href: string;
  icon: IconComponent;
};

type MenuKey =
  | "dashboard"
  | "publishEvent"
  | "publishCampaign"
  | "events"
  | "campaigns"
  | "scan"
  | "sales"
  | "transactions"
  | "withdrawals"
  | "statistics"
  | "profile"
  | "settings";

type OrganizerSidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  locale?: Locale;
  onLogout?: () => void;
  loggingOut?: boolean;
  logoutFailed?: boolean;
};

/* ============================================
   ROUTES ORGANISATEUR

   Les destinations seront développées
   dans les prochaines étapes.
============================================ */

const ROUTES = {
  scan: "/organizer/dashboard/scan",
  dashboard: "/organizer/dashboard",

  publishEvent:
    "/organizer/dashboard/publish-event",

  publishCampaign:
    "/organizer/dashboard/publish-campaign",

  events:
    "/organizer/dashboard/events",

  campaigns:
    "/organizer/dashboard/campaigns",

  sales:
    "/organizer/dashboard/sales",

  transactions:
    "/organizer/dashboard/transactions",

  withdrawals:
    "/organizer/dashboard/withdrawals",

  statistics:
    "/organizer/dashboard/statistics",

  profile:
    "/organizer/dashboard/profile",

  settings:
    "/organizer/dashboard/settings",
} as const;

/* ============================================
   INTITULÉS DES MENUS
============================================ */

const TEXT = {
  fr: {
    dashboard: "Tableau de bord",
    publishEvent: "Publier un événement",
    publishCampaign: "Publier une cagnotte",
    events: "Mes événements",
    campaigns: "Mes cagnottes",
    scan: "Scanner les billets",
    sales: "Billets & ventes",
    transactions: "Transactions",
    withdrawals: "Retraits",
    statistics: "Statistiques",
    profile: "Mon profil",
    settings: "Paramètres",

    homeShort: "Accueil",
    eventsShort: "Événements",
    publishShort: "Publier",
    transactionsShort: "Transactions",
    profileShort: "Profil",

    organizer: "Espace Organisateur",
    menu: "Menu",
    close: "Fermer",
    publishTitle: "Que souhaitez-vous publier ?",
    navigation: "Navigation organisateur",
    logout: "Se déconnecter",
    loggingOut: "Déconnexion en cours…",
    logoutFailed: "Déconnexion impossible. Veuillez réessayer.",
  },

  en: {
    dashboard: "Dashboard",
    publishEvent: "Publish an event",
    publishCampaign: "Publish a fundraiser",
    events: "My events",
    campaigns: "My fundraisers",
    scan: "Ticket scanner",
    sales: "Tickets & sales",
    transactions: "Transactions",
    withdrawals: "Withdrawals",
    statistics: "Statistics",
    profile: "My profile",
    settings: "Settings",

    homeShort: "Home",
    eventsShort: "Events",
    publishShort: "Publish",
    transactionsShort: "Transactions",
    profileShort: "Profile",

    organizer: "Organizer Space",
    menu: "Menu",
    close: "Close",
    publishTitle: "What would you like to publish?",
    navigation: "Organizer navigation",
    logout: "Log out",
    loggingOut: "Logging out…",
    logoutFailed: "Unable to log out. Please try again.",
  },
} as const;

/* ============================================
   MENU PRINCIPAL
============================================ */

const MENU_ITEMS: MenuItem[] = [
  {
    key: "dashboard",
    href: ROUTES.dashboard,
    icon: House,
  },
  {
    key: "publishEvent",
    href: ROUTES.publishEvent,
    icon: CirclePlus,
  },
  {
    key: "publishCampaign",
    href: ROUTES.publishCampaign,
    icon: Heart,
  },
  {
    key: "events",
    href: ROUTES.events,
    icon: CalendarDays,
  },
  {
    key: "campaigns",
    href: ROUTES.campaigns,
    icon: Heart,
  },
  {
    key: "sales",
    href: ROUTES.sales,
    icon: Ticket,
  },
  { key: "scan", href: ROUTES.scan, icon: ScanLine },
  {
    key: "transactions",
    href: ROUTES.transactions,
    icon: ArrowLeftRight,
  },
  {
    key: "withdrawals",
    href: ROUTES.withdrawals,
    icon: BanknoteArrowDown,
  },
  {
    key: "statistics",
    href: ROUTES.statistics,
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    key: "profile",
    href: ROUTES.profile,
    icon: UserRound,
  },
  {
    key: "settings",
    href: ROUTES.settings,
    icon: Settings,
  },
];

/* ============================================
   DÉTECTION DU MENU ACTIF
============================================ */

function isActiveRoute(
  pathname: string,
  href: string
): boolean {
  if (href === ROUTES.dashboard) {
    return pathname === href;
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

/* ============================================
   COMPOSANT PRINCIPAL
============================================ */

export default function OrganizerSidebar({
  mobileOpen = false,
  onMobileClose,
  locale,
  onLogout,
  loggingOut = false,
  logoutFailed = false,
}: OrganizerSidebarProps) {
  const pathname = usePathname();

  const storedLocale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => defaultLocale);
  const currentLocale = locale ?? storedLocale;

  const [menuPath, setMenuPath] = useState(pathname);
  const [publishOpen, setPublishOpen] =
    useState(false);

  const t = TEXT[currentLocale];

  /* ==========================================
     SYNCHRONISATION LANGUE
  ========================================== */



  /* ==========================================
     FERMETURE APRÈS NAVIGATION
  ========================================== */

  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setPublishOpen(false);
  }

  useEffect(() => {
    onMobileClose?.();
    // Un changement de route ferme les menus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* ==========================================
     BLOQUER LE DÉFILEMENT SOUS LE DRAWER
  ========================================== */

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onMobileClose?.();
      }
    }

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        onKeyDown
      );
    };
  }, [mobileOpen, onMobileClose]);

  /* ==========================================
     MENU ACTIF
  ========================================== */

  function active(key: MenuKey): boolean {
    return isActiveRoute(
      pathname,
      ROUTES[key]
    );
  }

  function closeDrawer() {
    onMobileClose?.();
  }

  function closePublishMenu() {
    setPublishOpen(false);
  }

  /* ==========================================
     CONTENU DU MENU VERTICAL

     Réutilisé sur PC et dans
     le menu hamburger mobile.
  ========================================== */

  function renderAccountControls() {
    return (
      <div className="shrink-0 space-y-3 border-t border-white/15 bg-[#003b28] px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-white/20 px-3 py-2.5 text-left text-sm font-semibold text-white transition-colors hover:border-red-200/50 hover:bg-red-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait"
          >
            {loggingOut ? <LoaderCircle size={20} className="shrink-0 animate-spin" aria-hidden="true" /> : <LogOut size={20} className="shrink-0" aria-hidden="true" />}
            <span>{loggingOut ? t.loggingOut : t.logout}</span>
          </button>
        )}
        {logoutFailed && <p role="alert" className="px-1 text-xs leading-relaxed text-red-100">{t.logoutFailed}</p>}
      </div>
    );
  }

  function renderNavigation(
    mobile: boolean
  ) {
    return (
      <nav
        aria-label={t.navigation}
        className="flex w-full flex-col gap-1.5"
      >
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = active(item.key);

          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={
                mobile
                  ? closeDrawer
                  : undefined
              }
              aria-current={
                selected ? "page" : undefined
              }
              className={[
                "group flex min-h-12 w-full",
                "items-center gap-3",
                "rounded-xl px-4 py-3",
                "text-[14px] font-semibold",
                "transition-colors duration-150",
                "focus-visible:outline-2",
                "focus-visible:outline-offset-2",
                "focus-visible:outline-white",
                selected
                  ? [
                      "bg-linear-to-r",
                      "from-[#2bc500]",
                      "to-[#079600]",
                      "text-white",
                      "shadow-[0_4px_14px_rgba(0,0,0,0.16)]",
                    ].join(" ")
                  : [
                      "text-white/95",
                      "hover:bg-white/12",
                      "hover:text-white",
                    ].join(" "),
              ].join(" ")}
            >
              <Icon
                size={23}
                strokeWidth={selected ? 2.5 : 2}
                className="shrink-0"
                aria-hidden
              />

              <span className="min-w-0 flex-1">
                {t[item.key]}
              </span>

              {selected && (
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full bg-white"
                />
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  /* ==========================================
     AFFICHAGE
  ========================================== */

  return (
    <>
      {/* ======================================
          MENU LATÉRAL PC

          La largeur est fixée à 240 px.
          Le layout du dashboard doit
          utiliser flex ou grid pour que
          le contenu remplisse le reste
          de l'écran.
      ====================================== */}

      <aside
        aria-label={t.navigation}
        className={[
          "hidden lg:flex",
          "h-full min-h-0",
          "w-60 shrink-0",
          "flex-col",
          "overflow-hidden",
          "bg-linear-to-b",
          "from-[#004b30]",
          "via-[#003f29]",
          "to-[#002b1e]",
          "text-white",
        ].join(" ")}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-3 scrollbar-thin xl:px-3">
          {renderNavigation(false)}
        </div>

        {renderAccountControls()}

        {/* VAGUES DÉCORATIVES INFÉRIEURES */}

        <div
          aria-hidden="true"
          className="relative h-10 w-full shrink-0 overflow-hidden"
        >
          <svg
            viewBox="0 0 240 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <path
              d="M0 58 C62 5 116 27 157 45 C192 61 215 30 240 20 L240 100 L0 100 Z"
              fill="#59c500"
            />
            <path
              d="M0 79 C63 45 99 50 139 66 C179 83 208 49 240 42 L240 100 L0 100 Z"
              fill="#ffdb00"
            />
            <path
              d="M0 95 C65 69 105 75 146 82 C190 91 212 67 240 64 L240 100 L0 100 Z"
              fill="#ff3429"
            />
          </svg>
        </div>
      </aside>

      {/* ======================================
          DRAWER MOBILE / TABLETTE

          Ouvert par le bouton hamburger
          du futur OrganizerHeader.
      ====================================== */}

      {mobileOpen && (
        <div className="fixed inset-0 z-80 lg:hidden">
          {/* FOND SOMBRE */}

          <button
            type="button"
            onClick={closeDrawer}
            aria-label={t.close}
            className="absolute inset-0 h-full w-full bg-black/55"
          />

          {/* PANNEAU LATÉRAL */}

          <aside
            id="organizer-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label={t.menu}
            className={[
              "absolute inset-y-0 left-0",
              "flex h-full",
              "w-[min(86vw,340px)]",
              "flex-col overflow-hidden",
              "bg-linear-to-b",
              "from-[#004b30]",
              "via-[#003e28]",
              "to-[#002b1e]",
              "text-white",
              "shadow-2xl",
            ].join(" ")}
          >
            {/* HAUT DU DRAWER */}

            <div className="flex h-17 shrink-0 items-center justify-between border-b border-white/15 px-5">
              <div className="flex items-center gap-2.5">
                <Menu
                  size={22}
                  aria-hidden
                />

                <span className="text-base font-extrabold">
                  {t.menu}
                </span>
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                aria-label={t.close}
                className="flex size-10 items-center justify-center rounded-full hover:bg-white/15"
              >
                <X size={24} />
              </button>
            </div>

            {/* NAVIGATION */}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
              {renderNavigation(true)}
            </div>

            {renderAccountControls()}

            {/* VAGUES */}

            <div
              aria-hidden="true"
              className="relative h-8 shrink-0 overflow-hidden"
            >
              <svg
                viewBox="0 0 340 70"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
              >
                <path
                  d="M0 35 C80 0 150 28 210 22 S300 4 340 18 L340 70 L0 70 Z"
                  fill="#50c500"
                />
                <path
                  d="M0 54 C100 26 150 44 230 37 S300 22 340 28 L340 70 L0 70 Z"
                  fill="#ffcf00"
                />
                <path
                  d="M0 65 C110 43 160 55 230 52 S300 39 340 42 L340 70 L0 70 Z"
                  fill="#f52c2c"
                />
              </svg>
            </div>
          </aside>
        </div>
      )}

      {/* ======================================
          NAVIGATION INFÉRIEURE MOBILE

          Architecture :
          Accueil | Événements | Publier |
          Transactions | Profil
      ====================================== */}

      <nav
        aria-label={t.navigation}
        className={[
          "fixed inset-x-0 bottom-0",
          "z-60 lg:hidden",
          "w-full",
          "border-t border-gray-200",
          "bg-white",
          "shadow-[0_-4px_20px_rgba(0,0,0,0.06)]",
          "pb-[env(safe-area-inset-bottom)]",
        ].join(" ")}
      >
        <div className="grid h-16 w-full grid-cols-5 items-stretch">
          {/* ACCUEIL */}

          <Link
            href={ROUTES.dashboard}
            aria-current={
              active("dashboard")
                ? "page"
                : undefined
            }
            className={[
              "flex min-w-0 flex-col",
              "items-center justify-center",
              "gap-1 px-1",
              "text-center",
              active("dashboard")
                ? "text-green-700"
                : "text-[#142138]",
            ].join(" ")}
          >
            <House
              size={23}
              strokeWidth={2}
              fill={
                active("dashboard")
                  ? "currentColor"
                  : "none"
              }
            />
            <span className="text-[10px] font-semibold sm:text-xs">
              {t.homeShort}
            </span>
          </Link>

          {/* ÉVÉNEMENTS */}

          <Link
            href={ROUTES.events}
            aria-current={
              active("events")
                ? "page"
                : undefined
            }
            className={[
              "flex min-w-0 flex-col",
              "items-center justify-center",
              "gap-1 px-1",
              "text-center",
              active("events")
                ? "text-green-700"
                : "text-[#142138]",
            ].join(" ")}
          >
            <CalendarDays
              size={23}
              strokeWidth={2}
            />

            <span className="text-[10px] font-semibold sm:text-xs">
              {t.eventsShort}
            </span>
          </Link>

          {/* PUBLIER */}

          <button
            type="button"
            onClick={() =>
              setPublishOpen((value) => !value)
            }
            aria-expanded={publishOpen}
            aria-controls="organizer-publish-menu"
            className={[
              "flex min-w-0 flex-col",
              "items-center justify-center",
              "gap-1 px-1",
              "text-center",
              publishOpen ||
              active("publishEvent") ||
              active("publishCampaign")
                ? "text-green-700"
                : "text-[#142138]",
            ].join(" ")}
          >
            <CirclePlus
              size={25}
              strokeWidth={2}
            />

            <span className="text-[10px] font-semibold sm:text-xs">
              {t.publishShort}
            </span>
          </button>

          {/* TRANSACTIONS */}

          <Link
            href={ROUTES.transactions}
            aria-current={
              active("transactions")
                ? "page"
                : undefined
            }
            className={[
              "flex min-w-0 flex-col",
              "items-center justify-center",
              "gap-1 px-0.5",
              "text-center",
              active("transactions")
                ? "text-green-700"
                : "text-[#142138]",
            ].join(" ")}
          >
            <ArrowLeftRight
              size={23}
              strokeWidth={2}
            />

            <span className="text-[9px] font-semibold sm:text-xs">
              {t.transactionsShort}
            </span>
          </Link>

          {/* PROFIL */}

          <Link
            href={ROUTES.profile}
            aria-current={
              active("profile")
                ? "page"
                : undefined
            }
            className={[
              "flex min-w-0 flex-col",
              "items-center justify-center",
              "gap-1 px-1",
              "text-center",
              active("profile")
                ? "text-green-700"
                : "text-[#142138]",
            ].join(" ")}
          >
            <UserRound
              size={23}
              strokeWidth={2}
            />

            <span className="text-[10px] font-semibold sm:text-xs">
              {t.profileShort}
            </span>
          </Link>
        </div>
      </nav>

      {/* ======================================
          MENU PUBLIER — MOBILE

          Permet de choisir :
          - Publier un événement
          - Publier une cagnotte
      ====================================== */}

      {publishOpen && (
        <div
          id="organizer-publish-menu"
          className="fixed inset-0 z-75 lg:hidden"
        >
          {/* FOND */}

          <button
            type="button"
            onClick={closePublishMenu}
            aria-label={t.close}
            className="absolute inset-0 bg-black/35"
          />

          {/* PANNEAU */}

          <div className="absolute inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] border-t border-gray-100 bg-white px-4 py-5 shadow-2xl">
            <div className="mx-auto w-full max-w-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-[#003e28]">
                  {t.publishTitle}
                </h2>

                <button
                  type="button"
                  onClick={closePublishMenu}
                  aria-label={t.close}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href={ROUTES.publishEvent}
                  onClick={closePublishMenu}
                  className="flex min-h-15 items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 text-sm font-bold text-green-950"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-700 text-white">
                    <Ticket size={21} />
                  </span>

                  <span className="flex-1">
                    {t.publishEvent}
                  </span>

                  <ChevronRight
                    size={19}
                    className="text-green-700"
                  />
                </Link>

                <Link
                  href={ROUTES.publishCampaign}
                  onClick={closePublishMenu}
                  className="flex min-h-15 items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 text-sm font-bold text-gray-950"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
                    <Heart size={21} />
                  </span>

                  <span className="flex-1">
                    {t.publishCampaign}
                  </span>

                  <ChevronRight
                    size={19}
                    className="text-red-600"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
