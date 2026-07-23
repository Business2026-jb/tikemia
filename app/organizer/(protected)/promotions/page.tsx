import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Crown,
  Database,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { redirect } from "next/navigation";

import PromotionPageClient from "@/components/organizer/promotions/promotion-page-client";
import {
  getOrganizerPromotions,
  GetOrganizerPromotionsError,
  type GetOrganizerPromotionsResult,
} from "@/lib/organizer/promotions/get-organizer-promotions";

export const metadata: Metadata = {
  title: "Visibilité Premium | Tikemia",
  description:
    "Gérez votre abonnement Premium, vos événements promus et leurs performances depuis votre espace organisateur Tikemia.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PromotionsPageLoadSuccess = {
  success: true;
  data: GetOrganizerPromotionsResult;
};

type PromotionsPageLoadFailure = {
  success: false;
  message: string;
  code: string;
  status: number;
  redirectTo?: string;
};

type PromotionsPageLoadResult =
  | PromotionsPageLoadSuccess
  | PromotionsPageLoadFailure;

async function loadPromotionsPageData(): Promise<PromotionsPageLoadResult> {
  try {
    const data =
      await getOrganizerPromotions();

    return {
      success: true,
      data,
    };
  } catch (error) {
    if (
      error instanceof
      GetOrganizerPromotionsError
    ) {
      return {
        success: false,
        message: error.message,
        code: error.code,
        status: error.status,
        redirectTo:
          error.redirectTo,
      };
    }

    console.error(
      "[ORGANIZER_PROMOTIONS_PAGE_LOAD_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return {
      success: false,
      message:
        "Impossible de charger la Visibilité Premium pour le moment.",
      code:
        "GET_ORGANIZER_PROMOTIONS_FAILED",
      status: 500,
    };
  }
}

function shouldRedirectToLogin(
  result: PromotionsPageLoadFailure,
): boolean {
  return (
    result.status === 401 ||
    result.code === "UNAUTHORIZED" ||
    result.code === "INVALID_SESSION" ||
    result.code === "EXPIRED_SESSION"
  );
}

export default async function OrganizerPromotionsPage() {
  const result =
    await loadPromotionsPageData();

  if (!result.success) {
    if (
      shouldRedirectToLogin(result)
    ) {
      redirect(
        result.redirectTo ??
          "/organizer/login",
      );
    }

    if (result.redirectTo) {
      redirect(result.redirectTo);
    }

    return (
      <PromotionsPageLoadError
        message={result.message}
        code={result.code}
        status={result.status}
      />
    );
  }

  return (
    <main className="w-full min-w-0">
      <PromotionPageClient
        initialData={result.data}
      />
    </main>
  );
}

type PromotionsPageLoadErrorProps = {
  message: string;
  code: string;
  status: number;
};

type ErrorPresentation = {
  title: string;
  description: string;
  recommendation: string;
  icon:
    | "forbidden"
    | "network"
    | "database"
    | "generic";
};

function getErrorPresentation({
  code,
  status,
}: {
  code: string;
  status: number;
}): ErrorPresentation {
  if (
    status === 403 ||
    code === "FORBIDDEN"
  ) {
    return {
      title:
        "Accès Premium indisponible",
      description:
        "Votre compte organisateur ne dispose pas actuellement des autorisations nécessaires pour accéder à cette section.",
      recommendation:
        "Vérifiez que votre compte est actif, que votre adresse email est confirmée et que vous utilisez bien un compte organisateur.",
      icon: "forbidden",
    };
  }

  if (
    code ===
      "GET_SUBSCRIPTION_PLANS_FAILED" ||
    code ===
      "GET_ORGANIZER_PROMOTIONS_FAILED"
  ) {
    return {
      title:
        "Impossible de charger la page Premium",
      description:
        "Les données de votre abonnement, de vos promotions ou des formules disponibles n’ont pas pu être récupérées.",
      recommendation:
        "Vérifiez votre connexion, puis réessayez. Si le problème persiste, contrôlez la connexion Prisma et la présence de formules Premium actives dans la base de données.",
      icon: "database",
    };
  }

  if (
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return {
      title:
        "Service Premium temporairement indisponible",
      description:
        "Le service ne peut pas répondre pour le moment.",
      recommendation:
        "Patientez quelques instants puis actualisez la page.",
      icon: "network",
    };
  }

  return {
    title:
      "Impossible de charger la page Premium",
    description:
      "Une erreur inattendue empêche l’affichage des données Premium.",
    recommendation:
      "Actualisez la page. Si le problème continue, vérifiez les journaux du serveur et la configuration de la base de données.",
    icon: "generic",
  };
}

function PromotionsPageLoadError({
  message,
  code,
  status,
}: PromotionsPageLoadErrorProps) {
  const presentation =
    getErrorPresentation({
      code,
      status,
    });

  return (
    <main className="flex min-h-[calc(100dvh-160px)] w-full min-w-0 items-center justify-center py-6 sm:py-8">
      <section className="relative w-full max-w-[980px] overflow-hidden rounded-2xl border border-orange-500/20 bg-[#071015] shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-500/[0.08] via-transparent to-red-500/[0.05]"
        />

        <header className="relative border-b border-white/[0.07] px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10 text-orange-400">
              {presentation.icon ===
              "forbidden" ? (
                <ShieldCheck className="h-5 w-5" />
              ) : presentation.icon ===
                "network" ? (
                <WifiOff className="h-5 w-5" />
              ) : presentation.icon ===
                "database" ? (
                <Database className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-orange-300">
                  <Crown className="h-3 w-3" />
                  Visibilité Premium
                </span>

                <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold text-neutral-500">
                  {code}
                </span>
              </div>

              <h1 className="mt-3 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
                {presentation.title}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                {presentation.description}
              </p>
            </div>
          </div>
        </header>

        <div className="relative p-5 sm:p-6">
          <div
            role="alert"
            className="rounded-xl border border-orange-500/25 bg-orange-500/[0.07] px-4 py-3.5 text-sm leading-6 text-orange-200"
          >
            {message}
          </div>

          <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

              <div>
                <p className="text-xs font-black text-neutral-300">
                  Vérifications recommandées
                </p>

                <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                  {presentation.recommendation}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href="/organizer/dashboard"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au tableau de bord
            </Link>

            <Link
              href="/organizer/promotions"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_14px_40px_rgba(34,197,94,0.16)] transition hover:scale-[1.01]"
            >
              <RefreshCcw className="h-4 w-4" />
              Réessayer
            </Link>
          </div>
        </div>

        <footer className="relative flex flex-col gap-2 border-t border-white/[0.07] bg-black/15 px-5 py-3.5 text-[10px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-lime-400" />
            Tikemia — Espace organisateur sécurisé
          </span>

          <span>
            Statut HTTP : {status}
          </span>
        </footer>
      </section>
    </main>
  );
}