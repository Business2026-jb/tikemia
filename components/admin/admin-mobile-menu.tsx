"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  BellRing,
  CalendarCheck2,
  ChevronDown,
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
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

type AdminMobileMenuProps = {
  open: boolean;
  onClose: () => void;

  adminName?: string;
  adminEmail?: string;
  adminAvatarUrl?: string | null;
  adminRoleLabel?: string;

  /**
   * Permet au layout parent de gérer lui-même la déconnexion.
   * Si cette fonction n’est pas fournie, le composant appelle
   * directement POST /api/admin/auth/logout.
   */
  onLogout?: () => Promise<void> | void;
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
  const normalized =
    value?.trim() ?? "";

  if (!normalized) {
    return null;
  }

  if (
    normalized.startsWith("/") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("http://")
  ) {
    return normalized;
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

export default function AdminMobileMenu({
  open,
  onClose,
  adminName = DEFAULT_ADMIN_NAME,
  adminEmail = DEFAULT_ADMIN_EMAIL,
  adminAvatarUrl = null,
  adminRoleLabel =
    DEFAULT_ADMIN_ROLE_LABEL,
  onLogout,
}: AdminMobileMenuProps) {
  const pathname = usePathname();

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false);

  const [
    expandedSections,
    setExpandedSections,
  ] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        NAVIGATION_SECTIONS.map(
          (section) => [
            section.label,
            true,
          ],
        ),
      ),
  );

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

  const activeSectionLabel =
    useMemo(() => {
      for (const section of NAVIGATION_SECTIONS) {
        const containsActiveItem =
          section.items.some(
            (item) =>
              isNavigationItemActive({
                pathname,
                item,
              }),
          );

        if (containsActiveItem) {
          return section.label;
        }
      }

      return null;
    }, [pathname]);

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
    if (!open) {
      return;
    }

    onClose();
  }, [pathname, open, onClose]);

  useEffect(() => {
    if (!activeSectionLabel) {
      return;
    }

    const timeoutId =
      window.setTimeout(() => {
        setExpandedSections(
          (current) => ({
            ...current,
            [activeSectionLabel]:
              true,
          }),
        );
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [activeSectionLabel]);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      if (onLogout) {
        await onLogout();
        onClose();
        return;
      }

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
            credentials:
              "same-origin",
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
          // La réponse n’est pas au format JSON.
        }

        throw new Error(
          message,
        );
      }

      window.location.href =
        "/admin/login";
    } catch (error) {
      console.error(
        "[ADMIN_MOBILE_MENU_LOGOUT_ERROR]",
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

  function toggleSection(
    label: string,
  ) {
    setExpandedSections(
      (current) => ({
        ...current,
        [label]:
          !current[label],
      }),
    );
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] lg:hidden">
      <button
        type="button"
        aria-label="Fermer le menu administrateur"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      <aside
        aria-label="Menu administrateur mobile"
        className="absolute inset-y-0 right-0 flex w-[min(92vw,390px)] flex-col border-l border-white/[0.08] bg-[#03070d] shadow-[-30px_0_90px_rgba(0,0,0,0.68)]"
      >
        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-white/[0.07] px-5">
          <Link
            href="/admin/dashboard"
            onClick={onClose}
            aria-label="Tableau de bord administrateur Tikemia"
            className="flex items-center"
          >
            <Image
              src="/logo.png"
              alt="Tikemia"
              width={190}
              height={60}
              priority
              className="h-auto w-[145px] object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-neutral-400 transition active:scale-95 active:bg-white/[0.07] active:text-white"
          >
            <X
              aria-hidden="true"
              className="h-5 w-5"
            />
          </button>
        </header>

        <div className="shrink-0 px-4 pt-4">
          <Link
            href="/admin/profile"
            onClick={onClose}
            aria-label="Ouvrir mon profil administrateur"
            className={`flex items-center gap-3 rounded-2xl border p-3.5 transition ${
              pathname ===
              "/admin/profile"
                ? "border-blue-400/30 bg-blue-400/[0.08]"
                : "border-white/[0.08] bg-white/[0.035] active:bg-white/[0.06]"
            }`}
          >
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-400/30 bg-blue-400/10">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={`Photo de profil de ${displayName}`}
                  fill
                  sizes="48px"
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
                className="mt-0.5 truncate text-xs text-neutral-500"
              >
                {email}
              </p>

              <span className="mt-2 inline-flex max-w-full truncate rounded-full border border-blue-400/25 bg-blue-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-blue-300">
                {roleLabel}
              </span>
            </div>

            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-neutral-600"
            />
          </Link>
        </div>

        <nav
          aria-label="Navigation administrateur"
          className="mt-4 min-h-0 flex-1 overflow-y-auto px-4 pb-5 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]"
        >
          <div className="space-y-3">
            {NAVIGATION_SECTIONS.map(
              (section) => {
                const isExpanded =
                  expandedSections[
                    section.label
                  ] ?? true;

                const containsActiveItem =
                  section.items.some(
                    (item) =>
                      isNavigationItemActive({
                        pathname,
                        item,
                      }),
                  );

                return (
                  <section
                    key={
                      section.label
                    }
                    className="overflow-hidden rounded-2xl border border-white/[0.065] bg-white/[0.018]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        toggleSection(
                          section.label,
                        );
                      }}
                      aria-expanded={
                        isExpanded
                      }
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
                    >
                      <span
                        className={`text-[10px] font-black uppercase tracking-[0.15em] ${
                          containsActiveItem
                            ? "text-blue-300"
                            : "text-neutral-600"
                        }`}
                      >
                        {section.label}
                      </span>

                      <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          isExpanded
                            ? "rotate-180 text-blue-300"
                            : "text-neutral-600"
                        }`}
                      />
                    </button>

                    {isExpanded ? (
                      <div className="space-y-1 border-t border-white/[0.055] p-1.5">
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
                                onClick={
                                  onClose
                                }
                                aria-current={
                                  active
                                    ? "page"
                                    : undefined
                                }
                                className={`group relative flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                                  active
                                    ? "bg-gradient-to-r from-blue-500/[0.2] via-violet-500/10 to-transparent text-white"
                                    : "text-neutral-400 active:bg-white/[0.05] active:text-white"
                                }`}
                              >
                                {active ? (
                                  <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-gradient-to-b from-blue-400 via-violet-400 to-cyan-400" />
                                ) : null}

                                <Icon
                                  aria-hidden="true"
                                  className={`h-[19px] w-[19px] shrink-0 ${
                                    active
                                      ? "text-blue-300"
                                      : "text-neutral-500"
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
                    ) : null}
                  </section>
                );
              },
            )}
          </div>
        </nav>

        <footer className="shrink-0 border-t border-white/[0.07] bg-[#03070d] p-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#08101a] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-400/10">
                <Headphones
                  aria-hidden="true"
                  className="h-5 w-5 text-blue-300"
                />
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

            <div className="mt-4 space-y-2">
              <a
                href="mailto:admin@tikemia.com"
                className="block truncate text-xs text-neutral-400 transition active:text-blue-300"
              >
                admin@tikemia.com
              </a>

              <a
                href="tel:+2290169567744"
                className="block text-xs text-neutral-400 transition active:text-blue-300"
              >
                +229 01 69 56 77 44
              </a>
            </div>

            <Link
              href="/admin/support"
              onClick={onClose}
              className="mt-4 flex h-10 w-full items-center justify-center rounded-xl border border-blue-400/40 bg-blue-400/[0.04] px-3 text-xs font-bold text-white transition active:bg-blue-400/10"
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
            className="mt-3 flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-neutral-500 transition active:bg-red-500/10 active:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? (
              <LoaderCircle
                aria-hidden="true"
                className="h-[19px] w-[19px] animate-spin"
              />
            ) : (
              <LogOut
                aria-hidden="true"
                className="h-[19px] w-[19px]"
              />
            )}

            <span>
              {isLoggingOut
                ? "Déconnexion..."
                : "Déconnexion"}
            </span>
          </button>
        </footer>
      </aside>
    </div>
  );
}