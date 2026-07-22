/**
 * Moteur financier officiel de Tikemia.
 *
 * Règle actuelle :
 * - le client paie le prix affiché ;
 * - Tikemia retient 6 % sur chaque vente ;
 * - l’organisateur reçoit le montant restant ;
 * - aucun montant n’est calculé avec des flottants imprécis.
 */

export const TIKEMIA_PLATFORM_FEE_PERCENT = 6;
export const TIKEMIA_PLATFORM_FEE_BASIS_POINTS = 600;

export const DEFAULT_EVENT_CURRENCY = "XOF";

const BASIS_POINTS_DIVISOR = 10_000;

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

const THREE_DECIMAL_CURRENCIES = new Set([
  "BHD",
  "IQD",
  "JOD",
  "KWD",
  "LYD",
  "OMR",
  "TND",
]);

export type MoneyInput = string | number;

export type TicketPricingInput = {
  unitPrice: MoneyInput;
  quantity: number;
  currency?: string;
  platformFeePercent?: number;
};

export type TicketPricingResult = {
  currency: string;
  quantity: number;
  platformFeePercent: number;
  platformFeeBasisPoints: number;

  unit: {
    gross: number;
    platformFee: number;
    organizerNet: number;
  };

  totals: {
    grossRevenue: number;
    platformFee: number;
    organizerNet: number;
    customerTotal: number;
  };

  minorUnits: {
    unitGross: number;
    unitPlatformFee: number;
    unitOrganizerNet: number;
    grossRevenue: number;
    platformFee: number;
    organizerNet: number;
    customerTotal: number;
  };
};

export type EventTicketTypePricingInput = {
  id?: string;
  name: string;
  unitPrice: MoneyInput;
  quantity: number;
};

export type EventTicketTypePricingResult = {
  id?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  grossRevenue: number;
  platformFee: number;
  organizerNet: number;
};

export type EventRevenueProjection = {
  currency: string;
  platformFeePercent: number;
  totalCapacity: number;
  averageTicketPrice: number;

  grossRevenue: number;
  platformFee: number;
  organizerNet: number;
  customerTotal: number;

  ticketTypes: EventTicketTypePricingResult[];
};

export type OrderPricingLineInput = {
  ticketTypeId: string;
  name?: string;
  unitPrice: MoneyInput;
  quantity: number;
};

export type OrderPricingLineResult = {
  ticketTypeId: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  platformFee: number;
  organizerNet: number;
  total: number;
};

export type OrderPricingResult = {
  currency: string;
  platformFeePercent: number;
  quantity: number;
  subtotal: number;
  platformFee: number;
  organizerNet: number;
  total: number;
  lines: OrderPricingLineResult[];
};

export class PricingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingValidationError";
  }
}

export function normalizeCurrency(
  currency?: string,
): string {
  const normalizedCurrency =
    currency?.trim().toUpperCase() ||
    DEFAULT_EVENT_CURRENCY;

  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new PricingValidationError(
      "La devise doit contenir exactement trois lettres.",
    );
  }

  return normalizedCurrency;
}

export function getCurrencyFractionDigits(
  currency: string,
): number {
  const normalizedCurrency = normalizeCurrency(currency);

  if (ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return 0;
  }

  if (THREE_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return 3;
  }

  return 2;
}

export function percentageToBasisPoints(
  percentage: number,
): number {
  if (!Number.isFinite(percentage)) {
    throw new PricingValidationError(
      "Le pourcentage de commission est invalide.",
    );
  }

  if (percentage < 0 || percentage > 100) {
    throw new PricingValidationError(
      "Le pourcentage de commission doit être compris entre 0 et 100.",
    );
  }

  return Math.round(percentage * 100);
}

export function basisPointsToPercentage(
  basisPoints: number,
): number {
  if (
    !Number.isInteger(basisPoints) ||
    basisPoints < 0 ||
    basisPoints > BASIS_POINTS_DIVISOR
  ) {
    throw new PricingValidationError(
      "Le taux de commission en points de base est invalide.",
    );
  }

  return basisPoints / 100;
}

export function moneyToMinorUnits(
  value: MoneyInput,
  currency = DEFAULT_EVENT_CURRENCY,
): number {
  const normalizedCurrency = normalizeCurrency(currency);
  const fractionDigits = getCurrencyFractionDigits(
    normalizedCurrency,
  );

  const normalizedValue =
    typeof value === "number"
      ? value.toString()
      : value.trim().replace(/\s/g, "").replace(",", ".");

  if (!normalizedValue) {
    throw new PricingValidationError(
      "Le montant est obligatoire.",
    );
  }

  if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
    throw new PricingValidationError(
      "Le montant renseigné n’est pas valide.",
    );
  }

  const [integerPart, decimalPart = ""] =
    normalizedValue.split(".");

  if (decimalPart.length > fractionDigits) {
    throw new PricingValidationError(
      fractionDigits === 0
        ? `${normalizedCurrency} n’accepte pas de décimales.`
        : `Le montant ne peut pas contenir plus de ${fractionDigits} décimale${
            fractionDigits > 1 ? "s" : ""
          }.`,
    );
  }

  const paddedDecimalPart = decimalPart
    .padEnd(fractionDigits, "0")
    .slice(0, fractionDigits);

  const multiplier = 10 ** fractionDigits;

  const integerMinorUnits =
    Number(integerPart) * multiplier;

  const decimalMinorUnits = paddedDecimalPart
    ? Number(paddedDecimalPart)
    : 0;

  const minorUnits =
    integerMinorUnits + decimalMinorUnits;

  if (
    !Number.isSafeInteger(minorUnits) ||
    minorUnits < 0
  ) {
    throw new PricingValidationError(
      "Le montant est trop élevé ou invalide.",
    );
  }

  return minorUnits;
}

export function minorUnitsToMoney(
  minorUnits: number,
  currency = DEFAULT_EVENT_CURRENCY,
): number {
  if (
    !Number.isSafeInteger(minorUnits) ||
    minorUnits < 0
  ) {
    throw new PricingValidationError(
      "Le montant en unité minimale est invalide.",
    );
  }

  const fractionDigits = getCurrencyFractionDigits(
    currency,
  );

  return minorUnits / 10 ** fractionDigits;
}

export function formatMoney(
  value: MoneyInput,
  currency = DEFAULT_EVENT_CURRENCY,
  locale = "fr-FR",
): string {
  const normalizedCurrency = normalizeCurrency(currency);
  const minorUnits = moneyToMinorUnits(
    value,
    normalizedCurrency,
  );

  const amount = minorUnitsToMoney(
    minorUnits,
    normalizedCurrency,
  );

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: getCurrencyFractionDigits(
      normalizedCurrency,
    ),
    maximumFractionDigits: getCurrencyFractionDigits(
      normalizedCurrency,
    ),
  }).format(amount);
}

export function calculatePlatformFeeMinorUnits(
  grossAmountMinorUnits: number,
  platformFeeBasisPoints =
    TIKEMIA_PLATFORM_FEE_BASIS_POINTS,
): number {
  if (
    !Number.isSafeInteger(grossAmountMinorUnits) ||
    grossAmountMinorUnits < 0
  ) {
    throw new PricingValidationError(
      "Le montant brut est invalide.",
    );
  }

  if (
    !Number.isInteger(platformFeeBasisPoints) ||
    platformFeeBasisPoints < 0 ||
    platformFeeBasisPoints > BASIS_POINTS_DIVISOR
  ) {
    throw new PricingValidationError(
      "Le taux de commission Tikemia est invalide.",
    );
  }

  return Math.round(
    (grossAmountMinorUnits *
      platformFeeBasisPoints) /
      BASIS_POINTS_DIVISOR,
  );
}

export function calculateTicketPricing({
  unitPrice,
  quantity,
  currency = DEFAULT_EVENT_CURRENCY,
  platformFeePercent =
    TIKEMIA_PLATFORM_FEE_PERCENT,
}: TicketPricingInput): TicketPricingResult {
  const normalizedCurrency = normalizeCurrency(currency);

  if (
    !Number.isInteger(quantity) ||
    quantity < 0
  ) {
    throw new PricingValidationError(
      "La quantité de billets doit être un nombre entier positif ou nul.",
    );
  }

  const platformFeeBasisPoints =
    percentageToBasisPoints(platformFeePercent);

  const unitGrossMinorUnits = moneyToMinorUnits(
    unitPrice,
    normalizedCurrency,
  );

  const grossRevenueMinorUnits =
    unitGrossMinorUnits * quantity;

  if (!Number.isSafeInteger(grossRevenueMinorUnits)) {
    throw new PricingValidationError(
      "Le revenu potentiel est trop élevé.",
    );
  }

  /*
   * La commission est calculée sur le total de la ligne.
   * Cela évite l’accumulation d’erreurs d’arrondi pour plusieurs billets.
   */
  const platformFeeMinorUnits =
    calculatePlatformFeeMinorUnits(
      grossRevenueMinorUnits,
      platformFeeBasisPoints,
    );

  const organizerNetMinorUnits =
    grossRevenueMinorUnits - platformFeeMinorUnits;

  const unitPlatformFeeMinorUnits =
    quantity > 0
      ? Math.round(platformFeeMinorUnits / quantity)
      : calculatePlatformFeeMinorUnits(
          unitGrossMinorUnits,
          platformFeeBasisPoints,
        );

  const unitOrganizerNetMinorUnits =
    Math.max(
      unitGrossMinorUnits -
        unitPlatformFeeMinorUnits,
      0,
    );

  return {
    currency: normalizedCurrency,
    quantity,
    platformFeePercent:
      basisPointsToPercentage(
        platformFeeBasisPoints,
      ),
    platformFeeBasisPoints,

    unit: {
      gross: minorUnitsToMoney(
        unitGrossMinorUnits,
        normalizedCurrency,
      ),
      platformFee: minorUnitsToMoney(
        unitPlatformFeeMinorUnits,
        normalizedCurrency,
      ),
      organizerNet: minorUnitsToMoney(
        unitOrganizerNetMinorUnits,
        normalizedCurrency,
      ),
    },

    totals: {
      grossRevenue: minorUnitsToMoney(
        grossRevenueMinorUnits,
        normalizedCurrency,
      ),
      platformFee: minorUnitsToMoney(
        platformFeeMinorUnits,
        normalizedCurrency,
      ),
      organizerNet: minorUnitsToMoney(
        organizerNetMinorUnits,
        normalizedCurrency,
      ),

      /*
       * Tikemia retient sa commission sur le prix du billet.
       * Elle n’est pas ajoutée en supplément au client.
       */
      customerTotal: minorUnitsToMoney(
        grossRevenueMinorUnits,
        normalizedCurrency,
      ),
    },

    minorUnits: {
      unitGross: unitGrossMinorUnits,
      unitPlatformFee:
        unitPlatformFeeMinorUnits,
      unitOrganizerNet:
        unitOrganizerNetMinorUnits,
      grossRevenue: grossRevenueMinorUnits,
      platformFee: platformFeeMinorUnits,
      organizerNet: organizerNetMinorUnits,
      customerTotal: grossRevenueMinorUnits,
    },
  };
}

export function calculateEventRevenueProjection(
  ticketTypes: readonly EventTicketTypePricingInput[],
  options?: {
    currency?: string;
    platformFeePercent?: number;
  },
): EventRevenueProjection {
  const currency = normalizeCurrency(
    options?.currency,
  );

  const platformFeePercent =
    options?.platformFeePercent ??
    TIKEMIA_PLATFORM_FEE_PERCENT;

  const platformFeeBasisPoints =
    percentageToBasisPoints(
      platformFeePercent,
    );

  if (ticketTypes.length === 0) {
    return {
      currency,
      platformFeePercent,
      totalCapacity: 0,
      averageTicketPrice: 0,
      grossRevenue: 0,
      platformFee: 0,
      organizerNet: 0,
      customerTotal: 0,
      ticketTypes: [],
    };
  }

  let totalCapacity = 0;
  let totalGrossMinorUnits = 0;
  let totalPlatformFeeMinorUnits = 0;
  let totalOrganizerNetMinorUnits = 0;

  const calculatedTicketTypes =
    ticketTypes.map((ticketType) => {
      const cleanName = ticketType.name.trim();

      if (!cleanName) {
        throw new PricingValidationError(
          "Chaque type de billet doit avoir un nom.",
        );
      }

      const pricing = calculateTicketPricing({
        unitPrice: ticketType.unitPrice,
        quantity: ticketType.quantity,
        currency,
        platformFeePercent,
      });

      totalCapacity += pricing.quantity;
      totalGrossMinorUnits +=
        pricing.minorUnits.grossRevenue;
      totalPlatformFeeMinorUnits +=
        pricing.minorUnits.platformFee;
      totalOrganizerNetMinorUnits +=
        pricing.minorUnits.organizerNet;

      return {
        id: ticketType.id,
        name: cleanName,
        unitPrice: pricing.unit.gross,
        quantity: pricing.quantity,
        grossRevenue:
          pricing.totals.grossRevenue,
        platformFee:
          pricing.totals.platformFee,
        organizerNet:
          pricing.totals.organizerNet,
      };
    });

  const averageTicketPriceMinorUnits =
    totalCapacity > 0
      ? Math.round(
          totalGrossMinorUnits / totalCapacity,
        )
      : 0;

  return {
    currency,
    platformFeePercent:
      basisPointsToPercentage(
        platformFeeBasisPoints,
      ),
    totalCapacity,
    averageTicketPrice: minorUnitsToMoney(
      averageTicketPriceMinorUnits,
      currency,
    ),
    grossRevenue: minorUnitsToMoney(
      totalGrossMinorUnits,
      currency,
    ),
    platformFee: minorUnitsToMoney(
      totalPlatformFeeMinorUnits,
      currency,
    ),
    organizerNet: minorUnitsToMoney(
      totalOrganizerNetMinorUnits,
      currency,
    ),
    customerTotal: minorUnitsToMoney(
      totalGrossMinorUnits,
      currency,
    ),
    ticketTypes: calculatedTicketTypes,
  };
}

export function calculateOrderPricing(
  lines: readonly OrderPricingLineInput[],
  options?: {
    currency?: string;
    platformFeePercent?: number;
  },
): OrderPricingResult {
  const currency = normalizeCurrency(
    options?.currency,
  );

  const platformFeePercent =
    options?.platformFeePercent ??
    TIKEMIA_PLATFORM_FEE_PERCENT;

  if (lines.length === 0) {
    throw new PricingValidationError(
      "La commande doit contenir au moins un billet.",
    );
  }

  let totalQuantity = 0;
  let subtotalMinorUnits = 0;
  let platformFeeMinorUnits = 0;
  let organizerNetMinorUnits = 0;

  const calculatedLines = lines.map((line) => {
    const ticketTypeId =
      line.ticketTypeId.trim();

    if (!ticketTypeId) {
      throw new PricingValidationError(
        "L’identifiant du type de billet est obligatoire.",
      );
    }

    if (
      !Number.isInteger(line.quantity) ||
      line.quantity <= 0
    ) {
      throw new PricingValidationError(
        "La quantité commandée doit être supérieure à zéro.",
      );
    }

    const pricing = calculateTicketPricing({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      currency,
      platformFeePercent,
    });

    totalQuantity += line.quantity;
    subtotalMinorUnits +=
      pricing.minorUnits.grossRevenue;
    platformFeeMinorUnits +=
      pricing.minorUnits.platformFee;
    organizerNetMinorUnits +=
      pricing.minorUnits.organizerNet;

    return {
      ticketTypeId,
      name: line.name?.trim() || undefined,
      quantity: line.quantity,
      unitPrice: pricing.unit.gross,
      subtotal: pricing.totals.grossRevenue,
      platformFee:
        pricing.totals.platformFee,
      organizerNet:
        pricing.totals.organizerNet,
      total: pricing.totals.customerTotal,
    };
  });

  return {
    currency,
    platformFeePercent,
    quantity: totalQuantity,
    subtotal: minorUnitsToMoney(
      subtotalMinorUnits,
      currency,
    ),
    platformFee: minorUnitsToMoney(
      platformFeeMinorUnits,
      currency,
    ),
    organizerNet: minorUnitsToMoney(
      organizerNetMinorUnits,
      currency,
    ),

    /*
     * Le client paie le sous-total des billets.
     * Les 6 % sont déduits de ce montant.
     */
    total: minorUnitsToMoney(
      subtotalMinorUnits,
      currency,
    ),

    lines: calculatedLines,
  };
}