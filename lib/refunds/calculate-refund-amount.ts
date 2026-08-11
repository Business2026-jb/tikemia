import "server-only";

import { RefundError } from "@/lib/refunds/errors";

type RefundAmountValue =
  | string
  | number;

function toMinorUnits(
  value: RefundAmountValue,
): number {
  const normalizedValue =
    typeof value === "number"
      ? value
      : Number(
          value
            .trim()
            .replace(/\s/g, "")
            .replace(",", "."),
        );

  if (
    !Number.isFinite(
      normalizedValue,
    ) ||
    normalizedValue < 0
  ) {
    throw new RefundError({
      code:
        "REFUND_AMOUNT_INVALID",

      message:
        "Le montant du billet à rembourser est invalide.",

      status: 400,
    });
  }

  return Math.round(
    (normalizedValue +
      Number.EPSILON) *
      100,
  );
}

function fromMinorUnits(
  value: number,
): string {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new RefundError({
      code:
        "REFUND_AMOUNT_INVALID",

      message:
        "Le montant calculé du remboursement est invalide.",

      status: 400,
    });
  }

  return (
    value / 100
  ).toFixed(2);
}

export function calculateRefundAmount({
  ticketAmounts,
  maximumRefundableAmount,
}: {
  ticketAmounts:
    readonly RefundAmountValue[];

  maximumRefundableAmount?:
    | RefundAmountValue
    | null;
}): string {
  if (
    ticketAmounts.length === 0
  ) {
    throw new RefundError({
      code:
        "REFUND_AMOUNT_INVALID",

      message:
        "Aucun billet n’a été sélectionné pour le remboursement.",

      status: 400,
    });
  }

  const totalMinor =
    ticketAmounts.reduce<number>(
      (
        total,
        ticketAmount,
      ) => {
        const ticketMinor =
          toMinorUnits(
            ticketAmount,
          );

        const nextTotal =
          total +
          ticketMinor;

        if (
          !Number.isSafeInteger(
            nextTotal,
          )
        ) {
          throw new RefundError({
            code:
              "REFUND_AMOUNT_INVALID",

            message:
              "Le montant total du remboursement est trop élevé ou invalide.",

            status: 400,
          });
        }

        return nextTotal;
      },
      0,
    );

  if (totalMinor <= 0) {
    throw new RefundError({
      code:
        "REFUND_AMOUNT_INVALID",

      message:
        "Le montant du remboursement doit être supérieur à zéro.",

      status: 400,
    });
  }

  if (
    maximumRefundableAmount !==
      null &&
    maximumRefundableAmount !==
      undefined
  ) {
    const maximumMinor =
      toMinorUnits(
        maximumRefundableAmount,
      );

    if (
      maximumMinor <= 0
    ) {
      throw new RefundError({
        code:
          "REFUND_AMOUNT_INVALID",

        message:
          "Ce paiement ne possède plus de montant remboursable.",

        status: 409,
      });
    }

    if (
      totalMinor >
      maximumMinor
    ) {
      throw new RefundError({
        code:
          "REFUND_AMOUNT_INVALID",

        message:
          "Le montant demandé dépasse le montant encore remboursable sur ce paiement.",

        status: 409,
      });
    }
  }

  return fromMinorUnits(
    totalMinor,
  );
}