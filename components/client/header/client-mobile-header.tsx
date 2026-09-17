"use client";

import Image from "next/image";
import Link from "next/link";

import {
  Menu,
  Search,
  User,
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
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
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

  return (
    fullName ||
    user?.email?.trim() ||
    "Tikemia"
  );
}

function getUserInitials(
  user?: ClientMobileHeaderUser | null,
): string {
  const firstName =
    user?.firstName?.trim() ?? "";

  const lastName =
    user?.lastName?.trim() ?? "";

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`
      .trim()
      .toUpperCase();

  return (
    initials ||
    user?.email
      ?.trim()
      .charAt(0)
      .toUpperCase() ||
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
  const pathname =
    usePathname();

  const router =
    useRouter();

  const locale =
    useLocale();

  const tCommon =
    useTranslations(
      "common",
    );

  const tHeader =
    useTranslations(
      "header",
    );

  const tNavigation =
    useTranslations(
      "navigation",
    );

  const tAuth =
    useTranslations(
      "auth",
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

  const searchInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const initials =
    useMemo(
      () =>
        getUserInitials(
          user,
        ),
      [user],
    );

  const unreadNotificationsCount =
    Math.max(
      user?.unreadNotificationsCount ??
        0,
      0,
    );

  const suggestions =
    locale === "en"
      ? SEARCH_SUGGESTIONS.en
      : SEARCH_SUGGESTIONS.fr;

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
    if (!searchOpen) {
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
  }, [searchOpen]);

  useEffect(() => {
    if (
      !drawerOpen &&
      !searchOpen
    ) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
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
  ]);

  function closeDrawer(): void {
    setDrawerOpen(
      false,
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

    try {
      if (onLogout) {
        await onLogout();
      } else {
        const response =
          await fetch(
            "/api/customer/auth/logout",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },
            },
          );

        if (
          !response.ok
        ) {
          throw new Error(
            "La déconnexion du client a échoué.",
          );
        }
      }

      closeDrawer();

      router.push(
        "/",
      );

      router.refresh();
    } catch (
      error
    ) {
      console.error(
        "[CLIENT_MOBILE_HEADER_LOGOUT_ERROR]",
        error instanceof Error
          ? {
              name:
                error.name,

              message:
                error.message,
            }
          : error,
      );
    } finally {
      setIsLoggingOut(
        false,
      );
    }
  }

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full lg:hidden",
          "border-b border-white/[0.08]",
          "bg-[#020609]/95 text-white",
          "shadow-[0_16px_46px_rgba(0,0,0,0.42)]",
          "backdrop-blur-2xl",
          "supports-[backdrop-filter]:bg-[#020609]/86",
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-400/70 to-transparent"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-r from-lime-500/[0.025] via-transparent to-orange-500/[0.025]"
        />

        <div className="relative flex h-[72px] w-full items-center justify-between gap-3 px-3 sm:h-[76px] sm:px-4">
          <button
            type="button"
            onClick={() =>
              setDrawerOpen(
                true,
              )
            }
            aria-label={
              tHeader(
                "openMenu",
              )
            }
            aria-expanded={
              drawerOpen
            }
            aria-controls="client-mobile-drawer"
            className={cn(
              "group relative flex h-11 w-11 shrink-0",
              "items-center justify-center overflow-hidden rounded-[14px]",
              "border border-lime-400/20",
              "bg-gradient-to-br from-lime-400/[0.10] via-white/[0.035] to-transparent",
              "text-white",
              "shadow-[0_8px_25px_rgba(163,230,53,0.06)]",
              "transition duration-200",
              "hover:border-lime-400/35",
              "hover:bg-lime-400/[0.10]",
              "active:scale-[0.94]",
              "focus-visible:outline-none",
              "focus-visible:ring-2",
              "focus-visible:ring-lime-400/60",
            )}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-lime-400/[0.08] to-transparent opacity-0 transition group-hover:opacity-100"
            />

            <Menu
              className="relative h-[21px] w-[21px] stroke-[2.15] transition-transform duration-200 group-active:scale-90"
              aria-hidden="true"
            />
          </button>

          <Link
            href="/"
            aria-label="Tikemia"
            className={cn(
              "absolute left-1/2 top-1/2",
              "flex -translate-x-1/2 -translate-y-1/2",
              "items-center justify-center",
              "rounded-xl",
              "focus-visible:outline-none",
              "focus-visible:ring-2",
              "focus-visible:ring-lime-400/60",
            )}
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
              onClick={() =>
                setSearchOpen(
                  true,
                )
              }
              aria-label={
                tHeader(
                  "search",
                )
              }
              aria-expanded={
                searchOpen
              }
              aria-controls="client-mobile-search"
              className={cn(
                "group relative flex h-11 w-11",
                "items-center justify-center overflow-hidden rounded-[14px]",
                "border border-orange-400/20",
                "bg-gradient-to-br from-orange-400/[0.10] via-white/[0.035] to-transparent",
                "text-white",
                "shadow-[0_8px_25px_rgba(249,115,22,0.06)]",
                "transition duration-200",
                "hover:border-orange-400/35",
                "hover:bg-orange-400/[0.10]",
                "active:scale-[0.94]",
                "focus-visible:outline-none",
                "focus-visible:ring-2",
                "focus-visible:ring-orange-400/60",
              )}
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-orange-400/[0.08] to-transparent opacity-0 transition group-hover:opacity-100"
              />

              <Search
                className="relative h-[20px] w-[20px] stroke-[2.15]"
                aria-hidden="true"
              />
            </button>

            <Link
              href={
                user
                  ? "/account/profile"
                  : loginHref
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
                "group relative flex h-11 w-11",
                "items-center justify-center overflow-visible rounded-[14px]",
                "border border-red-400/20",
                "bg-gradient-to-br from-red-400/[0.08] via-orange-400/[0.05] to-transparent",
                "text-white",
                "shadow-[0_8px_25px_rgba(239,68,68,0.05)]",
                "transition duration-200",
                "hover:border-red-400/35",
                "hover:bg-red-400/[0.08]",
                "active:scale-[0.94]",
                "focus-visible:outline-none",
                "focus-visible:ring-2",
                "focus-visible:ring-red-400/50",
              )}
            >
              {user ? (
                <ClientMobileAvatar
                  user={
                    user
                  }
                  initials={
                    initials
                  }
                />
              ) : (
                <User
                  className="h-[20px] w-[20px] stroke-[2.15]"
                  aria-hidden="true"
                />
              )}

              {unreadNotificationsCount >
                0 && (
                <span
                  className={cn(
                    "absolute -right-1.5 -top-1.5",
                    "flex h-5 min-w-5 items-center justify-center",
                    "rounded-full border-2 border-[#020609]",
                    "bg-gradient-to-br from-red-500 to-orange-500",
                    "px-1 text-[9px] font-black leading-none text-white",
                    "shadow-[0_4px_14px_rgba(239,68,68,0.35)]",
                  )}
                >
                  {unreadNotificationsCount >
                  99
                    ? "99+"
                    : unreadNotificationsCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <div
        id="client-mobile-drawer"
      >
        <ClientMobileDrawer
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
          loginHref={
            loginHref
          }
          registerHref={
            registerHref
          }
          isLoggingOut={
            isLoggingOut
          }
          onClose={
            closeDrawer
          }
          onLogout={
            handleLogout
          }
        />
      </div>

      <MobileSearchDialog
        open={
          searchOpen
        }
        value={
          searchValue
        }
        suggestions={
          suggestions
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
        searchLabel={
          tCommon(
            "search",
          )
        }
        cancelLabel={
          tCommon(
            "cancel",
          )
        }
        closeLabel={
          tCommon(
            "close",
          )
        }
        locale={
          locale
        }
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
  if (
    user?.avatarUrl
  ) {
    return (
      <span
        className={cn(
          "relative block h-8 w-8 shrink-0 overflow-hidden rounded-[11px]",
          "border border-white/[0.14]",
          "bg-white/[0.04]",
          "shadow-[0_4px_12px_rgba(0,0,0,0.25)]",
        )}
      >
        <Image
          src={
            user.avatarUrl
          }
          alt={
            getUserDisplayName(
              user,
            )
          }
          fill
          sizes="32px"
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center",
        "rounded-[11px]",
        "border border-lime-400/25",
        "bg-gradient-to-br from-lime-400/20 via-orange-400/15 to-red-500/15",
        "text-[10px] font-black text-white",
        "shadow-[0_4px_14px_rgba(163,230,53,0.08)]",
      )}
    >
      {initials}
    </span>
  );
}

function MobileSearchDialog({
  open,
  value,
  suggestions,
  inputRef,
  onChange,
  onClose,
  onSubmit,
  searchLabel,
  cancelLabel,
  closeLabel,
  locale,
}: {
  open: boolean;
  value: string;
  suggestions:
    | typeof SEARCH_SUGGESTIONS.fr
    | typeof SEARCH_SUGGESTIONS.en;
  inputRef: React.RefObject<
    HTMLInputElement | null
  >;
  onChange: (
    value: string,
  ) => void;
  onClose: () => void;
  onSubmit: () => void;
  searchLabel: string;
  cancelLabel: string;
  closeLabel: string;
  locale: string;
}) {
  const normalizedValue =
    normalizeSearchValue(
      value,
    );

  const popularSearchesLabel =
    locale === "en"
      ? "Popular searches"
      : "Recherches populaires";

  const placeholder =
    locale === "en"
      ? "Artist, concert, festival, city..."
      : "Artiste, concert, festival, ville...";

  return (
    <div
      id="client-mobile-search"
      className={cn(
        "fixed inset-0 z-[90] lg:hidden",
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
          closeLabel
        }
        tabIndex={
          open
            ? 0
            : -1
        }
        className={cn(
          "absolute inset-0",
          "bg-black/85 backdrop-blur-md",
          "transition-opacity duration-300",
          open
            ? "opacity-100"
            : "opacity-0",
        )}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={
          searchLabel
        }
        className={cn(
          "relative w-full",
          "border-b border-white/[0.09]",
          "bg-[#050c10]",
          "px-3 pb-6",
          "pt-[max(14px,env(safe-area-inset-top))]",
          "shadow-[0_30px_100px_rgba(0,0,0,0.72)]",
          "transition-transform duration-300 ease-out",
          "sm:px-4",
          open
            ? "translate-y-0"
            : "-translate-y-full",
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-lime-400 via-orange-400 to-red-500"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-24 w-[70%] -translate-x-1/2 bg-lime-400/[0.025] blur-3xl"
        />

        <form
          role="search"
          onSubmit={(
            event,
          ) => {
            event.preventDefault();

            onSubmit();
          }}
          className="relative flex items-center gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-lime-400/75"
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
                  event.target
                    .value,
                )
              }
              type="search"
              name="q"
              maxLength={
                120
              }
              autoComplete="off"
              placeholder={
                placeholder
              }
              aria-label={
                searchLabel
              }
              tabIndex={
                open
                  ? 0
                  : -1
              }
              className={cn(
                "h-[52px] w-full rounded-[15px]",
                "border border-white/[0.10]",
                "bg-white/[0.045]",
                "py-3 pl-12 pr-4",
                "text-sm font-medium text-white",
                "outline-none",
                "transition duration-200",
                "placeholder:text-neutral-600",
                "hover:border-white/[0.15]",
                "focus:border-lime-400/40",
                "focus:bg-white/[0.055]",
                "focus:ring-4",
                "focus:ring-lime-400/[0.06]",
              )}
            />
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            tabIndex={
              open
                ? 0
                : -1
            }
            className={cn(
              "flex h-[52px] shrink-0 items-center justify-center",
              "rounded-[15px] px-3",
              "border border-white/[0.08]",
              "bg-white/[0.025]",
              "text-xs font-bold text-neutral-300",
              "transition",
              "hover:bg-white/[0.06]",
              "hover:text-white",
              "active:scale-95",
            )}
          >
            {cancelLabel}
          </button>
        </form>

        <div className="relative mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-600">
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
                  tabIndex={
                    open
                      ? 0
                      : -1
                  }
                  className={cn(
                    "rounded-full border px-3.5 py-2",
                    "text-xs font-semibold",
                    "transition duration-200",
                    "active:scale-95",
                    value ===
                      suggestion
                      ? [
                          "border-lime-400/30",
                          "bg-lime-400/[0.10]",
                          "text-lime-300",
                          "shadow-[0_4px_16px_rgba(163,230,53,0.06)]",
                        ].join(
                          " ",
                        )
                      : [
                          "border-white/[0.08]",
                          "bg-white/[0.025]",
                          "text-neutral-400",
                          "hover:border-orange-400/25",
                          "hover:bg-orange-400/[0.06]",
                          "hover:text-orange-300",
                        ].join(
                          " ",
                        ),
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

        <button
          type="button"
          onClick={
            onSubmit
          }
          disabled={
            !normalizedValue
          }
          tabIndex={
            open
              ? 0
              : -1
          }
          className={cn(
            "relative mt-5 flex h-[52px] w-full",
            "items-center justify-center gap-2 overflow-hidden",
            "rounded-[15px]",
            "bg-gradient-to-r from-[#8fd400] via-[#e1c800] to-[#ff4b2b]",
            "text-sm font-black text-white",
            "shadow-[0_12px_30px_rgba(255,92,31,0.12)]",
            "transition duration-200",
            "hover:brightness-110",
            "active:scale-[0.985]",
            "disabled:cursor-not-allowed",
            "disabled:opacity-40",
          )}
        >
          <Search
            className="h-4 w-4"
            aria-hidden="true"
          />

          {
            searchLabel
          }
        </button>

        <button
          type="button"
          onClick={
            onClose
          }
          aria-label={
            closeLabel
          }
          tabIndex={
            open
              ? 0
              : -1
          }
          className="absolute right-3 top-[max(14px,env(safe-area-inset-top))] hidden h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-neutral-300 transition hover:bg-white/[0.06] sm:flex"
        >
          <X
            className="h-5 w-5"
            aria-hidden="true"
          />
        </button>
      </section>
    </div>
  );
}