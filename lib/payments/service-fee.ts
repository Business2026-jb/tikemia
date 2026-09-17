export const SERVICE_FEE_RATE_PERCENT =
  5;

export const SERVICE_FEE_CAP_FCFA =
  5_000;

export function isFcfaCurrency(
  currency:
    | string
    | null
    | undefined,
): boolean {
  const normalizedCurrency =
    currency
      ?.trim()
      .toUpperCase() ??
    "";

  return (
    normalizedCurrency ===
      "XOF" ||
    normalizedCurrency ===
      "XAF"
  );
}

function normalizeAmount(
  value: number,
): number {
  return Number.isFinite(
    value,
  )
    ? Math.max(
        value,
        0,
      )
    : 0;
}

export function calculateServiceFee(
  subtotal: number,
  currency = "XOF",
): number {
  const normalizedSubtotal =
    normalizeAmount(
      subtotal,
    );

  if (
    normalizedSubtotal <=
    0
  ) {
    return 0;
  }

  const rawFee =
    normalizedSubtotal *
    (
      SERVICE_FEE_RATE_PERCENT /
      100
    );

  /*
   * Le FCFA ne possède pas de subdivision
   * monétaire utilisée dans Tikemia.
   *
   * On arrondit donc toujours vers le franc
   * supérieur afin qu'un montant positif ne
   * génère jamais 0 F de frais par simple
   * arrondi.
   */
  if (
    isFcfaCurrency(
      currency,
    )
  ) {
    return Math.min(
      SERVICE_FEE_CAP_FCFA,
      Math.ceil(
        rawFee,
      ),
    );
  }

  /*
   * Pour les devises avec décimales :
   * arrondi supérieur au centime.
   *
   * Aucun plafond FCFA n'est appliqué
   * à une autre devise.
   */
  return (
    Math.ceil(
      rawFee *
        100,
    ) /
    100
  );
}

export function calculateOrderPricing(
  subtotal: number,
  currency = "XOF",
): {
  subtotal: number;
  serviceFee: number;
  total: number;
} {
  const normalizedSubtotal =
    normalizeAmount(
      subtotal,
    );

  const serviceFee =
    calculateServiceFee(
      normalizedSubtotal,
      currency,
    );

  return {
    subtotal:
      normalizedSubtotal,

    serviceFee,

    total:
      normalizedSubtotal +
      serviceFee,
  };
}