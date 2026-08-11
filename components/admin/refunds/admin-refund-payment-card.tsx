"use client";

import {
  CreditCard,
  Hash,
  ReceiptText,
  WalletCards,
} from "lucide-react";

import type {
  AdminRefundDetail,
} from "@/components/admin/refunds/admin-refunds-page";

function formatMoney(
  amount: string,
  currency: string,
): string {
  const value =
    Number(
      amount,
    );

  if (
    !Number.isFinite(
      value,
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
        currency:
          currency.toUpperCase(),
      },
    ).format(
      value,
    );
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default function AdminRefundPaymentCard({
  refund,
}: {
  refund:
    AdminRefundDetail;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
        Paiement
      </p>

      <div className="mt-4 space-y-3">
        <Info
          icon={
            CreditCard
          }
          label="Prestataire"
          value={
            refund.payment
              .provider
          }
        />
        <Info
          icon={
            WalletCards
          }
          label="Montant payé"
          value={formatMoney(
            refund.payment
              .amount,
            refund.payment
              .currency,
          )}
        />
        <Info
          icon={
            ReceiptText
          }
          label="Commande"
          value={
            refund.order
              .reference
          }
        />
        <Info
          icon={
            Hash
          }
          label="Transaction"
          value={
            refund.payment
              .providerTransactionId ??
            refund.payment
              .providerReference ??
            "Non disponible"
          }
        />
      </div>
    </section>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon:
    typeof CreditCard;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-neutral-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-neutral-600">
          {label}
        </p>
        <p className="mt-1 break-all text-sm font-bold text-neutral-200">
          {value}
        </p>
      </div>
    </div>
  );
}
