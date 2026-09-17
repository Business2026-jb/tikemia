"use client";

import Link from "next/link";

import {
  CalendarDays,
  Compass,
  Heart,
  Home,
  ShoppingBag,
  Ticket,
  UserRound,
} from "lucide-react";

import {
  usePathname,
} from "next/navigation";

import {
  useTranslations,
} from "next-intl";

export type ClientMobileBottomNavUser = {
  id: string;
};

export type ClientMobileBottomNavProps = {
  user?: ClientMobileBottomNavUser | null;

  homeHref?: string;
  exploreHref?: string;
  favoritesHref?: string;
  ticketsHref?: string;
  eventsHref?: string;
  profileHref?: string;

  /**
   * Cette prop est conservée pour rester compatible
   * avec app/(client)/layout.tsx.
   *
   * Elle représente maintenant directement la route
   * "Mes commandes".
   *
   * Valeur attendue :
   * /account/orders
   */
  accountHref?: string;

  loginHref?: string;

  /**
   * Badges optionnels.
   *
   * Ils peuvent être branchés plus tard sur les vraies
   * statistiques du client sans modifier le composant.
   */
  ordersCount?: number;
  favoritesCount?: number;

  /**
   * Affiche le petit indicateur vert sur le profil.
   * Par défaut il est actif lorsqu'un utilisateur est connecté.
   */
  profileOnline?: boolean;

  hiddenPathPrefixes?: string[];

  className?: string;
};

type NavigationItemId =
  | "home"
  | "explore"
  | "favorites"
  | "tickets"
  | "events"
  | "orders"
  | "profile";

type NavigationItem = {
  id: NavigationItemId;
  href: string;
  label: string;
  requiresAuthentication?: boolean;

  /**
   * Certains raccourcis peuvent mener vers une variante
   * de /events sans avoir besoin d'un second état actif.
   */
  showActiveState?: boolean;
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

  if (
    pathname === "/"
  ) {
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
    normalizePath(
      pathname,
    );

  const targetPath =
    normalizePath(
      href,
    );

  if (
    targetPath === "/"
  ) {
    return (
      currentPath === "/"
    );
  }

  return (
    currentPath ===
      targetPath ||
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

function NavigationIcon({
  id,
  active,
}: {
  id: NavigationItemId;
  active: boolean;
}) {
  const className =
    cn(
      "h-[22px] w-[22px]",
      "stroke-[2]",
      "transition-all duration-300",

      active
        ? "scale-[1.04] text-[#9cff57]"
        : "text-white/78 group-hover:text-white",
    );

  switch (
    id
  ) {
    case "home":
      return (
        <Home
          aria-hidden="true"
          className={cn(
            className,
            active &&
              "fill-[#9cff57]",
          )}
        />
      );

    case "explore":
      return (
        <Compass
          aria-hidden="true"
          className={className}
        />
      );

    case "favorites":
      return (
        <Heart
          aria-hidden="true"
          className={className}
        />
      );

    case "tickets":
      return (
        <Ticket
          aria-hidden="true"
          className="h-[29px] w-[29px] stroke-[2.7] text-[#071008]"
        />
      );

    case "events":
      return (
        <CalendarDays
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

    case "profile":
    default:
      return (
        <UserRound
          aria-hidden="true"
          className={className}
        />
      );
  }
}

function NavigationBadge({
  count,
}: {
  count: number;
}) {
  if (
    count <= 0
  ) {
    return null;
  }

  return (
    <span
      aria-label={`${count}`}
      className={cn(
        "absolute -right-2 -top-2",
        "flex h-[20px] min-w-[20px]",
        "items-center justify-center",
        "rounded-full",
        "border-2 border-[#050b10]",
        "bg-[#ff3159]",
        "px-1",
        "text-[9px] font-black",
        "leading-none text-white",
        "shadow-[0_4px_14px_rgba(255,49,89,0.38)]",
      )}
    >
      {count > 99
        ? "99+"
        : count}
    </span>
  );
}

export default function ClientMobileBottomNav({
  user = null,

  homeHref = "/",
  exploreHref = "/events",
  favoritesHref = "/favorites",
  ticketsHref = "/account/tickets",

  /**
   * Route distincte conservée pour proposer un accès
   * direct aux événements populaires.
   *
   * La route principale /events reste utilisée par Explorer.
   */
  eventsHref = "/events?sort=popular",

  /**
   * On utilise accountHref pour Mes commandes afin de
   * préserver la compatibilité avec le layout existant.
   */
  accountHref = "/account/orders",

  profileHref = "/account/profile",

  loginHref = "/login",

  ordersCount = 0,
  favoritesCount = 0,

  profileOnline = Boolean(
    user,
  ),

  hiddenPathPrefixes = [
    ...DEFAULT_HIDDEN_PATH_PREFIXES,
  ],

  className,
}: ClientMobileBottomNavProps) {
  const pathname =
    usePathname();

  const tNavigation =
    useTranslations(
      "navigation",
    );

  const tEvents =
    useTranslations(
      "events",
    );

  const normalizedPath =
    normalizePath(
      pathname,
    );

  const shouldHide =
    hiddenPathPrefixes.some(
      (
        prefix,
      ) => {
        const normalizedPrefix =
          normalizePath(
            prefix,
          );

        return (
          normalizedPath ===
            normalizedPrefix ||
          normalizedPath.startsWith(
            `${normalizedPrefix}/`,
          )
        );
      },
    );

  if (
    shouldHide
  ) {
    return null;
  }

  const navigationItems:
    NavigationItem[] = [
      {
        id: "home",

        href:
          homeHref,

        label:
          tNavigation(
            "home",
          ),
      },

      {
        id:
          "explore",

        href:
          exploreHref,

        label:
          tNavigation(
            "explore",
          ),
      },

      {
        id:
          "favorites",

        href:
          favoritesHref,

        label:
          tNavigation(
            "favorites",
          ),

        requiresAuthentication:
          true,
      },

      {
        id:
          "tickets",

        href:
          ticketsHref,

        label:
          tNavigation(
            "myTickets",
          ),

        requiresAuthentication:
          true,
      },

      {
        id:
          "events",

        href:
          eventsHref,

        label:
          tEvents(
            "title",
          ),

        /*
         * Explorer et Événements partagent /events.
         *
         * Explorer reste l'état actif principal afin d'éviter
         * que les deux boutons deviennent verts simultanément.
         */
        showActiveState:
          false,
      },

      {
        id:
          "orders",

        href:
          accountHref,

        label:
          tNavigation(
            "myOrders",
          ),

        requiresAuthentication:
          true,
      },

      {
        id:
          "profile",

        href:
          profileHref,

        label:
          user
            ? tNavigation(
                "profile",
              )
            : tNavigation(
                "login",
              ),

        requiresAuthentication:
          true,
      },
    ];

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[70]",
        "pointer-events-none",
        "px-2",
        "pb-[max(7px,env(safe-area-inset-bottom))]",
        "lg:hidden",
        className,
      )}
    >
      <nav
        aria-label="Navigation mobile"
        className={cn(
          "pointer-events-auto",
          "relative mx-auto",
          "w-full max-w-[720px]",
          "overflow-visible",

          "rounded-[28px]",

          "border border-[#2b4050]/80",

          "bg-[#050b10]/96",

          "px-1.5 pb-1.5 pt-2",

          "shadow-[0_22px_65px_rgba(0,0,0,0.72)]",

          "backdrop-blur-2xl",

          "supports-[backdrop-filter]:bg-[#050b10]/90",
        )}
      >
        {/* Bordure intérieure premium */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[1px] rounded-[27px] border border-white/[0.025]"
        />

        {/* Ligne lumineuse Tikemia */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#7dff42]/55 to-transparent"
        />

        {/* Halo derrière le bouton central */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-20 w-28 -translate-x-1/2 -translate-y-6 rounded-full bg-[#7dff42]/[0.08] blur-2xl"
        />

        <div className="relative grid grid-cols-7 items-end gap-0">
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

              const pathActive =
                isPathActive({
                  pathname,

                  href:
                    item.href,
                });

              const active =
                item.showActiveState ===
                false
                  ? false
                  : pathActive;

              const isCenter =
                item.id ===
                "tickets";

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
                    "group relative flex min-w-0",

                    "flex-col items-center justify-end",

                    "outline-none",

                    "transition-transform duration-200",

                    "focus-visible:ring-2",

                    "focus-visible:ring-[#8dff4f]/60",

                    "focus-visible:ring-offset-2",

                    "focus-visible:ring-offset-[#050b10]",

                    "active:scale-[0.94]",

                    isCenter
                      ? "pb-0"
                      : "min-h-[67px] pb-[7px] pt-[6px]",
                  )}
                >
                  {isCenter ? (
                    /*
                     * ======================================================
                     * BOUTON CENTRAL — MES BILLETS
                     * ======================================================
                     */
                    <div className="relative -mt-[31px] flex flex-col items-center">
                      {/* Glow */}
                      <span
                        aria-hidden="true"
                        className="absolute left-1/2 top-[11px] h-[62px] w-[62px] -translate-x-1/2 rounded-full bg-[#8dff4f]/25 blur-2xl"
                      />

                      {/* Anneau extérieur */}
                      <span
                        aria-hidden="true"
                        className="absolute left-1/2 top-0 h-[78px] w-[78px] -translate-x-1/2 rounded-full border border-[#7dff42]/35"
                      />

                      {/* Cercle principal */}
                      <span
                        className={cn(
                          "relative flex h-[68px] w-[68px]",

                          "items-center justify-center",

                          "rounded-full",

                          "border-[3px] border-[#72c932]",

                          "bg-gradient-to-br",

                          "from-[#a9ff68]",

                          "via-[#8dff4f]",

                          "to-[#73e93a]",

                          "shadow-[0_0_0_6px_rgba(75,145,25,0.22),0_0_30px_rgba(132,255,73,0.30),0_14px_28px_rgba(0,0,0,0.45)]",

                          "transition duration-300",

                          "group-hover:scale-[1.04]",
                        )}
                      >
                        <NavigationIcon
                          id="tickets"
                          active
                        />
                      </span>

                      <span
                        className={cn(
                          "mt-[7px]",

                          "max-w-[76px] truncate",

                          "text-center",

                          "text-[9.5px]",

                          "font-bold",

                          "leading-none",

                          "text-white",

                          "sm:text-[11px]",
                        )}
                      >
                        {
                          item.label
                        }
                      </span>
                    </div>
                  ) : (
                    /*
                     * ======================================================
                     * ONGLETS LATÉRAUX
                     * ======================================================
                     */
                    <>
                      {active ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="absolute inset-x-1 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-[#76ff3b] via-[#9cff57] to-[#e6ff4d] shadow-[0_0_12px_rgba(126,255,62,0.55)]"
                          />

                          <span
                            aria-hidden="true"
                            className="absolute bottom-0 left-1/2 h-10 w-12 -translate-x-1/2 bg-[#8dff4f]/[0.05] blur-xl"
                          />
                        </>
                      ) : null}

                      <span className="relative flex h-8 w-9 items-center justify-center">
                        <NavigationIcon
                          id={
                            item.id
                          }
                          active={
                            active
                          }
                        />

                        {item.id ===
                          "favorites" ? (
                          <NavigationBadge
                            count={
                              favoritesCount
                            }
                          />
                        ) : null}

                        {item.id ===
                          "orders" ? (
                          <NavigationBadge
                            count={
                              ordersCount
                            }
                          />
                        ) : null}

                        {item.id ===
                          "profile" &&
                        profileOnline ? (
                          <span
                            aria-label="En ligne"
                            className={cn(
                              "absolute -right-1 top-0",

                              "h-2.5 w-2.5",

                              "rounded-full",

                              "border-2 border-[#050b10]",

                              "bg-[#7dff42]",

                              "shadow-[0_0_8px_rgba(125,255,66,0.55)]",
                            )}
                          />
                        ) : null}
                      </span>

                      <span
                        className={cn(
                          "mt-[5px]",

                          "max-w-full truncate",

                          "px-0.5",

                          "text-center",

                          "text-[8px]",

                          "font-medium",

                          "leading-none",

                          "tracking-[-0.01em]",

                          "transition-colors duration-200",

                          "min-[390px]:text-[8.5px]",

                          "sm:text-[10px]",

                          active
                            ? "font-bold text-[#a7ff68]"
                            : "text-white/65 group-hover:text-white",
                        )}
                      >
                        {
                          item.label
                        }
                      </span>
                    </>
                  )}
                </Link>
              );
            },
          )}
        </div>
      </nav>
    </div>
  );
}