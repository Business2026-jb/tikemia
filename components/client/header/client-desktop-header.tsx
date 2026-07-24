"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  CircleHelp,
  Heart,
  Languages,
  LogIn,
  LogOut,
  Search,
  Settings,
  ShoppingBag,
  Ticket,
  UserRound,
} from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

export type ClientDesktopHeaderUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export type ClientDesktopHeaderProps = {
  user?: ClientDesktopHeaderUser | null;

  logoSrc?: string;

  supportEmail?: string;
  supportPhone?: string;
  locationLabel?: string;

  defaultSearchValue?: string;

  loginHref?: string;
  registerHref?: string;

  onLogout?: () => void | Promise<void>;
};

type NavigationItem = {
  label: string;
  href: string;
};

type AccountMenuItem = {
  label: string;
  href: string;
  icon: typeof Ticket;
};

const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: "Accueil",
    href: "/",
  },
  {
    label: "Explorer",
    href: "/events",
  },
  {
    label: "Catégories",
    href: "/categories",
  },
  {
    label: "Top événements",
    href: "/events?sort=popular",
  },
  {
    label: "À propos",
    href: "/about",
  },
  {
    label: "Contact",
    href: "/contact",
  },
];

const ACCOUNT_MENU_ITEMS: AccountMenuItem[] = [
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
  return classes
    .filter(Boolean)
    .join(" ");
}

function normalizeSearchValue(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function normalizeTelephoneHref(
  value: string,
): string {
  return value.replace(
    /[^\d+]/g,
    "",
  );
}

function getUserDisplayName(
  user?: ClientDesktopHeaderUser | null,
): string {
  const fullName = [
    user?.firstName?.trim(),
    user?.lastName?.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  if (fullName) {
    return fullName;
  }

  if (user?.email) {
    return user.email;
  }

  return "Mon compte";
}

function getUserInitials(
  user?: ClientDesktopHeaderUser | null,
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
      ?.trim()
      .charAt(0)
      .toUpperCase() || "C"
  );
}

function isNavigationItemActive({
  pathname,
  href,
}: {
  pathname: string;
  href: string;
}): boolean {
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

export default function ClientDesktopHeader({
  user = null,

  logoSrc = "/logo.png",

  supportEmail = "contact@tikemia.com",
  supportPhone = "+229 01 69 56 77 44",
  locationLabel = "Cotonou, Bénin",

  defaultSearchValue = "",

  loginHref = "/login",
  registerHref = "/register",

  onLogout,
}: ClientDesktopHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const accountMenuRef =
    useRef<HTMLDetailsElement | null>(
      null,
    );

  const languageMenuRef =
    useRef<HTMLDetailsElement | null>(
      null,
    );

  const [searchValue, setSearchValue] =
    useState(defaultSearchValue);

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const displayName = useMemo(
    () => getUserDisplayName(user),
    [user],
  );

  const initials = useMemo(
    () => getUserInitials(user),
    [user],
  );

  function closeAccountMenu(): void {
    if (accountMenuRef.current) {
      accountMenuRef.current.open =
        false;
    }
  }

  function closeLanguageMenu(): void {
    if (languageMenuRef.current) {
      languageMenuRef.current.open =
        false;
    }
  }

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

    closeAccountMenu();
    closeLanguageMenu();
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
            "La déconnexion du client a échoué.",
          );
        }
      }

      closeAccountMenu();

      router.push("/");
      router.refresh();
    } catch (error) {
      console.error(
        "[CLIENT_DESKTOP_HEADER_LOGOUT_ERROR]",
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : error,
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 hidden w-full border-b border-white/[0.08] bg-[#03070a]/90 text-white shadow-[0_16px_48px_rgba(0,0,0,0.28)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#03070a]/78 lg:block">
      <div className="border-b border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto flex h-9 w-full max-w-[1600px] items-center justify-between gap-6 px-5 xl:px-8">
          <div className="flex min-w-0 items-center gap-5 text-[11px] font-medium text-neutral-400">
            <a
              href={`tel:${normalizeTelephoneHref(
                supportPhone,
              )}`}
              className="inline-flex shrink-0 items-center gap-2 transition hover:text-white"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.06]">
                <CircleHelp className="h-3 w-3 text-emerald-400" />
              </span>

              {supportPhone}
            </a>

            <a
              href={`mailto:${supportEmail}`}
              className="max-w-[220px] truncate transition hover:text-white"
            >
              {supportEmail}
            </a>

            <span className="max-w-[200px] truncate">
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

            <details
              ref={languageMenuRef}
              className="group relative"
            >
              <summary className="flex cursor-pointer list-none items-center gap-1.5 transition hover:text-white [&::-webkit-details-marker]:hidden">
                <Languages className="h-3.5 w-3.5" />

                Français

                <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
              </summary>

              <div className="absolute right-0 top-7 z-50 w-44 overflow-hidden rounded-xl border border-white/[0.09] bg-[#081015] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <button
                  type="button"
                  onClick={
                    closeLanguageMenu
                  }
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
            </details>
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-[78px] w-full max-w-[1600px] items-center gap-4 px-5 xl:gap-5 xl:px-8">
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
            className="h-auto w-[145px] object-contain xl:w-[165px]"
          />
        </Link>

        <nav
          aria-label="Navigation principale des clients"
          className="flex min-w-0 flex-1 items-center justify-center gap-0.5 xl:gap-1"
        >
          {NAVIGATION_ITEMS.map(
            (item) => {
              const active =
                isNavigationItemActive({
                  pathname,
                  href: item.href,
                });

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
                  className={cn(
                    "relative whitespace-nowrap rounded-lg px-2.5 py-2 text-[12px] font-semibold transition xl:px-3 xl:text-[13px]",
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
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
          className="relative hidden w-full max-w-[300px] xl:block 2xl:max-w-[380px]"
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
            name="q"
            maxLength={120}
            autoComplete="off"
            placeholder="Événement, artiste, ville..."
            aria-label="Rechercher un événement"
            className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.04] pl-10 pr-12 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/35 focus:bg-white/[0.055] focus:ring-2 focus:ring-emerald-500/10"
          />

          <button
            type="submit"
            disabled={
              !normalizeSearchValue(
                searchValue,
              )
            }
            aria-label="Lancer la recherche"
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() =>
              router.push("/search")
            }
            aria-label="Ouvrir la recherche"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-300 transition hover:border-white/[0.14] hover:bg-white/[0.055] hover:text-white xl:hidden"
          >
            <Search className="h-4 w-4" />
          </button>

          <Link
            href="/favorites"
            className="flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.04] hover:text-white"
          >
            <Heart className="h-4 w-4" />

            <span className="hidden 2xl:inline">
              Favoris
            </span>
          </Link>

          <Link
            href="/account/tickets"
            className="flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.04] hover:text-white"
          >
            <Ticket className="h-4 w-4" />

            <span className="hidden 2xl:inline">
              Mes billets
            </span>
          </Link>

          <details
            ref={accountMenuRef}
            className="group relative"
          >
            <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-2 pr-3 transition hover:border-white/[0.14] hover:bg-white/[0.055] [&::-webkit-details-marker]:hidden">
              <ClientDesktopAvatar
                user={user}
                initials={initials}
              />

              <div className="hidden max-w-[115px] text-left xl:block">
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

              <ChevronDown className="h-4 w-4 text-neutral-500 transition group-open:rotate-180" />
            </summary>

            <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[300px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#081015] shadow-[0_26px_80px_rgba(0,0,0,0.58)]">
              {user ? (
                <>
                  <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-4">
                    <ClientDesktopAvatar
                      user={user}
                      initials={initials}
                      large
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
                    {ACCOUNT_MENU_ITEMS.map(
                      (item) => {
                        const Icon =
                          item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={
                              closeAccountMenu
                            }
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.045] hover:text-white"
                          >
                            <Icon className="h-4 w-4 text-neutral-500" />

                            {item.label}
                          </Link>
                        );
                      },
                    )}
                  </div>

                  <div className="border-t border-white/[0.07] p-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleLogout()
                      }
                      disabled={
                        isLoggingOut
                      }
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
                      Connectez-vous pour
                      consulter vos commandes,
                      billets et favoris.
                    </p>
                  </div>

                  <Link
                    href={loginHref}
                    onClick={
                      closeAccountMenu
                    }
                    className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 text-sm font-black text-white transition hover:brightness-110"
                  >
                    <LogIn className="h-4 w-4" />

                    Se connecter
                  </Link>

                  <Link
                    href={registerHref}
                    onClick={
                      closeAccountMenu
                    }
                    className="mt-2 flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-sm font-bold text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    Créer un compte
                  </Link>

                  <p className="mt-3 text-center text-[10px] leading-4 text-neutral-600">
                    Vous pouvez acheter un billet
                    sans créer de compte.
                  </p>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function ClientDesktopAvatar({
  user,
  initials,
  large = false,
}: {
  user?: ClientDesktopHeaderUser | null;
  initials: string;
  large?: boolean;
}) {
  const sizeClass = large
    ? "h-12 w-12 text-sm"
    : "h-8 w-8 text-[10px]";

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
          alt={getUserDisplayName(user)}
          fill
          sizes={
            large
              ? "48px"
              : "32px"
          }
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