
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Image from "next/image";
import Link from "next/link";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Heart,
  Home,
  Landmark,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Ticket,
  UserCircle2,
  UserRound,
  UserRoundCog,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

/* ======================================================
   TIKEMIA — NAVIGATION ADMINISTRATEUR

   PC :
   - Header fixe
   - Sidebar fixe
   - Menus et sous-menus

   MOBILE :
   - Header compact
   - Menu hamburger
   - Navigation inférieure
   - Menu complet coulissant

   LANGUE :
   - Français uniquement

   AUTHENTIFICATION :
   - Gérée par le layout administrateur
   - Déconnexion via API sécurisée

   Aucun chiffre fictif.
   Aucun menu supplémentaire.
====================================================== */

const ADMIN_HOME = "/admin";
const ADMIN_LOGIN = "/admin/login";
const ADMIN_LOGOUT_API = "/api/admin/auth/confirm";

const LOGO_PATH = "/logo/logo.png";

type MenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: {
    label: string;
    href: string;
    icon?: LucideIcon;
  }[];
};

/* ======================================================
   MENUS PRINCIPAUX
====================================================== */

const MENU_ITEMS: MenuItem[] = [
  {
    label: "Tableau de bord",
    href: "/admin",
    icon: Home,
  },
  {
    label: "Organisateurs",
    href: "/admin/organizers",
    icon: UsersRound,
  },
  {
    label: "Clients",
    href: "/admin/clients",
    icon: UserRound,
  },
  {
    label: "Événements",
    href: "/admin/events",
    icon: CalendarDays,
  },
  {
    label: "Cagnottes / Dons",
    href: "/admin/campaigns",
    icon: Heart,
  },
  {
    label: "Billets & Commandes",
    href: "/admin/tickets",
    icon: Ticket,
  },
  {
    label: "Transactions",
    href: "/admin/transactions",
    icon: ArrowLeftRight,
  },
  {
    label: "Retraits",
    href: "/admin/withdrawals",
    icon: Landmark,
  },
  
  {
    label: "Rapports & Statistiques",
    href: "/admin/statistics",
    icon: BarChart3,
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
  },
  {
    label: "Paramètres",
    href: "/admin/settings",
    icon: Settings,
  },
  {
    label: "Utilisateurs & Rôles",
    href: "/admin/users",
    icon: UserRoundCog,
  },
];

/* ======================================================
   NAVIGATION MOBILE INFÉRIEURE
====================================================== */

const MOBILE_TABS = [
  {
    label: "Accueil",
    href: "/admin",
    icon: Home,
  },
  {
    label: "Organisateurs",
    href: "/admin/organizers",
    icon: UsersRound,
  },
  {
    label: "Transactions",
    href: "/admin/transactions",
    icon: ArrowLeftRight,
  },
];

/* ======================================================
   UTILITAIRES
====================================================== */

function normalizePath(path: string) {
  if (path === "/") return path;

  return path.replace(/\/+$/, "");
}

function isActiveRoute(
  pathname: string,
  href: string,
  exact = false
) {
  const current = normalizePath(pathname);
  const target = normalizePath(href);

  if (exact || target === "/admin") {
    return current === target;
  }

  return (
    current === target ||
    current.startsWith(`${target}/`)
  );
}

/* ======================================================
   LOGO
====================================================== */

function AdminLogo({
  mobile = false,
}: {
  mobile?: boolean;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  return (
    <Link
      href={ADMIN_HOME}
      aria-label="Accueil administration TIKEMIA"
      className="flex min-w-0 shrink-0 items-center"
    >
      {!imageFailed ? (
        <Image
          src={LOGO_PATH}
          alt="TIKEMIA"
          width={mobile ? 153 : 184}
          height={mobile ? 44 : 52}
          priority
          className={
            mobile
              ? "h-10 w-auto max-w-38.25 object-contain"
              : "h-12.25 w-auto max-w-46 object-contain"
          }
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="text-[22px] font-black tracking-tight text-[#087d2d]">
          TIKEMIA
        </span>
      )}
    </Link>
  );
}

/* ======================================================
   COMPOSANT PRINCIPAL
====================================================== */

export default function AdminNavigation() {
  const pathname = usePathname() || "/admin";
  return <AdminNavigationContent key={pathname} />;
}

function AdminNavigationContent() {
  const pathname = usePathname() || "/admin";
  const router = useRouter();

  const [drawerOpen, setDrawerOpen] =
    useState(false);



  const [profileOpen, setProfileOpen] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [logoutError, setLogoutError] =
    useState(false);



  /* ====================================================
     CHANGEMENT DE PAGE
  ==================================================== */



  /* ====================================================
     VERROUILLAGE DU SCROLL MOBILE
  ==================================================== */

  useEffect(() => {
    if (!drawerOpen) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const drawer = document.getElementById("tikemia-admin-mobile-drawer");
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select, [tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0);
    const frame = window.requestAnimationFrame(() => focusable()[0]?.focus());
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable(), first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trapFocus);

    return () => {
      document.body.style.overflow =
        previousOverflow;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trapFocus);
      previousFocus?.focus();
    };
  }, [drawerOpen]);

  /* ====================================================
     ÉCHAP POUR FERMER LES MENUS
  ==================================================== */

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        setProfileOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  /* ====================================================
     DÉCONNEXION

     Ne supprime pas les cookies
     directement côté navigateur.

     L'API serveur doit révoquer
     la session avant la redirection.
  ==================================================== */

  const logout = useCallback(async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError(false);

    try {
      const response = await fetch(
        ADMIN_LOGOUT_API,
        {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "ADMIN_LOGOUT_FAILED"
        );
      }

      setDrawerOpen(false);
      setProfileOpen(false);

      router.replace(ADMIN_LOGIN);
      router.refresh();
    } catch {
      setLogoutError(true);
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, router]);

  /* ====================================================
     LIENS SIMPLES
  ==================================================== */

  function renderMenuLink(
    item: MenuItem,
    mobile: boolean
  ) {
    const active = isActiveRoute(
      pathname,
      item.href,
      item.href === "/admin"
    );

    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => {
          if (mobile) {
            setDrawerOpen(false);
          }
        }}
        aria-current={
          active ? "page" : undefined
        }
        className={`
          group
          flex
          min-h-11.25
          w-full
          items-center
          gap-3
          rounded-xl
          px-3.5
          py-2.5
          text-[13px]
          font-bold
          transition-colors
          ${
            active
              ? "bg-[#7df318] text-[#061c12] shadow-[0_3px_8px_rgba(49,188,38,0.12)]"
              : "text-[#e9f2fb] hover:bg-white/10"
          }
        `}
      >
        <Icon
          size={21}
          strokeWidth={active ? 2.6 : 2}
          className="shrink-0"
        />

        <span className="min-w-0 flex-1">
          {item.label}
        </span>

        {!active && (
          <ChevronRight
            size={16}
            className="shrink-0 opacity-60"
          />
        )}
      </Link>
    );
  }

  /* ====================================================
     SOUS-MENU TIKEMIA PAY
  ==================================================== */

  

  /* ====================================================
     LISTE COMPLÈTE
  ==================================================== */

  function renderMenu(mobile: boolean) {
    return (
      <nav
        aria-label="Navigation administrateur"
        className="space-y-1"
      >
        {MENU_ITEMS.map((item) =>
          renderMenuLink(item, mobile)
        )}
      </nav>
    );
  }

  /* ====================================================
     BOUTON DÉCONNEXION
  ==================================================== */

  function renderLogout() {
    return (
      <div className="mt-5">
        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void logout()}
          className="flex min-h-11.5 w-full items-center justify-center gap-2 rounded-full border border-[#ff3f4c] bg-transparent px-4 text-[13px] font-extrabold text-[#ff6470] transition-colors hover:bg-[#ff3f4c]/10 disabled:opacity-50"
        >
          {loggingOut ? (
            <LoaderCircle
              size={19}
              className="animate-spin"
            />
          ) : (
            <LogOut size={19} />
          )}

          Déconnexion
        </button>

        {logoutError && (
          <p
            role="alert"
            className="mt-2 text-center text-xs font-medium text-[#ff9c9c]"
          >
            Déconnexion indisponible.
          </p>
        )}
      </div>
    );
  }

  /* ====================================================
     RENDU PC + MOBILE
  ==================================================== */

  return (
    <>
      {/* ==============================================
          DIMENSIONS DU SHELL

          Le layout existant affiche
          AdminNavigation avant main.

          On réserve donc :
          - 72 px pour le header
          - 264 px pour la sidebar PC
          - 76 px pour la barre mobile
      ============================================== */}

      <style jsx global>{`
        #tikemia-admin {
          position: relative;
          width: 100%;
          min-height: 100dvh;
        }

        #tikemia-admin-content {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          margin-left: 0;
          padding-top: 84px;
          padding-bottom: 112px;
        }

        @media (min-width: 1024px) {
          #tikemia-admin-content {
            width: calc(100% - 264px);
            margin-left: 264px;
            padding-top: 88px;
            padding-bottom: 20px;
          }
        }

        @media (max-width: 1023px) {
          #tikemia-admin-content {
            padding-bottom:
              calc(88px + env(safe-area-inset-bottom));
          }
        }
      `}</style>

      {/* ==============================================
          HEADER FIXE PC / MOBILE
      ============================================== */}

      <header
        id="tikemia-admin-header"
        className="fixed inset-x-0 top-0 z-[60] h-18 border-b border-[#e0e8e3] bg-white shadow-[0_2px_10px_rgba(12,35,65,0.07)]"
      >
        <div className="flex h-full w-full items-center justify-between gap-3 px-3 sm:px-5 lg:px-7">
          {/* GAUCHE */}

          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={() =>
                setDrawerOpen(true)
              }
              aria-label="Ouvrir le menu administrateur"
              aria-expanded={drawerOpen}
              aria-controls="tikemia-admin-mobile-drawer"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[#102638] hover:bg-[#f0f5f1] lg:hidden"
            >
              <Menu size={25} />
            </button>

            <AdminLogo />

            <div
              className="hidden items-center gap-2 rounded-xl bg-[#071827] px-3.5 py-2 text-white shadow-sm md:flex"
            >
              <ShieldCheck
                size={21}
                className="text-[#74ed29]"
              />

              <span className="text-[13px] font-extrabold">
                Administrateur
              </span>
            </div>
          </div>

          {/* DROITE */}

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Notifications */}

            <Link
              href="/admin/notifications"
              aria-label="Notifications administrateur"
              className="flex size-10 items-center justify-center rounded-full text-[#0c1e2d] hover:bg-[#f1f5f2]"
            >
              <Bell size={23} />
            </Link>

            {/* Profil PC */}

            <div className="relative hidden lg:block">
              <button
                type="button"
                onClick={() =>
                  setProfileOpen(
                    (previous) => !previous
                  )
                }
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left hover:bg-[#f3f7f3]"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-[#057b2e] text-white">
                  <UserCircle2 size={29} />
                </div>

                <div className="hidden xl:block">
                  <p className="text-[13px] font-black text-[#0e1e31]">
                    Admin TIKEMIA
                  </p>

                  <p className="text-[11px] text-[#556878]">
                    Administrateur
                  </p>
                </div>

                <ChevronDown
                  size={16}
                  className="text-[#253648]"
                />
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+10px)] z-[80] w-58.75 rounded-2xl border border-[#e2e9e4] bg-white p-2 shadow-[0_10px_30px_rgba(10,29,48,0.14)]"
                >
                  <Link
                    role="menuitem"
                    href="/admin/settings"
                    onClick={() =>
                      setProfileOpen(false)
                    }
                    className="flex items-center gap-2 rounded-xl px-3 py-3 text-[13px] font-bold text-[#172a3d] hover:bg-[#f0f6f1]"
                  >
                    <Settings size={18} />
                    Paramètres
                  </Link>

                  <button
                    role="menuitem"
                    type="button"
                    disabled={loggingOut}
                    onClick={() =>
                      void logout()
                    }
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-[13px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <LogOut size={18} />
                    Déconnexion
                  </button>

                  {logoutError && (
                    <p
                      role="alert"
                      className="px-3 py-2 text-xs text-red-600"
                    >
                      Déconnexion indisponible.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Profil mobile */}

            <button
              type="button"
              onClick={() =>
                setDrawerOpen(true)
              }
              aria-label="Profil et menu administrateur"
              className="flex size-10 items-center justify-center rounded-full text-[#087d2d] lg:hidden"
            >
              <UserCircle2 size={29} />
            </button>
          </div>
        </div>
      </header>

      {/* ==============================================
          SIDEBAR PC
      ============================================== */}

      <aside
        id="tikemia-admin-sidebar"
        aria-label="Menu principal administrateur"
        className="fixed bottom-0 left-0 top-18 z-40 hidden w-66 flex-col overflow-y-auto bg-[#041a2c] px-3 pb-5 pt-4 text-white shadow-[4px_0_14px_rgba(0,0,0,0.07)] lg:flex"
      >
        <div className="flex-1">
          {renderMenu(false)}
        </div>

        <div className="pt-5">
          {renderLogout()}
        </div>
      </aside>

      {/* ==============================================
          OVERLAY MOBILE
      ============================================== */}

      {drawerOpen && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Fermer le menu"
          onClick={() =>
            setDrawerOpen(false)
          }
          className="fixed inset-0 z-[80] bg-[#051321]/65 lg:hidden"
        />
      )}

      {/* ==============================================
          MENU COULISSANT MOBILE
      ============================================== */}

      <aside
        id="tikemia-admin-mobile-drawer"
        role="dialog"
        aria-modal={drawerOpen ? true : undefined}
        aria-label="Menu administrateur mobile"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        className={`
          fixed
          bottom-0
          left-0
          top-0
          z-[90]
          flex
          w-[min(86vw,330px)]
          flex-col
          bg-[#041a2c]
          text-white
          shadow-2xl
          transition-transform
          duration-200
          lg:hidden
          ${
            drawerOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        {/* Entête menu mobile */}

        <div className="flex min-h-18.25 items-center justify-between gap-3 border-b border-white/10 px-4">
          <div className="flex items-center gap-2">
            <ShieldCheck
              size={24}
              className="text-[#80ed38]"
            />

            <span className="text-[16px] font-black">
              Administration
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              setDrawerOpen(false)
            }
            aria-label="Fermer le menu"
            className="flex size-10 items-center justify-center rounded-xl bg-white/10"
          >
            <X size={22} />
          </button>
        </div>

        {/* Profil */}

        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <div className="flex size-11 items-center justify-center rounded-full bg-[#0b7d32] text-white">
            <UserCircle2 size={30} />
          </div>

          <div className="min-w-0">
            <p className="text-[14px] font-black">
              Admin TIKEMIA
            </p>

            <p className="text-[12px] text-[#c8d8e3]">
              Administrateur
            </p>
          </div>
        </div>

        {/* Tous les menus */}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          {renderMenu(true)}

          <div className="mt-4 border-t border-white/10 pt-4">
            {renderLogout()}
          </div>
        </div>
      </aside>

      {/* ==============================================
          NAVIGATION INFÉRIEURE MOBILE

          Accueil
          Organisateurs
          Transactions
          Plus
      ============================================== */}

      <nav
        aria-label="Navigation rapide administrateur"
        className="fixed inset-x-0 bottom-0 z-[60] flex min-h-17.5 items-center justify-around border-t border-[#e5ebe5] bg-white px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-3px_15px_rgba(11,35,46,0.06)] lg:hidden"
      >
        {MOBILE_TABS.map((item) => {
          const Icon = item.icon;

          const active = isActiveRoute(
            pathname,
            item.href,
            item.href === "/admin"
          );

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={
                active ? "page" : undefined
              }
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2"
            >
              <span
                className={`flex size-9.75 items-center justify-center rounded-xl ${
                  active
                    ? "bg-[#dff9e0] text-[#087d2d]"
                    : "text-[#172739]"
                }`}
              >
                <Icon
                  size={23}
                  strokeWidth={
                    active ? 2.5 : 2
                  }
                />
              </span>

              <span
                className={`max-w-full truncate text-[10px] ${
                  active
                    ? "font-black text-[#087d2d]"
                    : "font-semibold text-[#27394c]"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() =>
            setDrawerOpen(true)
          }
          aria-label="Afficher tous les menus"
          aria-expanded={drawerOpen}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2"
        >
          <span
            className={`flex size-9.75 items-center justify-center rounded-xl ${
              drawerOpen
                ? "bg-[#dff9e0] text-[#087d2d]"
                : "text-[#172739]"
            }`}
          >
            <LayoutGrid size={23} />
          </span>

          <span
            className={`text-[10px] ${
              drawerOpen
                ? "font-black text-[#087d2d]"
                : "font-semibold text-[#27394c]"
            }`}
          >
            Plus
          </span>
        </button>
      </nav>
    </>
  );
}
