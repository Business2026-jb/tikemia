"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Crown,
  ExternalLink,
  Loader2,
  LockKeyhole,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  XCircle,
} from "lucide-react";
import {
  useRouter,
} from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
} from "react";

import type {
  OrganizerSubscriptionCheckout,
} from "@/lib/organizer/promotions/get-subscription-checkout";

type SubscriptionCheckoutClientProps =
  Readonly<{
    initialData:
      OrganizerSubscriptionCheckout;
    returnPaymentId?:
      | string
      | null;
    returnState?:
      | "return"
      | "cancelled"
      | null;
  }>;

type PaymentCreateSuccess =
  Readonly<{
    success: true;
    message: string;
    payment: {
      id: string;
      subscriptionId: string;
      provider: string;
      providerTransactionId:
        | string
        | null;
      providerReference:
        | string
        | null;
      checkoutUrl: string;
      returnUrl: string;
      cancelUrl: string;
      amount: string;
      currency: string;
      status: string;
      alreadyPrepared: boolean;
    };
  }>;

type PaymentCreateFailure =
  Readonly<{
    success: false;
    error?: {
      code?: string;
      message?: string;
      retryable?: boolean;
      provider?:
        | string
        | null;
      providerReference?:
        | string
        | null;
      paymentId?:
        | string
        | null;
      details?:
        Record<
          string,
          unknown
        >;
    };
    redirectTo?: string;
  }>;

type PaymentCreateResponse =
  | PaymentCreateSuccess
  | PaymentCreateFailure;

type Feedback =
  | {
      type:
        | "success"
        | "error"
        | "info";
      message: string;
    }
  | null;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function formatDate(
  value:
    | string
    | null,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function getBillingPeriodLabel(
  value: string,
): string {
  switch (
    value
      .trim()
      .toUpperCase()
  ) {
    case "ONE_TIME":
      return "Paiement unique";

    case "MONTHLY":
      return "Mensuel";

    case "QUARTERLY":
      return "Trimestriel";

    case "YEARLY":
      return "Annuel";

    default:
      return value;
  }
}

function getSubscriptionStatusLabel(
  value: string,
): string {
  switch (
    value
      .trim()
      .toUpperCase()
  ) {
    case "PENDING":
      return "En attente";

    case "ACTIVE":
      return "Actif";

    case "PAST_DUE":
      return "Paiement en retard";

    case "PAUSED":
      return "En pause";

    case "CANCELLED":
      return "Annulé";

    case "EXPIRED":
      return "Expiré";

    default:
      return value;
  }
}

function getPaymentStatusLabel(
  value:
    | string
    | null
    | undefined,
): string {
  switch (
    normalizeText(
      value,
    ).toUpperCase()
  ) {
    case "PENDING":
      return "En attente";

    case "SUCCESS":
      return "Payé";

    case "FAILED":
      return "Échec";

    case "REFUNDED":
      return "Remboursé";

    default:
      return "Aucun paiement";
  }
}

function isSafeCheckoutUrl(
  value: string,
): boolean {
  try {
    const url =
      new URL(value);

    return (
      url.protocol ===
        "https:" ||
      (
        process.env.NODE_ENV ===
          "development" &&
        url.protocol ===
          "http:"
      )
    );
  } catch {
    return false;
  }
}

async function parseJsonResponse(
  response: Response,
): Promise<
  PaymentCreateResponse | null
> {
  try {
    return (
      await response.json()
    ) as PaymentCreateResponse;
  } catch {
    return null;
  }
}

export default function SubscriptionCheckoutClient({
  initialData,
  returnPaymentId = null,
  returnState = null,
}: SubscriptionCheckoutClientProps) {
  const router =
    useRouter();

  const [
    isPreparingPayment,
    setIsPreparingPayment,
  ] =
    useState(false);

  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

  const [
    feedback,
    setFeedback,
  ] =
    useState<Feedback>(
      null,
    );

  const {
    organizer,
    subscription,
    plan,
    latestPayment,
    state,
  } = initialData;

  const includedFeatures =
    useMemo(
      () =>
        plan.features.filter(
          (feature) =>
            feature.included,
        ),
      [plan.features],
    );

  const paymentMatchesReturn =
    Boolean(
      returnPaymentId &&
        latestPayment?.id &&
        returnPaymentId ===
          latestPayment.id,
    );

  const isPaymentSuccessful =
    latestPayment?.status ===
    "SUCCESS";

  const isPaymentPending =
    latestPayment?.status ===
    "PENDING";

  const isPaymentFailed =
    latestPayment?.status ===
    "FAILED";

  const isPaymentRefunded =
    latestPayment?.status ===
    "REFUNDED";

  const canStartPayment =
    state.canPay &&
    !state.isActive &&
    !isPaymentSuccessful &&
    !isPaymentRefunded;

  const buttonLabel =
    isPreparingPayment
      ? "Préparation du paiement..."
      : isPaymentFailed
        ? "Réessayer le paiement"
        : state.hasReusableCheckout
          ? "Continuer le paiement"
          : "Continuer vers le paiement sécurisé";

  const refreshCheckout =
    useCallback(() => {
      if (
        isRefreshing ||
        isPreparingPayment
      ) {
        return;
      }

      setFeedback(null);
      setIsRefreshing(true);

      router.refresh();

      window.setTimeout(
        () => {
          setIsRefreshing(
            false,
          );
        },
        900,
      );
    }, [
      isPreparingPayment,
      isRefreshing,
      router,
    ]);

  async function handleCreatePayment() {
    if (
      !canStartPayment ||
      isPreparingPayment
    ) {
      return;
    }

    setFeedback(null);
    setIsPreparingPayment(
      true,
    );

    try {
      const response =
        await fetch(
          "/api/organizer/promotions/subscription/payment/create",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                subscriptionId:
                  subscription.id,
              }),
          },
        );

      const payload =
        await parseJsonResponse(
          response,
        );

      if (
        response.status ===
          401 &&
        payload &&
        !payload.success &&
        payload.redirectTo
      ) {
        router.push(
          payload.redirectTo,
        );
        return;
      }

      if (
        !response.ok ||
        !payload ||
        !payload.success
      ) {
        const message =
          payload &&
          !payload.success
            ? payload.error
                ?.message
            : null;

        throw new Error(
          message ||
            "Impossible de préparer le paiement sécurisé pour le moment.",
        );
      }

      const checkoutUrl =
        normalizeText(
          payload.payment
            .checkoutUrl,
        );

      if (
        !checkoutUrl ||
        !isSafeCheckoutUrl(
          checkoutUrl,
        )
      ) {
        throw new Error(
          "L’adresse du paiement sécurisé retournée par le prestataire est invalide.",
        );
      }

      setFeedback({
        type: "success",
        message:
          payload.payment
            .alreadyPrepared
            ? "Votre paiement est déjà prêt. Redirection vers le prestataire sécurisé..."
            : "Paiement sécurisé préparé. Redirection vers le prestataire...",
      });

      window.location.assign(
        checkoutUrl,
      );
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof
            Error
            ? error.message
            : "Impossible de préparer le paiement sécurisé pour le moment.",
      });

      setIsPreparingPayment(
        false,
      );
    }
  }

  return (
    <div className="w-full space-y-5 pb-6 sm:space-y-6">
      <CheckoutReturnBanner
        returnState={
          returnState
        }
        paymentMatchesReturn={
          paymentMatchesReturn
        }
        isPaymentSuccessful={
          isPaymentSuccessful
        }
        isSubscriptionActive={
          state.isActive
        }
        onRefresh={
          refreshCheckout
        }
        refreshing={
          isRefreshing
        }
      />

      <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#071015]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-orange-500/[0.06]"
        />

        <div className="relative flex flex-col gap-5 border-b border-white/[0.07] px-4 py-5 sm:px-5 sm:py-6 lg:flex-row lg:items-start lg:justify-between lg:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-lime-400">
                <Sparkles className="h-3 w-3" />
                Visibilité Premium
              </span>

              <StatusBadge
                status={
                  subscription.status
                }
                type="subscription"
              />

              {organizer.hasBlueBadge ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/[0.08] px-2.5 py-1 text-[10px] font-black text-sky-300">
                  <BadgeCheck className="h-3 w-3" />
                  Badge bleu acquis
                </span>
              ) : null}
            </div>

            <h1 className="mt-4 text-xl font-black tracking-[-0.035em] text-white sm:text-2xl lg:text-[28px]">
              Finalisez votre abonnement Premium
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Vérifiez votre formule puis continuez vers le paiement sécurisé. L’activation est effectuée automatiquement après confirmation du paiement par Tikemia.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={
                refreshCheckout
              }
              disabled={
                isRefreshing ||
                isPreparingPayment
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 text-xs font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCcw
                className={`h-3.5 w-3.5 ${
                  isRefreshing
                    ? "animate-spin"
                    : ""
                }`}
              />
              Actualiser
            </button>

            <Link
              href="/organizer/promotions"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 text-xs font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour
            </Link>
          </div>
        </div>

        <div className="relative grid gap-5 p-4 sm:p-5 lg:p-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0 space-y-5">
            <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
              <div className="flex flex-col gap-4 border-b border-white/[0.06] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-lime-400">
                      <Crown className="h-4 w-4" />
                    </span>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-neutral-600">
                        Formule sélectionnée
                      </p>

                      <h2 className="mt-0.5 text-lg font-black tracking-[-0.025em] text-white">
                        {plan.name}
                      </h2>
                    </div>
                  </div>

                  {plan.description ? (
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-500">
                      {
                        plan.description
                      }
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0 sm:text-right">
                  <p className="text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                    {
                      plan.priceFormatted
                    }
                  </p>

                  <p className="mt-1 text-[11px] font-medium text-neutral-600">
                    {
                      getBillingPeriodLabel(
                        plan.billingPeriod,
                      )
                    }
                  </p>
                </div>
              </div>

              <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
                <PlanMetric
                  icon={
                    CalendarDays
                  }
                  label="Durée"
                  value={`${plan.durationDays} jour${
                    plan.durationDays >
                    1
                      ? "s"
                      : ""
                  }`}
                />

                <PlanMetric
                  icon={
                    TicketCheck
                  }
                  label="Événements promus"
                  value={`${plan.maxBoostedEvents} maximum`}
                />

                <PlanMetric
                  icon={
                    RotateCcw
                  }
                  label="Renouvellement"
                  value={
                    subscription.autoRenew
                      ? "Automatique"
                      : "Désactivé"
                  }
                />

                <PlanMetric
                  icon={
                    ShieldCheck
                  }
                  label="Activation"
                  value="Après paiement"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-white">
                    Avantages inclus
                  </h2>

                  <p className="mt-1 text-[11px] leading-5 text-neutral-600">
                    Les avantages appliqués à cette formule sont chargés directement depuis Tikemia.
                  </p>
                </div>

                <span className="rounded-full border border-white/[0.07] bg-black/20 px-2.5 py-1 text-[10px] font-black text-neutral-500">
                  {
                    includedFeatures.length
                  }{" "}
                  avantage
                  {includedFeatures.length >
                  1
                    ? "s"
                    : ""}
                </span>
              </div>

              {includedFeatures.length >
              0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {includedFeatures.map(
                    (
                      feature,
                    ) => (
                      <div
                        key={
                          feature.key
                        }
                        className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-black/15 p-3.5"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-lime-400">
                          <Check className="h-3 w-3" />
                        </span>

                        <div className="min-w-0">
                          <p className="text-xs font-black text-neutral-300">
                            {
                              feature.label
                            }
                          </p>

                          {feature.description ? (
                            <p className="mt-1 text-[11px] leading-5 text-neutral-600">
                              {
                                feature.description
                              }
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/15 p-4 text-xs leading-5 text-neutral-600">
                  Les détails supplémentaires de cette formule seront appliqués automatiquement après activation.
                </div>
              )}
            </section>

            <PaymentHistoryCard
              latestPayment={
                latestPayment
              }
            />
          </div>

          <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
            <section className="relative overflow-hidden rounded-2xl border border-emerald-500/15 bg-[#081116] shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.08] via-transparent to-orange-500/[0.06]"
              />

              <div className="relative border-b border-white/[0.07] px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-lime-400">
                    <CreditCard className="h-4.5 w-4.5" />
                  </span>

                  <div>
                    <h2 className="text-sm font-black text-white">
                      Récapitulatif
                    </h2>

                    <p className="mt-0.5 text-[10px] text-neutral-600">
                      Paiement sécurisé
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative p-4 sm:p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.08em] text-neutral-600">
                  Total à payer
                </p>

                <p className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">
                  {
                    plan.priceFormatted
                  }
                </p>

                <div className="mt-5 space-y-3 border-t border-white/[0.07] pt-4">
                  <SummaryRow
                    label="Formule"
                    value={
                      plan.name
                    }
                  />

                  <SummaryRow
                    label="Période"
                    value={
                      getBillingPeriodLabel(
                        plan.billingPeriod,
                      )
                    }
                  />

                  <SummaryRow
                    label="Durée"
                    value={`${plan.durationDays} jours`}
                  />

                  <SummaryRow
                    label="Devise"
                    value={
                      plan.currency
                    }
                  />

                  <SummaryRow
                    label="Abonnement"
                    value={
                      getSubscriptionStatusLabel(
                        subscription.status,
                      )
                    }
                  />

                  <SummaryRow
                    label="Paiement"
                    value={
                      getPaymentStatusLabel(
                        latestPayment?.status,
                      )
                    }
                  />
                </div>

                <PaymentStateNotice
                  state={
                    state
                  }
                  latestPayment={
                    latestPayment
                  }
                />

                {feedback ? (
                  <div
                    role={
                      feedback.type ===
                      "error"
                        ? "alert"
                        : "status"
                    }
                    className={`mt-4 rounded-xl border px-3.5 py-3 text-xs leading-5 ${
                      feedback.type ===
                      "error"
                        ? "border-red-500/25 bg-red-500/[0.08] text-red-200"
                        : feedback.type ===
                            "success"
                          ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-200"
                          : "border-sky-500/20 bg-sky-500/[0.07] text-sky-200"
                    }`}
                  >
                    {
                      feedback.message
                    }
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={
                    handleCreatePayment
                  }
                  disabled={
                    !canStartPayment ||
                    isPreparingPayment ||
                    isRefreshing
                  }
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-4 text-sm font-black text-white shadow-[0_16px_44px_rgba(34,197,94,0.18)] transition hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/70 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
                >
                  {isPreparingPayment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isPaymentFailed ? (
                    <RotateCcw className="h-4 w-4" />
                  ) : (
                    <LockKeyhole className="h-4 w-4" />
                  )}

                  {
                    buttonLabel
                  }

                  {!isPreparingPayment &&
                  canStartPayment ? (
                    <ExternalLink className="h-3.5 w-3.5" />
                  ) : null}
                </button>

                {!canStartPayment ? (
                  <NonPayableAction
                    state={
                      state
                    }
                    latestPayment={
                      latestPayment
                    }
                  />
                ) : null}

                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-black/15 p-3.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

                  <p className="text-[10px] leading-5 text-neutral-600">
                    Le montant est vérifié côté serveur. Votre abonnement est activé uniquement après confirmation sécurisée du paiement par le prestataire et Tikemia.
                  </p>
                </div>
              </div>
            </section>

            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-neutral-700">
              <LockKeyhole className="h-3 w-3" />
              Transaction sécurisée
              <span aria-hidden="true">
                •
              </span>
              {
                organizer.email
              }
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function CheckoutReturnBanner({
  returnState,
  paymentMatchesReturn,
  isPaymentSuccessful,
  isSubscriptionActive,
  onRefresh,
  refreshing,
}: {
  returnState:
    | "return"
    | "cancelled"
    | null;
  paymentMatchesReturn: boolean;
  isPaymentSuccessful: boolean;
  isSubscriptionActive: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (!returnState) {
    return null;
  }

  if (
    returnState ===
      "cancelled"
  ) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" />

          <div>
            <p className="text-sm font-black text-orange-200">
              Paiement interrompu
            </p>

            <p className="mt-1 text-xs leading-5 text-orange-200/60">
              Vous êtes revenu du prestataire sans confirmation de paiement. Vous pouvez reprendre le paiement lorsque vous le souhaitez.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (
    isPaymentSuccessful &&
    isSubscriptionActive
  ) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />

        <div>
          <p className="text-sm font-black text-emerald-200">
            Paiement confirmé
          </p>

          <p className="mt-1 text-xs leading-5 text-emerald-200/60">
            Votre abonnement Premium est actif. Vous pouvez maintenant retourner à Visibilité Premium pour promouvoir vos événements.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />

        <div>
          <p className="text-sm font-black text-sky-200">
            Vérification du paiement
          </p>

          <p className="mt-1 text-xs leading-5 text-sky-200/60">
            {paymentMatchesReturn
              ? "Tikemia vérifie le statut réel du paiement. Le retour du prestataire ne constitue pas à lui seul une confirmation."
              : "La page a été ouverte après un retour de paiement. Actualisez pour récupérer le statut confirmé par le serveur."}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={
          onRefresh
        }
        disabled={
          refreshing
        }
        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-3 text-xs font-black text-sky-200 transition hover:bg-sky-400/[0.1] disabled:opacity-50"
      >
        <RefreshCcw
          className={`h-3.5 w-3.5 ${
            refreshing
              ? "animate-spin"
              : ""
          }`}
        />
        Vérifier
      </button>
    </div>
  );
}

function StatusBadge({
  status,
  type,
}: {
  status: string;
  type:
    | "subscription"
    | "payment";
}) {
  const normalized =
    status
      .trim()
      .toUpperCase();

  const success =
    normalized ===
      "ACTIVE" ||
    normalized ===
      "SUCCESS";

  const warning =
    normalized ===
      "PENDING" ||
    normalized ===
      "PAST_DUE";

  const neutral =
    normalized ===
      "PAUSED";

  const label =
    type ===
    "subscription"
      ? getSubscriptionStatusLabel(
          status,
        )
      : getPaymentStatusLabel(
          status,
        );

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${
        success
          ? "border-emerald-500/20 bg-emerald-500/[0.08] text-lime-400"
          : warning
            ? "border-orange-500/20 bg-orange-500/[0.08] text-orange-300"
            : neutral
              ? "border-sky-500/20 bg-sky-500/[0.07] text-sky-300"
              : "border-red-500/20 bg-red-500/[0.07] text-red-300"
      }`}
    >
      {success ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : warning ? (
        <Clock3 className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}

      {label}
    </span>
  );
}

function PlanMetric({
  icon: Icon,
  label,
  value,
}: {
  icon:
    typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[#081116] p-4">
      <div className="flex items-center gap-2 text-neutral-600">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-black uppercase tracking-[0.06em]">
          {label}
        </span>
      </div>

      <p className="mt-2 text-xs font-black text-neutral-300">
        {value}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] text-neutral-600">
        {label}
      </span>

      <span className="max-w-[60%] text-right text-[11px] font-black text-neutral-300">
        {value}
      </span>
    </div>
  );
}

function PaymentHistoryCard({
  latestPayment,
}: {
  latestPayment:
    OrganizerSubscriptionCheckout["latestPayment"];
}) {
  if (!latestPayment) {
    return (
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-black/20 text-neutral-500">
            <CreditCard className="h-4 w-4" />
          </span>

          <div>
            <h2 className="text-sm font-black text-white">
              Paiement
            </h2>

            <p className="mt-1 text-xs leading-5 text-neutral-600">
              Aucun paiement n’a encore été préparé pour cette souscription.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-black/20 text-neutral-500">
            <CreditCard className="h-4 w-4" />
          </span>

          <div>
            <h2 className="text-sm font-black text-white">
              Dernier paiement
            </h2>

            <p className="mt-1 text-[11px] text-neutral-600">
              Créé le{" "}
              {
                formatDate(
                  latestPayment.createdAt,
                )
              }
            </p>
          </div>
        </div>

        <StatusBadge
          status={
            latestPayment.status
          }
          type="payment"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PaymentDetail
          label="Montant"
          value={
            latestPayment.amountFormatted
          }
        />

        <PaymentDetail
          label="Prestataire"
          value={
            latestPayment.provider ||
            "—"
          }
        />

        <PaymentDetail
          label="Référence"
          value={
            latestPayment.providerReference ||
            "En attente"
          }
        />

        <PaymentDetail
          label="Confirmé le"
          value={
            formatDate(
              latestPayment.paidAt,
            )
          }
        />
      </div>

      {latestPayment.failureReason ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3.5 py-3 text-xs leading-5 text-red-200">
          {
            latestPayment.failureReason
          }
        </div>
      ) : null}
    </section>
  );
}

function PaymentDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.06em] text-neutral-700">
        {label}
      </p>

      <p className="mt-1.5 break-words text-[11px] font-black text-neutral-400">
        {value}
      </p>
    </div>
  );
}

function PaymentStateNotice({
  state,
  latestPayment,
}: {
  state:
    OrganizerSubscriptionCheckout["state"];
  latestPayment:
    OrganizerSubscriptionCheckout["latestPayment"];
}) {
  if (
    state.isActive &&
    state.alreadyPaid
  ) {
    return (
      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-3.5">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

        <p className="text-[11px] leading-5 text-emerald-200/70">
          Paiement confirmé. Votre abonnement Premium est actif.
        </p>
      </div>
    );
  }

  if (
    latestPayment?.status ===
    "FAILED"
  ) {
    return (
      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />

        <p className="text-[11px] leading-5 text-red-200/70">
          La dernière tentative de paiement a échoué. Vous pouvez relancer un paiement sécurisé.
        </p>
      </div>
    );
  }

  if (
    state.paymentRefunded
  ) {
    return (
      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-orange-500/20 bg-orange-500/[0.06] p-3.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />

        <p className="text-[11px] leading-5 text-orange-200/70">
          Ce paiement a été remboursé. Retournez à Visibilité Premium pour choisir une nouvelle formule si nécessaire.
        </p>
      </div>
    );
  }

  if (
    latestPayment?.status ===
    "PENDING"
  ) {
    return (
      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-3.5">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />

        <p className="text-[11px] leading-5 text-sky-200/70">
          Un paiement est actuellement en attente. Tikemia vérifiera sa confirmation côté serveur.
        </p>
      </div>
    );
  }

  return null;
}

function NonPayableAction({
  state,
  latestPayment,
}: {
  state:
    OrganizerSubscriptionCheckout["state"];
  latestPayment:
    OrganizerSubscriptionCheckout["latestPayment"];
}) {
  if (
    state.isActive &&
    latestPayment?.status ===
      "SUCCESS"
  ) {
    return (
      <Link
        href="/organizer/promotions"
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 text-xs font-black text-lime-400 transition hover:bg-emerald-500/[0.1]"
      >
        <Sparkles className="h-4 w-4" />
        Promouvoir mes événements
      </Link>
    );
  }

  return (
    <Link
      href="/organizer/promotions"
      className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-xs font-black text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      Retour à Visibilité Premium
    </Link>
  );
}