"use client";

import Link from "next/link";
import {
  Heart,
  Home,
  Search,
  ShoppingBag,
  Ticket,
  User,
} from "lucide-react";
import { usePathname } from "next/navigation";

export type ClientMobileBottomNavUser = {
  id: string;
};

export type ClientMobileBottomNavProps = {
  user?: ClientMobileBottomNavUser | null;

  homeHref?: string;
  exploreHref?: string;
  favoritesHref?: string;
  ticketsHref?: string;

  /**
   * Cette prop conserve son nom actuel pour rester compatible
   * avec app/(client)/layout.tsx.
   *
   * Quand le client est connecté, elle doit contenir :
   * /account/orders
   */
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
  | "orders"
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

function normalizePath(
  value: string,
): string {
  const pathname =
    value
      .split("?")[0]
      ?.trim() ||
    "/";

  if (pathname === "/") {
    return "/";
  }

  return pathname.replace(
    /\/+$/,
    "",
  );
}

function isPathActive({
  pathname,
  href,
}: {
  pathname: string;
  href: string;
}): boolean {
  const currentPath =
    normalizePath(pathname);

  const targetPath =
    normalizePath(href);

  if (targetPath === "/") {
    return currentPath === "/";
  }

  return (
    currentPath === targetPath ||
    currentPath.startsWith(
      `${targetPath}/`,
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
    const separator =
      loginHref.includes("?")
        ? "&"
        : "?";

    return `${loginHref}${separator}redirect=${encodeURIComponent(
      href,
    )}`;
  }

  return href;
}

function renderNavigationIcon({
  icon,
  active,
}: {
  icon: NavigationIconName;
  active: boolean;
}) {
  const className =
    cn(
      "h-[19px] w-[19px] transition duration-200",
      active
        ? "text-lime-400"
        : "text-neutral-500 group-hover:text-neutral-300",
    );

  switch (icon) {
    case "home":
      return (
        <Home
          aria-hidden="true"
          className={className}
        />
      );

    case "search":
      return (
        <Search
          aria-hidden="true"
          className={className}
        />
      );

    case "heart":
      return (
        <Heart
          aria-hidden="true"
          className={className}
        />
      );

    case "ticket":
      return (
        <Ticket
          aria-hidden="true"
          className={className}
        />
      );

    case "orders":
      return (
        <ShoppingBag
          aria-hidden="true"
          className={className}
        />
      );

    default:
      return (
        <User
          aria-hidden="true"
          className={className}
        />
      );
  }
}

export default function ClientMobileBottomNav({
  user = null,

  homeHref = "/",
  exploreHref = "/events",
  favoritesHref = "/favorites",
  ticketsHref = "/account/tickets",
  accountHref = "/account/orders",
  loginHref = "/login",

  hiddenPathPrefixes = [
    ...DEFAULT_HIDDEN_PATH_PREFIXES,
  ],

  className,
}: ClientMobileBottomNavProps) {
  const pathname =
    usePathname();

  const normalizedPath =
    normalizePath(pathname);

  const shouldHide =
    hiddenPathPrefixes.some(
      (
        prefix,
      ) => {
        const normalizedPrefix =
          normalizePath(prefix);

        return (
          normalizedPath ===
            normalizedPrefix ||
          normalizedPath.startsWith(
            `${normalizedPrefix}/`,
          )
        );
      },
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
      requiresAuthentication: true,
    },
    {
      id: "tickets",
      label: "Billets",
      href: ticketsHref,
      icon: "ticket",
      requiresAuthentication: true,
    },
    {
      id:
        user
          ? "orders"
          : "login",

      label:
        user
          ? "Mes commandes"
          : "Connexion",

      href:
        user
          ? accountHref
          : loginHref,

      icon:
        user
          ? "orders"
          : "user",

      requiresAuthentication:
        Boolean(user),
    },
  ];

  return (
    <nav
      aria-label="Navigation mobile principale"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[70] border-t border-white/[0.09] bg-[#03070a]/95 px-2 pt-2 shadow-[0_-14px_45px_rgba(0,0,0,0.38)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#03070a]/84 lg:hidden",
        "pb-[max(8px,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-1">
        {navigationItems.map(
          (
            item,
          ) => {
            const resolvedHref =
              createProtectedHref({
                href:
                  item.href,

                requiresAuthentication:
                  item.requiresAuthentication,

                user,

                loginHref,
              });

            const active =
              isPathActive({
                pathname,

                href:
                  item.href,
              });

            return (
              <Link
                key={
                  item.id
                }
                href={
                  resolvedHref
                }
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
                aria-label={
                  item.label
                }
                className={cn(
                  "group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center outline-none transition duration-200",
                  "focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03070a]",
                  "active:scale-95",
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
                    "flex h-8 w-8 items-center justify-center rounded-xl border transition duration-200",
                    active
                      ? "border-emerald-500/20 bg-emerald-500/[0.09]"
                      : "border-transparent bg-transparent group-hover:border-white/[0.06] group-hover:bg-white/[0.025]",
                  )}
                >
                  {renderNavigationIcon({
                    icon:
                      item.icon,

                    active,
                  })}
                </span>

                <span
                  className={cn(
                    "max-w-full truncate text-[9px] font-bold transition duration-200 sm:text-[10px]",
                    active
                      ? "text-emerald-300"
                      : "text-neutral-600 group-hover:text-neutral-300",
                  )}
                >
                  {
                    item.label
                  }
                </span>
              </Link>
            );
          },
        )}
      </div>
    </nav>
  );
}