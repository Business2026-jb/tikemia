"use client";

import {
  AlertTriangle,
  Building2,
  CalendarDays,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import PayoutMethodBadge from "./payout-method-badge";
import PayoutStatusBadge from "./payout-status-badge";

type AdminPayoutDetail =
  Awaited<
    ReturnType<
      typeof import(
        "@/lib/admin/payouts/get-admin-payout"
      ).getAdminPayout
    >
  >;

function formatMoney(
  amount: string,
  currency: string,
): string {
  const numeric =
    Number(amount);

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      },
    ).format(
      numeric,
    );
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatDate(
  value:
    | Date
    | string
    | null
    | undefined,
): string {
  if (!value) {
    return "-";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
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
        {value ||
          "-"}
      </div>
    </div>
  );
}

export default function PayoutDetailsDialog({
  payoutId,
  open,
  onClose,
}: {
  payoutId:
    | string
    | null;
  open:
    boolean;
  onClose:
    () => void;
}) {
  const [
    payout,
    setPayout,
  ] =
    useState<AdminPayoutDetail | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    if (
      !open ||
      !payoutId
    ) {
      setPayout(null);
      setError("");
      setLoading(false);
      return;
    }

    const normalizedPayoutId =
      payoutId;

    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setPayout(null);

      try {
        const response =
          await fetch(
            `/api/admin/payouts/${encodeURIComponent(
              normalizedPayoutId,
            )}`,
            {
              cache: "no-store",
              signal:
                controller.signal,
            },
          );

        const payload =
          (await response.json()) as {
            success?: boolean;
            data?:
              AdminPayoutDetail;
            error?:
              | {
                  message?: string;
                }
              | string;
          };

        if (
          !response.ok ||
          !payload.success ||
          !payload.data
        ) {
          throw new Error(
            typeof payload.error ===
            "string"
              ? payload.error
              : payload.error?.message ||
                  "Impossible de charger le retrait.",
          );
        }

        setPayout(
          payload.data,
        );
      } catch (caught) {
        if (
          controller.signal
            .aborted
        ) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger le retrait.",
        );
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [
    open,
    payoutId,
  ]);

  if (
    !open ||
    !payoutId
  ) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6">
      <button
        type="button"
        aria-label="Fermer"
        onClick={
          onClose
        }
        className="absolute inset-0"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[24px] border border-white/[0.09] bg-[#070b0e] shadow-2xl">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#070b0e]/95 p-5 backdrop-blur sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              Retrait organisateur
            </p>

            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
              Détails de la demande
            </h2>

            <p className="mt-1 text-xs text-neutral-600">
              {payoutId}
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-amber-300" />
            </div>
          ) : null}

          {error ? (
            <div className="flex gap-3 rounded-2xl border border-red-400/15 bg-red-400/[0.06] p-4 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

              {error}
            </div>
          ) : null}

          {payout ? (
            <div className="space-y-4">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Statut
                  </p>

                  <div className="mt-3">
                    <PayoutStatusBadge
                      status={
                        payout.status
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Montant demandé
                  </p>

                  <p className="mt-2 text-xl font-black text-white">
                    {formatMoney(
                      payout.amount,
                      payout.currency,
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Montant net
                  </p>

                  <p className="mt-2 text-xl font-black text-emerald-300">
                    {formatMoney(
                      payout.netAmount,
                      payout.currency,
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Méthode
                  </p>

                  <div className="mt-3">
                    <PayoutMethodBadge
                      type={
                        payout.destinationType
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <ReceiptText className="h-4 w-4 text-amber-300" />

                    Demande
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Référence"
                      value={
                        payout.reference
                      }
                    />

                    <Info
                      label="Frais"
                      value={formatMoney(
                        payout.fee,
                        payout.currency,
                      )}
                    />

                    <Info
                      label="Date de demande"
                      value={formatDate(
                        payout.requestedAt,
                      )}
                    />

                    <Info
                      label="Date de traitement"
                      value={formatDate(
                        payout.processedAt,
                      )}
                    />

                    <Info
                      label="Note organisateur"
                      value={
                        payout.note
                      }
                    />

                    <Info
                      label="Note administrative"
                      value={
                        payout.adminNote
                      }
                    />
                  </div>

                  {payout.rejectionReason ? (
                    <div className="mt-5 rounded-xl border border-red-400/15 bg-red-400/[0.05] p-4">
                      <p className="text-xs font-black text-red-300">
                        Motif du refus
                      </p>

                      <p className="mt-2 text-sm leading-6 text-neutral-400">
                        {payout.rejectionReason}
                      </p>
                    </div>
                  ) : null}

                  {payout.informationRequest ? (
                    <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-4">
                      <p className="text-xs font-black text-amber-300">
                        Informations demandées
                      </p>

                      <p className="mt-2 text-sm leading-6 text-neutral-400">
                        {payout.informationRequest.message}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <UserRound className="h-4 w-4 text-sky-300" />

                    Organisateur
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Nom"
                      value={
                        payout.organizer
                          .fullName
                      }
                    />

                    <Info
                      label="Entreprise"
                      value={
                        payout.organizer
                          .profile
                          ?.businessName
                      }
                    />

                    <Info
                      label="E-mail"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-neutral-600" />

                          {payout.organizer.email}
                        </span>
                      }
                    />

                    <Info
                      label="Téléphone"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-neutral-600" />

                          {payout.organizer.phone}
                        </span>
                      }
                    />

                    <Info
                      label="Pays"
                      value={
                        payout.organizer
                          .country
                      }
                    />

                    <Info
                      label="Compte actif"
                      value={
                        payout.organizer
                          .isActive
                          ? "Oui"
                          : "Non"
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <Building2 className="h-4 w-4 text-emerald-300" />

                    Destination
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Titulaire"
                      value={
                        payout.destination
                          ?.accountName
                      }
                    />

                    <Info
                      label="Banque"
                      value={
                        payout.destination
                          ?.bankName
                      }
                    />

                    <Info
                      label="Compte"
                      value={
                        payout.destination
                          ?.bankAccountNumberLast4
                          ? `•••• ${payout.destination.bankAccountNumberLast4}`
                          : null
                      }
                    />

                    <Info
                      label="IBAN"
                      value={
                        payout.destination
                          ?.ibanLast4
                          ? `•••• ${payout.destination.ibanLast4}`
                          : null
                      }
                    />

                    <Info
                      label="Mobile Money"
                      value={
                        payout.destination
                          ?.mobileProvider
                      }
                    />

                    <Info
                      label="Téléphone"
                      value={
                        payout.destination
                          ?.phoneNumberLast4
                          ? `•••• ${payout.destination.phoneNumberLast4}`
                          : null
                      }
                    />

                    <Info
                      label="Réseau crypto"
                      value={
                        payout.destination
                          ?.cryptoNetwork
                      }
                    />

                    <Info
                      label="Adresse crypto"
                      value={
                        payout.destination
                          ?.cryptoAddressLast6
                          ? `•••••• ${payout.destination.cryptoAddressLast6}`
                          : null
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <WalletCards className="h-4 w-4 text-violet-300" />

                    Revenus organisateur
                  </h3>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                      <p className="text-[10px] font-bold uppercase text-neutral-600">
                        Événements
                      </p>

                      <p className="mt-1 text-lg font-black text-white">
                        {payout.revenueSummary.eventsCount}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                      <p className="text-[10px] font-bold uppercase text-neutral-600">
                        Commandes payées
                      </p>

                      <p className="mt-1 text-lg font-black text-white">
                        {payout.revenueSummary.paidOrdersCount}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                      <p className="text-[10px] font-bold uppercase text-neutral-600">
                        Revenus bruts
                      </p>

                      <p className="mt-1 text-lg font-black text-white">
                        {formatMoney(
                          payout.revenueSummary
                            .grossRevenue,
                          payout.currency,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                      <p className="text-[10px] font-bold uppercase text-neutral-600">
                        Revenus nets estimés
                      </p>

                      <p className="mt-1 text-lg font-black text-emerald-300">
                        {formatMoney(
                          payout.revenueSummary
                            .estimatedNetRevenue,
                          payout.currency,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="flex items-center gap-2 font-black text-white">
                  <CalendarDays className="h-4 w-4 text-amber-300" />

                  Événements générateurs de revenus
                </h3>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.07] text-[10px] font-black uppercase tracking-wider text-neutral-600">
                        <th className="py-3 pr-4">
                          Événement
                        </th>

                        <th className="px-4 py-3">
                          Lieu
                        </th>

                        <th className="px-4 py-3">
                          Commandes
                        </th>

                        <th className="px-4 py-3">
                          Brut
                        </th>

                        <th className="py-3 pl-4 text-right">
                          Net estimé
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {payout.revenueSummary.events.map(
                        (
                          event,
                        ) => (
                          <tr
                            key={
                              event.id
                            }
                            className="border-b border-white/[0.05] text-neutral-300"
                          >
                            <td className="py-3 pr-4 font-bold">
                              {event.title}
                            </td>

                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-neutral-600" />

                                {event.city},{" "}
                                {event.country}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              {event.paidOrders}
                            </td>

                            <td className="px-4 py-3">
                              {formatMoney(
                                event.grossRevenue,
                                event.currency,
                              )}
                            </td>

                            <td className="py-3 pl-4 text-right font-black text-white">
                              {formatMoney(
                                event.estimatedNetRevenue,
                                event.currency,
                              )}
                            </td>
                          </tr>
                        ),
                      )}
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
