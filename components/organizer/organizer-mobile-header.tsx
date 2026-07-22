"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Menu,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type OrganizerMobileHeaderProps = {
  organizerName?: string;
  organizerEmail?: string;
  organizerAvatarUrl?: string | null;
  notificationCount?: number;
  onOpenMenu: () => void;
  menuOpen?: boolean;
};

const pageTitles: Array<{
  path: string;
  title: string;
}> = [
  {
    path: "/organizer/dashboard",
    title: "Tableau de bord",
  },
  {
    path: "/organizer/events/create",
    title: "Créer un événement",
  },
  {
    path: "/organizer/events",
    title: "Événements",
  },
  {
    path: "/organizer/orders",
    title: "Commandes",
  },
  {
    path: "/organizer/participants",
    title: "Participants",
  },
  {
    path: "/organizer/statistics",
    title: "Statistiques",
  },
  {
    path: "/organizer/payments",
    title: "Paiements",
  },
  {
    path: "/organizer/marketing",
    title: "Marketing",
  },
  {
    path: "/organizer/coupons",
    title: "Coupons",
  },
  {
    path: "/organizer/settings",
    title: "Paramètres",
  },
  {
    path: "/organizer/profile",
    title: "Mon profil",
  },
  {
    path: "/organizer/support",
    title: "Assistance",
  },
];

function getCurrentPageTitle(pathname: string): string {
  const exactMatch = pageTitles.find((page) => page.path === pathname);

  if (exactMatch) {
    return exactMatch.title;
  }

  const nestedMatch = pageTitles
    .filter((page) => page.path !== "/organizer/dashboard")
    .sort((a, b) => b.path.length - a.path.length)
    .find((page) => pathname.startsWith(`${page.path}/`));

  return nestedMatch?.title ?? "Espace organisateur";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function OrganizerMobileHeader({
  organizerName = "Organisateur Tikemia",
  organizerEmail = "contact@tikemia.com",
  organizerAvatarUrl = null,
  notificationCount = 0,
  onOpenMenu,
  menuOpen = false,
}: OrganizerMobileHeaderProps) {
  const pathname = usePathname();

  const notificationRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const currentTitle = getCurrentPageTitle(pathname);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (
        notificationRef.current &&
        !notificationRef.current.contains(target)
      ) {
        setNotificationOpen(false);
      }

      if (
        profileRef.current &&
        !profileRef.current.contains(target)
      ) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    setNotificationOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#03080c]/95 backdrop-blur-xl lg:hidden">
      <div className="flex h-[72px] items-center justify-between gap-3 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/organizer/dashboard"
            className="shrink-0"
            aria-label="Tableau de bord Tikemia"
          >
            <Image
              src="/logo.png"
              alt="Tikemia"
              width={180}
              height={58}
              priority
              className="h-auto w-[122px] object-contain sm:w-[140px]"
            />
          </Link>

          <div className="hidden min-w-0 border-l border-white/[0.08] pl-3 min-[520px]:block">
            <p className="truncate text-sm font-bold text-white">
              {currentTitle}
            </p>

            <p className="mt-0.5 truncate text-[11px] text-neutral-600">
              Espace organisateur
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div ref={notificationRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationOpen((current) => !current);
                setProfileOpen(false);
              }}
              aria-label="Ouvrir les notifications"
              aria-expanded={notificationOpen}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-neutral-400 transition active:scale-95"
            >
              <Bell className="h-[19px] w-[19px]" />

              {notificationCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#03080c] bg-red-500 px-1 text-[9px] font-black text-white">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </button>

            {notificationOpen && (
              <div className="absolute right-0 top-[50px] w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#081015] shadow-[0_24px_70px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4">
                  <div>
                    <p className="text-sm font-bold text-white">
                      Notifications
                    </p>

                    <p className="mt-0.5 text-xs text-neutral-500">
                      Activité récente
                    </p>
                  </div>

                  {notificationCount > 0 && (
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-lime-400">
                      {notificationCount}
                    </span>
                  )}
                </div>

                <div className="px-5 py-7 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
                    <Bell className="h-5 w-5 text-neutral-500" />
                  </div>

                  <p className="mt-3 text-sm font-semibold text-neutral-300">
                    Aucune notification
                  </p>

                  <p className="mt-1 text-xs leading-5 text-neutral-600">
                    Vos ventes, paiements et alertes apparaîtront ici.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((current) => !current);
                setNotificationOpen(false);
              }}
              aria-label="Ouvrir le profil"
              aria-expanded={profileOpen}
              className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 transition active:scale-95"
            >
              {organizerAvatarUrl ? (
                <Image
                  src={organizerAvatarUrl}
                  alt={organizerName}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                <span className="text-xs font-black text-lime-400">
                  {getInitials(organizerName)}
                </span>
              )}
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-[50px] w-[270px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#081015] shadow-[0_24px_70px_rgba(0,0,0,0.6)]">
                <div className="border-b border-white/[0.07] px-4 py-4">
                  <p className="truncate text-sm font-bold text-white">
                    {organizerName}
                  </p>

                  <p className="mt-1 truncate text-xs text-neutral-500">
                    {organizerEmail}
                  </p>
                </div>

                <div className="p-2">
                  <Link
                    href="/organizer/profile"
                    className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-neutral-300 transition active:bg-white/[0.06]"
                  >
                    <UserRound className="h-[18px] w-[18px] text-neutral-500" />
                    Mon profil
                  </Link>

                  <Link
                    href="/organizer/settings"
                    className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-neutral-300 transition active:bg-white/[0.06]"
                  >
                    <Settings className="h-[18px] w-[18px] text-neutral-500" />
                    Paramètres
                  </Link>
                </div>

                <div className="border-t border-white/[0.07] px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-neutral-600">
                      Compte organisateur
                    </span>

                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 font-bold text-lime-400">
                      Actif
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenMenu}
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-lime-500 to-orange-500 text-white shadow-[0_8px_24px_rgba(34,197,94,0.18)] transition active:scale-95"
          >
            {menuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      <div className="border-t border-white/[0.05] px-4 py-2.5 min-[520px]:hidden">
        <p className="truncate text-sm font-bold text-white">
          {currentTitle}
        </p>
      </div>
    </header>
  );
}