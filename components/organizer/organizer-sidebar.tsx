"use client";

import Image from "next/image";
import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  BadgePercent,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Headphones,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Megaphone,
  Plus,
  Settings,
  ShoppingBag,
  Sparkles,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useState } from "react";

type OrganizerSidebarProps = {
  organizerName?: string;
  organizerEmail?: string;
  organizerAvatarUrl?: string | null;
};

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  exact?: boolean;
};

const NAVIGATION: NavigationItem[] = [
  {
    name: "Tableau de bord",
    href: "/organizer/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "Événements",
    href: "/organizer/events",
    icon: CalendarDays,
  },
  {
    name: "Créer un événement",
    href: "/organizer/events/create",
    icon: Plus,
    exact: true,
  },
  {
    name: "Commandes",
    href: "/organizer/orders",
    icon: ShoppingBag,
  },
  {
    name: "Participants",
    href: "/organizer/participants",
    icon: UsersRound,
  },
  {
    name: "Statistiques",
    href: "/organizer/statistics",
    icon: BarChart3,
  },
  {
    name: "Paiements",
    href: "/organizer/payments",
    icon: CircleDollarSign,
  },
  {
    name: "Retraits",
    href: "/organizer/payments?payout=request",
    icon: WalletCards,
  },
  {
    name: "Marketing",
    href: "/organizer/marketing",
    icon: Megaphone,
  },
  {
    name: "Codes promo",
    href: "/organizer/coupons",
    icon: BadgePercent,
  },
  {
    name: "Visibilité Premium",
    href: "/organizer/promotions",
    icon: Sparkles,
  },
  {
    name: "Paramètres",
    href: "/organizer/settings",
    icon: Settings,
  },
];

const DEFAULT_ORGANIZER_NAME =
  "Organisateur Tikemia";

const DEFAULT_ORGANIZER_EMAIL =
  "contact@tikemia.com";

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeAvatarUrl(
  value: string | null | undefined,
): string | null {
  const normalizedValue =
    value?.trim() ?? "";

  if (!normalizedValue) {
    return null;
  }

  if (
    normalizedValue.startsWith("/") ||
    normalizedValue.startsWith("https://") ||
    normalizedValue.startsWith("http://")
  ) {
    return normalizedValue;
  }

  return null;
}

function getInitials(
  name: string,
): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "OR";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0].charAt(0)}${words[
    words.length - 1
  ].charAt(0)}`.toUpperCase();
}

function isNavigationItemActive({
  pathname,
  item,
}: {
  pathname: string;
  item: NavigationItem;
}): boolean {
  if (item.exact) {
    return pathname === item.href;
  }

  /*
   * La route de création possède son propre bouton.
   * Elle ne doit donc pas activer également « Événements ».
   */
  if (
    item.href === "/organizer/events" &&
    pathname === "/organizer/events/create"
  ) {
    return false;
  }

  return (
    pathname === item.href ||
    pathname.startsWith(
      `${item.href}/`,
    )
  );
}

export default function OrganizerSidebar({
  organizerName = DEFAULT_ORGANIZER_NAME,
  organizerEmail = DEFAULT_ORGANIZER_EMAIL,
  organizerAvatarUrl = null,
}: OrganizerSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false);

  const displayName =
    normalizeText(
      organizerName,
    ) ||
    DEFAULT_ORGANIZER_NAME;

  const email =
    normalizeText(
      organizerEmail,
    ) ||
    DEFAULT_ORGANIZER_EMAIL;

  const avatarUrl =
    normalizeAvatarUrl(
      organizerAvatarUrl,
    );

  const initials =
    getInitials(
      displayName,
    );

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      const response =
        await fetch(
          "/api/organizer/auth/logout",
          {
            method: "POST",
            headers: {
              Accept:
                "application/json",
            },
            cache: "no-store",
          },
        );

      if (!response.ok) {
        let message =
          "Impossible de vous déconnecter.";

        try {
          const result =
            (await response.json()) as {
              message?: string;
            };

          if (
            result.message?.trim()
          ) {
            message =
              result.message;
          }
        } catch {
          // Réponse non JSON.
        }

        throw new Error(
          message,
        );
      }

      router.replace(
        "/organizer/login",
      );

      router.refresh();
    } catch (error) {
      console.error(
        "[ORGANIZER_SIDEBAR_LOGOUT_ERROR]",
        error instanceof Error
          ? {
              name: error.name,
              message:
                error.message,
            }
          : error,
      );

      setIsLoggingOut(false);
    }
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-white/[0.07] bg-[#03080c] lg:flex lg:flex-col">
      {/* Logo Tikemia */}
      <div className="flex h-[92px] shrink-0 items-center border-b border-white/[0.07] px-5">
        <Link
          href="/organizer/dashboard"
          aria-label="Tableau de bord Tikemia"
          className="flex items-center"
        >
          <Image
            src="/logo.png"
            alt="Tikemia"
            width={220}
            height={70}
            priority
            className="h-auto w-[175px] object-contain"
          />
        </Link>
      </div>

      {/* Profil de l’organisateur */}
      <div className="shrink-0 px-3 pt-4">
        <Link
          href="/organizer/profile"
          aria-label="Ouvrir mon profil organisateur"
          className={`group block rounded-2xl border p-3.5 transition ${
            pathname ===
            "/organizer/profile"
              ? "border-emerald-500/30 bg-emerald-500/[0.08]"
              : "border-white/[0.08] bg-white/[0.035] hover:border-emerald-500/25 hover:bg-emerald-500/[0.055]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-500/30 bg-emerald-500/10">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={`Photo de profil de ${displayName}`}
                  fill
                  sizes="44px"
                  priority
                  className="object-cover"
                />
              ) : (
                <span className="text-sm font-black text-lime-400">
                  {initials}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {displayName}
              </p>

              <p
                title={email}
                className="mt-0.5 truncate text-[11px] text-neutral-500"
              >
                Organisateur
              </p>
            </div>

            <ChevronRight
              className={`h-4 w-4 shrink-0 transition ${
                pathname ===
                "/organizer/profile"
                  ? "text-lime-400"
                  : "text-neutral-600 group-hover:translate-x-0.5 group-hover:text-lime-400"
              }`}
            />
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Navigation organisateur"
        className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-5 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]"
      >
        <div className="space-y-1">
          {NAVIGATION.map(
            (item) => {
              const Icon =
                item.icon;

              const active =
                isNavigationItemActive(
                  {
                    pathname,
                    item,
                  },
                );

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
                  className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-emerald-500/[0.18] via-lime-500/10 to-transparent text-white"
                      : "text-neutral-400 hover:bg-white/[0.045] hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-gradient-to-b from-emerald-400 via-lime-400 to-orange-500" />
                  )}

                  <Icon
                    className={`h-[19px] w-[19px] shrink-0 transition ${
                      active
                        ? "text-lime-400"
                        : "text-neutral-500 group-hover:text-neutral-200"
                    }`}
                  />

                  <span className="min-w-0 truncate">
                    {item.name}
                  </span>
                </Link>
              );
            },
          )}
        </div>
      </nav>

      {/* Support et déconnexion */}
      <div className="shrink-0 border-t border-white/[0.07] bg-[#03080c] p-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#071014] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <Headphones className="h-5 w-5 text-lime-400" />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-bold text-white">
                Besoin d’aide ?
              </p>

              <p className="mt-0.5 truncate text-xs text-neutral-500">
                Support organisateur
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 text-xs text-neutral-400">
            <a
              href="mailto:contact@tikemia.com"
              className="block truncate transition hover:text-lime-400"
            >
              contact@tikemia.com
            </a>

            <a
              href="tel:+2290169567744"
              className="block transition hover:text-lime-400"
            >
              +229 01 69 56 77 44
            </a>
          </div>

          <Link
            href="/organizer/support"
            className="mt-4 flex h-10 w-full items-center justify-center rounded-xl border border-emerald-500/50 bg-emerald-500/[0.04] px-3 text-xs font-bold text-white transition hover:bg-emerald-500/10"
          >
            Contacter le support
          </Link>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleLogout();
          }}
          disabled={
            isLoggingOut
          }
          className="mt-3 flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-neutral-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoggingOut ? (
            <LoaderCircle className="h-[19px] w-[19px] animate-spin" />
          ) : (
            <LogOut className="h-[19px] w-[19px]" />
          )}

          <span>
            {isLoggingOut
              ? "Déconnexion..."
              : "Déconnexion"}
          </span>
        </button>
      </div>
    </aside>
  );
}