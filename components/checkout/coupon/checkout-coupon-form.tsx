"use client";

import {
  LoaderCircle,
  Tag,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import CheckoutCouponApplied, {
  type CheckoutAppliedCoupon,
} from "@/components/checkout/coupon/checkout-coupon-applied";
import CheckoutCouponError from "@/components/checkout/coupon/checkout-coupon-error";

export type CheckoutCouponAmounts = Readonly<{
  subtotal: string;
  platformFee: string;
  discountAmount: string;
  discountedSubtotal: string;
  discountedPlatformFee: string;
  total: string;
  currency: string;
}>;

export type CheckoutCouponResult = Readonly<{
  coupon: CheckoutAppliedCoupon;
  amounts: CheckoutCouponAmounts;
}>;

type CouponApiPayload = {
  success?: boolean;
  message?: string;
  coupon?: {
    id?: string;
    code?: string;
    description?: string | null;
    discountType?: string;
    discountValue?: string;
  };
  amounts?: CheckoutCouponAmounts;
  error?: string | {
    message?: string;
  };
};

function normalizeCouponCode(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function getErrorMessage(
  payload: CouponApiPayload,
  fallback: string,
): string {
  return typeof payload.error === "string"
    ? payload.error
    : payload.error?.message || payload.message || fallback;
}

function buildDiscountLabel({
  discountType,
  discountValue,
  currency,
}: {
  discountType: string;
  discountValue: string;
  currency: string;
}): string {
  const numeric = Number(discountValue);

  if (discountType === "PERCENTAGE") {
    return Number.isFinite(numeric)
      ? `Réduction de ${numeric.toLocaleString("fr-FR", {
          maximumFractionDigits: 2,
        })} %`
      : `Réduction de ${discountValue} %`;
  }

  if (discountType === "SERVICE_FEE") {
    return "Frais de service offerts";
  }

  if (Number.isFinite(numeric)) {
    try {
      return `Réduction de ${new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(numeric)}`;
    } catch {
      return `Réduction de ${numeric.toLocaleString("fr-FR")} ${currency}`;
    }
  }

  return `Réduction de ${discountValue} ${currency}`;
}

export default function CheckoutCouponForm({
  orderId,
  eventId,
  initialCoupon = null,
  disabled = false,
  validateEndpoint = "/api/client/checkout/coupons/validate",
  applyEndpoint = "/api/client/checkout/coupons/apply",
  removeEndpoint = "/api/client/checkout/coupons/remove",
  onApplied,
  onRemoved,
}: {
  orderId: string;
  eventId: string;
  initialCoupon?: CheckoutCouponResult | null;
  disabled?: boolean;
  validateEndpoint?: string;
  applyEndpoint?: string;
  removeEndpoint?: string;
  onApplied: (result: CheckoutCouponResult) => void;
  onRemoved: (amounts: CheckoutCouponAmounts) => void;
}) {
  const inputId = useId();
  const [code, setCode] = useState("");
  const [applied, setApplied] =
    useState<CheckoutCouponResult | null>(initialCoupon);
  const [validating, setValidating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const requestControllerRef =
    useRef<AbortController | null>(null);

  useEffect(() => {
    setApplied(initialCoupon);
  }, [initialCoupon]);

  useEffect(() => {
    return () => {
      requestControllerRef.current?.abort();
    };
  }, []);

  const normalizedCode = normalizeCouponCode(code);
  const canSubmit =
    Boolean(orderId.trim()) &&
    Boolean(eventId.trim()) &&
    normalizedCode.length > 0 &&
    !validating &&
    !removing &&
    !disabled;

  async function submitCoupon() {
    if (!canSubmit) return;

    requestControllerRef.current?.abort();

    const controller = new AbortController();
    requestControllerRef.current = controller;

    setValidating(true);
    setError("");

    try {
      const validateResponse = await fetch(validateEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          orderId,
          eventId,
          code: normalizedCode,
        }),
      });

      const validatePayload =
        (await validateResponse.json()) as CouponApiPayload;

      if (
        !validateResponse.ok ||
        !validatePayload.success ||
        !validatePayload.coupon ||
        !validatePayload.amounts
      ) {
        throw new Error(
          getErrorMessage(
            validatePayload,
            "Ce code promo ne peut pas être appliqué.",
          ),
        );
      }

      const applyResponse = await fetch(applyEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          orderId,
          eventId,
          code: normalizedCode,
        }),
      });

      const applyPayload =
        (await applyResponse.json()) as CouponApiPayload;

      if (
        !applyResponse.ok ||
        !applyPayload.success ||
        !applyPayload.coupon ||
        !applyPayload.amounts
      ) {
        throw new Error(
          getErrorMessage(
            applyPayload,
            "Impossible d’appliquer ce code promo.",
          ),
        );
      }

      const coupon = {
        id: applyPayload.coupon.id || "",
        code: applyPayload.coupon.code || normalizedCode,
        description:
          applyPayload.coupon.description ?? null,
        discountType:
          applyPayload.coupon.discountType || "PERCENTAGE",
        discountValue:
          applyPayload.coupon.discountValue || "0",
        discountLabel: buildDiscountLabel({
          discountType:
            applyPayload.coupon.discountType || "PERCENTAGE",
          discountValue:
            applyPayload.coupon.discountValue || "0",
          currency: applyPayload.amounts.currency,
        }),
      } satisfies CheckoutAppliedCoupon;

      const result: CheckoutCouponResult = {
        coupon,
        amounts: applyPayload.amounts,
      };

      setApplied(result);
      setCode("");
      onApplied(result);
    } catch (caught) {
      if (controller.signal.aborted) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’appliquer ce code promo.",
      );
    } finally {
      if (!controller.signal.aborted) {
        setValidating(false);
      }
    }
  }

  async function removeCoupon() {
    if (!applied || removing || disabled) return;

    requestControllerRef.current?.abort();

    const controller = new AbortController();
    requestControllerRef.current = controller;

    setRemoving(true);
    setError("");

    try {
      const response = await fetch(removeEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          orderId,
          eventId,
          code: applied.coupon.code,
        }),
      });

      const payload =
        (await response.json()) as CouponApiPayload;

      if (
        !response.ok ||
        !payload.success ||
        !payload.amounts
      ) {
        throw new Error(
          getErrorMessage(
            payload,
            "Impossible de retirer le code promo.",
          ),
        );
      }

      setApplied(null);
      setCode("");
      onRemoved(payload.amounts);
    } catch (caught) {
      if (controller.signal.aborted) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible de retirer le code promo.",
      );
    } finally {
      if (!controller.signal.aborted) {
        setRemoving(false);
      }
    }
  }

  if (applied) {
    return (
      <div className="space-y-3">
        <CheckoutCouponApplied
          coupon={applied.coupon}
          removing={removing}
          onRemove={() => void removeCoupon()}
        />

        {error ? (
          <CheckoutCouponError
            message={error}
            onDismiss={() => setError("")}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={inputId}
          className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-neutral-500"
        >
          Code promo
        </label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Tag
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
              aria-hidden="true"
            />

            <input
              id={inputId}
              type="text"
              value={code}
              disabled={disabled || validating || removing}
              onChange={(event) => {
                setCode(event.target.value);
                if (error) setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitCoupon();
                }
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={100}
              placeholder="Ex. URBAN20"
              className="h-11 w-full rounded-xl border border-white/[0.09] bg-black/20 pl-10 pr-3 text-sm font-bold uppercase tracking-wide text-white outline-none transition placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-700 focus:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={() => void submitCoupon()}
            disabled={!canSubmit}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {validating ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Tag className="h-4 w-4" />
            )}

            {validating ? "Vérification..." : "Appliquer"}
          </button>
        </div>

        <p className="mt-2 text-[11px] leading-5 text-neutral-600">
          Le code sera vérifié pour cet événement avant le paiement.
        </p>
      </div>

      {error ? (
        <CheckoutCouponError
          message={error}
          onDismiss={() => setError("")}
        />
      ) : null}
    </div>
  );
}
