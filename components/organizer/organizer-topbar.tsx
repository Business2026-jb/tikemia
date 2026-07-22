"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Settings, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type OrganizerTopbarProps = {
  organizerName?: string;
  organizerEmail?: string;
  organizerAvatarUrl?: string | null;
  notificationCount?: number;
};

const pageTitles: Array<{
  path: string;
  title: string;
  description?: string;
}> = [
  {
    path: "/organizer/dashboard",
    title: "Tableau de bord",
    description: "Vue d’ensemble de votre activité",
  },
  {
    path: "/organizer/events/create",
    title: "Créer un nouvel événement",
    description: "Configurez et publiez votre événement",
  },
  {
    path: "/organizer/events",
    title: "Événements",
    description: "Gérez vos événements et leur publication",
  },
  {
    path: "/organizer/orders",
    title: "Commandes",
    description: "Suivez les achats et les réservations",
  },
  {
    path: "/organizer/participants",
    title: "Participants",
    description: "Consultez les participants à vos événements",
  },
  {
    path: "/organizer/statistics",
    title: "Statistiques",
    description: "Analysez vos performances",
  },
  {
    path: "/organizer/payments",
    title: "Paiements",
    description: "Suivez vos revenus et vos versements",
  },
  {
    path: "/organizer/marketing",
    title: "Marketing",
    description: "Développez la visibilité de vos événements",
  },
  {
    path: "/organizer/coupons",
    title: "Coupons",
    description: "Gérez vos codes promotionnels",
  },
  {
    path: "/organizer/settings",
    title: "Paramètres",
    description: "Configurez votre espace organisateur",
  },
  {
    path: "/organizer/profile",
    title: "Mon profil",
    description: "Gérez vos informations personnelles",
  },
  {
    path: "/organizer/support",
    title: "Assistance",
    description: "Contactez l’équipe Tikemia",
  },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getCurrentPage(pathname: string) {
  const exactMatch = pageTitles.find((page) => page.path === pathname);

  if (exactMatch) {
    return exactMatch;
  }

  const nestedMatch = pageTitles
    .filter((page) => page.path !== "/organizer/dashboard")
    .sort((a, b) => b.path.length - a.path.length)
    .find((page) => pathname.startsWith(`${page.path}/`));

  return (
    nestedMatch ?? {
      title: "Espace organisateur",
      description: "Gérez votre activité sur Tikemia",
    }
  );
}

export default function OrganizerTopbar({
  organizerName = "Organisateur Tikemia",
  organizerEmail = "contact@tikemia.com",
  organizerAvatarUrl = null,
  notificationCount = 0,
}: OrganizerTopbarProps) {
  const pathname = usePathname();
  const currentPage = getCurrentPage(pathname);

  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target)
      ) {
        setProfileMenuOpen(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(target)
      ) {
        setNotificationMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    setProfileMenuOpen(false);
    setNotificationMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 hidden h-[92px] border-b border-white/[0.07] bg-[#03080c]/95 backdrop-blur-xl lg:block">
      <div className="flex h-full items-center justify-between gap-6 px-7 xl:px-9">
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-black tracking-[-0.025em] text-white">
            {currentPage.title}
          </h1>

          {currentPage.description && (
            <p className="mt-1 truncate text-sm text-neutral-500">
              {currentPage.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div ref={notificationRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationMenuOpen((current) => !current);
                setProfileMenuOpen(false);
              }}
              aria-label="Ouvrir les notifications"
              aria-expanded={notificationMenuOpen}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-neutral-400 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white"
            >
              <Bell className="h-5 w-5" />

              {notificationCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#03080c] bg-red-500 px-1 text-[10px] font-black text-white">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </button>

            {notificationMenuOpen && (
              <div className="absolute right-0 top-[56px] w-[340px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#081015] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                  <div>
                    <p className="text-sm font-bold text-white">
                      Notifications
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Activité récente de votre compte
                    </p>
                  </div>

                  {notificationCount > 0 && (
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-lime-400">
                      {notificationCount} nouvelle
                      {notificationCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="px-5 py-7 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
                    <Bell className="h-5 w-5 text-neutral-500" />
                  </div>

                  <p className="mt-3 text-sm font-semibold text-neutral-300">
                    Aucune notification à afficher
                  </p>

                  <p className="mt-1 text-xs leading-5 text-neutral-600">
                    Les ventes, paiements et alertes apparaîtront ici.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen((current) => !current);
                setNotificationMenuOpen(false);
              }}
              aria-label="Ouvrir le menu du profil"
              aria-expanded={profileMenuOpen}
              className="flex min-w-[210px] items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-left transition hover:border-white/[0.08] hover:bg-white/[0.035]"
            >
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-500/30 bg-emerald-500/10">
                {organizerAvatarUrl ? (
                  <Image
                    src={organizerAvatarUrl}
                    alt={organizerName}
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-sm font-black text-lime-400">
                    {getInitials(organizerName)}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">
                  {organizerName}
                </p>

                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  Organisateur
                </p>
              </div>

              <ChevronDown
                className={`h-4 w-4 shrink-0 text-neutral-500 transition ${
                  profileMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 top-[60px] w-[280px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#081015] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
                <div className="border-b border-white/[0.07] px-5 py-4">
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
                    className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    <UserRound className="h-[18px] w-[18px] text-neutral-500" />
                    Mon profil
                  </Link>

                  <Link
                    href="/organizer/settings"
                    className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    <Settings className="h-[18px] w-[18px] text-neutral-500" />
                    Paramètres
                  </Link>
                </div>

                <div className="border-t border-white/[0.07] px-4 py-3">
                  <div className="flex items-center justify-between gap-4 text-xs">
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
        </div>
      </div>
    </header>
  );
}