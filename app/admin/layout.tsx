"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  Menu,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  usePathname,
} from "next/navigation";
import {
  useMemo,
  useState,
} from "react";

import AdminMobileMenu from "@/components/admin/admin-mobile-menu";
import AdminSidebar from "@/components/admin/admin-sidebar";

type AdminLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

const ADMIN_LOGIN_PATH =
  "/admin/login";

const DEFAULT_ADMIN = {
  name:
    "Administrateur Tikemia",

  email:
    "admin@tikemia.com",

  roleLabel:
    "Administrateur",

  avatarUrl:
    null as string | null,
};

function isPublicAdminRoute(
  pathname: string,
): boolean {
  return (
    pathname ===
      ADMIN_LOGIN_PATH ||
    pathname.startsWith(
      `${ADMIN_LOGIN_PATH}/`,
    )
  );
}

function getPageTitle(
  pathname: string,
): string {
  const routes: Array<{
    path: string;
    title: string;
  }> = [
    {
      path:
        "/admin/dashboard",

      title:
        "Tableau de bord",
    },
    {
      path:
        "/admin/notifications",

      title:
        "Notifications",
    },
    {
      path:
        "/admin/organizers",

      title:
        "Organisateurs",
    },
    {
      path:
        "/admin/customers",

      title:
        "Clients",
    },
    {
      path:
        "/admin/events",

      title:
        "Événements",
    },
    {
      path:
        "/admin/orders",

      title:
        "Commandes",
    },
    {
      path:
        "/admin/payments",

      title:
        "Paiements",
    },
    {
      path:
        "/admin/payouts",

      title:
        "Retraits",
    },
    {
      path:
        "/admin/subscriptions",

      title:
        "Abonnements",
    },
    {
      path:
        "/admin/promotions",

      title:
        "Visibilité Premium",
    },
    {
      path:
        "/admin/coupons",

      title:
        "Codes promo",
    },
    {
      path:
        "/admin/marketing",

      title:
        "Marketing",
    },
    {
      path:
        "/admin/reports",

      title:
        "Signalements",
    },
    {
      path:
        "/admin/analytics",

      title:
        "Rapports",
    },
    {
      path:
        "/admin/security",

      title:
        "Sécurité",
    },
    {
      path:
        "/admin/audit-logs",

      title:
        "Journal d’activité",
    },
    {
      path:
        "/admin/settings",

      title:
        "Paramètres",
    },
    {
      path:
        "/admin/profile",

      title:
        "Mon profil",
    },
    {
      path:
        "/admin/support",

      title:
        "Support interne",
    },
  ];

  const matchedRoute =
    routes.find(
      (
        route,
      ) =>
        pathname ===
          route.path ||
        pathname.startsWith(
          `${route.path}/`,
        ),
    );

  return (
    matchedRoute?.title ??
    "Administration"
  );
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const pathname =
    usePathname();

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] =
    useState(false);

  const publicRoute =
    isPublicAdminRoute(
      pathname,
    );

  const pageTitle =
    useMemo(
      () =>
        getPageTitle(
          pathname,
        ),
      [
        pathname,
      ],
    );

  if (publicRoute) {
    return (
      <div className="min-h-screen bg-[#03070d] text-white">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#03070d] text-white">
      <AdminSidebar
        adminName={
          DEFAULT_ADMIN.name
        }
        adminEmail={
          DEFAULT_ADMIN.email
        }
        adminRoleLabel={
          DEFAULT_ADMIN.roleLabel
        }
        adminAvatarUrl={
          DEFAULT_ADMIN.avatarUrl
        }
      />

      <div className="min-h-screen lg:pl-[268px]">
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#03070d]/92 backdrop-blur-2xl">
          <div className="flex min-h-[72px] items-center gap-3 px-4 sm:px-5 lg:min-h-[82px] lg:px-6 xl:px-8">
            <button
              type="button"
              onClick={() =>
                setMobileMenuOpen(
                  true,
                )
              }
              aria-label="Ouvrir le menu administrateur"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-neutral-300 transition active:scale-95 active:bg-white/[0.07] lg:hidden"
            >
              <Menu
                aria-hidden="true"
                className="h-5 w-5"
              />
            </button>

            <Link
              href="/admin/dashboard"
              aria-label="Accueil administration Tikemia"
              className="shrink-0 lg:hidden"
            >
              <Image
                src="/logo.png"
                alt="Tikemia"
                width={165}
                height={54}
                priority
                className="h-auto w-[130px] object-contain sm:w-[142px]"
              />
            </Link>

            <div className="hidden min-w-0 flex-1 lg:block">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/[0.08] text-blue-300">
                  <ShieldCheck
                    aria-hidden="true"
                    className="h-5 w-5"
                  />
                </span>

                <div className="min-w-0">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
                    Centre de contrôle Tikemia
                  </p>

                  <h1 className="mt-1 truncate text-xl font-black tracking-[-0.025em] text-white xl:text-2xl">
                    {
                      pageTitle
                    }
                  </h1>
                </div>
              </div>
            </div>

            <div className="ml-auto flex min-w-0 items-center gap-2">
              <Link
                href="/admin/events"
                className="hidden h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-bold text-neutral-300 transition hover:border-blue-400/20 hover:bg-blue-400/[0.07] hover:text-white xl:inline-flex"
              >
                Gérer les événements
              </Link>

              <button
                type="button"
                aria-label="Recherche administrateur"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-400 transition hover:border-blue-400/20 hover:bg-blue-400/[0.07] hover:text-blue-300"
              >
                <Search
                  aria-hidden="true"
                  className="h-[18px] w-[18px]"
                />
              </button>

              <Link
                href="/admin/notifications"
                aria-label="Ouvrir les notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-400 transition hover:border-blue-400/20 hover:bg-blue-400/[0.07] hover:text-blue-300"
              >
                <Bell
                  aria-hidden="true"
                  className="h-[18px] w-[18px]"
                />

                <span
                  aria-hidden="true"
                  className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-[#03070d] bg-red-500"
                />
              </Link>

              <Link
                href="/admin/profile"
                aria-label="Ouvrir le profil administrateur"
                className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/[0.08] px-2 text-xs font-black text-blue-300 transition hover:bg-blue-400/[0.13]"
              >
                AD
              </Link>
            </div>
          </div>

          <div className="border-t border-white/[0.055] px-4 py-2.5 lg:hidden">
            <p className="truncate text-sm font-black text-white">
              {
                pageTitle
              }
            </p>
          </div>
        </header>

        <main className="min-w-0">
          <div className="w-full min-w-0 px-4 py-5 sm:px-5 sm:py-6 lg:px-6 lg:py-7 xl:px-8 xl:py-8">
            {children}
          </div>
        </main>
      </div>

      <AdminMobileMenu
        open={
          mobileMenuOpen
        }
        onClose={() =>
          setMobileMenuOpen(
            false,
          )
        }
        adminName={
          DEFAULT_ADMIN.name
        }
        adminEmail={
          DEFAULT_ADMIN.email
        }
        adminRoleLabel={
          DEFAULT_ADMIN.roleLabel
        }
        adminAvatarUrl={
          DEFAULT_ADMIN.avatarUrl
        }
      />
    </div>
  );
}