"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Heart,
  Home,
  Info,
  Languages,
  LogIn,
  LogOut,
  Menu,
  Search,
  Settings,
  ShoppingBag,
  Ticket,
  User,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

export type ClientHeaderUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  unreadNotificationsCount?: number;
};

export type ClientHeaderProps = {
  user?: ClientHeaderUser | null;
  logoSrc?: string;
  supportEmail?: string;
  supportPhone?: string;
  locationLabel?: string;
  defaultSearchValue?: string;
  onLogout?: () => void | Promise<void>;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: typeof Home;
};

const DESKTOP_NAVIGATION: NavigationItem[] = [
  {
    label: "Accueil",
    href: "/",
    icon: Home,
  },
  {
    label: "Explorer",
    href: "/events",
    icon: Search,
  },
  {
    label: "Catégories",
    href: "/categories",
    icon: CalendarDays,
  },
  {
    label: "Top événements",
    href: "/events?sort=popular",
    icon: Ticket,
  },
  {
    label: "À propos",
    href: "/about",
    icon: Info,
  },
  {
    label: "Contact",
    href: "/contact",
    icon: CircleHelp,
  },
];

const MOBILE_NAVIGATION: NavigationItem[] = [
  ...DESKTOP_NAVIGATION,
  {
    label: "Mes billets",
    href: "/account/tickets",
    icon: Ticket,
  },
  {
    label: "Mes commandes",
    href: "/account/orders",
    icon: ShoppingBag,
  },
  {
    label: "Mes favoris",
    href: "/favorites",
    icon: Heart,
  },
  {
    label: "Mon profil",
    href: "/account/profile",
    icon: UserRound,
  },
  {
    label: "Paramètres",
    href: "/account/settings",
    icon: Settings,
  },
];

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes.filter(Boolean).join(" ");
}

function normalizeSearchValue(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function getInitials(
  user?: ClientHeaderUser | null,
): string {
  const firstName =
    user?.firstName?.trim() ?? "";

  const lastName =
    user?.lastName?.trim() ?? "";

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`
      .trim()
      .toUpperCase();

  if (initials) {
    return initials;
  }

  return (
    user?.email
      ?.charAt(0)
      .toUpperCase() || "C"
  );
}

function getDisplayName(
  user?: ClientHeaderUser | null,
): string {
  const fullName = [
    user?.firstName?.trim(),
    user?.lastName?.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return fullName || "Mon compte";
}

function isPathActive(
  pathname: string,
  href: string,
): boolean {
  const cleanHref =
    href.split("?")[0];

  if (cleanHref === "/") {
    return pathname === "/";
  }

  return (
    pathname === cleanHref ||
    pathname.startsWith(
      `${cleanHref}/`,
    )
  );
}

export default function ClientHeader({
  user = null,
  logoSrc = "/logo.png",
  supportEmail = "contact@tikemia.com",
  supportPhone = "+229 01 69 56 77 44",
  locationLabel = "Cotonou, Bénin",
  defaultSearchValue = "",
  onLogout,
}: ClientHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [accountOpen, setAccountOpen] =
    useState(false);

  const [languageOpen, setLanguageOpen] =
    useState(false);

  const [searchValue, setSearchValue] =
    useState(defaultSearchValue);

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const accountMenuRef =
    useRef<HTMLDivElement | null>(null);

  const languageMenuRef =
    useRef<HTMLDivElement | null>(null);

  const searchInputRef =
    useRef<HTMLInputElement | null>(null);

  const unreadNotificationsCount =
    user?.unreadNotificationsCount ?? 0;

  const displayName = useMemo(
    () => getDisplayName(user),
    [user],
  );

  const initials = useMemo(
    () => getInitials(user),
    [user],
  );

  useEffect(() => {
    if (
      !drawerOpen &&
      !searchOpen
    ) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [drawerOpen, searchOpen]);

  useEffect(() => {
    function handlePointerDown(
      event: MouseEvent,
    ): void {
      const target =
        event.target as Node;

      if (
        accountOpen &&
        accountMenuRef.current &&
        !accountMenuRef.current.contains(
          target,
        )
      ) {
        setAccountOpen(false);
      }

      if (
        languageOpen &&
        languageMenuRef.current &&
        !languageMenuRef.current.contains(
          target,
        )
      ) {
        setLanguageOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
    };
  }, [
    accountOpen,
    languageOpen,
  ]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    const timeout =
      window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchOpen]);

  function submitSearch(): void {
    const normalizedValue =
      normalizeSearchValue(searchValue);

    if (!normalizedValue) {
      return;
    }

    router.push(
      `/search?q=${encodeURIComponent(
        normalizedValue,
      )}`,
    );

    setSearchOpen(false);
    setDrawerOpen(false);
  }

  async function handleLogout(): Promise<void> {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      if (onLogout) {
        await onLogout();
      } else {
        const response = await fetch(
          "/api/customer/auth/logout",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            "La déconnexion a échoué.",
          );
        }
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      console.error(
        "[CLIENT_HEADER_LOGOUT_ERROR]",
        error,
      );
    } finally {
      setIsLoggingOut(false);
      setAccountOpen(false);
      setDrawerOpen(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#03070a]/90 text-white shadow-[0_14px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#03070a]/78">
        <div className="hidden border-b border-white/[0.06] bg-white/[0.015] lg:block">
          <div className="mx-auto flex h-9 w-full max-w-[1600px] items-center justify-between gap-6 px-5 xl:px-8">
            <div className="flex min-w-0 items-center gap-5 text-[11px] font-medium text-neutral-400">
              <a
                href={`tel:${supportPhone.replace(
                  /\s+/g,
                  "",
                )}`}
                className="inline-flex items-center gap-2 transition hover:text-white"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
                  <Bell className="h-3 w-3" />
                </span>

                {supportPhone}
              </a>

              <a
                href={`mailto:${supportEmail}`}
                className="transition hover:text-white"
              >
                {supportEmail}
              </a>

              <span className="truncate">
                {locationLabel}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-4 text-[11px] font-semibold text-neutral-400">
              <Link
                href="/help"
                className="transition hover:text-white"
              >
                Aide
              </Link>

              <div
                ref={languageMenuRef}
                className="relative"
              >
                <button
                  type="button"
                  onClick={() => {
                    setLanguageOpen(
                      (current) =>
                        !current,
                    );

                    setAccountOpen(false);
                  }}
                  aria-expanded={
                    languageOpen
                  }
                  className="inline-flex items-center gap-1.5 transition hover:text-white"
                >
                  <Languages className="h-3.5 w-3.5" />

                  Français

                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition",
                      languageOpen &&
                        "rotate-180",
                    )}
                  />
                </button>

                {languageOpen && (
                  <div className="absolute right-0 top-7 z-50 w-40 overflow-hidden rounded-xl border border-white/[0.09] bg-[#081015] p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
                    <button
                      type="button"
                      className="flex w-full items-center rounded-lg bg-emerald-500/10 px-3 py-2 text-left text-xs font-bold text-emerald-300"
                    >
                      Français
                    </button>

                    <button
                      type="button"
                      disabled
                      className="mt-1 flex w-full cursor-not-allowed items-center rounded-lg px-3 py-2 text-left text-xs text-neutral-600"
                    >
                      English — bientôt
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto hidden h-[78px] w-full max-w-[1600px] items-center gap-5 px-5 lg:flex xl:px-8">
          <Link
            href="/"
            aria-label="Accueil Tikemia"
            className="flex shrink-0 items-center"
          >
            <Image
              src={logoSrc}
              alt="Tikemia"
              width={190}
              height={62}
              priority
              className="h-auto w-[150px] object-contain xl:w-[170px]"
            />
          </Link>

          <nav
            aria-label="Navigation principale"
            className="flex min-w-0 flex-1 items-center justify-center gap-1"
          >
            {DESKTOP_NAVIGATION.map(
              (item) => {
                const active =
                  isPathActive(
                    pathname,
                    item.href,
                  );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative rounded-lg px-3 py-2 text-[13px] font-semibold transition",
                      active
                        ? "bg-white/[0.055] text-white"
                        : "text-neutral-400 hover:bg-white/[0.035] hover:text-white",
                    )}
                  >
                    {item.label}

                    {active && (
                      <span className="absolute inset-x-3 -bottom-[15px] h-0.5 rounded-full bg-gradient-to-r from-lime-400 via-orange-400 to-red-500" />
                    )}
                  </Link>
                );
              },
            )}
          </nav>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
            className="relative hidden w-full max-w-[360px] xl:block"
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />

            <input
              value={searchValue}
              onChange={(event) =>
                setSearchValue(
                  event.target.value,
                )
              }
              type="search"
              placeholder="Événement, artiste, ville..."
              aria-label="Rechercher un événement"
              className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.04] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/35 focus:bg-white/[0.055] focus:ring-2 focus:ring-emerald-500/10"
            />
          </form>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setSearchOpen(true)
              }
              aria-label="Ouvrir la recherche"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-300 transition hover:border-white/[0.14] hover:bg-white/[0.055] hover:text-white xl:hidden"
            >
              <Search className="h-4 w-4" />
            </button>

            <Link
              href="/favorites"
              className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              <Heart className="h-4 w-4" />

              <span className="hidden 2xl:inline">
                Favoris
              </span>
            </Link>

            <Link
              href="/account/tickets"
              className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              <Ticket className="h-4 w-4" />

              <span className="hidden 2xl:inline">
                Mes billets
              </span>
            </Link>

            <div
              ref={accountMenuRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() => {
                  setAccountOpen(
                    (current) =>
                      !current,
                  );

                  setLanguageOpen(false);
                }}
                aria-expanded={
                  accountOpen
                }
                className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-2 pr-3 transition hover:border-white/[0.14] hover:bg-white/[0.055]"
              >
                <ClientAvatar
                  user={user}
                  initials={initials}
                  size="sm"
                />

                <div className="hidden max-w-[110px] text-left xl:block">
                  <p className="truncate text-xs font-black text-white">
                    {user
                      ? displayName
                      : "Connexion"}
                  </p>

                  <p className="truncate text-[10px] text-neutral-600">
                    {user
                      ? "Espace client"
                      : "Accéder au compte"}
                  </p>
                </div>

                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-neutral-500 transition",
                    accountOpen &&
                      "rotate-180",
                  )}
                />
              </button>

              {accountOpen && (
                <AccountDropdown
                  user={user}
                  displayName={
                    displayName
                  }
                  initials={initials}
                  isLoggingOut={
                    isLoggingOut
                  }
                  onLogout={
                    handleLogout
                  }
                />
              )}
            </div>
          </div>
        </div>

        <div className="relative flex h-[70px] items-center justify-between gap-3 px-4 lg:hidden">
          <button
            type="button"
            onClick={() =>
              setDrawerOpen(true)
            }
            aria-label="Ouvrir le menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white transition active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link
            href="/"
            aria-label="Accueil Tikemia"
            className="absolute left-1/2 -translate-x-1/2"
          >
            <Image
              src={logoSrc}
              alt="Tikemia"
              width={180}
              height={58}
              priority
              className="h-auto w-[132px] object-contain sm:w-[145px]"
            />
          </Link>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setSearchOpen(true)
              }
              aria-label="Rechercher"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white transition active:scale-95"
            >
              <Search className="h-5 w-5" />
            </button>

            <Link
              href={
                user
                  ? "/account/profile"
                  : "/login"
              }
              aria-label={
                user
                  ? "Mon compte"
                  : "Connexion"
              }
              className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white transition active:scale-95"
            >
              {user ? (
                <ClientAvatar
                  user={user}
                  initials={initials}
                  size="xs"
                />
              ) : (
                <User className="h-5 w-5" />
              )}

              {unreadNotificationsCount >
                0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#03070a] bg-red-500 px-1 text-[9px] font-black text-white">
                  {Math.min(
                    unreadNotificationsCount,
                    99,
                  )}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <MobileDrawer
        open={drawerOpen}
        pathname={pathname}
        user={user}
        logoSrc={logoSrc}
        initials={initials}
        displayName={displayName}
        isLoggingOut={isLoggingOut}
        onClose={() =>
          setDrawerOpen(false)
        }
        onLogout={handleLogout}
      />

      <SearchOverlay
        open={searchOpen}
        value={searchValue}
        inputRef={searchInputRef}
        onChange={setSearchValue}
        onClose={() =>
          setSearchOpen(false)
        }
        onSubmit={submitSearch}
      />
    </>
  );
}

function ClientAvatar({
  user,
  initials,
  size,
}: {
  user?: ClientHeaderUser | null;
  initials: string;
  size: "xs" | "sm" | "lg";
}) {
  const sizeClass = {
    xs: "h-8 w-8 text-[10px]",
    sm: "h-8 w-8 text-[10px]",
    lg: "h-12 w-12 text-sm",
  }[size];

  if (user?.avatarUrl) {
    return (
      <span
        className={cn(
          "relative block shrink-0 overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.04]",
          sizeClass,
        )}
      >
        <Image
          src={user.avatarUrl}
          alt={getDisplayName(user)}
          fill
          sizes="48px"
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-gradient-to-br from-emerald-500/20 via-orange-500/15 to-red-500/15 font-black text-white",
        sizeClass,
      )}
    >
      {initials}
    </span>
  );
}

function AccountDropdown({
  user,
  displayName,
  initials,
  isLoggingOut,
  onLogout,
}: {
  user?: ClientHeaderUser | null;
  displayName: string;
  initials: string;
  isLoggingOut: boolean;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[290px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#081015] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
      {user ? (
        <>
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-4">
            <ClientAvatar
              user={user}
              initials={initials}
              size="lg"
            />

            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {displayName}
              </p>

              <p className="mt-0.5 truncate text-xs text-neutral-500">
                {user.email}
              </p>
            </div>
          </div>

          <div className="p-2">
            <AccountLink
              href="/account/tickets"
              icon={Ticket}
              label="Mes billets"
            />

            <AccountLink
              href="/account/orders"
              icon={ShoppingBag}
              label="Mes commandes"
            />

            <AccountLink
              href="/favorites"
              icon={Heart}
              label="Mes favoris"
            />

            <AccountLink
              href="/account/profile"
              icon={UserRound}
              label="Mon profil"
            />

            <AccountLink
              href="/account/settings"
              icon={Settings}
              label="Paramètres"
            />
          </div>

          <div className="border-t border-white/[0.07] p-2">
            <button
              type="button"
              onClick={() =>
                void onLogout()
              }
              disabled={isLoggingOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />

              {isLoggingOut
                ? "Déconnexion..."
                : "Se déconnecter"}
            </button>
          </div>
        </>
      ) : (
        <div className="p-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
            <p className="text-sm font-black text-white">
              Retrouvez vos billets
            </p>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Connectez-vous pour consulter
              vos commandes, billets et
              favoris.
            </p>
          </div>

          <Link
            href="/login"
            className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 text-sm font-black text-white"
          >
            <LogIn className="h-4 w-4" />
            Se connecter
          </Link>

          <Link
            href="/register"
            className="mt-2 flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-sm font-bold text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            Créer un compte
          </Link>
        </div>
      )}
    </div>
  );
}

function AccountLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Ticket;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.045] hover:text-white"
    >
      <Icon className="h-4 w-4 text-neutral-500" />
      {label}
    </Link>
  );
}

function MobileDrawer({
  open,
  pathname,
  user,
  logoSrc,
  initials,
  displayName,
  isLoggingOut,
  onClose,
  onLogout,
}: {
  open: boolean;
  pathname: string;
  user?: ClientHeaderUser | null;
  logoSrc: string;
  initials: string;
  displayName: string;
  isLoggingOut: boolean;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[80] lg:hidden",
        open
          ? "pointer-events-auto"
          : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer le menu"
        className={cn(
          "absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300",
          open
            ? "opacity-100"
            : "opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(88vw,360px)] flex-col border-r border-white/[0.09] bg-[#071014] shadow-[24px_0_80px_rgba(0,0,0,0.52)] transition-transform duration-300 ease-out",
          open
            ? "translate-x-0"
            : "-translate-x-full",
        )}
      >
        <div className="flex h-[72px] items-center justify-between border-b border-white/[0.07] px-4">
          <Link
            href="/"
            onClick={onClose}
          >
            <Image
              src={logoSrc}
              alt="Tikemia"
              width={165}
              height={54}
              className="h-auto w-[145px] object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-white/[0.07] px-4 py-4">
          {user ? (
            <Link
              href="/account/profile"
              onClick={onClose}
              className="flex items-center gap-3 rounded-2xl border border-emerald-500/18 bg-emerald-500/[0.055] p-3.5"
            >
              <ClientAvatar
                user={user}
                initials={initials}
                size="lg"
              />

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">
                  {displayName}
                </p>

                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {user.email}
                </p>
              </div>
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/login"
                onClick={onClose}
                className="flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 text-sm font-black text-white"
              >
                Connexion
              </Link>

              <Link
                href="/register"
                onClick={onClose}
                className="flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-sm font-bold text-neutral-300"
              >
                Inscription
              </Link>
            </div>
          )}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
            Navigation
          </p>

          <div className="space-y-1">
            {MOBILE_NAVIGATION.map(
              (item) => {
                const active =
                  isPathActive(
                    pathname,
                    item.href,
                  );

                const Icon =
                  item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-semibold transition",
                      active
                        ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300"
                        : "border-transparent text-neutral-300 hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px]",
                        active
                          ? "text-lime-400"
                          : "text-neutral-500",
                      )}
                    />

                    {item.label}
                  </Link>
                );
              },
            )}
          </div>
        </nav>

        <div className="border-t border-white/[0.07] p-4">
          {user ? (
            <button
              type="button"
              onClick={() =>
                void onLogout()
              }
              disabled={isLoggingOut}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] text-sm font-bold text-red-400 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />

              {isLoggingOut
                ? "Déconnexion..."
                : "Se déconnecter"}
            </button>
          ) : (
            <p className="text-center text-[11px] leading-5 text-neutral-600">
              Achetez vos billets avec ou
              sans compte.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function SearchOverlay({
  open,
  value,
  inputRef,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  value: string;
  inputRef: React.RefObject<
    HTMLInputElement | null
  >;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] transition",
        open
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la recherche"
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recherche d’événements"
        className={cn(
          "relative mx-auto mt-3 w-[calc(100%-24px)] max-w-3xl overflow-hidden rounded-2xl border border-white/[0.1] bg-[#081015] shadow-[0_30px_100px_rgba(0,0,0,0.6)] transition-all duration-300 sm:mt-8 sm:w-[calc(100%-40px)]",
          open
            ? "translate-y-0 scale-100"
            : "-translate-y-3 scale-[0.98]",
        )}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="flex items-center gap-2 p-3 sm:p-4"
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

            <input
              ref={inputRef}
              value={value}
              onChange={(event) =>
                onChange(
                  event.target.value,
                )
              }
              type="search"
              placeholder="Artiste, concert, festival, ville..."
              className="h-12 w-full rounded-xl border border-white/[0.09] bg-white/[0.04] pl-12 pr-4 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-emerald-500/35 focus:ring-2 focus:ring-emerald-500/10 sm:h-14 sm:text-base"
            />
          </div>

          <button
            type="submit"
            disabled={
              !normalizeSearchValue(value)
            }
            className="hidden h-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45 sm:flex sm:h-14"
          >
            Rechercher
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-neutral-300 sm:h-14 sm:w-14"
          >
            <X className="h-5 w-5" />
          </button>
        </form>

        <div className="border-t border-white/[0.07] px-4 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
            Recherches populaires
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "Concert",
              "Festival",
              "Conférence",
              "Cotonou",
              "Abidjan",
              "Dakar",
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() =>
                  onChange(suggestion)
                }
                className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-xs font-semibold text-neutral-400 transition hover:border-emerald-500/25 hover:bg-emerald-500/[0.07] hover:text-emerald-300"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}