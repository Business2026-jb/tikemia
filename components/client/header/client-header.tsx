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
  LogIn,
  LogOut,
  Menu,
  RotateCcw,
  Search,
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

import {
  useLocale,
  useTranslations,
} from "next-intl";

import LanguageSwitcher from "@/components/language/language-switcher";

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

  loginHref?: string;
  registerHref?: string;

  logoSrc?: string;
  supportEmail?: string;
  supportPhone?: string;
  locationLabel?: string;
  defaultSearchValue?: string;

  onLogout?: () => void | Promise<void>;
};

type NavigationLabelKey =
  | "home"
  | "explore"
  | "categories"
  | "topEvents"
  | "about"
  | "contact"
  | "profile"
  | "myOrders"
  | "refunds"
  | "myTickets"
  | "favorites";

type NavigationItem = {
  labelKey:
    NavigationLabelKey;

  href:
    string;

  icon:
    | typeof Home
    | typeof Search
    | typeof CalendarDays
    | typeof Ticket
    | typeof Info
    | typeof CircleHelp
    | typeof UserRound
    | typeof ShoppingBag
    | typeof Heart
    | typeof RotateCcw;
};

const DESKTOP_NAVIGATION:
  NavigationItem[] = [
    {
      labelKey:
        "home",

      href:
        "/",

      icon:
        Home,
    },

    {
      labelKey:
        "explore",

      href:
        "/events",

      icon:
        Search,
    },

    {
      labelKey:
        "categories",

      href:
        "/categories",

      icon:
        CalendarDays,
    },

    {
      labelKey:
        "topEvents",

      href:
        "/events?sort=popular",

      icon:
        Ticket,
    },

    {
      labelKey:
        "about",

      href:
        "/about",

      icon:
        Info,
    },

    {
      labelKey:
        "contact",

      href:
        "/contact",

      icon:
        CircleHelp,
    },
  ];

const AUTHENTICATED_MOBILE_NAVIGATION:
  NavigationItem[] = [
    {
      labelKey:
        "profile",

      href:
        "/account/profile",

      icon:
        UserRound,
    },

    {
      labelKey:
        "myOrders",

      href:
        "/account/orders",

      icon:
        ShoppingBag,
    },

    {
      labelKey:
        "refunds",

      href:
        "/account/refunds",

      icon:
        RotateCcw,
    },

    {
      labelKey:
        "myTickets",

      href:
        "/account/tickets",

      icon:
        Ticket,
    },

    {
      labelKey:
        "favorites",

      href:
        "/favorites",

      icon:
        Heart,
    },
  ];

const SEARCH_SUGGESTIONS = {
  fr: [
    "Concert",
    "Festival",
    "Conférence",
    "Spectacle",
    "Cotonou",
    "Abidjan",
    "Dakar",
  ],

  en: [
    "Concert",
    "Festival",
    "Conference",
    "Show",
    "Cotonou",
    "Abidjan",
    "Dakar",
  ],
} as const;

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
  value:
    string,
): string {
  return value
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
    .slice(
      0,
      120,
    );
}

function createLoginRedirectHref(
  loginHref:
    string,

  destination:
    string,
): string {
  const separator =
    loginHref.includes(
      "?",
    )
      ? "&"
      : "?";

  return `${loginHref}${separator}redirect=${encodeURIComponent(
    destination,
  )}`;
}

function getInitials(
  user?:
    ClientHeaderUser | null,
): string {
  const firstName =
    user?.firstName?.trim() ??
    "";

  const lastName =
    user?.lastName?.trim() ??
    "";

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`
      .trim()
      .toUpperCase();

  if (
    initials
  ) {
    return initials;
  }

  return (
    user?.email
      ?.trim()
      .charAt(0)
      .toUpperCase() ||
    "C"
  );
}

function getDisplayName(
  user?:
    ClientHeaderUser | null,

  fallback =
    "Tikemia",
): string {
  const fullName =
    [
      user?.firstName?.trim(),
      user?.lastName?.trim(),
    ]
      .filter(Boolean)
      .join(" ");

  return (
    fullName ||
    user?.email?.trim() ||
    fallback
  );
}

function isPathActive(
  pathname:
    string,

  href:
    string,
): boolean {
  const cleanHref =
    href
      .split("?")[0] ||
    "/";

  if (
    cleanHref ===
    "/"
  ) {
    return (
      pathname ===
      "/"
    );
  }

  return (
    pathname ===
      cleanHref ||
    pathname.startsWith(
      `${cleanHref}/`,
    )
  );
}

export default function ClientHeader({
  user = null,

  loginHref = "/login",
  registerHref = "/register",

  logoSrc = "/logo.png",

  supportEmail =
    "contact@tikemia.com",

  supportPhone =
    "+229 01 69 56 77 44",

  locationLabel =
    "Cotonou, Bénin",

  defaultSearchValue =
    "",

  onLogout,
}: ClientHeaderProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const locale =
    useLocale();

  const tNavigation =
    useTranslations(
      "navigation",
    );

  const tHeader =
    useTranslations(
      "header",
    );

  const [
    drawerOpen,
    setDrawerOpen,
  ] =
    useState(false);

  const [
    searchOpen,
    setSearchOpen,
  ] =
    useState(false);

  const [
    accountOpen,
    setAccountOpen,
  ] =
    useState(false);

  const [
    searchValue,
    setSearchValue,
  ] =
    useState(
      defaultSearchValue,
    );

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] =
    useState(false);

  const accountMenuRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const searchInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const unreadNotificationsCount =
    Math.max(
      user?.unreadNotificationsCount ??
        0,
      0,
    );

  const translatedAccountFallback =
    tNavigation(
      "myAccount",
    );

  const displayName =
    useMemo(
      () =>
        getDisplayName(
          user,
          translatedAccountFallback,
        ),
      [
        user,
        translatedAccountFallback,
      ],
    );

  const initials =
    useMemo(
      () =>
        getInitials(
          user,
        ),
      [user],
    );

  const favoritesHref =
    user
      ? "/favorites"
      : createLoginRedirectHref(
          loginHref,
          "/favorites",
        );

  const ticketsHref =
    user
      ? "/account/tickets"
      : createLoginRedirectHref(
          loginHref,
          "/account/tickets",
        );

  const profileHref =
    user
      ? "/account/profile"
      : createLoginRedirectHref(
          loginHref,
          "/account/profile",
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
  }, [
    drawerOpen,
    searchOpen,
  ]);

  useEffect(() => {
    if (
      !accountOpen
    ) {
      return;
    }

    function handlePointerDown(
      event:
        MouseEvent,
    ): void {
      const target =
        event.target as Node;

      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(
          target,
        )
      ) {
        setAccountOpen(
          false,
        );
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
  ]);

  useEffect(() => {
    if (
      !searchOpen
    ) {
      return;
    }

    const timeout =
      window.setTimeout(
        () => {
          searchInputRef.current?.focus();
        },
        80,
      );

    return () => {
      window.clearTimeout(
        timeout,
      );
    };
  }, [
    searchOpen,
  ]);

  useEffect(() => {
    if (
      !drawerOpen &&
      !searchOpen &&
      !accountOpen
    ) {
      return;
    }

    function handleKeyDown(
      event:
        KeyboardEvent,
    ): void {
      if (
        event.key !==
        "Escape"
      ) {
        return;
      }

      setDrawerOpen(
        false,
      );

      setSearchOpen(
        false,
      );

      setAccountOpen(
        false,
      );
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    drawerOpen,
    searchOpen,
    accountOpen,
  ]);

  function openDrawer(): void {
    setAccountOpen(
      false,
    );

    setSearchOpen(
      false,
    );

    setDrawerOpen(
      true,
    );
  }

  function closeDrawer(): void {
    setDrawerOpen(
      false,
    );
  }

  function openSearch(): void {
    setAccountOpen(
      false,
    );

    setDrawerOpen(
      false,
    );

    setSearchOpen(
      true,
    );
  }

  function closeSearch(): void {
    setSearchOpen(
      false,
    );
  }

  function submitSearch(): void {
    const normalizedValue =
      normalizeSearchValue(
        searchValue,
      );

    if (
      !normalizedValue
    ) {
      return;
    }

    router.push(
      `/search?q=${encodeURIComponent(
        normalizedValue,
      )}`,
    );

    closeSearch();
    closeDrawer();

    setAccountOpen(
      false,
    );
  }

  async function handleLogout(): Promise<void> {
    if (
      isLoggingOut
    ) {
      return;
    }

    setIsLoggingOut(
      true,
    );

    setAccountOpen(
      false,
    );

    closeDrawer();

    try {
      if (
        onLogout
      ) {
        await onLogout();

        window.location.assign(
          "/",
        );

        return;
      }

      const response =
        await fetch(
          "/api/client/auth/logout",
          {
            method:
              "POST",

            credentials:
              "include",

            cache:
              "no-store",

            headers: {
              Accept:
                "application/json",
            },
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () =>
              null,
          )) as
          | {
              success?: boolean;
              redirectTo?: string;
              message?: string;
            }
          | null;

      if (
        !response.ok
      ) {
        console.error(
          "[CLIENT_HEADER_LOGOUT_API_ERROR]",
          result?.message ||
            "La déconnexion du client a rencontré une erreur côté serveur.",
        );
      }

      window.location.assign(
        result?.redirectTo ||
          "/",
      );
    } catch (
      error
    ) {
      console.error(
        "[CLIENT_HEADER_LOGOUT_ERROR]",
        error,
      );

      window.location.assign(
        "/",
      );
    }
  }

  const desktopNavigationLabel =
    locale === "en"
      ? "Main navigation"
      : "Navigation principale";

  const mobileMenuLabel =
    locale === "en"
      ? "Main menu"
      : "Menu principal";

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full",
          "border-b border-white/[0.08]",
          "bg-[#020609]/94 text-white",
          "shadow-[0_14px_45px_rgba(0,0,0,0.32)]",
          "backdrop-blur-2xl",
          "supports-[backdrop-filter]:bg-[#020609]/82",
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-400/60 to-transparent"
        />

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
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-lime-400/15 bg-lime-400/[0.04]">
                  <Bell
                    className="h-3 w-3 text-lime-400/80"
                    aria-hidden="true"
                  />
                </span>

                {
                  supportPhone
                }
              </a>

              <a
                href={`mailto:${supportEmail}`}
                className="transition hover:text-white"
              >
                {
                  supportEmail
                }
              </a>

              <span className="truncate">
                {
                  locationLabel
                }
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-4 text-[11px] font-semibold text-neutral-400">
              <Link
                href="/help"
                className="transition hover:text-white"
              >
                {
                  tNavigation(
                    "help",
                  )
                }
              </Link>

              <LanguageSwitcher
                compact
              />
            </div>
          </div>
        </div>

        <div className="mx-auto hidden h-[76px] w-full max-w-[1600px] items-center gap-4 px-5 lg:flex xl:gap-6 xl:px-8">
          <Link
            href="/"
            aria-label="Tikemia"
            className="flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/60"
          >
            <Image
              src={
                logoSrc
              }
              alt="Tikemia"
              width={
                190
              }
              height={
                62
              }
              priority
              className="h-auto w-[145px] object-contain xl:w-[160px]"
            />
          </Link>

          <nav
            aria-label={
              desktopNavigationLabel
            }
            className="flex min-w-0 flex-1 items-center justify-center gap-0.5 xl:gap-1"
          >
            {DESKTOP_NAVIGATION.map(
              (
                item,
              ) => {
                const active =
                  isPathActive(
                    pathname,
                    item.href,
                  );

                return (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    aria-current={
                      active
                        ? "page"
                        : undefined
                    }
                    className={cn(
                      "relative whitespace-nowrap rounded-lg px-2.5 py-2",
                      "text-[13px] font-semibold",
                      "transition duration-200",
                      "xl:px-3 xl:text-sm",

                      active
                        ? "bg-white/[0.055] text-white"
                        : "text-neutral-400 hover:bg-white/[0.035] hover:text-white",
                    )}
                  >
                    {
                      tNavigation(
                        item.labelKey,
                      )
                    }

                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-3 -bottom-[15px] h-0.5 rounded-full bg-gradient-to-r from-lime-400 via-orange-400 to-red-500"
                      />
                    ) : null}
                  </Link>
                );
              },
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={
                openSearch
              }
              aria-label={
                tHeader(
                  "search",
                )
              }
              className={cn(
                "flex h-10 w-10 items-center justify-center",
                "rounded-xl",
                "border border-white/[0.08]",
                "bg-white/[0.025]",
                "text-neutral-300",
                "transition duration-200",
                "hover:border-lime-400/25",
                "hover:bg-lime-400/[0.06]",
                "hover:text-lime-300",
              )}
            >
              <Search
                className="h-4 w-4"
                aria-hidden="true"
              />
            </button>

            <Link
              href={
                favoritesHref
              }
              className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              <Heart
                className="h-4 w-4"
                aria-hidden="true"
              />

              <span className="hidden xl:inline">
                {
                  tNavigation(
                    "favorites",
                  )
                }
              </span>
            </Link>

            <Link
              href={
                ticketsHref
              }
              className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              <Ticket
                className="h-4 w-4"
                aria-hidden="true"
              />

              <span className="hidden xl:inline">
                {
                  tNavigation(
                    "myTickets",
                  )
                }
              </span>
            </Link>

            <div
              ref={
                accountMenuRef
              }
              className="relative"
            >
              <button
                type="button"
                onClick={() => {
                  setAccountOpen(
                    (
                      current,
                    ) =>
                      !current,
                  );

                  setSearchOpen(
                    false,
                  );

                  setDrawerOpen(
                    false,
                  );
                }}
                aria-expanded={
                  accountOpen
                }
                aria-haspopup="menu"
                aria-label={
                  user
                    ? tNavigation(
                        "myAccount",
                      )
                    : tNavigation(
                        "login",
                      )
                }
                className={cn(
                  "flex h-11 items-center gap-2",
                  "rounded-xl",
                  "border border-white/[0.08]",
                  "bg-white/[0.025]",
                  "px-2 pr-3",
                  "transition duration-200",
                  "hover:border-white/[0.14]",
                  "hover:bg-white/[0.055]",
                )}
              >
                <ClientAvatar
                  user={
                    user
                  }
                  initials={
                    initials
                  }
                  size="sm"
                />

                <div className="hidden max-w-[110px] text-left xl:block">
                  <p className="truncate text-xs font-black text-white">
                    {user
                      ? displayName
                      : tNavigation(
                          "login",
                        )}
                  </p>

                  <p className="truncate text-[10px] text-neutral-600">
                    {user
                      ? tNavigation(
                          "clientArea",
                        )
                      : tNavigation(
                          "myAccount",
                        )}
                  </p>
                </div>

                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-neutral-500 transition",
                    accountOpen &&
                      "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>

              {accountOpen ? (
                <AccountDropdown
                  user={
                    user
                  }
                  displayName={
                    displayName
                  }
                  initials={
                    initials
                  }
                  isLoggingOut={
                    isLoggingOut
                  }
                  loginHref={
                    loginHref
                  }
                  registerHref={
                    registerHref
                  }
                  onClose={() =>
                    setAccountOpen(
                      false,
                    )
                  }
                  onLogout={
                    handleLogout
                  }
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative flex h-[72px] items-center justify-between gap-3 px-3 lg:hidden sm:h-[76px] sm:px-4">
          <button
            type="button"
            onClick={
              openDrawer
            }
            aria-label={
              tHeader(
                "openMenu",
              )
            }
            aria-expanded={
              drawerOpen
            }
            className={cn(
              "group relative flex h-11 w-11 shrink-0",
              "items-center justify-center overflow-hidden",
              "rounded-[14px]",
              "border border-lime-400/20",
              "bg-gradient-to-br",
              "from-lime-400/[0.10]",
              "via-white/[0.035]",
              "to-transparent",
              "text-white",
              "transition duration-200",
              "active:scale-[0.94]",
            )}
          >
            <Menu
              className="h-[21px] w-[21px] stroke-[2.15]"
              aria-hidden="true"
            />
          </button>

          <Link
            href="/"
            aria-label="Tikemia"
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          >
            <Image
              src={
                logoSrc
              }
              alt="Tikemia"
              width={
                190
              }
              height={
                62
              }
              priority
              className="h-auto w-[132px] object-contain drop-shadow-[0_5px_16px_rgba(0,0,0,0.25)] min-[390px]:w-[140px] sm:w-[150px]"
            />
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={
                openSearch
              }
              aria-label={
                tHeader(
                  "search",
                )
              }
              aria-expanded={
                searchOpen
              }
              className={cn(
                "flex h-11 w-11 items-center justify-center",
                "rounded-[14px]",
                "border border-orange-400/20",
                "bg-gradient-to-br",
                "from-orange-400/[0.10]",
                "via-white/[0.035]",
                "to-transparent",
                "text-white",
                "transition duration-200",
                "active:scale-[0.94]",
              )}
            >
              <Search
                className="h-[20px] w-[20px] stroke-[2.15]"
                aria-hidden="true"
              />
            </button>

            <Link
              href={
                profileHref
              }
              aria-label={
                user
                  ? tNavigation(
                      "profile",
                    )
                  : tNavigation(
                      "login",
                    )
              }
              className={cn(
                "relative flex h-11 w-11",
                "items-center justify-center",
                "rounded-[14px]",
                "border border-red-400/20",
                "bg-gradient-to-br",
                "from-red-400/[0.08]",
                "via-orange-400/[0.05]",
                "to-transparent",
                "text-white",
                "transition duration-200",
                "active:scale-[0.94]",
              )}
            >
              {user ? (
                <ClientAvatar
                  user={
                    user
                  }
                  initials={
                    initials
                  }
                  size="xs"
                />
              ) : (
                <User
                  className="h-[20px] w-[20px] stroke-[2.15]"
                  aria-hidden="true"
                />
              )}

              {unreadNotificationsCount >
              0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#020609] bg-gradient-to-br from-red-500 to-orange-500 px-1 text-[9px] font-black leading-none text-white shadow-[0_4px_14px_rgba(239,68,68,0.35)]">
                  {unreadNotificationsCount >
                  99
                    ? "99+"
                    : unreadNotificationsCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </header>

      <MobileDrawer
        open={
          drawerOpen
        }
        pathname={
          pathname
        }
        user={
          user
        }
        logoSrc={
          logoSrc
        }
        initials={
          initials
        }
        displayName={
          displayName
        }
        isLoggingOut={
          isLoggingOut
        }
        loginHref={
          loginHref
        }
        registerHref={
          registerHref
        }
        menuLabel={
          mobileMenuLabel
        }
        onClose={
          closeDrawer
        }
        onLogout={
          handleLogout
        }
      />

      <SearchOverlay
        open={
          searchOpen
        }
        locale={
          locale
        }
        value={
          searchValue
        }
        inputRef={
          searchInputRef
        }
        onChange={
          setSearchValue
        }
        onClose={
          closeSearch
        }
        onSubmit={
          submitSearch
        }
      />
    </>
  );
}

function ClientAvatar({
  user,
  initials,
  size,
}: {
  user?:
    ClientHeaderUser | null;

  initials:
    string;

  size:
    "xs" | "sm" | "lg";
}) {
  const sizeClass =
    {
      xs:
        "h-8 w-8 text-[10px]",

      sm:
        "h-8 w-8 text-[10px]",

      lg:
        "h-12 w-12 text-sm",
    }[size];

  if (
    user?.avatarUrl
  ) {
    return (
      <span
        className={cn(
          "relative block shrink-0 overflow-hidden rounded-full",
          "border border-white/[0.12]",
          "bg-white/[0.04]",
          sizeClass,
        )}
      >
        <Image
          src={
            user.avatarUrl
          }
          alt={
            getDisplayName(
              user,
            )
          }
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
        "flex shrink-0 items-center justify-center rounded-full",
        "border border-lime-400/25",
        "bg-gradient-to-br",
        "from-lime-400/20",
        "via-orange-400/15",
        "to-red-500/15",
        "font-black text-white",
        sizeClass,
      )}
    >
      {
        initials
      }
    </span>
  );
}

function AccountDropdown({
  user,
  displayName,
  initials,
  isLoggingOut,
  loginHref,
  registerHref,
  onClose,
  onLogout,
}: {
  user?:
    ClientHeaderUser | null;

  displayName:
    string;

  initials:
    string;

  isLoggingOut:
    boolean;

  loginHref:
    string;

  registerHref:
    string;

  onClose:
    () => void;

  onLogout:
    () => void | Promise<void>;
}) {
  const tNavigation =
    useTranslations(
      "navigation",
    );

  const tAuth =
    useTranslations(
      "auth",
    );

  return (
    <div
      role="menu"
      className="absolute right-0 top-[calc(100%+10px)] z-50 w-[290px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#081015] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
    >
      {user ? (
        <>
          <Link
            href="/account/profile"
            onClick={
              onClose
            }
            className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-4 transition hover:bg-white/[0.025]"
          >
            <ClientAvatar
              user={
                user
              }
              initials={
                initials
              }
              size="lg"
            />

            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {
                  displayName
                }
              </p>

              <p className="mt-0.5 truncate text-xs text-neutral-500">
                {
                  user.email
                }
              </p>
            </div>
          </Link>

          <div className="p-2">
            <AccountLink
              href="/account/profile"
              icon={
                UserRound
              }
              label={
                tNavigation(
                  "profile",
                )
              }
              onClick={
                onClose
              }
            />

            <AccountLink
              href="/account/orders"
              icon={
                ShoppingBag
              }
              label={
                tNavigation(
                  "myOrders",
                )
              }
              onClick={
                onClose
              }
            />

            <AccountLink
              href="/account/refunds"
              icon={
                RotateCcw
              }
              label={
                tNavigation(
                  "refunds",
                )
              }
              onClick={
                onClose
              }
            />

            <AccountLink
              href="/account/tickets"
              icon={
                Ticket
              }
              label={
                tNavigation(
                  "myTickets",
                )
              }
              onClick={
                onClose
              }
            />

            <AccountLink
              href="/favorites"
              icon={
                Heart
              }
              label={
                tNavigation(
                  "favorites",
                )
              }
              onClick={
                onClose
              }
            />
          </div>

          <div className="border-t border-white/[0.07] p-2">
            <button
              type="button"
              onClick={() =>
                void onLogout()
              }
              disabled={
                isLoggingOut
              }
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut
                className="h-4 w-4"
                aria-hidden="true"
              />

              {isLoggingOut
                ? `${tNavigation(
                    "logout",
                  )}...`
                : tNavigation(
                    "logout",
                  )}
            </button>
          </div>
        </>
      ) : (
        <div className="p-4">
          <div className="rounded-xl border border-lime-400/20 bg-lime-400/[0.055] px-4 py-3">
            <p className="text-sm font-black text-white">
              {
                tNavigation(
                  "myTickets",
                )
              }
            </p>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {
                tNavigation(
                  "clientArea",
                )
              }
            </p>
          </div>

          <Link
            href={
              loginHref
            }
            onClick={
              onClose
            }
            className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-lime-500 via-yellow-500 to-orange-500 text-sm font-black text-white"
          >
            <LogIn
              className="h-4 w-4"
              aria-hidden="true"
            />

            {
              tAuth(
                "loginButton",
              )
            }
          </Link>

          <Link
            href={
              registerHref
            }
            onClick={
              onClose
            }
            className="mt-2 flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-sm font-bold text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            {
              tAuth(
                "register",
              )
            }
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
  onClick,
}: {
  href:
    string;

  icon:
    | typeof Ticket
    | typeof ShoppingBag
    | typeof Heart
    | typeof UserRound
    | typeof RotateCcw;

  label:
    string;

  onClick?:
    () => void;
}) {
  return (
    <Link
      href={
        href
      }
      onClick={
        onClick
      }
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.045] hover:text-white"
    >
      <Icon
        className="h-4 w-4 text-neutral-500"
        aria-hidden="true"
      />

      {
        label
      }
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
  loginHref,
  registerHref,
  menuLabel,
  onClose,
  onLogout,
}: {
  open:
    boolean;

  pathname:
    string;

  user?:
    ClientHeaderUser | null;

  logoSrc:
    string;

  initials:
    string;

  displayName:
    string;

  isLoggingOut:
    boolean;

  loginHref:
    string;

  registerHref:
    string;

  menuLabel:
    string;

  onClose:
    () => void;

  onLogout:
    () => void | Promise<void>;
}) {
  const tNavigation =
    useTranslations(
      "navigation",
    );

  const tAuth =
    useTranslations(
      "auth",
    );

  const tLanguage =
    useTranslations(
      "language",
    );

  const tCommon =
    useTranslations(
      "common",
    );

  const navigationItems =
    user
      ? [
          ...DESKTOP_NAVIGATION,
          ...AUTHENTICATED_MOBILE_NAVIGATION,
        ]
      : DESKTOP_NAVIGATION;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[80] lg:hidden",

        open
          ? "pointer-events-auto"
          : "pointer-events-none",
      )}
      aria-hidden={
        !open
      }
    >
      <button
        type="button"
        onClick={
          onClose
        }
        aria-label={
          tCommon(
            "close",
          )
        }
        tabIndex={
          open
            ? 0
            : -1
        }
        className={cn(
          "absolute inset-0",
          "bg-black/80 backdrop-blur-sm",
          "transition-opacity duration-300",

          open
            ? "opacity-100"
            : "opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={
          menuLabel
        }
        className={cn(
          "absolute inset-y-0 left-0",
          "flex w-[min(88vw,360px)] flex-col",
          "border-r border-white/[0.09]",
          "bg-[#050c10]",
          "shadow-[24px_0_90px_rgba(0,0,0,0.62)]",
          "transition-transform duration-300 ease-out",

          open
            ? "translate-x-0"
            : "-translate-x-full",
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-lime-400/50 via-orange-400/20 to-transparent"
        />

        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
          <Link
            href="/"
            onClick={
              onClose
            }
          >
            <Image
              src={
                logoSrc
              }
              alt="Tikemia"
              width={
                165
              }
              height={
                54
              }
              className="h-auto w-[145px] object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={
              onClose
            }
            aria-label={
              tCommon(
                "close",
              )
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-300 transition hover:bg-white/[0.06]"
          >
            <X
              className="h-5 w-5"
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="border-b border-white/[0.07] px-4 py-4">
          {user ? (
            <Link
              href="/account/profile"
              onClick={
                onClose
              }
              className="flex items-center gap-3 rounded-2xl border border-lime-400/18 bg-lime-400/[0.05] p-3.5"
            >
              <ClientAvatar
                user={
                  user
                }
                initials={
                  initials
                }
                size="lg"
              />

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">
                  {
                    displayName
                  }
                </p>

                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {
                    user.email
                  }
                </p>
              </div>
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={
                  loginHref
                }
                onClick={
                  onClose
                }
                className="flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-lime-500 via-yellow-500 to-orange-500 text-sm font-black text-white"
              >
                {
                  tAuth(
                    "login",
                  )
                }
              </Link>

              <Link
                href={
                  registerHref
                }
                onClick={
                  onClose
                }
                className="flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-sm font-bold text-neutral-300"
              >
                {
                  tAuth(
                    "register",
                  )
                }
              </Link>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <span className="text-xs font-bold text-neutral-500">
            {
              tLanguage(
                "label",
              )
            }
          </span>

          <LanguageSwitcher
            compact
          />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
            Navigation
          </p>

          <div className="space-y-1">
            {navigationItems.map(
              (
                item,
              ) => {
                const active =
                  isPathActive(
                    pathname,
                    item.href,
                  );

                const Icon =
                  item.icon;

                return (
                  <Link
                    key={`${item.labelKey}-${item.href}`}
                    href={
                      item.href
                    }
                    onClick={
                      onClose
                    }
                    aria-current={
                      active
                        ? "page"
                        : undefined
                    }
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-3",
                      "text-sm font-semibold transition duration-200",

                      active
                        ? "border-lime-400/20 bg-lime-400/[0.07] text-lime-300"
                        : "border-transparent text-neutral-300 hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-xl",

                        active
                          ? "bg-lime-400/[0.10]"
                          : "bg-white/[0.025]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px]",

                          active
                            ? "text-lime-400"
                            : "text-neutral-500",
                        )}
                        aria-hidden="true"
                      />
                    </span>

                    {
                      tNavigation(
                        item.labelKey,
                      )
                    }
                  </Link>
                );
              },
            )}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/[0.07] p-4">
          {user ? (
            <button
              type="button"
              onClick={() =>
                void onLogout()
              }
              disabled={
                isLoggingOut
              }
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] text-sm font-bold text-red-400 transition hover:bg-red-500/[0.12] disabled:opacity-50"
            >
              <LogOut
                className="h-4 w-4"
                aria-hidden="true"
              />

              {isLoggingOut
                ? `${tNavigation(
                    "logout",
                  )}...`
                : tNavigation(
                    "logout",
                  )}
            </button>
          ) : (
            <p className="text-center text-[11px] leading-5 text-neutral-600">
              {
                tAuth(
                  "noAccount",
                )
              }
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function SearchOverlay({
  open,
  locale,
  value,
  inputRef,
  onChange,
  onClose,
  onSubmit,
}: {
  open:
    boolean;

  locale:
    string;

  value:
    string;

  inputRef:
    React.RefObject<
      HTMLInputElement | null
    >;

  onChange:
    (
      value:
        string,
    ) => void;

  onClose:
    () => void;

  onSubmit:
    () => void;
}) {
  const tHeader =
    useTranslations(
      "header",
    );

  const tHome =
    useTranslations(
      "home",
    );

  const tCommon =
    useTranslations(
      "common",
    );

  const suggestions =
    locale === "en"
      ? SEARCH_SUGGESTIONS.en
      : SEARCH_SUGGESTIONS.fr;

  const popularSearchesLabel =
    locale === "en"
      ? "Popular searches"
      : "Recherches populaires";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] transition",

        open
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0",
      )}
      aria-hidden={
        !open
      }
    >
      <button
        type="button"
        onClick={
          onClose
        }
        aria-label={
          tCommon(
            "close",
          )
        }
        tabIndex={
          open
            ? 0
            : -1
        }
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={
          tHeader(
            "search",
          )
        }
        className={cn(
          "relative mx-auto mt-3",
          "w-[calc(100%-24px)] max-w-3xl",
          "overflow-hidden rounded-2xl",
          "border border-white/[0.10]",
          "bg-[#050c10]",
          "shadow-[0_30px_100px_rgba(0,0,0,0.70)]",
          "transition-all duration-300",
          "sm:mt-8 sm:w-[calc(100%-40px)]",

          open
            ? "translate-y-0 scale-100"
            : "-translate-y-3 scale-[0.98]",
        )}
      >
        <div
          aria-hidden="true"
          className="h-px w-full bg-gradient-to-r from-lime-400 via-orange-400 to-red-500"
        />

        <form
          role="search"
          onSubmit={(
            event,
          ) => {
            event.preventDefault();

            onSubmit();
          }}
          className="flex items-center gap-2 p-3 sm:p-4"
        >
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-lime-400/70"
              aria-hidden="true"
            />

            <input
              ref={
                inputRef
              }
              value={
                value
              }
              onChange={(
                event,
              ) =>
                onChange(
                  event.target.value,
                )
              }
              type="search"
              name="q"
              maxLength={
                120
              }
              autoComplete="off"
              placeholder={
                tHome(
                  "searchPlaceholder",
                )
              }
              className="h-12 w-full rounded-xl border border-white/[0.09] bg-white/[0.04] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-lime-400/35 focus:ring-2 focus:ring-lime-400/10 sm:h-14 sm:text-base"
            />
          </div>

          <button
            type="submit"
            disabled={
              !normalizeSearchValue(
                value,
              )
            }
            className="hidden h-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-lime-500 via-yellow-500 to-orange-500 px-5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 sm:flex sm:h-14"
          >
            {
              tCommon(
                "search",
              )
            }
          </button>

          <button
            type="button"
            onClick={
              onClose
            }
            aria-label={
              tCommon(
                "close",
              )
            }
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-neutral-300 transition hover:bg-white/[0.055] sm:h-14 sm:w-14"
          >
            <X
              className="h-5 w-5"
              aria-hidden="true"
            />
          </button>
        </form>

        <div className="border-t border-white/[0.07] px-4 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
            {
              popularSearchesLabel
            }
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map(
              (
                suggestion,
              ) => (
                <button
                  key={
                    suggestion
                  }
                  type="button"
                  onClick={() =>
                    onChange(
                      suggestion,
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5",
                    "text-xs font-semibold",
                    "transition duration-200",

                    value ===
                    suggestion
                      ? "border-lime-400/30 bg-lime-400/[0.09] text-lime-300"
                      : "border-white/[0.08] bg-white/[0.025] text-neutral-400 hover:border-orange-400/25 hover:bg-orange-400/[0.06] hover:text-orange-300",
                  )}
                >
                  {
                    suggestion
                  }
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}