"use client";

import {
  AlertTriangle,
  CalendarDays,
  CreditCard,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import PaymentProviderBadge from "./payment-provider-badge";
import PaymentStatusBadge from "./payment-status-badge";

type AdminPaymentDetail = Awaited<
  ReturnType<
    typeof import(
      "@/lib/admin/payments/get-admin-payment"
    ).getAdminPayment
  >
>;

function formatMoney(
  amount: string,
  currency: string,
): string {
  const numeric =
    Number(amount);

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",

        currency,

        maximumFractionDigits:
          2,
      },
    ).format(
      numeric,
    );
  } catch {
    return `${numeric.toLocaleString(
      "fr-FR",
    )} ${currency}`;
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
      : new Date(
          value,
        );

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
      dateStyle:
        "medium",

      timeStyle:
        "short",
    },
  ).format(
    date,
  );
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

export default function PaymentDetailsDialog({
  paymentId,
  open,
  onClose,
}: {
  paymentId:
    | string
    | null;

  open: boolean;

  onClose: () => void;
}) {
  const [
    payment,
    setPayment,
  ] =
    useState<AdminPaymentDetail | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(() => {
    if (
      !open ||
      !paymentId
    ) {
      setPayment(
        null,
      );

      setError("");

      setLoading(
        false,
      );

      return;
    }

    const normalizedPaymentId =
      paymentId;

    const controller =
      new AbortController();

    async function load() {
      setLoading(
        true,
      );

      setError("");

      setPayment(
        null,
      );

      try {
        const response =
          await fetch(
            `/api/admin/payments/${encodeURIComponent(
              normalizedPaymentId,
            )}`,
            {
              cache:
                "no-store",

              signal:
                controller.signal,
            },
          );

        const payload =
          (await response.json()) as {
            success?: boolean;

            data?:
              AdminPaymentDetail;

            error?:
              | {
                  message?:
                    string;
                }
              | string;
          };

        if (
          !response.ok ||
          !payload.success ||
          !payload.data
        ) {
          const message =
            typeof payload.error ===
            "string"
              ? payload.error
              : payload.error
                  ?.message;

          throw new Error(
            message ||
              "Impossible de charger le paiement.",
          );
        }

        setPayment(
          payload.data,
        );
      } catch (
        caught
      ) {
        if (
          controller.signal
            .aborted
        ) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger le paiement.",
        );
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(
            false,
          );
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [
    open,
    paymentId,
  ]);

  if (
    !open ||
    !paymentId
  ) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Détails du paiement"
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={
          onClose
        }
        className="absolute inset-0 cursor-default"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[24px] border border-white/[0.09] bg-[#070b0e] shadow-2xl">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#070b0e]/95 p-5 backdrop-blur sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
              Transaction Tikemia
            </p>

            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
              Détails du paiement
            </h2>

            <p className="mt-1 text-xs text-neutral-600">
              {paymentId}
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/[0.05] hover:text-white"
            aria-label="Fermer les détails"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-sky-300" />
            </div>
          ) : null}

          {error ? (
            <div className="flex gap-3 rounded-2xl border border-red-400/15 bg-red-400/[0.06] p-4 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

              {error}
            </div>
          ) : null}

          {payment ? (
            <div className="space-y-4">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Statut
                  </p>

                  <div className="mt-3">
                    <PaymentStatusBadge
                      status={
                        payment.status
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Montant
                  </p>

                  <p className="mt-2 text-xl font-black text-white">
                    {formatMoney(
                      payment.amount,
                      payment.currency,
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Fournisseur
                  </p>

                  <div className="mt-3">
                    <PaymentProviderBadge
                      provider={
                        payment.provider
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Remboursements
                  </p>

                  <p className="mt-2 text-xl font-black text-white">
                    {formatMoney(
                      payment
                        .statistics
                        .refundedAmount,
                      payment.currency,
                    )}
                  </p>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <ReceiptText className="h-4 w-4 text-sky-300" />

                    Paiement
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="ID paiement"
                      value={
                        payment.id
                      }
                    />

                    <Info
                      label="Méthode"
                      value={
                        payment.method
                      }
                    />

                    <Info
                      label="Référence fournisseur"
                      value={
                        payment.providerReference
                      }
                    />

                    <Info
                      label="Transaction fournisseur"
                      value={
                        payment.providerTransactionId
                      }
                    />

                    <Info
                      label="Initiation"
                      value={formatDate(
                        payment.initiatedAt,
                      )}
                    />

                    <Info
                      label="Paiement confirmé"
                      value={formatDate(
                        payment.paidAt,
                      )}
                    />

                    <Info
                      label="Expiration"
                      value={formatDate(
                        payment.expiresAt,
                      )}
                    />

                    <Info
                      label="Dernière mise à jour"
                      value={formatDate(
                        payment.updatedAt,
                      )}
                    />
                  </div>

                  {payment.failureReason ? (
                    <div className="mt-5 rounded-xl border border-red-400/15 bg-red-400/[0.05] p-4">
                      <p className="text-xs font-black text-red-300">
                        Échec du paiement
                      </p>

                      <p className="mt-2 text-sm leading-6 text-neutral-400">
                        {payment.failureReason}
                      </p>

                      {payment.failureCode ? (
                        <p className="mt-1 text-xs text-neutral-600">
                          Code :{" "}
                          {payment.failureCode}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <UserRound className="h-4 w-4 text-emerald-300" />

                    Client et commande
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Client"
                      value={
                        payment.order
                          .customerName
                      }
                    />

                    <Info
                      label="Commande"
                      value={
                        payment.order
                          .reference
                      }
                    />

                    <Info
                      label="E-mail"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-neutral-600" />

                          {
                            payment
                              .order
                              .customerEmail
                          }
                        </span>
                      }
                    />

                    <Info
                      label="Téléphone"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-neutral-600" />

                          {
                            payment
                              .order
                              .customerPhone
                          }
                        </span>
                      }
                    />

                    <Info
                      label="Sous-total"
                      value={formatMoney(
                        payment.order
                          .subtotal,
                        payment.order
                          .currency,
                      )}
                    />

                    <Info
                      label="Frais plateforme"
                      value={formatMoney(
                        payment.order
                          .platformFee,
                        payment.order
                          .currency,
                      )}
                    />

                    <Info
                      label="Total commande"
                      value={formatMoney(
                        payment.order
                          .total,
                        payment.order
                          .currency,
                      )}
                    />

                    <Info
                      label="Statut commande"
                      value={
                        payment.order
                          .status
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <CalendarDays className="h-4 w-4 text-amber-300" />

                    Événement
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Événement"
                      value={
                        payment.order
                          .event.title
                      }
                    />

                    <Info
                      label="Date"
                      value={formatDate(
                        payment.order
                          .event.startsAt,
                      )}
                    />

                    <Info
                      label="Lieu"
                      value={
                        <span className="inline-flex items-start gap-2">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-600" />

                          {[
                            payment.order
                              .event
                              .venueName,
                            payment.order
                              .event.city,
                            payment.order
                              .event.country,
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(
                              ", ",
                            )}
                        </span>
                      }
                    />

                    <Info
                      label="Organisateur"
                      value={
                        payment.order
                          .event
                          .organizer
                          .profile
                          ?.businessName ||
                        payment.order
                          .event
                          .organizer
                          .fullName
                      }
                    />

                    <Info
                      label="E-mail organisateur"
                      value={
                        payment.order
                          .event
                          .organizer
                          .email
                      }
                    />

                    <Info
                      label="Téléphone organisateur"
                      value={
                        payment.order
                          .event
                          .organizer
                          .phone
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <CreditCard className="h-4 w-4 text-violet-300" />

                    Activité technique
                  </h3>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      [
                        "Tentatives",
                        payment
                          .statistics
                          .attempts,
                      ],
                      [
                        "Webhooks",
                        payment
                          .statistics
                          .webhookEvents,
                      ],
                      [
                        "Remboursements",
                        payment
                          .statistics
                          .refunds,
                      ],
                      [
                        "Billets",
                        payment
                          .statistics
                          .tickets,
                      ],
                      [
                        "Livraisons",
                        payment
                          .statistics
                          .deliveries,
                      ],
                    ].map(
                      ([
                        label,
                        value,
                      ]) => (
                        <div
                          key={String(
                            label,
                          )}
                          className="rounded-xl border border-white/[0.06] bg-black/20 p-3"
                        >
                          <p className="text-[10px] font-bold uppercase text-neutral-600">
                            {label}
                          </p>

                          <p className="mt-1 text-lg font-black text-white">
                            {value}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="flex items-center gap-2 font-black text-white">
                  <Ticket className="h-4 w-4 text-emerald-300" />

                  Billetterie de la commande
                </h3>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.07] text-[10px] font-black uppercase tracking-wider text-neutral-600">
                        <th className="py-3 pr-4">
                          Catégorie
                        </th>

                        <th className="px-4 py-3">
                          Quantité
                        </th>

                        <th className="px-4 py-3">
                          Prix unitaire
                        </th>

                        <th className="px-4 py-3">
                          Frais
                        </th>

                        <th className="py-3 pl-4 text-right">
                          Total
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {payment.order.items.map(
                        (
                          item,
                        ) => (
                          <tr
                            key={
                              item.id
                            }
                            className="border-b border-white/[0.05] text-neutral-300"
                          >
                            <td className="py-3 pr-4 font-bold">
                              {
                                item
                                  .ticketType
                                  .name
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                item.quantity
                              }
                            </td>

                            <td className="px-4 py-3">
                              {formatMoney(
                                item.unitPrice,
                                payment
                                  .order
                                  .currency,
                              )}
                            </td>

                            <td className="px-4 py-3">
                              {formatMoney(
                                item.platformFee,
                                payment
                                  .order
                                  .currency,
                              )}
                            </td>

                            <td className="py-3 pl-4 text-right font-black text-white">
                              {formatMoney(
                                item.total,
                                payment
                                  .order
                                  .currency,
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