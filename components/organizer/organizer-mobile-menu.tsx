"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Headphones,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Plus,
  Settings,
  ShoppingBag,
  Sparkles,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect } from "react";

type OrganizerMobileMenuProps = {
  open: boolean;
  onClose: () => void;
  organizerName?: string;
  organizerEmail?: string;
  organizerAvatarUrl?: string | null;
  onLogout?: () => void;
};

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  exact?: boolean;
};

const navigation: NavigationItem[] = [
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
    href: "/organizer/payouts",
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase(),
    )
    .join("");
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

export default function OrganizerMobileMenu({
  open,
  onClose,
  organizerName = "Organisateur Tikemia",
  organizerEmail = "contact@tikemia.com",
  organizerAvatarUrl = null,
  onLogout,
}: OrganizerMobileMenuProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [open, onClose]);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Fermer le menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <aside className="absolute inset-y-0 right-0 flex w-[min(88vw,360px)] flex-col border-l border-white/[0.08] bg-[#03080c] shadow-[-24px_0_70px_rgba(0,0,0,0.6)]">
        <div className="flex h-[72px] items-center justify-between border-b border-white/[0.07] px-5">
          <Link
            href="/organizer/dashboard"
            onClick={onClose}
            aria-label="Tableau de bord Tikemia"
          >
            <Image
              src="/logo.png"
              alt="Tikemia"
              width={190}
              height={60}
              priority
              className="h-auto w-[140px] object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-neutral-400 transition active:scale-95 active:bg-white/[0.07]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-4">
          <Link
            href="/organizer/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3.5"
          >
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-500/30 bg-emerald-500/10">
              {organizerAvatarUrl ? (
                <Image
                  src={organizerAvatarUrl}
                  alt={organizerName}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <span className="text-sm font-black text-lime-400">
                  {getInitials(
                    organizerName,
                  )}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {organizerName}
              </p>

              <p className="mt-0.5 truncate text-xs text-neutral-500">
                {organizerEmail}
              </p>

              <span className="mt-2 inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-lime-400">
                Organisateur
              </span>
            </div>

            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600" />
          </Link>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto px-4 pb-5">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;

              const active =
                isNavigationItemActive({
                  pathname,
                  item,
                });

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
                  className={`group relative flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-emerald-500/18 via-lime-500/10 to-transparent text-white"
                      : "text-neutral-400 active:bg-white/[0.05] active:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-gradient-to-b from-emerald-400 via-lime-400 to-orange-500" />
                  )}

                  <Icon
                    className={`h-[19px] w-[19px] shrink-0 ${
                      active
                        ? "text-lime-400"
                        : "text-neutral-500"
                    }`}
                  />

                  <span className="min-w-0 truncate">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/[0.07] p-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#071014] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                <Headphones className="h-5 w-5 text-lime-400" />
              </div>

              <div>
                <p className="text-sm font-bold text-white">
                  Assistance Tikemia
                </p>

                <p className="mt-0.5 text-xs text-neutral-500">
                  Support organisateur
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <a
                href="mailto:contact@tikemia.com"
                className="block truncate text-xs text-neutral-400 transition active:text-lime-400"
              >
                contact@tikemia.com
              </a>

              <a
                href="tel:+2290169567744"
                className="block text-xs text-neutral-400 transition active:text-lime-400"
              >
                +229 01 69 56 77 44
              </a>
            </div>

            <Link
              href="/organizer/support"
              onClick={onClose}
              className="mt-4 flex h-10 w-full items-center justify-center rounded-xl border border-emerald-500/50 bg-emerald-500/[0.04] text-xs font-bold text-white transition active:bg-emerald-500/10"
            >
              Contacter le support
            </Link>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout?.();
            }}
            className="mt-3 flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-neutral-500 transition active:bg-red-500/10 active:text-red-400"
          >
            <LogOut className="h-[19px] w-[19px]" />
            Déconnexion
          </button>
        </div>
      </aside>
    </div>
  );
}