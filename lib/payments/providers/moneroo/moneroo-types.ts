export type MonerooPrimitive =
  | string
  | number
  | boolean
  | null;

export type MonerooMetadata = Record<
  string,
  MonerooPrimitive
>;

export type MonerooPaymentStatus =
  | "initiated"
  | "pending"
  | "processing"
  | "successful"
  | "success"
  | "completed"
  | "paid"
  | "failed"
  | "cancelled"
  | "canceled"
  | "expired"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | string;

/* -------------------------------------------------------------------------- */
/* Entrées envoyées à Moneroo                                                 */
/* -------------------------------------------------------------------------- */

export type MonerooCustomerInput = {
  email: string;
  first_name: string;
  last_name: string;

  /*
   * Ces champs restent disponibles pour préserver la compatibilité
   * interne de Tikemia.
   *
   * moneroo-client.ts ne doit toutefois envoyer à Moneroo que :
   * - email
   * - first_name
   * - last_name
   */
  phone?: string;
  address?: string;
  city?: string;
  country_code?: string;
};

export type MonerooInitializePaymentInput = {
  amount: number;
  currency: string;
  description: string;
  return_url: string;
  customer: MonerooCustomerInput;
  metadata?: MonerooMetadata;
};

/* -------------------------------------------------------------------------- */
/* Valeurs retournées par Moneroo                                             */
/* -------------------------------------------------------------------------- */

export type MonerooAmountValue =
  | number
  | string;

export type MonerooCurrencyObject = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  symbol?: string | null;
  decimals?: number | null;

  [key: string]: unknown;
};

export type MonerooCurrencyValue =
  | string
  | MonerooCurrencyObject;

export type MonerooPaymentCustomer = {
  id?: string | null;
  email?: string | null;

  first_name?: string | null;
  last_name?: string | null;

  firstName?: string | null;
  lastName?: string | null;

  phone?: string | null;
  phone_number?: string | null;

  address?: string | null;
  city?: string | null;

  country_code?: string | null;
  countryCode?: string | null;

  [key: string]: unknown;
};

export type MonerooPaymentContext = {
  gateway?: string | null;
  provider?: string | null;

  payment_method?: string | null;
  paymentMethod?: string | null;

  payment_method_type?: string | null;
  method?: string | null;

  country_code?: string | null;
  countryCode?: string | null;

  [key: string]: unknown;
};

export type MonerooPaymentCapture = {
  id?: string | null;

  gateway?: string | null;
  provider?: string | null;
  name?: string | null;

  method?: string | null;
  payment_method?: string | null;
  paymentMethod?: string | null;

  status?: string | null;

  [key: string]: unknown;
};

/* -------------------------------------------------------------------------- */
/* Réponse d’initialisation                                                   */
/* -------------------------------------------------------------------------- */

/**
 * La réponse réelle reçue lors de l’initialisation contient notamment :
 *
 * {
 *   data: {
 *     id: "py_...",
 *     checkout_url: "https://checkout.moneroo.io/..."
 *   }
 * }
 *
 * Le paiement n’est pas encore une transaction complète à cette étape.
 * Le statut, le montant et la devise restent donc facultatifs.
 */
export type MonerooInitializePaymentData = {
  id: string;

  /*
   * Propriété réellement retournée par Moneroo.
   */
  checkout_url?: string | null;

  /*
   * Variantes conservées pour compatibilité avec d’autres réponses
   * ou versions éventuelles de l’intégration.
   */
  checkoutUrl?: string | null;
  link?: string | null;

  status?: MonerooPaymentStatus | null;
  reference?: string | null;

  amount?: MonerooAmountValue | null;
  currency?: MonerooCurrencyValue | null;

  description?: string | null;

  created_at?: string | null;
  createdAt?: string | null;

  metadata?: Record<
    string,
    unknown
  > | null;

  [key: string]: unknown;
};

/* -------------------------------------------------------------------------- */
/* Données complètes d’un paiement                                            */
/* -------------------------------------------------------------------------- */

export type MonerooPaymentData = {
  id: string;
  status: MonerooPaymentStatus;

  amount: MonerooAmountValue;
  currency: MonerooCurrencyValue;

  description?: string | null;

  checkout_url?: string | null;
  checkoutUrl?: string | null;
  link?: string | null;

  reference?: string | null;

  is_processed?: boolean;
  isProcessed?: boolean;

  processed_at?: string | null;
  processedAt?: string | null;

  created_at?: string | null;
  createdAt?: string | null;

  updated_at?: string | null;
  updatedAt?: string | null;

  return_url?: string | null;
  returnUrl?: string | null;

  environment?: string | null;

  amount_formatted?: string | null;
  amountFormatted?: string | null;

  gateway?: string | null;
  method?: string | null;

  customer?:
    | MonerooPaymentCustomer
    | null;

  context?:
    | MonerooPaymentContext
    | null;

  capture?:
    | MonerooPaymentCapture
    | null;

  metadata?: Record<
    string,
    unknown
  > | null;

  [key: string]: unknown;
};

/* -------------------------------------------------------------------------- */
/* Enveloppe API                                                              */
/* -------------------------------------------------------------------------- */

export type MonerooApiResponse<T> = {
  /*
   * La réponse réelle peut ne pas contenir success.
   */
  success?: boolean;

  message?: string | null;

  data: T;

  errors?:
    | Record<string, unknown>
    | unknown[]
    | null;

  [key: string]: unknown;
};

export type MonerooInitializePaymentResponse =
  MonerooApiResponse<
    MonerooInitializePaymentData
  >;

export type MonerooRetrievePaymentResponse =
  MonerooApiResponse<
    MonerooPaymentData
  >;

export type MonerooVerifyPaymentResponse =
  MonerooApiResponse<
    MonerooPaymentData
  >;

/* -------------------------------------------------------------------------- */
/* Erreurs                                                                    */
/* -------------------------------------------------------------------------- */

export type MonerooApiErrorPayload = {
  success?: boolean;

  message?: string | null;

  error?:
    | string
    | Record<string, unknown>
    | null;

  detail?: string | null;
  description?: string | null;
  code?: string | null;

  errors?:
    | Record<string, unknown>
    | unknown[]
    | null;

  data?: unknown;

  [key: string]: unknown;
};

/* -------------------------------------------------------------------------- */
/* Options de requête                                                         */
/* -------------------------------------------------------------------------- */

export type MonerooRequestOptions = {
  signal?: AbortSignal;
  idempotencyKey?: string;
};

/* -------------------------------------------------------------------------- */
/* Webhooks                                                                   */
/* -------------------------------------------------------------------------- */

export type MonerooWebhookPayload = {
  id?: string;
  event?: string;
  type?: string;

  data?: {
    id?: string;

    payment_id?: string;
    paymentId?: string;

    status?: MonerooPaymentStatus;

    [key: string]: unknown;
  };

  [key: string]: unknown;
};

/* -------------------------------------------------------------------------- */
/* Gardes de types                                                            */
/* -------------------------------------------------------------------------- */

export function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isOptionalBoolean(
  value: unknown,
): boolean {
  return (
    value === undefined ||
    typeof value === "boolean"
  );
}

function isValidAmountValue(
  value: unknown,
): value is MonerooAmountValue {
  if (
    typeof value === "number"
  ) {
    return Number.isFinite(
      value,
    );
  }

  if (
    typeof value !== "string"
  ) {
    return false;
  }

  const normalizedValue =
    value
      .trim()
      .replace(",", ".");

  if (!normalizedValue) {
    return false;
  }

  return Number.isFinite(
    Number(normalizedValue),
  );
}

function isValidCurrencyValue(
  value: unknown,
): value is MonerooCurrencyValue {
  if (
    isNonEmptyString(value)
  ) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return isNonEmptyString(
    value.code,
  );
}

/**
 * Retourne le lien de checkout disponible dans une réponse Moneroo.
 *
 * La priorité correspond au format réellement reçu :
 * 1. checkout_url
 * 2. checkoutUrl
 * 3. link
 */
export function getMonerooCheckoutUrl(
  value:
    | MonerooInitializePaymentData
    | MonerooPaymentData,
): string | null {
  const candidates = [
    value.checkout_url,
    value.checkoutUrl,
    value.link,
  ];

  for (
    const candidate of
    candidates
  ) {
    if (
      typeof candidate ===
        "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return null;
}

/**
 * Vérifie l’enveloppe générale de réponse Moneroo.
 *
 * La propriété success est facultative.
 */
export function isMonerooApiResponse<T>(
  value: unknown,
  isData: (
    data: unknown,
  ) => data is T,
): value is MonerooApiResponse<T> {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isOptionalBoolean(
      value.success,
    )
  ) {
    return false;
  }

  if (!("data" in value)) {
    return false;
  }

  return isData(
    value.data,
  );
}

/**
 * Vérifie les données reçues lors de l’initialisation.
 *
 * Le paiement doit obligatoirement contenir :
 * - un identifiant ;
 * - au moins un lien de checkout valide.
 *
 * Le format réellement reçu utilise checkout_url.
 */
export function isMonerooInitializePaymentData(
  value: unknown,
): value is MonerooInitializePaymentData {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNonEmptyString(
      value.id,
    )
  ) {
    return false;
  }

  const checkoutUrl =
    isNonEmptyString(
      value.checkout_url,
    )
      ? value.checkout_url.trim()
      : isNonEmptyString(
            value.checkoutUrl,
          )
        ? value.checkoutUrl.trim()
        : isNonEmptyString(
              value.link,
            )
          ? value.link.trim()
          : null;

  if (!checkoutUrl) {
    return false;
  }

  try {
    const parsedUrl =
      new URL(checkoutUrl);

    if (
      parsedUrl.protocol !==
        "https:" &&
      parsedUrl.protocol !==
        "http:"
    ) {
      return false;
    }
  } catch {
    return false;
  }

  if (
    value.status !==
      undefined &&
    value.status !== null &&
    !isNonEmptyString(
      value.status,
    )
  ) {
    return false;
  }

  if (
    value.amount !==
      undefined &&
    value.amount !== null &&
    !isValidAmountValue(
      value.amount,
    )
  ) {
    return false;
  }

  if (
    value.currency !==
      undefined &&
    value.currency !== null &&
    !isValidCurrencyValue(
      value.currency,
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Vérifie les données complètes reçues lors d’une récupération
 * ou d’une vérification de paiement.
 */
export function isMonerooPaymentData(
  value: unknown,
): value is MonerooPaymentData {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNonEmptyString(
      value.id,
    )
  ) {
    return false;
  }

  if (
    !isNonEmptyString(
      value.status,
    )
  ) {
    return false;
  }

  if (
    !isValidAmountValue(
      value.amount,
    )
  ) {
    return false;
  }

  if (
    !isValidCurrencyValue(
      value.currency,
    )
  ) {
    return false;
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* Payouts / remboursements                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Moneroo utilise l'API Payout pour envoyer de l'argent à un client.
 *
 * Cette structure est ajoutée séparément des types Payment afin de ne pas
 * modifier ni casser le flux de paiement déjà utilisé par Tikemia.
 */
export type MonerooPayoutStatus =
  | "initiated"
  | "pending"
  | "processing"
  | "successful"
  | "success"
  | "completed"
  | "paid"
  | "failed"
  | "cancelled"
  | "canceled"
  | "expired"
  | string;

export type MonerooPayoutRecipient = {
  /**
   * Numéro du bénéficiaire, au format attendu par le moyen de transfert
   * sélectionné (ex. Mobile Money).
   */
  msisdn?: string;

  /**
   * Certains moyens de transfert futurs peuvent demander d'autres champs.
   * On garde cette ouverture sans affaiblir les champs obligatoires de Tikemia.
   */
  [key: string]: unknown;
};

export type MonerooPayoutCustomerInput = {
  email: string;
  first_name: string;
  last_name: string;
};

export type MonerooInitializePayoutInput = {
  /**
   * Montant entier envoyé à Moneroo.
   */
  amount: number;

  /**
   * Devise ISO 4217, par exemple XOF.
   */
  currency: string;

  description: string;

  /**
   * Code de la méthode de payout Moneroo, par exemple mtn_bj.
   */
  method: string;

  customer: MonerooPayoutCustomerInput;

  /**
   * Données nécessaires au bénéficiaire.
   * Pour Mobile Money, Moneroo utilise notamment recipient.msisdn.
   */
  recipient: MonerooPayoutRecipient;

  /**
   * Métadonnées internes Tikemia.
   *
   * Ne jamais y mettre de secret, de clé API ou de donnée sensible inutile.
   */
  metadata?: MonerooMetadata;
};

export type MonerooPayoutData = {
  id: string;

  status?: MonerooPayoutStatus | null;

  reference?: string | null;

  amount?: MonerooAmountValue | null;

  currency?: MonerooCurrencyValue | null;

  description?: string | null;

  method?: string | null;

  gateway?: string | null;
  provider?: string | null;

  customer?:
    | MonerooPaymentCustomer
    | null;

  recipient?:
    | Record<string, unknown>
    | null;

  metadata?:
    | Record<string, unknown>
    | null;

  is_processed?: boolean;
  isProcessed?: boolean;

  processed_at?: string | null;
  processedAt?: string | null;

  created_at?: string | null;
  createdAt?: string | null;

  updated_at?: string | null;
  updatedAt?: string | null;

  [key: string]: unknown;
};

export type MonerooInitializePayoutResponse =
  MonerooApiResponse<
    MonerooPayoutData
  >;

export type MonerooRetrievePayoutResponse =
  MonerooApiResponse<
    MonerooPayoutData
  >;

/**
 * Vérifie les données minimales retournées lors de l'initialisation d'un payout.
 *
 * Moneroo documente au minimum data.id pour une initialisation réussie.
 * Les autres propriétés restent facultatives afin de préserver la compatibilité
 * avec les réponses réelles du prestataire.
 */
export function isMonerooInitializePayoutData(
  value: unknown,
): value is MonerooPayoutData {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNonEmptyString(
      value.id,
    )
  ) {
    return false;
  }

  if (
    value.status !==
      undefined &&
    value.status !==
      null &&
    !isNonEmptyString(
      value.status,
    )
  ) {
    return false;
  }

  if (
    value.amount !==
      undefined &&
    value.amount !==
      null &&
    !isValidAmountValue(
      value.amount,
    )
  ) {
    return false;
  }

  if (
    value.currency !==
      undefined &&
    value.currency !==
      null &&
    !isValidCurrencyValue(
      value.currency,
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Vérifie les données d'un payout récupéré depuis Moneroo.
 *
 * L'identifiant est obligatoire. Le statut, le montant et la devise sont
 * validés lorsqu'ils sont présents.
 */
export function isMonerooPayoutData(
  value: unknown,
): value is MonerooPayoutData {
  return isMonerooInitializePayoutData(
    value,
  );
}

/**
 * Alias explicite utilisé par le moteur de remboursement Tikemia.
 *
 * Un remboursement exécuté via l'API Payout reste techniquement un payout
 * Moneroo. Cet alias évite de confondre ce flux avec l'état du Payment initial.
 */
export type MonerooRefundPayoutInput =
  MonerooInitializePayoutInput;

export type MonerooRefundPayoutResponse =
  MonerooInitializePayoutResponse;