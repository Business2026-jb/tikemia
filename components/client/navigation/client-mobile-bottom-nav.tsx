"use client";

import Link from "next/link";
import {
  Heart,
  Home,
  Search,
  Ticket,
  User,
} from "lucide-react";
import {
  usePathname,
} from "next/navigation";

export type ClientMobileBottomNavUser = {
  id: string;
};

export type ClientMobileBottomNavProps = {
  user?: ClientMobileBottomNavUser | null;

  homeHref?: string;
  exploreHref?: string;
  favoritesHref?: string;
  ticketsHref?: string;
  accountHref?: string;
  loginHref?: string;

  hiddenPathPrefixes?: string[];

  className?: string;
};

type NavigationIconName =
  | "home"
  | "search"
  | "heart"
  | "ticket"
  | "user";

type NavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: NavigationIconName;
  requiresAuthentication?: boolean;
};

const DEFAULT_HIDDEN_PATH_PREFIXES = [
  "/checkout",
  "/payment",
  "/organizer",
  "/admin",
] as const;

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
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

function createProtectedHref({
  href,
  requiresAuthentication,
  user,
  loginHref,
}: {
  href: string;
  requiresAuthentication?: boolean;
  user?: ClientMobileBottomNavUser | null;
  loginHref: string;
}): string {
  if (
    requiresAuthentication &&
    !user
  ) {
    return `${loginHref}?redirect=${encodeURIComponent(
      href,
    )}`;
  }

  return href;
}

function renderNavigationIcon(
  icon: NavigationIconName,
  active: boolean,
) {
  const className = cn(
    "h-[19px] w-[19px] transition",
    active
      ? "text-lime-400"
      : "text-neutral-500",
  );

  if (icon === "home") {
    return (
      <Home
        aria-hidden="true"
        className={className}
      />
    );
  }

  if (icon === "search") {
    return (
      <Search
        aria-hidden="true"
        className={className}
      />
    );
  }

  if (icon === "heart") {
    return (
      <Heart
        aria-hidden="true"
        className={className}
      />
    );
  }

  if (icon === "ticket") {
    return (
      <Ticket
        aria-hidden="true"
        className={className}
      />
    );
  }

  return (
    <User
      aria-hidden="true"
      className={className}
    />
  );
}

export default function ClientMobileBottomNav({
  user = null,

  homeHref = "/",
  exploreHref = "/events",
  favoritesHref = "/favorites",
  ticketsHref = "/account/tickets",
  accountHref = "/account/profile",
  loginHref = "/login",

  hiddenPathPrefixes = [
    ...DEFAULT_HIDDEN_PATH_PREFIXES,
  ],

  className,
}: ClientMobileBottomNavProps) {
  const pathname = usePathname();

  const shouldHide =
    hiddenPathPrefixes.some(
      (prefix) =>
        pathname === prefix ||
        pathname.startsWith(
          `${prefix}/`,
        ),
    );

  if (shouldHide) {
    return null;
  }

  const navigationItems: NavigationItem[] = [
    {
      id: "home",
      label: "Accueil",
      href: homeHref,
      icon: "home",
    },
    {
      id: "explore",
      label: "Explorer",
      href: exploreHref,
      icon: "search",
    },
    {
      id: "favorites",
      label: "Favoris",
      href: favoritesHref,
      icon: "heart",
    },
    {
      id: "tickets",
      label: "Billets",
      href: ticketsHref,
      icon: "ticket",
      requiresAuthentication: true,
    },
    {
      id: "account",
      label: user
        ? "Compte"
        : "Connexion",
      href: user
        ? accountHref
        : loginHref,
      icon: "user",
    },
  ];

  return (
    <nav
      aria-label="Navigation mobile principale"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.09] bg-[#03070a]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_45px_rgba(0,0,0,0.38)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#03070a]/82 lg:hidden",
        className,
      )}
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-1">
        {navigationItems.map(
          (item) => {
            const active =
              isPathActive({
                pathname,
                href:
                  item.href,
              });

            const href =
              createProtectedHref({
                href:
                  item.href,
                requiresAuthentication:
                  item.requiresAuthentication,
                user,
                loginHref,
              });

            return (
              <Link
                key={item.id}
                href={href}
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
                className={cn(
                  "group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition active:scale-95",
                  active
                    ? "bg-emerald-500/[0.08]"
                    : "hover:bg-white/[0.035]",
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-gradient-to-r from-lime-400 via-orange-400 to-red-500"
                  />
                )}

                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl border transition",
                    active
                      ? "border-emerald-500/20 bg-emerald-500/[0.09]"
                      : "border-transparent bg-transparent group-hover:border-white/[0.06] group-hover:bg-white/[0.025]",
                  )}
                >
                  {renderNavigationIcon(
                    item.icon,
                    active,
                  )}
                </span>

                <span
                  className={cn(
                    "max-w-full truncate text-[10px] font-bold transition",
                    active
                      ? "text-emerald-300"
                      : "text-neutral-600 group-hover:text-neutral-300",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          },
        )}
      </div>
    </nav>
  );
}