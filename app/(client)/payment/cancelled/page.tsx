"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Clock3,
  CreditCard,
  RefreshCw,
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
  useRouter,
  useSearchParams,
} from "next/navigation";

type PaymentStatusResponse = {
  success: boolean;

  payment?: {
    id: string;
    status: string;
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

type StoredCheckoutOrder = {
  order?: {
    id?: string;
    event?: {
      slug?: string;
      title?: string;
    };
  };
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

function readStoredCheckoutOrder(
  orderId: string,
): StoredCheckoutOrder["order"] | null {
  if (
    typeof window ===
      "undefined" ||
    !orderId
  ) {
    return null;
  }

  const keys = [
    `tikemia:checkout:${orderId}`,
    "tikemia:checkout:current",
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
        ) as StoredCheckoutOrder;

      if (
        parsed.order?.id ===
          orderId
      ) {
        return parsed.order;
      }
    } catch {
      window.sessionStorage.removeItem(
        key,
      );
    }
  }

  return null;
}

function buildResultUrl({
  pathname,
  paymentId,
  orderId,
}: {
  pathname: string;
  paymentId: string;
  orderId: string;
}): string {
  const params =
    new URLSearchParams();

  if (
    paymentId
  ) {
    params.set(
      "paymentId",
      paymentId,
    );
  }

  if (
    orderId
  ) {
    params.set(
      "orderId",
      orderId,
    );
  }

  const query =
    params.toString();

  return query
    ? `${pathname}?${query}`
    : pathname;
}

function CancelledFallback() {
  return (
    <div className="flex min-h-[72vh] w-full items-center justify-center px-4 py-10">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/[0.08] border-t-orange-400" />
    </div>
  );
}

function PaymentCancelledContent() {
  const router =
    useRouter();

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
    eventSlug,
    setEventSlug,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(
    () => {
      const storedPayment =
        paymentId
          ? readStoredPaymentContext(
              paymentId,
            )
          : null;

      const resolvedOrderId =
        initialOrderId ||
        normalizeText(
          storedPayment?.orderId,
        );

      if (
        resolvedOrderId &&
        resolvedOrderId !==
          orderId
      ) {
        setOrderId(
          resolvedOrderId,
        );
      }

      const storedOrder =
        readStoredCheckoutOrder(
          resolvedOrderId,
        );

      if (
        storedOrder?.event
          ?.title
      ) {
        setEventTitle(
          normalizeText(
            storedOrder.event
              .title,
          ) ||
          null,
        );
      }

      if (
        storedOrder?.event
          ?.slug
      ) {
        setEventSlug(
          normalizeText(
            storedOrder.event
              .slug,
          ) ||
          null,
        );
      }
    },
    [
      initialOrderId,
      orderId,
      paymentId,
    ],
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
              eventTitle,
            );

            setEventSlug(
              normalizeText(
                payload.order
                  ?.event
                  ?.slug,
              ) ||
              eventSlug,
            );

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
              paymentStatus ===
                "SUCCESS" &&
              orderStatus ===
                "PAID" &&
              ticketsReady
            ) {
              router.replace(
                buildResultUrl({
                  pathname:
                    "/payment/success",

                  paymentId,

                  orderId:
                    resolvedOrderId,
                }),
              );

              return;
            }

            if (
              paymentStatus ===
                "FAILED" ||
              orderStatus ===
                "FAILED" ||
              paymentStatus ===
                "EXPIRED" ||
              orderStatus ===
                "EXPIRED"
            ) {
              router.replace(
                buildResultUrl({
                  pathname:
                    "/payment/failed",

                  paymentId,

                  orderId:
                    resolvedOrderId,
                }),
              );

              return;
            }

            if (
              paymentStatus ===
                "PENDING" ||
              paymentStatus ===
                "PROCESSING" ||
              orderStatus ===
                "PENDING" ||
              orderStatus ===
                "PROCESSING"
            ) {
              router.replace(
                buildResultUrl({
                  pathname:
                    "/payment/processing",

                  paymentId,

                  orderId:
                    resolvedOrderId,
                }),
              );
            }
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
      eventSlug,
      eventTitle,
      orderId,
      paymentId,
      router,
    ],
  );

  const retryHref =
    orderId
      ? `/checkout/${encodeURIComponent(
          orderId,
        )}`
      : eventSlug
        ? `/events/${encodeURIComponent(
            eventSlug,
          )}`
        : "/events";

  const eventHref =
    eventSlug
      ? `/events/${encodeURIComponent(
          eventSlug,
        )}`
      : "/events";

  return (
    <div className="relative flex min-h-[76vh] w-full items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-1/2 top-[44%] h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/[0.06] blur-[140px]" />
      </div>

      <section className="relative w-full max-w-2xl overflow-hidden rounded-[34px] border border-white/[0.09] bg-[#071015]/96 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[30px] border border-orange-400/20 bg-orange-400/[0.08] text-orange-400">
          <Ban
            aria-hidden="true"
            className="h-12 w-12"
          />
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[0.24em] text-orange-400">
          Paiement annulé
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Aucun débit confirmé
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-neutral-400 sm:text-base">
          Le paiement a été interrompu. Aucun billet n’est délivré sans confirmation sécurisée du prestataire.
        </p>

        {(orderReference ||
          eventTitle) && (
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
          </div>
        )}

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-left">
            <CreditCard
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-orange-400"
            />

            <span className="text-xs font-bold leading-5 text-neutral-400">
              Paiement non validé
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-left">
            <Ticket
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-orange-400"
            />

            <span className="text-xs font-bold leading-5 text-neutral-400">
              Aucun billet généré
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-left">
            <ShieldCheck
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-orange-400"
            />

            <span className="text-xs font-bold leading-5 text-neutral-400">
              Réservation protégée
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href={retryHref}
            className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 px-6 text-sm font-black text-black shadow-[0_18px_50px_rgba(132,204,22,0.18)] transition hover:brightness-110 active:scale-[0.99]"
          >
            <RefreshCw
              aria-hidden="true"
              className="h-5 w-5"
            />

            Réessayer le paiement
          </Link>

          <Link
            href={eventHref}
            className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.025] px-6 text-sm font-black text-white transition hover:border-white/[0.18] hover:bg-white/[0.04]"
          >
            <ArrowLeft
              aria-hidden="true"
              className="h-5 w-5"
            />

            Retour à l’événement
          </Link>
        </div>

        <div className="mt-7 flex items-center justify-center gap-2 text-xs leading-5 text-neutral-600">
          <Clock3
            aria-hidden="true"
            className="h-4 w-4"
          />

          Une réservation expirée sera libérée automatiquement.
        </div>
      </section>
    </div>
  );
}

export default function PaymentCancelledPage() {
  return (
    <Suspense
      fallback={
        <CancelledFallback />
      }
    >
      <PaymentCancelledContent />
    </Suspense>
  );
}