
"use client";

import {
  useCallback,
  useId,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

import { EVENT_CATEGORY_DEFINITIONS, eventCategoryLabel } from "@/i18n/config";
import { ChevronLeft, ChevronRight, Grid2X2, Music2, Drama, GraduationCap, Martini, Palmtree, Trophy, Tent, FlaskConical, Church, UtensilsCrossed, BriefcaseBusiness, Ellipsis } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  ArrowLeftRight,
  CalendarDays,
  CircleHelp,
  Globe2,
  Heart,
  Home,
  Mail,
  Menu,
  LogOut,
  Search,
  Ticket,
  UserRound,
  X,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — NAVIGATION PUBLIQUE

   FICHIER :
   src/components/public/PublicNavigation.tsx

   STRUCTURE :

   PC :
   - Logo TIKEMIA
   - Accueil
   - Événements
   - Cagnottes
   - Comment ça marche
   - Contact
   - Recherche
   - FR / EN

   MOBILE :
   - Header : Menu / Logo / Recherche
   - Menu latéral pour les liens secondaires
   - Navigation inférieure fixe à 5 boutons

   BARRE MOBILE :
   1. Accueil
   2. Événements
   3. Billets — bouton central principal
   4. Transfert
   5. Compte

   IMPORTANT :
   - Aucun menu organisateur
   - Aucun bouton créer un événement
   - Aucun bouton de connexion dans le header
   - Aucune obligation de connexion pour explorer
   - Aucun nouveau fichier CSS
   - Largeur 100 %
   - Compatible avec le layout public existant

   Le contrôle d'authentification des pages
   Billets, Transfert et Compte appartient
   aux pages et routes protégées.
========================================================== */

type Locale = "fr" | "en";

export function subscribePublicLocale(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("tikemia:locale-changed", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("tikemia:locale-changed", onChange);
  };
}

export function subscribePublicLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}
export function readPublicSearch(): string { return window.location.search; }

export function readPublicLocale(): Locale {
  try {
    const saved = window.localStorage.getItem("tikemia_locale");
    if (saved === "fr" || saved === "en") return saved;
  } catch { /* La langue du document reste disponible. */ }
  return document.documentElement.lang.startsWith("en") ? "en" : "fr";
}

function LanguageSelector({ locale, onChange, label, compact = false }: {
  locale: Locale;
  onChange: (locale: Locale) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <label className="flex h-11 shrink-0 items-center gap-1 rounded-full border border-[#e0e6e9] bg-white px-2 text-xs font-bold text-[#203049] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-green-700">
      {!compact && <Globe2 size={17} aria-hidden="true" />}
      <span className="sr-only">{label}</span>
      <select value={locale} onChange={event => onChange(event.target.value as Locale)} className="h-full cursor-pointer bg-transparent outline-none" title={label}>
        <option value="fr">FR</option>
        <option value="en">EN</option>
      </select>
    </label>
  );
}

type NavigationItem = {
  id: string;
  label: string;
  href: string;
};

type MobileItem = NavigationItem & {
  icon: typeof Home;
};

const URLS = {
  home: "/",
  events: "/explore",
  campaigns: "/campaigns",
  tickets: "/account/tickets",
  transfer: "/account/transfer",
  account: "/account",
  howItWorks: "/#how-it-works",
  contact: "/#contact",
} as const;

const LOGO_URL = "/logo/logo.png";

const MOBILE_BAR_HEIGHT = 76;

/* ==========================================================
   TEXTES FRANÇAIS / ANGLAIS
========================================================== */

const TRANSLATIONS = {
  fr: {
    home: "Accueil",
    events: "Événements",
    campaigns: "Cagnottes",
    howItWorks: "Comment ça marche",
    contact: "Contact",
    tickets: "Billets",
    transfer: "Transfert",
    account: "Compte",

    search: "Rechercher",
    searchPlaceholder: "Rechercher un événement...",
    searchAction: "Rechercher",

    menu: "Ouvrir le menu",
    close: "Fermer",
    navigation: "Navigation publique",
    mainNavigation: "Navigation principale",
    mobileNavigation: "Navigation mobile",
    otherLinks: "Découvrir TIKEMIA",

    language: "Langue",
    french: "Français",
    english: "English",

    explore: "Explorer",
    accessibilitySearch: "Ouvrir la recherche",
    emptySearch: "Saisissez votre recherche.",
  },

  en: {
    home: "Home",
    events: "Events",
    campaigns: "Fundraisers",
    howItWorks: "How it works",
    contact: "Contact",
    tickets: "Tickets",
    transfer: "Transfer",
    account: "Account",

    search: "Search",
    searchPlaceholder: "Search for an event...",
    searchAction: "Search",

    menu: "Open menu",
    close: "Close",
    navigation: "Public navigation",
    mainNavigation: "Main navigation",
    mobileNavigation: "Mobile navigation",
    otherLinks: "Discover TIKEMIA",

    language: "Language",
    french: "Français",
    english: "English",

    explore: "Explore",
    accessibilitySearch: "Open search",
    emptySearch: "Enter your search.",
  },
} as const;

/* ==========================================================
   CHEMINS ACTIFS

   Les liens Account / Billets / Transfert
   sont distincts, bien qu'ils utilisent
   le même espace client.
========================================================== */

function isActivePath(
  pathname: string,
  item: string
): boolean {
  if (item === "home") {
    return pathname === "/";
  }

  if (item === "events") {
    return (
      pathname === URLS.events || pathname.startsWith("/events/") ||
      pathname.startsWith(`${URLS.events}/`)
    );
  }

  if (item === "campaigns") {
    return (
      pathname === URLS.campaigns ||
      pathname.startsWith(`${URLS.campaigns}/`)
    );
  }

  if (item === "tickets") {
    return (
      pathname === URLS.tickets ||
      pathname.startsWith(`${URLS.tickets}/`)
    );
  }

  if (item === "transfer") {
    return (
      pathname === URLS.transfer ||
      pathname.startsWith(`${URLS.transfer}/`)
    );
  }

  if (item === "account") {
    return (
      pathname === URLS.account ||
      (
        pathname.startsWith(`${URLS.account}/`) &&
        !isActivePath(pathname, "tickets") &&
        !isActivePath(pathname, "transfer")
      )
    );
  }

  return false;
}

/* ==========================================================
   COMPOSANT PRINCIPAL
========================================================== */

export default function PublicNavigation() {
  const pathname = usePathname() ?? "/";
  return <PublicNavigationContent key={pathname} />;
}

function PublicNavigationContent() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const locale = useSyncExternalStore(subscribePublicLocale, readPublicLocale, () => "fr" as Locale);

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [searchOpen, setSearchOpen] =
    useState(false);

  

  const [query, setQuery] =
    useState("");

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const searchInputRef =
    useRef<HTMLInputElement>(null);

  

  const t = TRANSLATIONS[locale];

  /* ========================================================
     SYNCHRONISATION FR / EN
  ======================================================== */
  function changeLanguage(next: Locale) {

    try {
      localStorage.setItem(
        "tikemia_locale",
        next
      );
    } catch {
      // Aucun stockage obligatoire.
    }

    document.documentElement.lang = next;

    window.dispatchEvent(
      new CustomEvent("tikemia:locale-changed", { detail: { locale: next } })
    );
  }

  /* ========================================================
     FERMETURE LORS DU CHANGEMENT DE PAGE
  ======================================================== */
  /* ========================================================
     ACCESSIBILITÉ DU MENU MOBILE

     - Escape ferme les panneaux
     - Le défilement de la page est bloqué
       pendant l'ouverture du menu latéral
  ======================================================== */

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow =
      document.body.style.overflow;
    const menuButton = menuButtonRef.current;

    document.body.style.overflow = "hidden";
    const panel = drawerRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select, input:not([disabled]), [tabindex="0"]') ?? []);
    focusable()[0]?.focus();

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
      }
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    window.addEventListener(
      "keydown",
      onEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;
      menuButton?.focus();

      window.removeEventListener(
        "keydown",
        onEscape
      );
    };
  }, [menuOpen]);

  /* ========================================================
     RECHERCHE
  ======================================================== */

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    const closeSearch = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", closeSearch);
    return () => window.removeEventListener("keydown", closeSearch);
  }, [searchOpen]);

  const submitSearch = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const value = query.trim();

      if (!value) {
        searchInputRef.current?.focus();
        return;
      }

      const params = new URLSearchParams({
        q: value,
      });

      setSearchOpen(false);
      setMenuOpen(false);

      router.push(
        `${URLS.events}?${params.toString()}`
      );
    },
    [query, router]
  );

  /* ========================================================
     LIENS PC
  ======================================================== */

  const desktopItems: NavigationItem[] = [
    {
      id: "home",
      label: t.home,
      href: URLS.home,
    },
    {
      id: "events",
      label: t.events,
      href: URLS.events,
    },
    {
      id: "campaigns",
      label: t.campaigns,
      href: URLS.campaigns,
    },
    {
      id: "how",
      label: t.howItWorks,
      href: URLS.howItWorks,
    },
    {
      id: "contact",
      label: t.contact,
      href: URLS.contact,
    },
  ];

  /* ========================================================
     BARRE MOBILE : EXACTEMENT 5 MENUS
  ======================================================== */

  const mobileItems: MobileItem[] = [
    {
      id: "home",
      label: t.home,
      href: URLS.home,
      icon: Home,
    },
    {
      id: "events",
      label: t.events,
      href: URLS.events,
      icon: CalendarDays,
    },
    {
      id: "tickets",
      label: t.tickets,
      href: URLS.tickets,
      icon: Ticket,
    },
    {
      id: "transfer",
      label: t.transfer,
      href: URLS.transfer,
      icon: ArrowLeftRight,
    },
    {
      id: "account",
      label: t.account,
      href: URLS.account,
      icon: UserRound,
    },
  ];

  /* ========================================================
     FERMER LES MENUS
  ======================================================== */

  function closePanels() {
    setMenuOpen(false);
    setSearchOpen(false);
  }

  /* ========================================================
     RENDU
  ======================================================== */

  return (
    <>
      {/* ====================================================
          HEADER PUBLIC

          - Pleine largeur
          - Aucun max-width
          - Hauteur compacte
          - Aucun espace extérieur inutile
      ==================================================== */}

      <header
        id="tikemia-public-header"
        className={[
          "sticky",
          "top-0",
          "z-40",
          "w-full",
          "min-w-0",
          "border-b",
          "border-[#e6ece8]",
          "bg-white",
          "shadow-[0_2px_14px_rgba(8,47,25,0.05)]",
        ].join(" ")}
      >
        {/* ================================================
            HEADER PC
        ================================================= */}

        <div className="hidden h-19 w-full min-w-0 items-center justify-between gap-4 px-4 lg:flex lg:px-6 xl:px-8">
          {/* LOGO */}

          <div className="flex shrink-0 items-center gap-3"><Link
            href={URLS.home}
            aria-label="TIKEMIA — Accueil"
            className="flex shrink-0 items-center"
            onClick={closePanels}
          >
            <Image width={1075} height={416}
              src={LOGO_URL}
              loading="eager"
              alt="TIKEMIA"
              className="h-16 w-45 object-contain"
            />
          </Link>
<LanguageSelector locale={locale} onChange={changeLanguage} label={t.language} />
</div>

          {/* MENU CENTRAL */}

          <nav
            aria-label={t.mainNavigation}
            className="flex min-w-0 flex-1 items-center justify-center gap-3 xl:gap-5"
          >
            {desktopItems.map((item) => {
              const active =
                isActivePath(pathname, item.id);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={
                    active ? "page" : undefined
                  }
                  onClick={closePanels}
                  className={[
                    "relative",
                    "inline-flex",
                    "min-h-11",
                    "shrink-0",
                    "items-center",
                    "justify-center",
                    "whitespace-nowrap",
                    "text-[12px]",
                    "font-bold",
                    "transition-colors",
                    "xl:text-sm",
                    active
                      ? "text-[#087a2e]"
                      : "text-[#253047] hover:text-[#087b2c]",
                  ].join(" ")}
                >
                  {item.label}

                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-0.75 rounded-full bg-[#07872e]"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* RECHERCHE PC */}

{["/login", "/register", "/forgot-password", "/verify-email"].includes(pathname) ? <div className="flex shrink-0 items-center gap-2"><Link href="/login" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#087d30] px-3 text-xs font-bold text-[#087d30]"><UserRound size={18} /><span className="hidden xl:inline">{locale === "fr" ? "Se connecter" : "Sign in"}</span></Link><Link href="/register" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#087d30] px-3 text-xs font-bold text-white"><UserRound size={18} /><span className="hidden xl:inline">{locale === "fr" ? "S’inscrire" : "Sign up"}</span></Link></div> : <div className="flex shrink-0 items-center gap-2">
<button type="button" onClick={() => setSearchOpen(value => !value)} aria-label={t.accessibilitySearch} aria-expanded={searchOpen} aria-controls="tikemia-mobile-search" className="flex size-11 items-center justify-center rounded-xl hover:bg-green-50 xl:hidden"><Search size={22} /></button>
            <form
              role="search"
              onSubmit={submitSearch}
              className="hidden h-10 w-45 items-center gap-2 rounded-xl border border-[#e0e6e9] bg-[#f8fafb] px-3 xl:flex xl:w-48"
            >
              <Search
                size={17}
                className="shrink-0 text-[#728091]"
              />

              <input
                type="search"
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder={t.searchPlaceholder}
                aria-label={t.search}
                className="min-w-0 flex-1 border-0 bg-transparent text-xs text-[#223147] outline-none placeholder:text-[#81909d]"
              />
            </form>

            {/* LANGUE PC */}

            
<Link href="/account" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#087d30] px-3 text-xs font-bold text-white" aria-label={locale === "fr" ? "Mon compte" : "My account"}><UserRound size={19} /><span className="hidden 2xl:inline">{locale === "fr" ? "Mon compte" : "My account"}</span></Link></div>}
        </div>

        {/* ================================================
            HEADER MOBILE ET TABLETTE

            Menu à gauche
            Logo au centre
            Recherche à droite
        ================================================= */}

        <div className="flex h-16 w-full items-center justify-between gap-2 px-3 sm:px-5 lg:hidden">
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setMenuOpen(true);
            }}
            aria-label={t.menu}
            aria-expanded={menuOpen}
            aria-controls="tikemia-public-drawer"
            ref={menuButtonRef}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[#15243a] transition-colors hover:bg-[#f1f7f2]"
          >
            <Menu size={24} strokeWidth={2} />
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-3"><Link
            href={URLS.home}
            onClick={closePanels}
            className="relative flex h-11 w-28 min-w-0 shrink items-center justify-center sm:w-40"
            aria-label="TIKEMIA — Accueil"
          >
            <Image width={1075} height={416}
              src={LOGO_URL}
              loading="eager"
              alt="TIKEMIA"
              className="h-auto w-full object-contain"
            />
          </Link>
<LanguageSelector locale={locale} onChange={changeLanguage} label={t.language} compact />
</div>

          <button
            type="button"
            onClick={() =>
              setSearchOpen((value) => !value)
            }
            aria-label={
              searchOpen
                ? t.close
                : t.accessibilitySearch
            }
            aria-expanded={searchOpen}
            aria-controls="tikemia-mobile-search"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[#15243a] transition-colors hover:bg-[#f1f7f2]"
          >
            {searchOpen ? (
              <X size={23} />
            ) : (
              <Search size={23} />
            )}
          </button>
          <Link href="/account" onClick={closePanels} aria-label={locale === "fr" ? "Mon compte" : "My account"} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#dce9df] text-[#087d30] hover:bg-green-50"><UserRound size={22}/></Link>
        </div>

        {/* ================================================
            RECHERCHE MOBILE DÉPLIABLE

            Pas d'espace réservé quand elle
            est fermée.
        ================================================= */}

        {searchOpen && (
          <div
            id="tikemia-mobile-search"
            className="border-t border-[#edf0ee] bg-white px-3 py-3 shadow-sm sm:px-5 xl:hidden"
          >
            <form
              role="search"
              onSubmit={submitSearch}
              className="flex w-full items-center gap-2"
            >
              <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#dce5df] bg-[#f8faf9] px-3">
                <Search
                  size={17}
                  className="shrink-0 text-[#748492]"
                />

                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder={t.searchPlaceholder}
                  aria-label={t.search}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#81909d]"
                />
              </div>

              <button
                type="submit"
                disabled={!query.trim()}
                aria-label={t.searchAction}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#087f2e] text-white disabled:opacity-50"
              >
                <Search size={20} />
              </button>
            </form>
          </div>
        )}
      </header>

      {/* ====================================================
          MENU LATÉRAL MOBILE

          Pour les liens secondaires :
          Cagnottes, Comment ça marche, Contact,
          et sélection de la langue.

          Les cinq boutons principaux restent
          dans la barre inférieure.
      ==================================================== */}

      {menuOpen && (
        <div
          className="fixed inset-0 z-60 lg:hidden"
          aria-label={t.navigation}
        >
          {/* FOND */}

          <button
            type="button"
            aria-label={t.close}
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full bg-[#071b14]/55"
          />

          {/* PANNEAU */}

          <aside
            id="tikemia-public-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t.navigation}
            className="absolute inset-y-0 left-0 flex w-[min(85vw,340px)] flex-col overflow-y-auto bg-white shadow-2xl"
          >
            {/* EN-TÊTE DU PANNEAU */}

            <div className="flex min-h-17 items-center justify-between gap-3 border-b border-[#e8eeea] px-4 py-3">
              <Link
                href={URLS.home}
                onClick={closePanels}
                className="min-w-0"
              >
                <Image width={1075} height={416}
                  src={LOGO_URL}
                  alt="TIKEMIA"
                  className="h-auto w-40 object-contain"
                />
              </Link>

              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t.close}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f2f6f3]"
              >
                <X size={20} />
              </button>
            </div>

            {/* MENU COMPLET */}

            <nav
              aria-label={t.navigation}
              className="flex flex-col gap-1 p-3"
            >
              <Link
                href={URLS.home}
                onClick={closePanels}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#233548] hover:bg-[#f0f8f2]"
              >
                <Home
                  size={20}
                  className="text-[#087e30]"
                />
                {t.home}
              </Link>

              <Link
                href={URLS.events}
                onClick={closePanels}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#233548] hover:bg-[#f0f8f2]"
              >
                <CalendarDays
                  size={20}
                  className="text-[#087e30]"
                />
                {t.events}
              </Link>

              <Link
                href={URLS.campaigns}
                onClick={closePanels}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#233548] hover:bg-[#f0f8f2]"
              >
                <Heart
                  size={20}
                  className="text-[#d31f41]"
                />
                {t.campaigns}
              </Link>

              <Link
                href={URLS.howItWorks}
                onClick={closePanels}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#233548] hover:bg-[#f0f8f2]"
              >
                <CircleHelp
                  size={20}
                  className="text-[#087e30]"
                />
                {t.howItWorks}
              </Link>

              <Link
                href={URLS.contact}
                onClick={closePanels}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#233548] hover:bg-[#f0f8f2]"
              >
                <Mail
                  size={20}
                  className="text-[#087e30]"
                />
                {t.contact}
              </Link>

              <div className="my-2 h-px bg-[#e9efeb]" />

              <Link
                href={URLS.tickets}
                onClick={closePanels}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#233548] hover:bg-[#f0f8f2]"
              >
                <Ticket
                  size={20}
                  className="text-[#087e30]"
                />
                {t.tickets}
              </Link>

              <Link
                href={URLS.transfer}
                onClick={closePanels}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#233548] hover:bg-[#f0f8f2]"
              >
                <ArrowLeftRight
                  size={20}
                  className="text-[#087e30]"
                />
                {t.transfer}
              </Link>

              <Link
                href={URLS.account}
                onClick={closePanels}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#233548] hover:bg-[#f0f8f2]"
              >
                <UserRound
                  size={20}
                  className="text-[#087e30]"
                />
                {t.account}
              </Link>
            </nav>

            {/* SÉLECTION FR / EN */}

            
          </aside>
        </div>
      )}

      {/* ====================================================
          BARRE INFÉRIEURE MOBILE

          5 MENUS EXACTEMENT

          1. Accueil
          2. Événements
          3. BILLETS — BOUTON CENTRAL
          4. Transfert
          5. Compte

          HAUTEUR :
          76px + safe-area-inset-bottom

          Compatible avec le padding inférieur
          déjà défini dans (public)/layout.tsx.
      ==================================================== */}

      <nav
        aria-label={t.mobileNavigation}
        className={[
          "fixed",
          "inset-x-0",
          "bottom-0",
          "z-50",
          "w-full",
          "border-t",
          "border-[#e2e9e5]",
          "bg-white",
          "shadow-[0_-5px_22px_rgba(0,44,22,0.09)]",
          "lg:hidden",
        ].join(" ")}
        style={{
          height: `calc(${MOBILE_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="grid h-19 w-full grid-cols-5 items-center gap-0 px-1 sm:px-4">
          {mobileItems.map((item) => {
            const Icon = item.icon;

            const active = isActivePath(
              pathname,
              item.id
            );

            const isTickets =
              item.id === "tickets";

            /* ============================================
               BOUTON CENTRAL BILLETS

               Fond vert, icône blanche,
               surélévation et label visible.
            ============================================ */

            if (isTickets) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={
                    active ? "page" : undefined
                  }
                  onClick={closePanels}
                  className="relative flex h-full min-w-0 flex-col items-center justify-center gap-1"
                >
                  <span
                    className={[
                      "flex",
                      "size-13.5",
                      "shrink-0",
                      "items-center",
                      "justify-center",
                      "rounded-[17px]",
                      "bg-[#087d2d]",
                      "text-white",
                      "shadow-[0_5px_13px_rgba(7,115,40,0.26)]",
                      "transition-transform",
                      "-translate-y-2",
                      active
                        ? "ring-2 ring-[#f6cb20] ring-offset-2"
                        : "",
                    ].join(" ")}
                  >
                    <Icon
                      size={27}
                      strokeWidth={2.2}
                    />
                  </span>

                  <span className="-mt-2 text-[10px] font-extrabold leading-none text-[#087e30] sm:text-xs">
                    {item.label}
                  </span>
                </Link>
              );
            }

            /* ============================================
               LES 4 AUTRES MENUS

               Icône au-dessus, label en dessous.
            ============================================ */

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={item.label}
                aria-current={
                  active ? "page" : undefined
                }
                onClick={closePanels}
                className={[
                  "flex",
                  "h-full",
                  "min-w-0",
                  "flex-col",
                  "items-center",
                  "justify-center",
                  "gap-1",
                  "rounded-lg",
                  "transition-colors",
                  "focus-visible:outline-2",
                  "focus-visible:outline-[#087e30]",
                  active
                    ? "text-[#087e30]"
                    : "text-[#4b5d70] hover:text-[#087e30]",
                ].join(" ")}
              >
                <Icon
                  size={23}
                  strokeWidth={
                    active ? 2.5 : 1.9
                  }
                />

                <span
                  className={`max-w-full truncate px-0.5 text-[9px] leading-tight sm:text-[11px] ${
                    active
                      ? "font-extrabold"
                      : "font-semibold"
                  }`}
                >
                  {item.label}
                </span>

                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 h-1 w-1 rounded-full bg-[#087e30]"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/** Shared category navigation for the home and event listing. */
export function PublicCategoryStrip({ locale, selected, onSelect }: { locale: "fr" | "en"; selected?: string; onSelect?: (category: string) => void }) {
  const id = useId();
  const stripRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const syncEdges = useCallback(() => {
    const strip = stripRef.current;
    if (strip) setEdges({ start: strip.scrollLeft <= 1, end: strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1 });
  }, []);
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const observer = new ResizeObserver(syncEdges);
    observer.observe(strip);
    syncEdges();
    return () => observer.disconnect();
  }, [syncEdges]);
  function scroll(direction: -1 | 1) {
    const strip = stripRef.current;
    if (strip) strip.scrollBy({ left: direction * Math.max(160, strip.clientWidth * 0.75), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  const icons = { Music2, Drama, GraduationCap, Martini, Palmtree, Trophy, Tent, FlaskConical, Church, UtensilsCrossed, BriefcaseBusiness, Ellipsis };
  const cardClass = "tk-public-category flex min-h-16 w-23 sm:min-h-23 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center text-[11px] sm:gap-2 sm:px-3 sm:py-3 font-extrabold text-[#334454] sm:w-40 sm:text-sm";
  const arrowClass = "flex size-9 shrink-0 items-center justify-center rounded-full border border-[#dce7de] bg-white text-[#087d30] disabled:cursor-default disabled:opacity-30 sm:size-10";
  return <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3">
    <button type="button" aria-label={locale === "fr" ? "Cat\u00e9gories pr\u00e9c\u00e9dentes" : "Previous categories"} aria-controls={id} disabled={edges.start} onClick={() => scroll(-1)} className={arrowClass}><ChevronLeft size={20} /></button>
    <div id={id} ref={stripRef} onScroll={syncEdges} tabIndex={0} role="region" aria-label={locale === "fr" ? "Cat\u00e9gories" : "Categories"} className="tk-public-category-strip min-w-0 flex-1 snap-x snap-proximity overscroll-x-contain py-1 [scrollbar-width:thin]" style={{ display: "flex", flexWrap: "nowrap", overflowX: "auto", gap: 10 }}>
      {onSelect && <button type="button" onClick={() => onSelect("")} aria-pressed={selected === ""} className={cardClass} style={{ flexShrink: 0, borderColor: selected === "" ? "#087d30" : "#e4eae5", backgroundColor: "#edf7ee" }}><span className="flex size-7 sm:size-10 items-center justify-center rounded-full bg-white/75"><Grid2X2 size={22} className="size-4 sm:size-5.5" color="#087d30" /></span><span>{locale === "fr" ? "Tous" : "All"}</span></button>}
      {EVENT_CATEGORY_DEFINITIONS.map(category => {
        const Icon = icons[category.icon];
        const active = selected === category.key;
        const content = <><span className="flex size-7 sm:size-10 items-center justify-center rounded-full bg-white/75"><Icon size={22} className="size-4 sm:size-5.5" color={category.color} aria-hidden="true" /></span><span className="line-clamp-2 leading-tight">{eventCategoryLabel(category.key, locale)}</span></>;
        const style = { flexShrink: 0, backgroundColor: category.color + "12", borderColor: active ? category.color : "#e4eae5", boxShadow: active ? "inset 0 0 0 1px " + category.color : undefined };
        return onSelect ? <button key={category.key} type="button" onClick={() => onSelect(category.key)} aria-pressed={active} className={cardClass} style={style}>{content}</button> : <Link key={category.key} href={"/explore?category=" + encodeURIComponent(category.key)} className={cardClass} style={style}>{content}</Link>;
      })}
    </div>
    <button type="button" aria-label={locale === "fr" ? "Cat\u00e9gories suivantes" : "Next categories"} aria-controls={id} disabled={edges.end} onClick={() => scroll(1)} className={arrowClass}><ChevronRight size={20} /></button>
  </div>;
}

export function PublicAccountShell({ locale, children }: { locale: "fr" | "en"; children: import("react").ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [access, setAccess] = useState<"checking" | "authorized" | "error">("checking");
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;
    const check = async () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const response = await fetch("/api/public/account?session=1", { credentials: "same-origin", cache: "no-store", signal });
        if (stopped || signal.aborted) return;
        if (response.status === 401 || response.status === 403) {
          setAccess("checking"); window.location.replace("/login"); return;
        }
        if (!response.ok) throw new Error("SESSION_CHECK_FAILED");
        const result = await response.json();
        if (!result.success) throw new Error("SESSION_CHECK_FAILED");
        setAccess("authorized"); clearTimeout(timer);
        const remaining = Date.parse(result.expiresAt) - Date.now();
        timer = setTimeout(() => void check(), Number.isFinite(remaining) ? Math.max(100, Math.min(15000, remaining)) : 15000);
      } catch { if (!stopped && !signal.aborted) { setAccess("error"); timer = setTimeout(() => void check(), 15000); } }
    };
    const refresh = () => { if (document.visibilityState === "visible") void check(); };
    void check(); window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { stopped = true; controller?.abort(); clearTimeout(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [pathname]);
  const items = [{ href: "/account", icon: UserRound, label: locale === "fr" ? "Mon compte" : "My account" }, { href: "/account/tickets", icon: Ticket, label: locale === "fr" ? "Mes billets" : "My tickets" }, { href: "/account/transfer", icon: ArrowLeftRight, label: locale === "fr" ? "Transf\u00e9rer un billet" : "Transfer a ticket" }];
  async function logout() {
    if (busy) return;
    setBusy(true); setError(false);
    try { const response = await fetch("/api/public/account", { method: "DELETE", credentials: "same-origin" }); if (!response.ok) throw new Error(); router.replace("/login"); router.refresh(); }
    catch { setError(true); setBusy(false); }
  }
  if (access !== "authorized") return <div role="status" className="flex min-h-60 w-full flex-col items-center justify-center gap-3 p-4 text-center"><p>{locale === "fr" ? (access === "error" ? "Impossible de vérifier la session." : "Vérification de la session...") : "Checking session..."}</p>{access === "error" && <button type="button" onClick={() => window.location.reload()}>{locale === "fr" ? "Réessayer" : "Retry"}</button>}</div>;
  return <div className="grid w-full min-w-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="hidden min-w-0 bg-[#00432c] text-white lg:block">
      <nav aria-label={locale === "fr" ? "Espace personnel" : "Account navigation"} className="sticky top-24 flex flex-col gap-2 px-3 py-6">
        {items.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={"flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-bold " + (pathname === item.href ? "bg-[#beef16] text-[#003b1c]" : "text-white hover:bg-white/10")}><item.icon size={23} />{item.label}</Link>)}
        <button type="button" disabled={busy} onClick={() => void logout()} className="mt-3 flex min-h-12 items-center gap-3 rounded-xl px-4 text-left text-sm font-bold hover:bg-white/10 disabled:opacity-50"><LogOut size={23} />{locale === "fr" ? "D\u00e9connexion" : "Sign out"}</button>
        {error && <p role="alert" className="px-4 text-xs">{locale === "fr" ? "R\u00e9essayez." : "Try again."}</p>}
      </nav>
    </aside>
    <div className="min-w-0">{children}</div>
  </div>;
}

export function VerifiedBadge() { return <span role="img" aria-label="Organisateur vérifié" title="Organisateur vérifié" className="ml-1 inline-flex shrink-0 align-middle text-[#1687e8]"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 1 3 2 3.5.5 1 3.5 2 3-1 3.5-2 3-3.5 1-3 2-3-2-3.5-1-2-3L1 10l2-3 1-3.5L8 3z"/><path d="m7 11.5 3 3 6-6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>; }
