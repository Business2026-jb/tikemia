"use client";

import Image from "next/image";
import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  BadgePercent,
  BellRing,
  CalendarCheck2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileBarChart,
  Headphones,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Megaphone,
  MessageSquareWarning,
  ReceiptText,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  WalletCards,
} from "lucide-react";
import { useState } from "react";

type AdminSidebarProps = {
  adminName?: string;
  adminEmail?: string;
  adminAvatarUrl?: string | null;
  adminRoleLabel?: string;
};

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  exact?: boolean;
};

type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    label: "Vue générale",
    items: [
      {
        name: "Tableau de bord",
        href: "/admin/dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        name: "Notifications",
        href: "/admin/notifications",
        icon: BellRing,
      },
    ],
  },
  {
    label: "Utilisateurs",
    items: [
      {
        name: "Organisateurs",
        href: "/admin/organizers",
        icon: Store,
      },
      {
        name: "Clients",
        href: "/admin/customers",
        icon: Users,
      },
    ],
  },
  {
    label: "Billetterie",
    items: [
      {
        name: "Événements",
        href: "/admin/events",
        icon: CalendarCheck2,
      },
      {
        name: "Commandes",
        href: "/admin/orders",
        icon: ClipboardList,
      },
      {
        name: "Paiements",
        href: "/admin/payments",
        icon: CircleDollarSign,
      },
      {
        name: "Remboursements",
        href: "/admin/refunds",
        icon: RotateCcw,
      },
      {
        name: "Retraits",
        href: "/admin/payouts",
        icon: WalletCards,
      },
    ],
  },
  {
    label: "Croissance",
    items: [
      {
        name: "Abonnements",
        href: "/admin/subscriptions",
        icon: ReceiptText,
      },
      {
        name: "Visibilité Premium",
        href: "/admin/promotions",
        icon: Sparkles,
      },
      {
        name: "Codes promo",
        href: "/admin/coupons",
        icon: BadgePercent,
      },
      {
        name: "Marketing",
        href: "/admin/marketing",
        icon: Megaphone,
      },
    ],
  },
  {
    label: "Contrôle",
    items: [
      {
        name: "Signalements",
        href: "/admin/reports",
        icon: MessageSquareWarning,
      },
      {
        name: "Rapports",
        href: "/admin/analytics",
        icon: FileBarChart,
      },
      {
        name: "Sécurité",
        href: "/admin/security",
        icon: ShieldCheck,
      },
      {
        name: "Journal d’activité",
        href: "/admin/audit-logs",
        icon: LockKeyhole,
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        name: "Paramètres",
        href: "/admin/settings",
        icon: Settings,
      },
    ],
  },
];

const DEFAULT_ADMIN_NAME =
  "Administrateur Tikemia";

const DEFAULT_ADMIN_EMAIL =
  "admin@tikemia.com";

const DEFAULT_ADMIN_ROLE_LABEL =
  "Administrateur";

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
    return "AD";
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

  return (
    pathname === item.href ||
    pathname.startsWith(
      `${item.href}/`,
    )
  );
}

export default function AdminSidebar({
  adminName = DEFAULT_ADMIN_NAME,
  adminEmail = DEFAULT_ADMIN_EMAIL,
  adminAvatarUrl = null,
  adminRoleLabel =
    DEFAULT_ADMIN_ROLE_LABEL,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false);

  const displayName =
    normalizeText(adminName) ||
    DEFAULT_ADMIN_NAME;

  const email =
    normalizeText(adminEmail) ||
    DEFAULT_ADMIN_EMAIL;

  const roleLabel =
    normalizeText(adminRoleLabel) ||
    DEFAULT_ADMIN_ROLE_LABEL;

  const avatarUrl =
    normalizeAvatarUrl(
      adminAvatarUrl,
    );

  const initials =
    getInitials(displayName);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      const response =
        await fetch(
          "/api/admin/auth/logout",
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
        "/admin/login",
      );

      router.refresh();
    } catch (error) {
      console.error(
        "[ADMIN_SIDEBAR_LOGOUT_ERROR]",
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] border-r border-white/[0.07] bg-[#03070d] lg:flex lg:flex-col">
      <div className="flex h-[92px] shrink-0 items-center border-b border-white/[0.07] px-5">
        <Link
          href="/admin/dashboard"
          aria-label="Tableau de bord administrateur Tikemia"
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

      <div className="shrink-0 px-3 pt-4">
        <Link
          href="/admin/profile"
          aria-label="Ouvrir mon profil administrateur"
          className={`group block rounded-2xl border p-3.5 transition ${
            pathname ===
            "/admin/profile"
              ? "border-blue-400/30 bg-blue-400/[0.08]"
              : "border-white/[0.08] bg-white/[0.035] hover:border-blue-400/25 hover:bg-blue-400/[0.055]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-400/30 bg-blue-400/10">
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
                <span className="text-sm font-black text-blue-300">
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
                {email}
              </p>

              <span className="mt-2 inline-flex rounded-full border border-blue-400/25 bg-blue-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-blue-300">
                {roleLabel}
              </span>
            </div>

            <ChevronRight
              className={`h-4 w-4 shrink-0 transition ${
                pathname ===
                "/admin/profile"
                  ? "text-blue-300"
                  : "text-neutral-600 group-hover:translate-x-0.5 group-hover:text-blue-300"
              }`}
            />
          </div>
        </Link>
      </div>

      <nav
        aria-label="Navigation administrateur"
        className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-5 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]"
      >
        <div className="space-y-5">
          {NAVIGATION_SECTIONS.map(
            (section) => (
              <section
                key={section.label}
              >
                <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-600">
                  {section.label}
                </p>

                <div className="space-y-1">
                  {section.items.map(
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
                          className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                            active
                              ? "bg-gradient-to-r from-blue-500/[0.2] via-violet-500/10 to-transparent text-white"
                              : "text-neutral-400 hover:bg-white/[0.045] hover:text-white"
                          }`}
                        >
                          {active && (
                            <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-gradient-to-b from-blue-400 via-violet-400 to-cyan-400" />
                          )}

                          <Icon
                            className={`h-[19px] w-[19px] shrink-0 transition ${
                              active
                                ? "text-blue-300"
                                : "text-neutral-500 group-hover:text-neutral-200"
                            }`}
                          />

                          <span className="min-w-0 truncate">
                            {
                              item.name
                            }
                          </span>
                        </Link>
                      );
                    },
                  )}
                </div>
              </section>
            ),
          )}
        </div>
      </nav>

      <div className="shrink-0 border-t border-white/[0.07] bg-[#03070d] p-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#08101a] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-400/10">
              <Headphones className="h-5 w-5 text-blue-300" />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-bold text-white">
                Support interne
              </p>

              <p className="mt-0.5 truncate text-xs text-neutral-500">
                Assistance administration
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 text-xs text-neutral-400">
            <a
              href="mailto:admin@tikemia.com"
              className="block truncate transition hover:text-blue-300"
            >
              admin@tikemia.com
            </a>

            <a
              href="tel:+2290169567744"
              className="block transition hover:text-blue-300"
            >
              +229 01 69 56 77 44
            </a>
          </div>

          <Link
            href="/admin/support"
            className="mt-4 flex h-10 w-full items-center justify-center rounded-xl border border-blue-400/40 bg-blue-400/[0.04] px-3 text-xs font-bold text-white transition hover:bg-blue-400/10"
          >
            Ouvrir le support
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