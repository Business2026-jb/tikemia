import type {
  Metadata,
} from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  redirect,
} from "next/navigation";

import SubscriptionCheckoutClient from "@/components/organizer/promotions/subscription-checkout-client";
import {
  getSubscriptionCheckout,
  GetSubscriptionCheckoutError,
  type OrganizerSubscriptionCheckout,
} from "@/lib/organizer/promotions/get-subscription-checkout";

export const metadata: Metadata = {
  title:
    "Paiement Visibilité Premium | Tikemia",
  description:
    "Finalisez votre abonnement Visibilité Premium depuis votre espace organisateur Tikemia.",
};

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";
export const revalidate = 0;

type CheckoutSearchParams =
  Readonly<{
    subscriptionId?:
      | string
      | string[];
    paymentId?:
      | string
      | string[];
    payment?:
      | string
      | string[];
  }>;

type OrganizerPromotionCheckoutPageProps =
  Readonly<{
    searchParams:
      Promise<CheckoutSearchParams>;
  }>;

type CheckoutPageLoadSuccess =
  Readonly<{
    success: true;
    data:
      OrganizerSubscriptionCheckout;
  }>;

type CheckoutPageLoadFailure =
  Readonly<{
    success: false;
    message: string;
    code: string;
    status: number;
    redirectTo?: string;
  }>;

type CheckoutPageLoadResult =
  | CheckoutPageLoadSuccess
  | CheckoutPageLoadFailure;

type CheckoutPaymentReturnState =
  | "return"
  | "cancelled"
  | null;

function readSingleSearchParam(
  value:
    | string
    | string[]
    | undefined,
): string | null {
  if (
    typeof value ===
    "string"
  ) {
    return (
      value.trim() ||
      null
    );
  }

  if (
    Array.isArray(value)
  ) {
    const first =
      value[0];

    return typeof first ===
        "string" &&
      first.trim()
      ? first.trim()
      : null;
  }

  return null;
}

function normalizePaymentReturnState(
  value:
    | string
    | null,
): CheckoutPaymentReturnState {
  const normalized =
    value
      ?.trim()
      .toLowerCase();

  if (
    normalized ===
      "return" ||
    normalized ===
      "cancelled"
  ) {
    return normalized;
  }

  return null;
}

async function loadCheckoutPageData(
  subscriptionId: string,
): Promise<CheckoutPageLoadResult> {
  try {
    const data =
      await getSubscriptionCheckout({
        subscriptionId,
      });

    return {
      success: true,
      data,
    };
  } catch (error) {
    if (
      error instanceof
      GetSubscriptionCheckoutError
    ) {
      return {
        success: false,
        message:
          error.message,
        code:
          error.code,
        status:
          error.status,
        redirectTo:
          error.redirectTo,
      };
    }

    console.error(
      "[ORGANIZER_SUBSCRIPTION_CHECKOUT_PAGE_LOAD_ERROR]",
      error instanceof
        Error
        ? {
            name:
              error.name,
            message:
              error.message,
            stack:
              process.env
                .NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return {
      success: false,
      message:
        "Impossible de charger le paiement de l’abonnement Premium pour le moment.",
      code:
        "GET_SUBSCRIPTION_CHECKOUT_FAILED",
      status: 500,
    };
  }
}

function shouldRedirectToLogin(
  result:
    CheckoutPageLoadFailure,
): boolean {
  return (
    result.status === 401 ||
    result.code ===
      "UNAUTHORIZED" ||
    result.code ===
      "INVALID_SESSION" ||
    result.code ===
      "EXPIRED_SESSION"
  );
}

export default async function OrganizerPromotionCheckoutPage({
  searchParams,
}: OrganizerPromotionCheckoutPageProps) {
  const params =
    await searchParams;

  const subscriptionId =
    readSingleSearchParam(
      params.subscriptionId,
    );

  const paymentId =
    readSingleSearchParam(
      params.paymentId,
    );

  const paymentState =
    normalizePaymentReturnState(
      readSingleSearchParam(
        params.payment,
      ),
    );

  /*
   * Cette route ne doit jamais inventer ou rechercher une souscription à la
   * place de l'organisateur. Le backend de création de souscription fournit
   * toujours explicitement subscriptionId dans redirectTo.
   */
  if (!subscriptionId) {
    return (
      <CheckoutPageLoadError
        message="L’identifiant de l’abonnement Premium est absent de l’adresse de paiement."
        code="SUBSCRIPTION_ID_REQUIRED"
        status={400}
      />
    );
  }

  const result =
    await loadCheckoutPageData(
      subscriptionId,
    );

  if (!result.success) {
    if (
      shouldRedirectToLogin(
        result,
      )
    ) {
      redirect(
        result.redirectTo ??
          "/organizer/login",
      );
    }

    /*
     * Les erreurs qui possèdent une destination sûre fournie par le backend
     * sont redirigées uniquement après le traitement spécifique des sessions.
     */
    if (
      result.redirectTo &&
      result.redirectTo !==
        "/organizer/promotions"
    ) {
      redirect(
        result.redirectTo,
      );
    }

    return (
      <CheckoutPageLoadError
        message={
          result.message
        }
        code={
          result.code
        }
        status={
          result.status
        }
      />
    );
  }

  /*
   * paymentId provient seulement de l'URL de retour Moneroo et sert à
   * l'affichage. SubscriptionCheckoutClient ne doit jamais s'en servir pour
   * décider qu'un paiement est réussi : l'état de référence reste celui
   * chargé depuis Prisma et confirmé par le webhook.
   */
  return (
    <main className="w-full min-w-0">
      <SubscriptionCheckoutClient
        initialData={
          result.data
        }
        returnPaymentId={
          paymentId
        }
        returnState={
          paymentState
        }
      />
    </main>
  );
}

type CheckoutPageLoadErrorProps =
  Readonly<{
    message: string;
    code: string;
    status: number;
  }>;

type ErrorPresentation =
  Readonly<{
    title: string;
    description: string;
    recommendation: string;
    icon:
      | "forbidden"
      | "not-found"
      | "payment"
      | "generic";
  }>;

function getErrorPresentation({
  code,
  status,
}: {
  code: string;
  status: number;
}): ErrorPresentation {
  if (
    status === 403 ||
    code ===
      "FORBIDDEN"
  ) {
    return {
      title:
        "Paiement Premium indisponible",
      description:
        "Votre compte organisateur ne dispose pas actuellement des autorisations nécessaires pour accéder à ce paiement.",
      recommendation:
        "Vérifiez que votre compte est actif, que votre adresse email est confirmée et que vous utilisez bien un compte organisateur.",
      icon:
        "forbidden",
    };
  }

  if (
    status === 404 ||
    code ===
      "SUBSCRIPTION_NOT_FOUND"
  ) {
    return {
      title:
        "Abonnement introuvable",
      description:
        "Cette demande d’abonnement Premium n’existe plus ou n’appartient pas à votre compte organisateur.",
      recommendation:
        "Retournez à Visibilité Premium et choisissez de nouveau une formule disponible.",
      icon:
        "not-found",
    };
  }

  if (
    code ===
      "SUBSCRIPTION_ID_REQUIRED"
  ) {
    return {
      title:
        "Paiement incomplet",
      description:
        "Aucune demande d’abonnement valide n’a été indiquée pour cette page.",
      recommendation:
        "Retournez à Visibilité Premium et sélectionnez une formule afin de créer correctement votre demande d’abonnement.",
      icon:
        "payment",
    };
  }

  if (
    code ===
      "GET_SUBSCRIPTION_CHECKOUT_FAILED" ||
    status >= 500
  ) {
    return {
      title:
        "Impossible de charger le paiement",
      description:
        "Les informations de votre abonnement Premium n’ont pas pu être récupérées pour le moment.",
      recommendation:
        "Actualisez la page dans quelques instants. Si le problème persiste, vérifiez la connexion Prisma et les journaux du serveur.",
      icon:
        "payment",
    };
  }

  return {
    title:
      "Paiement Premium indisponible",
    description:
      "Une erreur empêche actuellement l’ouverture du paiement de votre abonnement Premium.",
    recommendation:
      "Retournez à Visibilité Premium puis réessayez depuis la formule souhaitée.",
    icon:
      "generic",
  };
}

function CheckoutPageLoadError({
  message,
  code,
  status,
}: CheckoutPageLoadErrorProps) {
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
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-orange-500/[0.08]"
        />

        <header className="relative border-b border-white/[0.07] px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10 text-orange-400">
              {presentation.icon ===
              "forbidden" ? (
                <ShieldCheck className="h-5 w-5" />
              ) : presentation.icon ===
                "not-found" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : presentation.icon ===
                "payment" ? (
                <CreditCard className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-lime-400">
                  <Sparkles className="h-3 w-3" />
                  Visibilité Premium
                </span>

                <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold text-neutral-500">
                  {code}
                </span>
              </div>

              <h1 className="mt-3 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
                {
                  presentation.title
                }
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                {
                  presentation.description
                }
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
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

              <div>
                <p className="text-xs font-black text-neutral-300">
                  Paiement sécurisé
                </p>

                <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                  {
                    presentation.recommendation
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href="/organizer/promotions"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à Visibilité Premium
            </Link>

            <Link
              href="/organizer/promotions"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_14px_40px_rgba(34,197,94,0.16)] transition hover:scale-[1.01]"
            >
              <RefreshCcw className="h-4 w-4" />
              Choisir une formule
            </Link>
          </div>
        </div>

        <footer className="relative flex flex-col gap-2 border-t border-white/[0.07] bg-black/15 px-5 py-3.5 text-[10px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-lime-400" />
            Tikemia — Paiement organisateur sécurisé
          </span>

          <span>
            Statut HTTP : {status}
          </span>
        </footer>
      </section>
    </main>
  );
}