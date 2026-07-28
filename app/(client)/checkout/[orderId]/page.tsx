"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Smartphone,
  Ticket,
  TriangleAlert,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type CheckoutPaymentMethod =
  | "CARD"
  | "MTN_MOMO"
  | "MOOV_MONEY"
  | "CELTIIS_CASH"
  | "ORANGE_MONEY"
  | "WAVE";

type CheckoutOrderItem = {
  id: string;
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  platformFee: string;
  total: string;
};

type CheckoutOrderEvent = {
  id: string;
  slug: string;
  title: string;
  coverImage?: string | null;
  venueName?: string | null;
  city?: string | null;
  country?: string | null;
  startsAt?: string | null;
};

type CheckoutOrderSnapshot = {
  id: string;
  reference: string;
  status: string;
  currency: string;
  subtotal: string;
  platformFee: string;
  total: string;
  reservationExpiresAt: string | null;
  checkoutToken: string;
  event: CheckoutOrderEvent;
  items: CheckoutOrderItem[];
};

type CheckoutStoragePayload = {
  order: CheckoutOrderSnapshot;
};

type CreatePaymentResponse = {
  success: boolean;
  message?: string;

  payment?: {
    id: string;
    orderId: string;
    orderReference: string;
    provider: string;
    method: string;
    status: string;
    amount: string;
    currency: string;
    checkoutUrl: string;
    returnUrl?: string | null;
    cancelUrl?: string | null;
    expiresAt?: string | null;
  };

  error?: {
    code?: string;
    message?: string;
  };
};

type PaymentMethodOption = {
  id: CheckoutPaymentMethod;
  title: string;
  description: string;
  icon: "card" | "phone";
  logos?: Array<{
    src: string;
    alt: string;
  }>;
};

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: "CARD",
    title: "Carte bancaire",
    description: "Visa et Mastercard",
    icon: "card",
    logos: [
      {
        src: "/images/payments/visa.png",
        alt: "Visa",
      },
      {
        src: "/images/payments/mastercard.webp",
        alt: "Mastercard",
      },
    ],
  },
  {
    id: "MTN_MOMO",
    title: "MTN Mobile Money",
    description: "Paiement depuis votre compte MTN MoMo",
    icon: "phone",
    logos: [
      {
        src: "/images/payments/mtn-momo.webp",
        alt: "MTN Mobile Money",
      },
    ],
  },
  {
    id: "MOOV_MONEY",
    title: "Moov Money",
    description: "Paiement depuis votre compte Moov Money",
    icon: "phone",
    logos: [
      {
        src: "/images/payments/moov-money.jpeg",
        alt: "Moov Money",
      },
    ],
  },
  {
    id: "CELTIIS_CASH",
    title: "Celtiis Cash",
    description: "Paiement depuis votre compte Celtiis Cash",
    icon: "phone",
  },
  {
    id: "ORANGE_MONEY",
    title: "Orange Money",
    description: "Paiement depuis votre compte Orange Money",
    icon: "phone",
    logos: [
      {
        src: "/images/payments/orange-money.png",
        alt: "Orange Money",
      },
    ],
  },
  {
    id: "WAVE",
    title: "Wave",
    description: "Paiement depuis votre compte Wave",
    icon: "phone",
    logos: [
      {
        src: "/images/payments/wave.png",
        alt: "Wave",
      },
    ],
  },
];

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeOrderId(
  value: string | string[] | undefined,
): string {
  if (
    Array.isArray(
      value,
    )
  ) {
    return normalizeText(
      value[0],
    );
  }

  return normalizeText(
    value,
  );
}

function parseAmount(
  value: string,
): number {
  const amount =
    Number.parseFloat(
      value,
    );

  return Number.isFinite(
    amount,
  )
    ? amount
    : 0;
}

function formatMoney(
  value: string,
  currency: string,
): string {
  const amount =
    parseAmount(
      value,
    );

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency:
          normalizeText(
            currency,
          ).toUpperCase() ||
          "XOF",
        maximumFractionDigits:
          normalizeText(
            currency,
          ).toUpperCase() ===
          "XOF"
            ? 0
            : 2,
      },
    ).format(
      amount,
    );
  } catch {
    return `${amount.toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

function formatEventDate(
  value: string | null | undefined,
): string | null {
  const normalized =
    normalizeText(
      value,
    );

  if (!normalized) {
    return null;
  }

  const date =
    new Date(
      normalized,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    date,
  );
}

function getStorageKeys(
  orderId: string,
): string[] {
  return [
    `tikemia:checkout:${orderId}`,
    `tikemia_checkout_${orderId}`,
    "tikemia:checkout:current",
    "tikemia_checkout_order",
  ];
}

function readCheckoutOrder(
  orderId: string,
): CheckoutOrderSnapshot | null {
  for (
    const key of
    getStorageKeys(
      orderId,
    )
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
        ) as
          | CheckoutStoragePayload
          | CheckoutOrderSnapshot;

      const order =
        "order" in parsed
          ? parsed.order
          : parsed;

      if (
        normalizeText(
          order.id,
        ) ===
          orderId &&
        normalizeText(
          order.checkoutToken,
        )
      ) {
        return order;
      }
    } catch {
      window.sessionStorage.removeItem(
        key,
      );
    }
  }

  return null;
}

function removeCheckoutOrder(
  orderId: string,
): void {
  for (
    const key of
    getStorageKeys(
      orderId,
    )
  ) {
    window.sessionStorage.removeItem(
      key,
    );
  }
}

function createPaymentIdempotencyKey(
  orderId: string,
): string {
  const existingKey =
    window.sessionStorage.getItem(
      `tikemia:payment:idempotency:${orderId}`,
    );

  if (existingKey) {
    return existingKey;
  }

  const randomPart =
    typeof crypto !==
      "undefined" &&
    "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}`;

  const key =
    `payment_${orderId}_${randomPart}`
      .replace(
        /[^A-Za-z0-9._:-]/g,
        "_",
      )
      .slice(
        0,
        190,
      );

  window.sessionStorage.setItem(
    `tikemia:payment:idempotency:${orderId}`,
    key,
  );

  return key;
}

function getRemainingTime(
  expiresAt: string | null,
): number {
  if (!expiresAt) {
    return 0;
  }

  const expiresAtTime =
    new Date(
      expiresAt,
    ).getTime();

  if (
    Number.isNaN(
      expiresAtTime,
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    expiresAtTime -
      Date.now(),
  );
}

function formatCountdown(
  remainingMilliseconds: number,
): string {
  const totalSeconds =
    Math.max(
      0,
      Math.floor(
        remainingMilliseconds /
          1000,
      ),
    );

  const minutes =
    Math.floor(
      totalSeconds /
        60,
    );

  const seconds =
    totalSeconds %
    60;

  return `${String(
    minutes,
  ).padStart(
    2,
    "0",
  )}:${String(
    seconds,
  ).padStart(
    2,
    "0",
  )}`;
}

function PaymentMethodIcon({
  option,
}: {
  option: PaymentMethodOption;
}) {
  if (
    option.icon ===
    "card"
  ) {
    return (
      <CreditCard
        aria-hidden="true"
        className="h-5 w-5"
      />
    );
  }

  return (
    <Smartphone
      aria-hidden="true"
      className="h-5 w-5"
    />
  );
}

function CheckoutSkeleton() {
  return (
    <div className="min-h-[70vh] w-full animate-pulse px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1500px] gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <div className="h-32 rounded-3xl bg-white/[0.04]" />
          <div className="h-72 rounded-3xl bg-white/[0.04]" />
        </div>

        <div className="h-[470px] rounded-3xl bg-white/[0.04]" />
      </div>
    </div>
  );
}

function CheckoutError({
  message,
  eventHref,
}: {
  message: string;
  eventHref: string;
}) {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-[28px] border border-red-500/20 bg-[#071015] p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[0.08] text-red-400">
          <TriangleAlert
            aria-hidden="true"
            className="h-7 w-7"
          />
        </div>

        <h1 className="mt-5 text-2xl font-black text-white">
          Paiement indisponible
        </h1>

        <p className="mt-3 text-sm leading-6 text-neutral-400">
          {message}
        </p>

        <Link
          href={eventHref}
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 px-6 text-sm font-black text-black transition hover:brightness-110"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-4 w-4"
          />
          Retour à l’événement
        </Link>
      </div>
    </div>
  );
}

export default function ClientCheckoutPage() {
  const params =
    useParams<{
      orderId: string;
    }>();

  const router =
    useRouter();

  const orderId =
    normalizeOrderId(
      params?.orderId,
    );

  const [
    order,
    setOrder,
  ] =
    useState<CheckoutOrderSnapshot | null>(
      null,
    );

  const [
    selectedPaymentMethod,
    setSelectedPaymentMethod,
  ] =
    useState<CheckoutPaymentMethod>(
      "CARD",
    );

  const [
    remainingTime,
    setRemainingTime,
  ] =
    useState(
      0,
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
    );

  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(
      false,
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(
    () => {
      if (!orderId) {
        setErrorMessage(
          "La commande est invalide.",
        );

        setIsLoading(
          false,
        );

        return;
      }

      const storedOrder =
        readCheckoutOrder(
          orderId,
        );

      if (!storedOrder) {
        setErrorMessage(
          "Les informations sécurisées de cette commande sont introuvables. Recommencez la réservation.",
        );

        setIsLoading(
          false,
        );

        return;
      }

      setOrder(
        storedOrder,
      );

      setRemainingTime(
        getRemainingTime(
          storedOrder
            .reservationExpiresAt,
        ),
      );

      setIsLoading(
        false,
      );
    },
    [
      orderId,
    ],
  );

  useEffect(
    () => {
      if (
        !order?.reservationExpiresAt
      ) {
        return;
      }

      const interval =
        window.setInterval(
          () => {
            setRemainingTime(
              getRemainingTime(
                order.reservationExpiresAt,
              ),
            );
          },
          1_000,
        );

      return () => {
        window.clearInterval(
          interval,
        );
      };
    },
    [
      order?.reservationExpiresAt,
    ],
  );

  const isExpired =
    Boolean(
      order?.reservationExpiresAt,
    ) &&
    remainingTime <=
      0;

  const totalTickets =
    useMemo(
      () =>
        order?.items.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.quantity,
          0,
        ) ??
        0,
      [
        order?.items,
      ],
    );

  const eventHref =
    order?.event.slug
      ? `/events/${order.event.slug}`
      : "/events";

  const eventDate =
    formatEventDate(
      order?.event.startsAt,
    );

  const handlePayment =
    useCallback(
      async () => {
        if (
          !order ||
          isSubmitting ||
          isExpired
        ) {
          return;
        }

        setErrorMessage(
          null,
        );

        setIsSubmitting(
          true,
        );

        try {
          const idempotencyKey =
            createPaymentIdempotencyKey(
              order.id,
            );

          const response =
            await fetch(
              "/api/client/payments/create",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  Accept:
                    "application/json",

                  "Idempotency-Key":
                    idempotencyKey,
                },

                body:
                  JSON.stringify({
                    orderId:
                      order.id,

                    checkoutToken:
                      order.checkoutToken,

                    paymentMethod:
                      selectedPaymentMethod,

                    idempotencyKey,
                  }),
              },
            );

          const payload =
            await response.json() as CreatePaymentResponse;

          if (
            !response.ok ||
            !payload.success
          ) {
            throw new Error(
              payload.error
                ?.message ||
              payload.message ||
              "Impossible de préparer le paiement.",
            );
          }

          const checkoutUrl =
            normalizeText(
              payload.payment
                ?.checkoutUrl,
            );

          const paymentId =
            normalizeText(
              payload.payment?.id,
            );

          if (
            !checkoutUrl ||
            !paymentId
          ) {
            throw new Error(
              "Le lien de paiement sécurisé est indisponible.",
            );
          }

          window.sessionStorage.setItem(
            `tikemia:payment:${paymentId}`,
            JSON.stringify({
              paymentId,
              orderId:
                order.id,
              checkoutToken:
                order.checkoutToken,
              createdAt:
                new Date().toISOString(),
            }),
          );

          window.location.assign(
            checkoutUrl,
          );
        } catch (
          error
        ) {
          setErrorMessage(
            error instanceof
              Error
              ? error.message
              : "Impossible de préparer le paiement.",
          );
        } finally {
          setIsSubmitting(
            false,
          );
        }
      },
      [
        isExpired,
        isSubmitting,
        order,
        selectedPaymentMethod,
      ],
    );

  const handleCancel =
    useCallback(
      () => {
        if (
          order
        ) {
          removeCheckoutOrder(
            order.id,
          );
        }

        router.push(
          eventHref,
        );
      },
      [
        eventHref,
        order,
        router,
      ],
    );

  if (
    isLoading
  ) {
    return (
      <CheckoutSkeleton />
    );
  }

  if (
    !order
  ) {
    return (
      <CheckoutError
        message={
          errorMessage ||
          "Cette commande est introuvable."
        }
        eventHref="/events"
      />
    );
  }

  return (
    <div className="w-full px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-12">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href={eventHref}
            className="inline-flex items-center gap-2 text-sm font-bold text-neutral-400 transition hover:text-white"
          >
            <ArrowLeft
              aria-hidden="true"
              className="h-4 w-4"
            />
            Retour
          </Link>

          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black",
              isExpired
                ? "border-red-500/20 bg-red-500/[0.08] text-red-300"
                : "border-amber-500/20 bg-amber-500/[0.08] text-amber-300",
            )}
          >
            <Clock3
              aria-hidden="true"
              className="h-4 w-4"
            />

            {isExpired
              ? "Réservation expirée"
              : `Réservation ${formatCountdown(
                  remainingTime,
                )}`}
          </div>
        </div>

        <div className="grid w-full gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="min-w-0 space-y-6">
            <div className="overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#071015] shadow-[0_26px_80px_rgba(0,0,0,0.26)]">
              <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="relative min-h-48 overflow-hidden bg-white/[0.03] md:min-h-full">
                  {order.event.coverImage ? (
                    <Image
                      src={
                        order.event
                          .coverImage
                      }
                      alt={
                        order.event.title
                      }
                      fill
                      sizes="(max-width: 768px) 100vw, 220px"
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="flex h-full min-h-48 items-center justify-center text-lime-400">
                      <Ticket
                        aria-hidden="true"
                        className="h-14 w-14"
                      />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                </div>

                <div className="min-w-0 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-lime-400/20 bg-lime-400/[0.08] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-lime-300">
                      Commande {order.reference}
                    </span>

                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-bold text-neutral-400">
                      {totalTickets} billet{totalTickets > 1 ? "s" : ""}
                    </span>
                  </div>

                  <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
                    {order.event.title}
                  </h1>

                  <div className="mt-5 grid gap-3 text-sm text-neutral-400 sm:grid-cols-2">
                    {eventDate && (
                      <div className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-black/10 p-3.5">
                        <CalendarDays
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 shrink-0 text-lime-400"
                        />

                        <span>
                          {eventDate}
                        </span>
                      </div>
                    )}

                    {(
                      order.event.venueName ||
                      order.event.city
                    ) && (
                      <div className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-black/10 p-3.5">
                        <MapPin
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 shrink-0 text-lime-400"
                        />

                        <span>
                          {[
                            order.event.venueName,
                            order.event.city,
                            order.event.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/[0.08] bg-[#071015] p-5 shadow-[0_26px_80px_rgba(0,0,0,0.24)] sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-400">
                  <Banknote
                    aria-hidden="true"
                    className="h-5 w-5"
                  />
                </div>

                <div>
                  <h2 className="text-xl font-black text-white">
                    Moyen de paiement
                  </h2>

                  <p className="mt-1 text-sm text-neutral-500">
                    Choisissez une option sécurisée.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {PAYMENT_METHODS.map(
                  (
                    option,
                  ) => {
                    const selected =
                      selectedPaymentMethod ===
                      option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setSelectedPaymentMethod(
                            option.id,
                          )
                        }
                        disabled={
                          isSubmitting ||
                          isExpired
                        }
                        className={cn(
                          "group relative flex min-h-[104px] items-center gap-4 rounded-2xl border p-4 text-left outline-none transition",
                          "focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071015]",
                          selected
                            ? "border-lime-400/35 bg-lime-400/[0.08]"
                            : "border-white/[0.08] bg-black/10 hover:border-white/[0.16] hover:bg-white/[0.025]",
                          (isSubmitting ||
                            isExpired) &&
                            "cursor-not-allowed opacity-60",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                            selected
                              ? "border-lime-400/25 bg-lime-400/[0.09] text-lime-400"
                              : "border-white/[0.08] bg-white/[0.025] text-neutral-400",
                          )}
                        >
                          <PaymentMethodIcon
                            option={
                              option
                            }
                          />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-white">
                            {option.title}
                          </span>

                          <span className="mt-1 block text-xs leading-5 text-neutral-500">
                            {option.description}
                          </span>

                          {option.logos && (
                            <span className="mt-3 flex flex-wrap items-center gap-2">
                              {option.logos.map(
                                (
                                  logo,
                                ) => (
                                  <span
                                    key={
                                      logo.src
                                    }
                                    className="relative h-5 w-10 overflow-hidden rounded bg-white px-1"
                                  >
                                    <Image
                                      src={
                                        logo.src
                                      }
                                      alt={
                                        logo.alt
                                      }
                                      fill
                                      sizes="40px"
                                      className="object-contain p-0.5"
                                    />
                                  </span>
                                ),
                              )}
                            </span>
                          )}
                        </span>

                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                            selected
                              ? "border-lime-400 bg-lime-400 text-black"
                              : "border-white/[0.12] text-transparent",
                          )}
                        >
                          <Check
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </section>

          <aside className="min-w-0">
            <div className="xl:sticky xl:top-28">
              <div className="rounded-[30px] border border-white/[0.08] bg-[#071015] p-5 shadow-[0_26px_80px_rgba(0,0,0,0.28)] sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-white">
                      Résumé
                    </h2>

                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-neutral-600">
                      {order.reference}
                    </p>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400">
                    <ShieldCheck
                      aria-hidden="true"
                      className="h-5 w-5"
                    />
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {order.items.map(
                    (
                      item,
                    ) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-white">
                              {item.ticketTypeName}
                            </p>

                            <p className="mt-1 text-xs text-neutral-500">
                              {item.quantity} ×{" "}
                              {formatMoney(
                                item.unitPrice,
                                order.currency,
                              )}
                            </p>
                          </div>

                          <p className="shrink-0 text-sm font-black text-white">
                            {formatMoney(
                              item.subtotal,
                              order.currency,
                            )}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>

                <div className="mt-6 space-y-3 border-t border-white/[0.08] pt-5 text-sm">
                  <div className="flex items-center justify-between gap-4 text-neutral-400">
                    <span>
                      Sous-total
                    </span>

                    <span className="font-bold text-white">
                      {formatMoney(
                        order.subtotal,
                        order.currency,
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-neutral-400">
                    <span>
                      Frais
                    </span>

                    <span className="font-bold text-white">
                      {formatMoney(
                        order.platformFee,
                        order.currency,
                      )}
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-4 border-t border-white/[0.08] pt-4">
                    <span className="text-sm font-black text-white">
                      Total
                    </span>

                    <span className="text-2xl font-black text-lime-400">
                      {formatMoney(
                        order.total,
                        order.currency,
                      )}
                    </span>
                  </div>
                </div>

                {errorMessage && (
                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.07] p-4 text-sm leading-6 text-red-300">
                    <TriangleAlert
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />

                    <span>
                      {errorMessage}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={
                    handlePayment
                  }
                  disabled={
                    isSubmitting ||
                    isExpired
                  }
                  className={cn(
                    "mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 px-5 text-sm font-black text-black shadow-[0_18px_45px_rgba(132,204,22,0.16)] transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071015]",
                    !isSubmitting &&
                      !isExpired &&
                      "hover:brightness-110 active:scale-[0.99]",
                    (isSubmitting ||
                      isExpired) &&
                      "cursor-not-allowed opacity-55",
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle
                        aria-hidden="true"
                        className="h-5 w-5 animate-spin"
                      />
                      Préparation
                    </>
                  ) : isExpired ? (
                    <>
                      <Clock3
                        aria-hidden="true"
                        className="h-5 w-5"
                      />
                      Réservation expirée
                    </>
                  ) : (
                    <>
                      <LockKeyhole
                        aria-hidden="true"
                        className="h-5 w-5"
                      />
                      Payer maintenant
                      <ChevronRight
                        aria-hidden="true"
                        className="h-5 w-5"
                      />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={
                    handleCancel
                  }
                  disabled={
                    isSubmitting
                  }
                  className="mt-3 h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] text-sm font-bold text-neutral-400 transition hover:border-white/[0.16] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Annuler
                </button>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-black/10 p-3 text-xs font-bold text-neutral-400">
                    <BadgeCheck
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-emerald-400"
                    />
                    Paiement vérifié
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-black/10 p-3 text-xs font-bold text-neutral-400">
                    <LockKeyhole
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-emerald-400"
                    />
                    Données protégées
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}