"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  TriangleAlert,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  CheckoutCouponAmounts,
  CheckoutCouponResult,
} from "@/components/checkout/coupon/checkout-coupon-form";

import CheckoutOrderSummary, {
  type CheckoutOrderEvent,
  type CheckoutOrderItem,
} from "./checkout-order-summary";
import CheckoutPaymentCard, {
  type CheckoutPaymentMethod,
} from "./checkout-payment-card";
import CheckoutSummary from "./checkout-summary";

type CheckoutOrderSnapshot = Readonly<{
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
  items: readonly CheckoutOrderItem[];
}>;

type CheckoutStoragePayload = Readonly<{
  order: CheckoutOrderSnapshot;
}>;

type CreatePaymentResponse = {
  success: boolean;
  message?: string;
  payment?: {
    id: string;
    checkoutUrl: string;
  };
  error?: {
    message?: string;
  };
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normalizeOrderId(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value)
    ? normalizeText(value[0])
    : normalizeText(value);
}

function getStorageKeys(orderId: string): string[] {
  return [
    `tikemia:checkout:${orderId}`,
    `tikemia_checkout_${orderId}`,
    "tikemia:checkout:current",
    "tikemia_checkout_order",
  ];
}

function readCheckoutOrder(orderId: string): CheckoutOrderSnapshot | null {
  for (const key of getStorageKeys(orderId)) {
    const rawValue = window.sessionStorage.getItem(key);

    if (!rawValue) continue;

    try {
      const parsed = JSON.parse(rawValue) as
        | CheckoutStoragePayload
        | CheckoutOrderSnapshot;

      const order = "order" in parsed ? parsed.order : parsed;

      if (
        normalizeText(order.id) === orderId &&
        normalizeText(order.checkoutToken)
      ) {
        return order;
      }
    } catch {
      window.sessionStorage.removeItem(key);
    }
  }

  return null;
}

function removeCheckoutOrder(orderId: string): void {
  for (const key of getStorageKeys(orderId)) {
    window.sessionStorage.removeItem(key);
  }
}

function createPaymentIdempotencyKey(orderId: string): string {
  const storageKey = `tikemia:payment:idempotency:${orderId}`;
  const existingKey = window.sessionStorage.getItem(storageKey);

  if (existingKey) return existingKey;

  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const key = `payment_${orderId}_${randomPart}`
    .replace(/[^A-Za-z0-9._:-]/g, "_")
    .slice(0, 190);

  window.sessionStorage.setItem(storageKey, key);

  return key;
}

function getRemainingTime(expiresAt: string | null): number {
  if (!expiresAt) return 0;

  const value = new Date(expiresAt).getTime();

  return Number.isNaN(value) ? 0 : Math.max(0, value - Date.now());
}

function formatCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;

  return `${String(minutesPart).padStart(2, "0")}:${String(
    secondsPart,
  ).padStart(2, "0")}`;
}

function initialAmounts(order: CheckoutOrderSnapshot): CheckoutCouponAmounts {
  return {
    subtotal: order.subtotal,
    platformFee: order.platformFee,
    discountAmount: "0.00",
    discountedSubtotal: order.subtotal,
    discountedPlatformFee: order.platformFee,
    total: order.total,
    currency: order.currency,
  };
}

function couponStorageKey(orderId: string): string {
  return `tikemia:checkout:coupon:${orderId}`;
}

export default function CheckoutPageClient() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderId = normalizeOrderId(params?.orderId);

  const [order, setOrder] = useState<CheckoutOrderSnapshot | null>(null);
  const [paymentMethod, setPaymentMethod] =
    useState<CheckoutPaymentMethod>("CARD");
  const [amounts, setAmounts] = useState<CheckoutCouponAmounts | null>(null);
  const [appliedCoupon, setAppliedCoupon] =
    useState<CheckoutCouponResult | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setErrorMessage("La commande est invalide.");
      setLoading(false);
      return;
    }

    const storedOrder = readCheckoutOrder(orderId);

    if (!storedOrder) {
      setErrorMessage(
        "Les informations sécurisées de cette commande sont introuvables. Recommencez la réservation.",
      );
      setLoading(false);
      return;
    }

    setOrder(storedOrder);
    setAmounts(initialAmounts(storedOrder));
    setRemainingTime(getRemainingTime(storedOrder.reservationExpiresAt));

    const storedCoupon = window.sessionStorage.getItem(
      couponStorageKey(storedOrder.id),
    );

    if (storedCoupon) {
      try {
        const parsed = JSON.parse(storedCoupon) as CheckoutCouponResult;
        setAppliedCoupon(parsed);
        setAmounts(parsed.amounts);
      } catch {
        window.sessionStorage.removeItem(couponStorageKey(storedOrder.id));
      }
    }

    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    if (!order?.reservationExpiresAt) return;

    const interval = window.setInterval(() => {
      setRemainingTime(getRemainingTime(order.reservationExpiresAt));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [order?.reservationExpiresAt]);

  const expired =
    Boolean(order?.reservationExpiresAt) && remainingTime <= 0;

  const eventHref = order?.event.slug
    ? `/events/${order.event.slug}`
    : "/events";

  const handleCouponApplied = useCallback(
    (result: CheckoutCouponResult) => {
      if (!order) return;

      setAppliedCoupon(result);
      setAmounts(result.amounts);
      setErrorMessage(null);

      window.sessionStorage.setItem(
        couponStorageKey(order.id),
        JSON.stringify(result),
      );

      window.sessionStorage.removeItem(
        `tikemia:payment:idempotency:${order.id}`,
      );
    },
    [order],
  );

  const handleCouponRemoved = useCallback(
    (nextAmounts: CheckoutCouponAmounts) => {
      if (!order) return;

      setAppliedCoupon(null);
      setAmounts(nextAmounts);
      setErrorMessage(null);

      window.sessionStorage.removeItem(couponStorageKey(order.id));
      window.sessionStorage.removeItem(
        `tikemia:payment:idempotency:${order.id}`,
      );
    },
    [order],
  );

  const handlePayment = useCallback(async () => {
    if (!order || !amounts || submitting || expired) return;

    /*
     * Sécurité : la réduction affichée est recalculée par les routes coupon.
     * La route /api/client/payments/create doit maintenant accepter et
     * revérifier couponCode avant de créer la transaction du montant réduit.
     */
    if (appliedCoupon) {
      setErrorMessage(
        "La route de création du paiement doit être mise à jour pour confirmer le code promo avant le paiement.",
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const idempotencyKey = createPaymentIdempotencyKey(order.id);

      const response = await fetch("/api/client/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          orderId: order.id,
          checkoutToken: order.checkoutToken,
          paymentMethod,
          idempotencyKey,
        }),
      });

      const payload = (await response.json()) as CreatePaymentResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error?.message ||
            payload.message ||
            "Impossible de préparer le paiement.",
        );
      }

      const checkoutUrl = normalizeText(payload.payment?.checkoutUrl);
      const paymentId = normalizeText(payload.payment?.id);

      if (!checkoutUrl || !paymentId) {
        throw new Error(
          "Le lien de paiement sécurisé est indisponible.",
        );
      }

      window.sessionStorage.setItem(
        `tikemia:payment:${paymentId}`,
        JSON.stringify({
          paymentId,
          orderId: order.id,
          checkoutToken: order.checkoutToken,
          createdAt: new Date().toISOString(),
        }),
      );

      window.location.assign(checkoutUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de préparer le paiement.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    amounts,
    appliedCoupon,
    expired,
    order,
    paymentMethod,
    submitting,
  ]);

  const handleCancel = useCallback(() => {
    if (order) {
      removeCheckoutOrder(order.id);
      window.sessionStorage.removeItem(couponStorageKey(order.id));
    }

    router.push(eventHref);
  }, [eventHref, order, router]);

  if (loading) {
    return (
      <div className="min-h-[70vh] w-full animate-pulse px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-[1500px] gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-5">
            <div className="h-64 rounded-3xl bg-white/[0.04]" />
            <div className="h-72 rounded-3xl bg-white/[0.04]" />
          </div>
          <div className="h-[570px] rounded-3xl bg-white/[0.04]" />
        </div>
      </div>
    );
  }

  if (!order || !amounts) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-[28px] border border-red-500/20 bg-[#071015] p-7 text-center">
          <TriangleAlert className="mx-auto h-10 w-10 text-red-400" />
          <h1 className="mt-4 text-2xl font-black text-white">
            Paiement indisponible
          </h1>
          <p className="mt-3 text-sm text-neutral-400">
            {errorMessage || "Cette commande est introuvable."}
          </p>
          <Link
            href="/events"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-black text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux événements
          </Link>
        </div>
      </div>
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
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>

          <div
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black ${
              expired
                ? "border-red-500/20 bg-red-500/[0.08] text-red-300"
                : "border-amber-500/20 bg-amber-500/[0.08] text-amber-300"
            }`}
          >
            <Clock3 className="h-4 w-4" />
            {expired
              ? "Réservation expirée"
              : `Réservation ${formatCountdown(remainingTime)}`}
          </div>
        </div>

        <div className="grid w-full gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="min-w-0 space-y-6">
            <CheckoutOrderSummary order={order} />

            <CheckoutPaymentCard
              value={paymentMethod}
              disabled={submitting || expired}
              onChange={setPaymentMethod}
            />
          </section>

          <CheckoutSummary
            orderId={order.id}
            eventId={order.event.id}
            checkoutToken={order.checkoutToken}
            reference={order.reference}
            currency={order.currency}
            items={order.items}
            amounts={amounts}
            appliedCoupon={appliedCoupon}
            expired={expired}
            submitting={submitting}
            errorMessage={errorMessage}
            onCouponApplied={handleCouponApplied}
            onCouponRemoved={handleCouponRemoved}
            onPay={() => void handlePayment()}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
