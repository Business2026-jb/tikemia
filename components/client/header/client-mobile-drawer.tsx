"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Heart,
  Home,
  Info,
  Languages,
  LogIn,
  LogOut,
  Search,
  Settings,
  ShoppingBag,
  Ticket,
  UserRound,
  X,
} from "lucide-react";

export type ClientMobileDrawerUser = {
  id: string;

  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;

  avatarUrl?: string | null;
};

export type ClientMobileDrawerNavigationItem = {
  label: string;
  href: string;

  description?: string;

  icon:
    | typeof Home
    | typeof Search
    | typeof CalendarDays
    | typeof Ticket
    | typeof ShoppingBag
    | typeof Heart
    | typeof UserRound
    | typeof CircleHelp
    | typeof Info
    | typeof Settings;

  requiresAuthentication?: boolean;
};

export type ClientMobileDrawerProps = {
  open: boolean;

  pathname: string;

  user?: ClientMobileDrawerUser | null;

  logoSrc?: string;

  loginHref?: string;
  registerHref?: string;

  isLoggingOut?: boolean;

  onClose: () => void;

  onLogout?: () => void | Promise<void>;
};

const DISCOVER_NAVIGATION: ClientMobileDrawerNavigationItem[] = [
  {
    label: "Accueil",
    description: "Retour à la page principale",
    href: "/",
    icon: Home,
  },
  {
    label: "Explorer",
    description: "Découvrir tous les événements",
    href: "/events",
    icon: Search,
  },
  {
    label: "Catégories",
    description: "Concerts, festivals et plus",
    href: "/categories",
    icon: CalendarDays,
  },
  {
    label: "Top événements",
    description: "Les événements les plus populaires",
    href: "/events?sort=popular",
    icon: Ticket,
  },
];

const CUSTOMER_NAVIGATION: ClientMobileDrawerNavigationItem[] = [
  {
    label: "Mes billets",
    description: "Consulter mes billets",
    href: "/account/tickets",
    icon: Ticket,
    requiresAuthentication: true,
  },
  {
    label: "Mes commandes",
    description: "Historique de mes achats",
    href: "/account/orders",
    icon: ShoppingBag,
    requiresAuthentication: true,
  },
  {
    label: "Mes favoris",
    description: "Événements enregistrés",
    href: "/favorites",
    icon: Heart,
  },
  {
    label: "Mon profil",
    description: "Informations personnelles",
    href: "/account/profile",
    icon: UserRound,
    requiresAuthentication: true,
  },
];

const INFORMATION_NAVIGATION: ClientMobileDrawerNavigationItem[] = [
  {
    label: "Aide et support",
    description: "Obtenir de l’aide",
    href: "/help",
    icon: CircleHelp,
  },
  {
    label: "À propos",
    description: "Découvrir Tikemia",
    href: "/about",
    icon: Info,
  },
  {
    label: "Paramètres",
    description: "Préférences du compte",
    href: "/account/settings",
    icon: Settings,
    requiresAuthentication: true,
  },
];

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes.filter(Boolean).join(" ");
}

function getDisplayName(
  user?: ClientMobileDrawerUser | null,
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

  return user?.email?.trim() || "Mon compte";
}

function getInitials(
  user?: ClientMobileDrawerUser | null,
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

function isPathActive({
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

function createNavigationHref({
  item,
  user,
  loginHref,
}: {
  item: ClientMobileDrawerNavigationItem;
  user?: ClientMobileDrawerUser | null;
  loginHref: string;
}): string {
  if (
    item.requiresAuthentication &&
    !user
  ) {
    return `${loginHref}?redirect=${encodeURIComponent(
      item.href,
    )}`;
  }

  return item.href;
}

export default function ClientMobileDrawer({
  open,
  pathname,
  user = null,
  logoSrc = "/logo.png",
  loginHref = "/login",
  registerHref = "/register",
  isLoggingOut = false,
  onClose,
  onLogout,
}: ClientMobileDrawerProps) {
  const displayName =
    getDisplayName(user);

  const initials =
    getInitials(user);

  async function handleLogout(): Promise<void> {
    if (
      !onLogout ||
      isLoggingOut
    ) {
      return;
    }

    await onLogout();
  }

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
        tabIndex={open ? 0 : -1}
        className={cn(
          "absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300",
          open
            ? "opacity-100"
            : "opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal Tikemia"
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(90vw,380px)] flex-col overflow-hidden border-r border-white/[0.09] bg-[#071014] shadow-[24px_0_90px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out",
          open
            ? "translate-x-0"
            : "-translate-x-full",
        )}
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[0.07] px-4 pt-[env(safe-area-inset-top)]">
          <Link
            href="/"
            onClick={onClose}
            aria-label="Accueil Tikemia"
            tabIndex={open ? 0 : -1}
            className="flex min-w-0 items-center"
          >
            <Image
              src={logoSrc}
              alt="Tikemia"
              width={170}
              height={56}
              priority
              className="h-auto w-[145px] object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            tabIndex={open ? 0 : -1}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-neutral-300 transition hover:bg-white/[0.06] hover:text-white active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-white/[0.07] px-4 py-4">
          {user ? (
            <Link
              href="/account/profile"
              onClick={onClose}
              tabIndex={open ? 0 : -1}
              className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5 transition hover:bg-emerald-500/[0.09] active:scale-[0.99]"
            >
              <ClientDrawerAvatar
                user={user}
                initials={initials}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  {displayName}
                </p>

                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {user.email}
                </p>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600" />
            </Link>
          ) : (
            <div>
              <p className="text-sm font-black text-white">
                Bienvenue sur Tikemia
              </p>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Achetez vos billets avec ou sans compte.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href={loginHref}
                  onClick={onClose}
                  tabIndex={open ? 0 : -1}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-3 text-sm font-black text-white transition hover:brightness-110 active:scale-[0.98]"
                >
                  <LogIn className="h-4 w-4" />
                  Connexion
                </Link>

                <Link
                  href={registerHref}
                  onClick={onClose}
                  tabIndex={open ? 0 : -1}
                  className="flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white active:scale-[0.98]"
                >
                  Inscription
                </Link>
              </div>
            </div>
          )}
        </div>

        <nav
          aria-label="Navigation mobile Tikemia"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
        >
          <ClientMobileDrawerGroup
            title="Découvrir"
            items={DISCOVER_NAVIGATION}
            pathname={pathname}
            user={user}
            loginHref={loginHref}
            open={open}
            onNavigate={onClose}
          />

          <ClientMobileDrawerGroup
            title="Mon espace"
            items={CUSTOMER_NAVIGATION}
            pathname={pathname}
            user={user}
            loginHref={loginHref}
            open={open}
            onNavigate={onClose}
          />

          <ClientMobileDrawerGroup
            title="Informations"
            items={INFORMATION_NAVIGATION}
            pathname={pathname}
            user={user}
            loginHref={loginHref}
            open={open}
            onNavigate={onClose}
          />

          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/[0.08] text-violet-300">
                <Languages className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">
                  Langue
                </p>

                <p className="text-xs text-neutral-500">
                  Français
                </p>
              </div>

              <span className="rounded-full border border-white/[0.08] px-2 py-1 text-[9px] font-bold text-neutral-600">
                FR
              </span>
            </div>
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/[0.07] bg-[#071014] p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          {user ? (
            <button
              type="button"
              onClick={() =>
                void handleLogout()
              }
              disabled={
                isLoggingOut ||
                !onLogout
              }
              tabIndex={open ? 0 : -1}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] text-sm font-bold text-red-400 transition hover:bg-red-500/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />

              {isLoggingOut
                ? "Déconnexion..."
                : "Se déconnecter"}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-[10px] font-medium text-neutral-600">
              <Ticket className="h-3.5 w-3.5" />
              Paiement et billets sécurisés
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ClientDrawerAvatar({
  user,
  initials,
}: {
  user?: ClientMobileDrawerUser | null;
  initials: string;
}) {
  if (user?.avatarUrl) {
    return (
      <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.04]">
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
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-gradient-to-br from-emerald-500/20 via-orange-500/15 to-red-500/15 text-sm font-black text-white">
      {initials}
    </span>
  );
}

function ClientMobileDrawerGroup({
  title,
  items,
  pathname,
  user,
  loginHref,
  open,
  onNavigate,
}: {
  title: string;

  items: ClientMobileDrawerNavigationItem[];

  pathname: string;

  user?: ClientMobileDrawerUser | null;

  loginHref: string;

  open: boolean;

  onNavigate: () => void;
}) {
  return (
    <section className="mb-5 last:mb-0">
      <h2 className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-600">
        {title}
      </h2>

      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;

          const active =
            isPathActive({
              pathname,
              href: item.href,
            });

          const href =
            createNavigationHref({
              item,
              user,
              loginHref,
            });

          return (
            <Link
              key={`${title}-${item.href}`}
              href={href}
              onClick={onNavigate}
              tabIndex={open ? 0 : -1}
              aria-current={
                active
                  ? "page"
                  : undefined
              }
              className={cn(
                "group flex items-center gap-3 rounded-xl border px-3 py-3 transition hover:bg-white/[0.04] active:scale-[0.99]",
                active
                  ? "border-emerald-500/20 bg-emerald-500/[0.08]"
                  : "border-transparent",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition",
                  active
                    ? "border-emerald-500/20 bg-emerald-500/[0.09] text-lime-400"
                    : "border-white/[0.06] bg-white/[0.025] text-neutral-500 group-hover:text-neutral-300",
                )}
              >
                <Icon className="h-[17px] w-[17px]" />
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm font-bold",
                    active
                      ? "text-emerald-300"
                      : "text-neutral-300 group-hover:text-white",
                  )}
                >
                  {item.label}
                </span>

                {item.description && (
                  <span className="mt-0.5 block truncate text-[10px] text-neutral-600">
                    {item.description}
                  </span>
                )}
              </span>

              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 transition",
                  active
                    ? "text-emerald-400"
                    : "text-neutral-700 group-hover:translate-x-0.5 group-hover:text-neutral-500",
                )}
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}