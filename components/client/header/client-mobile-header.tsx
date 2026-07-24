"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Search, User, X } from "lucide-react";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import ClientMobileDrawer from "@/components/client/header/client-mobile-drawer";

export type ClientMobileHeaderUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  unreadNotificationsCount?: number;
};

export type ClientMobileHeaderProps = {
  user?: ClientMobileHeaderUser | null;
  logoSrc?: string;
  defaultSearchValue?: string;
  loginHref?: string;
  registerHref?: string;
  onLogout?: () => void | Promise<void>;
};

const SEARCH_SUGGESTIONS = [
  "Concert",
  "Festival",
  "Conférence",
  "Spectacle",
  "Cotonou",
  "Abidjan",
  "Dakar",
] as const;

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function normalizeSearchValue(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function getUserDisplayName(
  user?: ClientMobileHeaderUser | null,
): string {
  const fullName = [
    user?.firstName?.trim(),
    user?.lastName?.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return fullName || user?.email?.trim() || "Mon compte";
}

function getUserInitials(
  user?: ClientMobileHeaderUser | null,
): string {
  const firstName = user?.firstName?.trim() ?? "";
  const lastName = user?.lastName?.trim() ?? "";

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`
      .trim()
      .toUpperCase();

  return (
    initials ||
    user?.email?.trim().charAt(0).toUpperCase() ||
    "C"
  );
}

export default function ClientMobileHeader({
  user = null,
  logoSrc = "/logo.png",
  defaultSearchValue = "",
  loginHref = "/login",
  registerHref = "/register",
  onLogout,
}: ClientMobileHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] =
    useState(defaultSearchValue);
  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const initials = useMemo(
    () => getUserInitials(user),
    [user],
  );

  const unreadNotificationsCount = Math.max(
    user?.unreadNotificationsCount ?? 0,
    0,
  );

  function closeDrawer(): void {
    setDrawerOpen(false);
  }

  function closeSearch(): void {
    setSearchOpen(false);
  }

  function submitSearch(): void {
    const normalizedValue =
      normalizeSearchValue(searchValue);

    if (!normalizedValue) {
      return;
    }

    router.push(
      `/search?q=${encodeURIComponent(normalizedValue)}`,
    );

    closeSearch();
    closeDrawer();
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
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            "La déconnexion du client a échoué.",
          );
        }
      }

      closeDrawer();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error(
        "[CLIENT_MOBILE_HEADER_LOGOUT_ERROR]",
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
    <>
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#03070a]/92 text-white shadow-[0_14px_40px_rgba(0,0,0,0.28)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#03070a]/80 lg:hidden">
        <div className="relative flex h-[70px] w-full items-center justify-between gap-3 px-3 sm:h-[74px] sm:px-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu principal"
            aria-expanded={drawerOpen}
            aria-controls="client-mobile-drawer"
            className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-white transition hover:bg-white/[0.055] active:scale-95"
          >
            <Menu className="h-5 w-5 transition group-active:scale-90" />
          </button>

          <Link
            href="/"
            aria-label="Accueil Tikemia"
            className="absolute left-1/2 flex -translate-x-1/2 items-center"
          >
            <Image
              src={logoSrc}
              alt="Tikemia"
              width={180}
              height={58}
              priority
              className="h-auto w-[128px] object-contain min-[390px]:w-[138px] sm:w-[148px]"
            />
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Rechercher un événement"
              aria-expanded={searchOpen}
              aria-controls="client-mobile-search"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-white transition hover:bg-white/[0.055] active:scale-95"
            >
              <Search className="h-5 w-5" />
            </button>

            <Link
              href={
                user ? "/account/profile" : loginHref
              }
              aria-label={
                user
                  ? "Accéder à mon compte"
                  : "Se connecter"
              }
              className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-white transition hover:bg-white/[0.055] active:scale-95"
            >
              {user ? (
                <ClientMobileAvatar
                  user={user}
                  initials={initials}
                />
              ) : (
                <User className="h-5 w-5" />
              )}

              {unreadNotificationsCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#03070a] bg-red-500 px-1 text-[9px] font-black text-white">
                  {unreadNotificationsCount > 99
                    ? "99+"
                    : unreadNotificationsCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <div id="client-mobile-drawer">
        <ClientMobileDrawer
          open={drawerOpen}
          pathname={pathname}
          user={user}
          logoSrc={logoSrc}
          loginHref={loginHref}
          registerHref={registerHref}
          isLoggingOut={isLoggingOut}
          onClose={closeDrawer}
          onLogout={handleLogout}
        />
      </div>

      <MobileSearchDialog
        open={searchOpen}
        value={searchValue}
        onChange={setSearchValue}
        onClose={closeSearch}
        onSubmit={submitSearch}
      />
    </>
  );
}

function ClientMobileAvatar({
  user,
  initials,
}: {
  user?: ClientMobileHeaderUser | null;
  initials: string;
}) {
  if (user?.avatarUrl) {
    return (
      <span className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.04]">
        <Image
          src={user.avatarUrl}
          alt={getUserDisplayName(user)}
          fill
          sizes="32px"
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-gradient-to-br from-emerald-500/20 via-orange-500/15 to-red-500/15 text-[10px] font-black text-white">
      {initials}
    </span>
  );
}

function MobileSearchDialog({
  open,
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const normalizedValue =
    normalizeSearchValue(value);

  return (
    <div
      id="client-mobile-search"
      className={cn(
        "fixed inset-0 z-[90] lg:hidden",
        open
          ? "pointer-events-auto"
          : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la recherche"
        tabIndex={open ? 0 : -1}
        className={cn(
          "absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Recherche d’événements"
        className={cn(
          "relative flex min-h-[230px] w-full flex-col border-b border-white/[0.09] bg-[#071014] px-3 pb-5 pt-[max(12px,env(safe-area-inset-top))] shadow-[0_30px_90px_rgba(0,0,0,0.65)] transition-transform duration-300 ease-out sm:px-4",
          open
            ? "translate-y-0"
            : "-translate-y-full",
        )}
      >
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

            <input
              value={value}
              onChange={(event) =>
                onChange(event.target.value)
              }
              type="search"
              name="q"
              maxLength={120}
              autoComplete="off"
              placeholder="Artiste, concert, festival, ville..."
              aria-label="Rechercher un événement"
              tabIndex={open ? 0 : -1}
              className="h-12 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] py-3 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Annuler la recherche"
            tabIndex={open ? 0 : -1}
            className="flex h-12 shrink-0 items-center justify-center rounded-xl px-2 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.04] active:scale-95 sm:px-3"
          >
            Annuler
          </button>
        </form>

        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-600">
            Recherches populaires
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {SEARCH_SUGGESTIONS.map(
              (suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() =>
                    onChange(suggestion)
                  }
                  tabIndex={open ? 0 : -1}
                  className={cn(
                    "rounded-full border px-3 py-2 text-xs font-semibold transition hover:border-emerald-500/25 hover:text-emerald-300 active:scale-95",
                    value === suggestion
                      ? "border-emerald-500/30 bg-emerald-500/[0.09] text-emerald-300"
                      : "border-white/[0.08] bg-white/[0.025] text-neutral-400",
                  )}
                >
                  {suggestion}
                </button>
              ),
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!normalizedValue}
          tabIndex={open ? 0 : -1}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 text-sm font-black text-white transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Search className="h-4 w-4" />
          Rechercher
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          tabIndex={open ? 0 : -1}
          className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] hidden h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-neutral-300 sm:flex"
        >
          <X className="h-5 w-5" />
        </button>
      </section>
    </div>
  );
}