
"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import AdminNavigation from
  "@/components/admin/AdminNavigation";

/*
  TIKEMIA — ADMIN LAYOUT

  - Administration en français
  - Responsive PC / mobile
  - Connexion sans navigation
  - Confirmation email sans navigation
  - Contrôle de session
  - Navigation unique
  - Aucun contenu fictif
*/

const ADMIN_LOGIN = "/admin/login";

const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login",
  "/admin/confirm",
]);

const SESSION_CHECK_URL =
  "/api/admin/dashboard?session=1";

type AccessState =
  | "checking"
  | "authorized"
  | "error";

function cleanPath(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

function AdminLoading() {
  return (
    <div
      className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-[#f7f9fc]"
      role="status"
      aria-label="Vérification de l'accès administrateur"
    >
      <div className="flex size-17 items-center justify-center rounded-2xl bg-[#e7f8e9]">
        <ShieldCheck
          size={35}
          className="text-[#087d2d]"
        />
      </div>

      <LoaderCircle
        size={25}
        className="animate-spin text-[#087d2d]"
      />

      <span className="sr-only">
        Vérification de la session
      </span>
    </div>
  );
}

function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const normalizedPath = cleanPath(
    pathname ?? "/admin"
  );

  const isPublicPage =
    PUBLIC_ADMIN_PATHS.has(normalizedPath);

  const [access, setAccess] =
    useState<AccessState>("checking");

  useEffect(() => {


    let cancelled = false;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    async function verifyAccess() {


      try {
        const response = await fetch(
          SESSION_CHECK_URL,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (cancelled) {
          return;
        }

        if (response.status === 401 ||
            response.status === 403) {
          router.replace(ADMIN_LOGIN);
          return;
        }

        if (!response.ok) {
          /*
            Ne jamais afficher le
            dashboard lorsque la
            vérification a échoué.
          */
          setAccess("error");
          return;
        }

        const result: unknown =
          await response.json();

        if (
          !result ||
          typeof result !== "object" ||
          Array.isArray(result) ||
          !("success" in result) ||
          result.success !== true
        ) {
          setAccess("error");
          return;
        }

        setAccess("authorized");
      } catch {
        if (!cancelled) {
          setAccess("error");
        }
      }
    }

    void verifyAccess();

    return () => {
      window.clearTimeout(timeout);
      cancelled = true;
      controller.abort();
    };
  }, [isPublicPage, normalizedPath, router]);

  /*
    Connexion et confirmation :
    aucune sidebar, aucun menu,
    aucune navigation administrateur.
  */

  if (isPublicPage) {
    return (
      <div
        lang="fr"
        id="tikemia-admin-auth"
        className="min-h-dvh w-full bg-[#f7f9fc] text-[#102036]"
      >
        {children}
      </div>
    );
  }

  /*
    Affichage uniquement après
    vérification positive.
  */

  return (
    <div
      lang="fr"
      id="tikemia-admin"
      className="flex min-h-dvh w-full min-w-0 bg-[#f7f9fc] text-[#102036]"
    >
      {/*
        Navigation commune :

        PC :
        - Header supérieur
        - Sidebar à gauche

        Mobile :
        - Header compact
        - Menu hamburger
        - Navigation inférieure

        AdminNavigation sera rendu
        une seule fois.
      */}

      {access === "authorized" ? <AdminNavigation /> : access === "error" ? (
        <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-3 px-4"><p>Impossible de vérifier la session.</p><button type="button" className="rounded-xl bg-green-700 px-5 py-3 text-white" onClick={() => window.location.reload()}>Réessayer</button></div>
      ) : <AdminLoading />}

      {/*
        Contenu administrateur.

        Le dashboard et les futures
        pages de gestion s'affichent
        ici sans recréer le menu.
      */}

      <main
        id="tikemia-admin-content"
        hidden={access !== "authorized"}
        inert={access !== "authorized"}
        className="min-w-0 flex-1 overflow-x-hidden px-3 pb-24 pt-5 sm:px-5 md:pb-8 md:pt-6 xl:px-7"
      >
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
 const pathname = cleanPath(usePathname() ?? "/admin");
 if (PUBLIC_ADMIN_PATHS.has(pathname)) return <div lang="fr" id="tikemia-admin-auth" className="min-h-dvh w-full bg-[#f7f9fc] text-[#102036]">{children}</div>;
 return <ProtectedAdminLayout key={pathname}>{children}</ProtectedAdminLayout>;
}
