"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Download,
  MailCheck,
  MessageCircleMore,
  ReceiptText,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useSearchParams,
} from "next/navigation";

type PaymentStatusResponse = {
  success: boolean;

  payment?: {
    id: string;
    status: string;
    amount?: string;
    currency?: string;
  };

  order?: {
    id: string;
    reference: string;
    status: string;

    event?: {
      id: string;
      slug: string;
      title: string;
    };
  };

  tickets?: {
    ready: boolean;
    expected: number;
    issued: number;
    valid: number;
  };

  error?: {
    code?: string;
    message?: string;
  };

  message?: string;
};

type StoredPaymentContext = {
  paymentId?: string;
  orderId?: string;
  checkoutToken?: string;
};

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function readStoredPaymentContext(
  paymentId: string,
): StoredPaymentContext | null {
  if (
    typeof window ===
      "undefined" ||
    !paymentId
  ) {
    return null;
  }

  const keys = [
    `tikemia:payment:${paymentId}`,
    "tikemia:payment:current",
  ];

  for (
    const key of
    keys
  ) {
    const rawValue =
      window.sessionStorage.getItem(
        key,
      );

    if (!rawValue) {
      continue;
    }

    try {
      const parsed =
        JSON.parse(
          rawValue,
        ) as StoredPaymentContext;

      if (
        !parsed.paymentId ||
        parsed.paymentId ===
          paymentId
      ) {
        return parsed;
      }
    } catch {
      window.sessionStorage.removeItem(
        key,
      );
    }
  }

  return null;
}

function formatMoney({
  amount,
  currency,
}: {
  amount: string;
  currency: string;
}): string {
  const numericAmount =
    Number.parseFloat(
      amount,
    );

  const normalizedCurrency =
    normalizeText(
      currency,
    ).toUpperCase() ||
    "XOF";

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",

        currency:
          normalizedCurrency,

        maximumFractionDigits:
          normalizedCurrency ===
          "XOF"
            ? 0
            : 2,
      },
    ).format(
      Number.isFinite(
        numericAmount,
      )
        ? numericAmount
        : 0,
    );
  } catch {
    return `${amount} ${normalizedCurrency}`;
  }
}

function SuccessFallback() {
  return (
    <div className="flex min-h-[72vh] w-full items-center justify-center px-4 py-10">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/[0.08] border-t-lime-400" />
    </div>
  );
}

function PaymentSuccessContent() {
  const searchParams =
    useSearchParams();

  const paymentId =
    useMemo(
      () =>
        normalizeText(
          searchParams.get(
            "paymentId",
          ) ||
          searchParams.get(
            "payment_id",
          ),
        ),
      [
        searchParams,
      ],
    );

  const initialOrderId =
    useMemo(
      () =>
        normalizeText(
          searchParams.get(
            "orderId",
          ) ||
          searchParams.get(
            "order_id",
          ),
        ),
      [
        searchParams,
      ],
    );

  const [
    orderId,
    setOrderId,
  ] =
    useState(
      initialOrderId,
    );

  const [
    orderReference,
    setOrderReference,
  ] =
    useState<string | null>(
      null,
    );

  const [
    eventTitle,
    setEventTitle,
  ] =
    useState<string | null>(
      null,
    );

  const [
    paymentAmount,
    setPaymentAmount,
  ] =
    useState<string | null>(
      null,
    );

  const [
    paymentCurrency,
    setPaymentCurrency,
  ] =
    useState(
      "XOF",
    );

  const [
    ticketsCount,
    setTicketsCount,
  ] =
    useState<number | null>(
      null,
    );

  const [
    isVerified,
    setIsVerified,
  ] =
    useState(
      false,
    );

  useEffect(
    () => {
      if (!paymentId) {
        return;
      }

      let cancelled =
        false;

      const verify =
        async () => {
          try {
            const storedContext =
              readStoredPaymentContext(
                paymentId,
              );

            const checkoutToken =
              normalizeText(
                storedContext
                  ?.checkoutToken,
              );

            const response =
              await fetch(
                `/api/client/payments/${encodeURIComponent(
                  paymentId,
                )}/status`,
                {
                  method:
                    "GET",

                  headers: {
                    Accept:
                      "application/json",

                    ...(checkoutToken
                      ? {
                          "x-checkout-token":
                            checkoutToken,
                        }
                      : {}),
                  },

                  cache:
                    "no-store",
                },
              );

            const payload =
              await response
                .json() as PaymentStatusResponse;

            if (
              cancelled ||
              !response.ok ||
              !payload.success
            ) {
              return;
            }

            const paymentStatus =
              normalizeText(
                payload.payment
                  ?.status,
              ).toUpperCase();

            const orderStatus =
              normalizeText(
                payload.order
                  ?.status,
              ).toUpperCase();

            const ticketsReady =
              Boolean(
                payload.tickets
                  ?.ready,
              );

            if (
              paymentStatus !==
                "SUCCESS" ||
              orderStatus !==
                "PAID" ||
              !ticketsReady
            ) {
              return;
            }

            const resolvedOrderId =
              normalizeText(
                payload.order?.id,
              ) ||
              normalizeText(
                storedContext
                  ?.orderId,
              ) ||
              orderId;

            setOrderId(
              resolvedOrderId,
            );

            setOrderReference(
              normalizeText(
                payload.order
                  ?.reference,
              ) ||
              null,
            );

            setEventTitle(
              normalizeText(
                payload.order
                  ?.event
                  ?.title,
              ) ||
              null,
            );

            setPaymentAmount(
              normalizeText(
                payload.payment
                  ?.amount,
              ) ||
              null,
            );

            setPaymentCurrency(
              normalizeText(
                payload.payment
                  ?.currency,
              ) ||
              "XOF",
            );

            setTicketsCount(
              payload.tickets
                ?.issued ??
              null,
            );

            setIsVerified(
              true,
            );
          } catch {
            return;
          }
        };

      void verify();

      return () => {
        cancelled =
          true;
      };
    },
    [
      orderId,
      paymentId,
    ],
  );

  const orderHref =
    orderId
      ? `/account/orders?orderId=${encodeURIComponent(
          orderId,
        )}`
      : "/account/orders";

  const downloadHref =
    orderId
      ? `/api/client/orders/${encodeURIComponent(
          orderId,
        )}/tickets/download`
      : "/account/tickets";

  return (
    <div className="relative flex min-h-[76vh] w-full items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-1/2 top-[42%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.07] blur-[140px]" />
      </div>

      <section className="relative w-full max-w-3xl overflow-hidden rounded-[34px] border border-white/[0.09] bg-[#071015]/96 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[30px] border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-400 shadow-[0_16px_50px_rgba(52,211,153,0.12)]">
          <CheckCircle2
            aria-hidden="true"
            className="h-12 w-12"
          />
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[0.24em] text-emerald-400">
          Paiement confirmé
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Vos billets sont prêts
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-neutral-400 sm:text-base">
          Votre commande a été validée et vos billets ont été générés avec leurs QR codes sécurisés.
        </p>

        {(orderReference ||
          eventTitle ||
          paymentAmount ||
          ticketsCount !==
            null) && (
          <div className="mt-7 grid gap-3 rounded-[26px] border border-white/[0.08] bg-black/10 p-4 text-left sm:grid-cols-2 sm:p-5">
            {orderReference && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-600">
                  Commande
                </p>

                <p className="mt-2 text-sm font-black text-white">
                  {orderReference}
                </p>
              </div>
            )}

            {eventTitle && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-600">
                  Événement
                </p>

                <p className="mt-2 text-sm font-black text-white">
                  {eventTitle}
                </p>
              </div>
            )}

            {paymentAmount && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-600">
                  Montant payé
                </p>

                <p className="mt-2 text-sm font-black text-lime-400">
                  {formatMoney({
                    amount:
                      paymentAmount,

                    currency:
                      paymentCurrency,
                  })}
                </p>
              </div>
            )}

            {ticketsCount !==
              null && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-600">
                  Billets
                </p>

                <p className="mt-2 text-sm font-black text-white">
                  {ticketsCount} billet{ticketsCount > 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-left">
            <ShieldCheck
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-emerald-400"
            />

            <span className="text-xs font-bold leading-5 text-neutral-400">
              Paiement vérifié côté serveur
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-left">
            <MailCheck
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-emerald-400"
            />

            <span className="text-xs font-bold leading-5 text-neutral-400">
              Envoi par e-mail préparé
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-left">
            <MessageCircleMore
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-emerald-400"
            />

            <span className="text-xs font-bold leading-5 text-neutral-400">
              Envoi WhatsApp préparé
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/account/tickets"
            className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 px-6 text-sm font-black text-black shadow-[0_18px_50px_rgba(132,204,22,0.18)] transition hover:brightness-110 active:scale-[0.99]"
          >
            <Ticket
              aria-hidden="true"
              className="h-5 w-5"
            />

            Voir mes billets
          </Link>

          <Link
            href={orderHref}
            className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.025] px-6 text-sm font-black text-white transition hover:border-white/[0.18] hover:bg-white/[0.04]"
          >
            <ReceiptText
              aria-hidden="true"
              className="h-5 w-5"
            />

            Voir ma commande
          </Link>
        </div>

        {isVerified &&
          orderId && (
            <a
              href={downloadHref}
              className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-black/10 px-6 text-sm font-bold text-neutral-300 transition hover:border-white/[0.16] hover:text-white"
            >
              <Download
                aria-hidden="true"
                className="h-4 w-4"
              />

              Télécharger les billets
            </a>
          )}

        <p className="mt-7 text-xs leading-5 text-neutral-600">
          Les billets restent disponibles dans votre espace Tikemia.
        </p>
      </section>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <SuccessFallback />
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}