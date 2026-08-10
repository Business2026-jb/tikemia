"use client";

import {
  AlertTriangle,
  CalendarDays,
  CreditCard,
  LoaderCircle,
  Mail,
  Phone,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import SubscriptionPlanBadge from "./subscription-plan-badge";
import SubscriptionStatusBadge from "./subscription-status-badge";

type AdminSubscriptionDetail = Awaited<
  ReturnType<
    typeof import(
      "@/lib/admin/subscriptions/get-admin-subscription"
    ).getAdminSubscription
  >
>;

function formatMoney(amount: string, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatDate(
  value: Date | string | null | undefined,
) {
  if (!value) return "-";

  const date =
    value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Info({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-600">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-semibold text-neutral-300">
        {value || "-"}
      </div>
    </div>
  );
}

export default function SubscriptionDetailsDialog({
  subscriptionId,
  open,
  onClose,
}: {
  subscriptionId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [subscription, setSubscription] =
    useState<AdminSubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !subscriptionId) {
      setSubscription(null);
      setLoading(false);
      setError("");
      return;
    }

    const normalizedSubscriptionId = subscriptionId;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setSubscription(null);

      try {
        const response = await fetch(
          `/api/admin/subscriptions/${encodeURIComponent(
            normalizedSubscriptionId,
          )}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          success?: boolean;
          data?: AdminSubscriptionDetail;
          error?: { message?: string } | string;
        };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : payload.error?.message ||
                  "Impossible de charger l’abonnement.",
          );
        }

        setSubscription(payload.data);
      } catch (caught) {
        if (controller.signal.aborted) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger l’abonnement.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [open, subscriptionId]);

  if (!open || !subscriptionId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[24px] border border-white/[0.09] bg-[#070b0e] shadow-2xl">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#070b0e]/95 p-5 backdrop-blur sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
              Abonnement organisateur
            </p>
            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
              Détails de l’abonnement
            </h2>
            <p className="mt-1 text-xs text-neutral-600">
              {subscriptionId}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-violet-300" />
            </div>
          ) : null}

          {error ? (
            <div className="flex gap-3 rounded-2xl border border-red-400/15 bg-red-400/[0.06] p-4 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {subscription ? (
            <div className="space-y-4">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Statut
                  </p>
                  <div className="mt-3">
                    <SubscriptionStatusBadge
                      status={subscription.status}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Plan
                  </p>
                  <div className="mt-3">
                    <SubscriptionPlanBadge
                      name={subscription.plan.name}
                      code={subscription.plan.code}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Prix
                  </p>
                  <p className="mt-2 text-xl font-black text-white">
                    {formatMoney(
                      subscription.plan.price,
                      subscription.plan.currency,
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Total payé
                  </p>
                  <p className="mt-2 text-xl font-black text-emerald-300">
                    {formatMoney(
                      subscription.paymentSummary.totalPaid,
                      subscription.paymentSummary.currency,
                    )}
                  </p>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <UserRound className="h-4 w-4 text-sky-300" />
                    Organisateur
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Nom"
                      value={subscription.organizer.fullName}
                    />
                    <Info
                      label="Entreprise"
                      value={
                        subscription.organizer.profile?.businessName
                      }
                    />
                    <Info
                      label="E-mail"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-neutral-600" />
                          {subscription.organizer.email}
                        </span>
                      }
                    />
                    <Info
                      label="Téléphone"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-neutral-600" />
                          {subscription.organizer.phone}
                        </span>
                      }
                    />
                    <Info
                      label="Pays"
                      value={subscription.organizer.country}
                    />
                    <Info
                      label="Compte actif"
                      value={
                        subscription.organizer.isActive
                          ? "Oui"
                          : "Non"
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <CalendarDays className="h-4 w-4 text-amber-300" />
                    Période et renouvellement
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Début"
                      value={formatDate(subscription.startsAt)}
                    />
                    <Info
                      label="Fin"
                      value={formatDate(subscription.endsAt)}
                    />
                    <Info
                      label="Fin d’essai"
                      value={formatDate(subscription.trialEndsAt)}
                    />
                    <Info
                      label="Renouvellement auto"
                      value={subscription.autoRenew ? "Oui" : "Non"}
                    />
                    <Info
                      label="Annulé le"
                      value={formatDate(subscription.canceledAt)}
                    />
                    <Info
                      label="Motif d’annulation"
                      value={subscription.cancellationReason}
                    />
                  </div>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <Sparkles className="h-4 w-4 text-violet-300" />
                    Privilèges du plan
                  </h3>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Info
                      label="Événements boostés"
                      value={subscription.plan.maxBoostedEvents}
                    />
                    <Info
                      label="Score priorité"
                      value={subscription.plan.priorityScore}
                    />
                    <Info
                      label="Durée"
                      value={`${subscription.plan.durationDays} jours`}
                    />
                    <Info
                      label="Période"
                      value={subscription.plan.billingPeriod}
                    />
                  </div>

                  <pre className="mt-4 max-h-72 overflow-auto rounded-xl border border-white/[0.06] bg-black/25 p-4 text-xs leading-6 text-neutral-400">
                    {JSON.stringify(
                      subscription.plan.features,
                      null,
                      2,
                    )}
                  </pre>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <CreditCard className="h-4 w-4 text-emerald-300" />
                    Utilisation
                  </h3>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {[
                      ["Paiements", subscription.paymentSummary.totalPayments],
                      ["Paiements réussis", subscription.paymentSummary.successfulPayments],
                      ["Boosts", subscription.boostSummary.total],
                      ["Boosts actifs", subscription.boostSummary.active],
                      ["Boosts programmés", subscription.boostSummary.scheduled],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-xl border border-white/[0.06] bg-black/20 p-3"
                      >
                        <p className="text-[10px] font-bold uppercase text-neutral-600">
                          {label}
                        </p>
                        <p className="mt-1 text-lg font-black text-white">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="font-black text-white">
                  Paiements récents
                </h3>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.07] text-[10px] font-black uppercase tracking-wider text-neutral-600">
                        <th className="py-3 pr-4">Date</th>
                        <th className="px-4 py-3">Montant</th>
                        <th className="px-4 py-3">Fournisseur</th>
                        <th className="px-4 py-3">Référence</th>
                        <th className="py-3 pl-4 text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscription.payments.map((payment) => (
                        <tr
                          key={payment.id}
                          className="border-b border-white/[0.05] text-neutral-300"
                        >
                          <td className="py-3 pr-4">
                            {formatDate(payment.createdAt)}
                          </td>
                          <td className="px-4 py-3 font-black text-white">
                            {formatMoney(
                              payment.amount,
                              payment.currency,
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {payment.provider}
                          </td>
                          <td className="px-4 py-3">
                            {payment.providerReference || "-"}
                          </td>
                          <td className="py-3 pl-4 text-right">
                            {payment.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
