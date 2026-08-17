"use client";

import Image from "next/image";
import {
  Banknote,
  Check,
  CreditCard,
  Smartphone,
} from "lucide-react";

export type CheckoutPaymentMethod =
  | "CARD"
  | "MTN_MOMO"
  | "MOOV_MONEY"
  | "CELTIIS_CASH"
  | "ORANGE_MONEY"
  | "WAVE";

type PaymentMethodOption = Readonly<{
  id: CheckoutPaymentMethod;
  title: string;
  description: string;
  icon: "card" | "phone";
  logos?: readonly {
    src: string;
    alt: string;
  }[];
}>;

const PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  {
    id: "CARD",
    title: "Carte bancaire",
    description: "Visa et Mastercard",
    icon: "card",
    logos: [
      { src: "/images/payments/visa.png", alt: "Visa" },
      {
        src: "/images/payments/mastercard.png",
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
        src: "/images/payments/mtn-momo.png",
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
        src: "/images/payments/moov-money.png",
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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function CheckoutPaymentCard({
  value,
  disabled,
  onChange,
}: {
  value: CheckoutPaymentMethod;
  disabled: boolean;
  onChange: (value: CheckoutPaymentMethod) => void;
}) {
  return (
    <section className="rounded-[30px] border border-white/[0.08] bg-[#071015] p-5 shadow-[0_26px_80px_rgba(0,0,0,0.24)] sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-400">
          <Banknote className="h-5 w-5" />
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
        {PAYMENT_METHODS.map((option) => {
          const selected = value === option.id;
          const Icon = option.icon === "card" ? CreditCard : Smartphone;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              disabled={disabled}
              className={cn(
                "group relative flex min-h-[104px] items-center gap-4 rounded-2xl border p-4 text-left outline-none transition",
                "focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071015]",
                selected
                  ? "border-lime-400/35 bg-lime-400/[0.08]"
                  : "border-white/[0.08] bg-black/10 hover:border-white/[0.16] hover:bg-white/[0.025]",
                disabled && "cursor-not-allowed opacity-60",
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
                <Icon className="h-5 w-5" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-white">
                  {option.title}
                </span>

                <span className="mt-1 block text-xs leading-5 text-neutral-500">
                  {option.description}
                </span>

                {option.logos ? (
                  <span className="mt-3 flex flex-wrap items-center gap-2">
                    {option.logos.map((logo) => (
                      <span
                        key={logo.src}
                        className="relative h-5 w-10 overflow-hidden rounded bg-white px-1"
                      >
                        <Image
                          src={logo.src}
                          alt={logo.alt}
                          fill
                          sizes="40px"
                          className="object-contain p-0.5"
                        />
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>

              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  selected
                    ? "border-lime-400 bg-lime-400 text-black"
                    : "border-white/[0.12] text-transparent",
                )}
              >
                <Check className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
