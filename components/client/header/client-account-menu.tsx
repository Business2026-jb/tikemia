"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  Heart,
  LogIn,
  LogOut,
  RotateCcw,
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
  useRouter,
} from "next/navigation";

export type ClientAccountMenuUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export type ClientAccountMenuProps = {
  user?: ClientAccountMenuUser | null;

  loginHref?: string;
  registerHref?: string;

  ticketsHref?: string;
  ordersHref?: string;
  refundsHref?: string;
  favoritesHref?: string;
  profileHref?: string;
  settingsHref?: string;

  compact?: boolean;

  onLogout?: () => void | Promise<void>;
};

type AccountNavigationItem = {
  label: string;
  href: string;
  icon:
    | typeof Ticket
    | typeof ShoppingBag
    | typeof RotateCcw
    | typeof Heart
    | typeof UserRound
    | typeof Settings;
};

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function getDisplayName(
  user?: ClientAccountMenuUser | null,
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
  user?: ClientAccountMenuUser | null,
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

export default function ClientAccountMenu({
  user = null,

  loginHref = "/login",
  registerHref = "/register",

  ticketsHref = "/account/tickets",
  ordersHref = "/account/orders",
  refundsHref = "/account/refunds",
  favoritesHref = "/favorites",
  profileHref = "/account/profile",
  settingsHref = "/account/settings",

  compact = false,

  onLogout,
}: ClientAccountMenuProps) {
  const router = useRouter();

  const detailsRef =
    useRef<HTMLDetailsElement | null>(
      null,
    );

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] =
    useState(false);

  const displayName =
    useMemo(
      () =>
        getDisplayName(
          user,
        ),
      [user],
    );

  const initials =
    useMemo(
      () =>
        getInitials(
          user,
        ),
      [user],
    );

  const navigationItems =
    useMemo<
      AccountNavigationItem[]
    >(
      () => [
        {
          label:
            "Mes billets",
          href:
            ticketsHref,
          icon:
            Ticket,
        },
        {
          label:
            "Mes commandes",
          href:
            ordersHref,
          icon:
            ShoppingBag,
        },
        {
          label:
            "Remboursements",
          href:
            refundsHref,
          icon:
            RotateCcw,
        },
        {
          label:
            "Mes favoris",
          href:
            favoritesHref,
          icon:
            Heart,
        },
        {
          label:
            "Mon profil",
          href:
            profileHref,
          icon:
            UserRound,
        },
        {
          label:
            "Paramètres",
          href:
            settingsHref,
          icon:
            Settings,
        },
      ],
      [
        ticketsHref,
        ordersHref,
        refundsHref,
        favoritesHref,
        profileHref,
        settingsHref,
      ],
    );

  function closeMenu(): void {
    if (
      detailsRef.current
    ) {
      detailsRef.current.open =
        false;
    }
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
      if (
        onLogout
      ) {
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

      closeMenu();

      router.push(
        "/",
      );

      router.refresh();
    } catch (error) {
      console.error(
        "[CLIENT_ACCOUNT_MENU_LOGOUT_ERROR]",
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
    <details
      ref={
        detailsRef
      }
      className="group relative"
    >
      <summary
        aria-label={
          user
            ? "Ouvrir le menu du compte"
            : "Ouvrir le menu de connexion"
        }
        className={cn(
          "flex cursor-pointer list-none items-center rounded-xl border border-white/[0.08] bg-white/[0.025] transition hover:border-white/[0.14] hover:bg-white/[0.055] [&::-webkit-details-marker]:hidden",
          compact
            ? "h-10 gap-1.5 px-2"
            : "h-11 gap-2 px-2 pr-3",
        )}
      >
        <ClientAccountAvatar
          user={
            user
          }
          initials={
            initials
          }
          large={
            false
          }
        />

        {!compact && (
          <div className="hidden max-w-[120px] min-w-0 text-left xl:block">
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
        )}

        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500 transition group-open:rotate-180" />
      </summary>

      <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[300px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#081015] shadow-[0_26px_80px_rgba(0,0,0,0.58)]">
        {user ? (
          <>
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-4">
              <ClientAccountAvatar
                user={
                  user
                }
                initials={
                  initials
                }
                large
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
            </div>

            <nav
              aria-label="Navigation du compte client"
              className="p-2"
            >
              {navigationItems.map(
                (
                  item,
                ) => {
                  const Icon =
                    item.icon;

                  return (
                    <Link
                      key={
                        item.href
                      }
                      href={
                        item.href
                      }
                      onClick={
                        closeMenu
                      }
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.045] hover:text-white"
                    >
                      <Icon className="h-4 w-4 text-neutral-500" />

                      {
                        item.label
                      }
                    </Link>
                  );
                },
              )}
            </nav>

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
                Connectez-vous pour consulter vos commandes, billets et favoris.
              </p>
            </div>

            <Link
              href={
                loginHref
              }
              onClick={
                closeMenu
              }
              className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 text-sm font-black text-white transition hover:brightness-110 active:scale-[0.99]"
            >
              <LogIn className="h-4 w-4" />

              Se connecter
            </Link>

            <Link
              href={
                registerHref
              }
              onClick={
                closeMenu
              }
              className="mt-2 flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-sm font-bold text-neutral-300 transition hover:bg-white/[0.05] hover:text-white active:scale-[0.99]"
            >
              Créer un compte
            </Link>

            <p className="mt-3 text-center text-[10px] leading-4 text-neutral-600">
              Vous pouvez acheter vos billets sans créer de compte.
            </p>
          </div>
        )}
      </div>
    </details>
  );
}

function ClientAccountAvatar({
  user,
  initials,
  large,
}: {
  user?: ClientAccountMenuUser | null;
  initials: string;
  large: boolean;
}) {
  const sizeClass =
    large
      ? "h-12 w-12 text-sm"
      : "h-8 w-8 text-[10px]";

  if (
    user?.avatarUrl
  ) {
    return (
      <span
        className={cn(
          "relative block shrink-0 overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.04]",
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
      {
        initials
      }
    </span>
  );
}