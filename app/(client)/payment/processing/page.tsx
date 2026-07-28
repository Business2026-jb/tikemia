"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Ticket,
  TriangleAlert,
} from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
    terminal: boolean;
  };

  order?: {
    id: string;
    reference: string;
    status: string;
  };

  tickets?: {
    ready: boolean;
    expected: number;
    issued: number;
    valid: number;
  };

  redirectTo?: string | null;

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
  createdAt?: string;
};

const POLLING_INTERVAL_MS =
  2_500;

const MAX_POLLING_DURATION_MS =
  3 * 60 * 1_000;

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

function ProcessingFallback() {
  return (
    <div className="flex min-h-[72vh] w-full items-center justify-center px-4 py-10">
      <LoaderCircle
        aria-label="Chargement"
        className="h-8 w-8 animate-spin text-lime-400"
      />
    </div>
  );
}

function PaymentProcessingContent() {
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
          ) ||
          searchParams.get(
            "payment",
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
          ) ||
          searchParams.get(
            "order",
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
    statusMessage,
    setStatusMessage,
  ] =
    useState(
      "Vérification du paiement",
    );

  const [
    detailMessage,
    setDetailMessage,
  ] =
    useState(
      "La confirmation sécurisée est en cours.",
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    );

  const [
    isChecking,
    setIsChecking,
  ] =
    useState(
      true,
    );

  const [
    hasTimedOut,
    setHasTimedOut,
  ] =
    useState(
      false,
    );

  const startedAtRef =
    useRef(
      Date.now(),
    );

  const requestInProgressRef =
    useRef(
      false,
    );

  const redirectedRef =
    useRef(
      false,
    );

  const checkPaymentStatus =
    useCallback(
      async () => {
        if (
          !paymentId ||
          requestInProgressRef.current ||
          redirectedRef.current
        ) {
          return;
        }

        requestInProgressRef.current =
          true;

        setErrorMessage(
          null,
        );

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
            !response.ok ||
            !payload.success
          ) {
            throw new Error(
              payload.error
                ?.message ||
              payload.message ||
              "Impossible de vérifier le paiement.",
            );
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

          if (
            resolvedOrderId &&
            resolvedOrderId !==
              orderId
          ) {
            setOrderId(
              resolvedOrderId,
            );
          }

          setOrderReference(
            normalizeText(
              payload.order
                ?.reference,
            ) ||
            null,
          );

          const paymentStatus =
            normalizeText(
              payload.payment
                ?.status,
            ).toUpperCase();

          const orderStatus =
            normalizeText(
              payload.order?.status,
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
            redirectedRef.current =
              true;

            setStatusMessage(
              "Paiement confirmé",
            );

            setDetailMessage(
              "Vos billets sont prêts.",
            );

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
            redirectedRef.current =
              true;

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
              "CANCELLED" ||
            orderStatus ===
              "CANCELLED"
          ) {
            redirectedRef.current =
              true;

            router.replace(
              buildResultUrl({
                pathname:
                  "/payment/cancelled",

                paymentId,

                orderId:
                  resolvedOrderId,
              }),
            );

            return;
          }

          if (
            paymentStatus ===
              "SUCCESS" ||
            orderStatus ===
              "PAID"
          ) {
            setStatusMessage(
              "Préparation des billets",
            );

            setDetailMessage(
              "Le paiement est confirmé. Les billets sont en cours de génération.",
            );
          } else {
            setStatusMessage(
              "Vérification du paiement",
            );

            setDetailMessage(
              "Nous attendons la confirmation sécurisée de FedaPay.",
            );
          }

          if (
            Date.now() -
              startedAtRef.current >=
            MAX_POLLING_DURATION_MS
          ) {
            setHasTimedOut(
              true,
            );

            setIsChecking(
              false,
            );

            setDetailMessage(
              "La confirmation prend plus de temps que prévu.",
            );
          }
        } catch (
          error
        ) {
          setErrorMessage(
            error instanceof
              Error
              ? error.message
              : "Impossible de vérifier le paiement.",
          );
        } finally {
          requestInProgressRef.current =
            false;
        }
      },
      [
        orderId,
        paymentId,
        router,
      ],
    );

  useEffect(
    () => {
      if (
        !paymentId
      ) {
        setIsChecking(
          false,
        );

        setErrorMessage(
          "L’identifiant du paiement est absent.",
        );

        return;
      }

      let cancelled =
        false;

      const run =
        async () => {
          if (
            cancelled
          ) {
            return;
          }

          await checkPaymentStatus();

          if (
            !cancelled &&
            !redirectedRef.current
          ) {
            setIsChecking(
              true,
            );
          }
        };

      void run();

      const interval =
        window.setInterval(
          () => {
            if (
              !cancelled &&
              !hasTimedOut &&
              !redirectedRef.current
            ) {
              void run();
            }
          },
          POLLING_INTERVAL_MS,
        );

      return () => {
        cancelled =
          true;

        window.clearInterval(
          interval,
        );
      };
    },
    [
      checkPaymentStatus,
      hasTimedOut,
      paymentId,
    ],
  );

  const handleManualRetry =
    useCallback(
      async () => {
        startedAtRef.current =
          Date.now();

        setHasTimedOut(
          false,
        );

        setIsChecking(
          true,
        );

        await checkPaymentStatus();
      },
      [
        checkPaymentStatus,
      ],
    );

  return (
    <div className="relative flex min-h-[76vh] w-full items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.06] blur-[130px]" />
      </div>

      <section className="relative w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/[0.09] bg-[#071015]/95 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-9">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] border border-lime-400/20 bg-lime-400/[0.07] text-lime-400">
          {errorMessage ? (
            <TriangleAlert
              aria-hidden="true"
              className="h-9 w-9"
            />
          ) : hasTimedOut ? (
            <Clock3
              aria-hidden="true"
              className="h-9 w-9"
            />
          ) : (
            <LoaderCircle
              aria-hidden="true"
              className="h-9 w-9 animate-spin"
            />
          )}
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-lime-400">
          Paiement sécurisé
        </p>

        <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
          {statusMessage}
        </h1>

        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-neutral-400 sm:text-base">
          {detailMessage}
        </p>

        {orderReference && (
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-xs font-bold text-neutral-400">
            <Ticket
              aria-hidden="true"
              className="h-4 w-4 text-lime-400"
            />

            {orderReference}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.07] p-4 text-sm leading-6 text-red-300"
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-left">
            <LockKeyhole
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-emerald-400"
            />

            <span className="text-xs font-bold leading-5 text-neutral-400">
              Paiement vérifié côté serveur
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-left">
            <ShieldCheck
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-emerald-400"
            />

            <span className="text-xs font-bold leading-5 text-neutral-400">
              Aucun billet avant confirmation
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-left">
            <CheckCircle2
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-emerald-400"
            />

            <span className="text-xs font-bold leading-5 text-neutral-400">
              QR sécurisé et unique
            </span>
          </div>
        </div>

        {(hasTimedOut ||
          errorMessage) && (
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={
                handleManualRetry
              }
              disabled={
                isChecking &&
                requestInProgressRef.current
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 px-6 text-sm font-black text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                aria-hidden="true"
                className="h-4 w-4"
              />

              Vérifier à nouveau
            </button>

            <Link
              href="/account/orders"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.025] px-6 text-sm font-bold text-neutral-300 transition hover:border-white/[0.18] hover:text-white"
            >
              Mes commandes
            </Link>
          </div>
        )}

        {!errorMessage &&
          !hasTimedOut && (
            <p className="mt-7 text-xs leading-5 text-neutral-600">
              Ne fermez pas cette page pendant la confirmation.
            </p>
          )}
      </section>
    </div>
  );
}

export default function PaymentProcessingPage() {
  return (
    <Suspense
      fallback={
        <ProcessingFallback />
      }
    >
      <PaymentProcessingContent />
    </Suspense>
  );
}