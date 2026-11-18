import { unstable_rethrow } from "next/navigation";

import { NextRequest, NextResponse } from "next/server";

import { getPublicPaymentMethods } from "@/lib/payments/methods";

import type {
  CheckoutType,
  CountryCode,
  CurrencyCode,
  PaymentMethodsQuery,
  PaymentMethodsResponse,
} from "@/lib/payments/types";

/**
 * =========================================================
 * TIKEMIA PAY
 * =========================================================
 *
 * Fichier :
 * src/app/api/checkout/payment-methods/route.ts
 *
 * Route :
 * GET /api/checkout/payment-methods
 *
 * Fonction :
 * Fournir au checkout public les moyens de paiement
 * autorisés selon :
 *
 * - Le pays du client
 * - La devise de la commande
 * - Le type de commande
 * - Les moyens activés et vérifiés côté serveur
 *
 * Compatible :
 * - Achat de billets
 * - Dons et cagnottes
 * - Checkout mobile et PC
 * - Français et anglais
 *
 * Sécurité :
 * - Aucun secret API exposé
 * - Aucun prestataire exposé dans la réponse publique
 * - Aucune donnée bancaire collectée
 * - Validation stricte des paramètres
 * - Aucun cache des méthodes
 * - Gestion sécurisée des erreurs
 *
 * Cette route :
 * - Ne crée aucune transaction
 * - Ne confirme aucun paiement
 * - Ne génère aucun billet
 * - Ne valide aucun don
 *
 * La sélection devra être revérifiée côté serveur
 * lors de l'exécution du paiement.
 * =========================================================
 */

/* =========================================================
   CONFIGURATION NEXT.JS
========================================================= */




/* =========================================================
   CONSTANTES
========================================================= */

const COUNTRY_PATTERN = /^[A-Z]{2}$/;

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

const MAX_QUERY_LENGTH = 1024;

const ALLOWED_PARAMS = new Set([
  "countryCode",
  "currencyCode",
  "checkoutType",
  "amountMinor",
]);

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
} as const;

/* =========================================================
   TYPES INTERNES
========================================================= */

type ApiErrorCode =
  | "INVALID_QUERY"
  | "INVALID_COUNTRY"
  | "INVALID_CURRENCY"
  | "INVALID_CHECKOUT_TYPE"
  | "SERVICE_UNAVAILABLE";

type ApiErrorResponse = {
  success: false;
  code: ApiErrorCode;
  message: string;
};

type ValidationResult =
  | {
      success: true;
      query: PaymentMethodsQuery & { amountMinor?: string };
    }
  | {
      success: false;
      code: ApiErrorCode;
    };

/* =========================================================
   MESSAGES D'ERREUR
========================================================= */

const ERROR_MESSAGES: Record<
  ApiErrorCode,
  string
> = {
  INVALID_QUERY:
    "Paramètres de demande invalides.",

  INVALID_COUNTRY:
    "Pays invalide ou manquant.",

  INVALID_CURRENCY:
    "Devise invalide ou manquante.",

  INVALID_CHECKOUT_TYPE:
    "Type de commande invalide.",

  SERVICE_UNAVAILABLE:
    "Les moyens de paiement sont temporairement indisponibles.",
};

/* =========================================================
   RÉPONSES JSON
========================================================= */

/**
 * Réponse d'erreur normalisée.
 *
 * Ne jamais transmettre au navigateur :
 * - Les erreurs brutes du prestataire
 * - Les variables d'environnement
 * - Les clés API
 * - Les informations internes de routage
 */

function errorResponse(
  code: ApiErrorCode,
  status: number
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      code,
      message: ERROR_MESSAGES[code],
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

/**
 * Réponse publique des méthodes.
 */

function successResponse(
  data: PaymentMethodsResponse
): NextResponse<PaymentMethodsResponse> {
  return NextResponse.json(data, {
    status: 200,
    headers: RESPONSE_HEADERS,
  });
}

/* =========================================================
   LECTURE SÉCURISÉE DES PARAMÈTRES
========================================================= */

/**
 * Empêche les paramètres multiples ou inconnus.
 *
 * Exemple refusé :
 *
 * ?countryCode=BJ&countryCode=FR
 *
 * Cela évite qu'une couche du système utilise
 * une valeur différente d'une autre.
 */

function hasValidParameters(
  params: URLSearchParams
): boolean {
  for (const key of params.keys()) {
    if (!ALLOWED_PARAMS.has(key)) {
      return false;
    }

    if (params.getAll(key).length !== 1) {
      return false;
    }
  }

  return true;
}

/* =========================================================
   NORMALISATION DU PAYS
========================================================= */

/**
 * Le code pays doit respecter ISO 3166-1 alpha-2.
 *
 * Exemples :
 * bj -> BJ
 * ci -> CI
 * fr -> FR
 *
 * La compatibilité commerciale du pays est
 * ensuite vérifiée par methods.ts.
 */

function normalizeCountry(
  value: string | null
): CountryCode | null {
  if (typeof value !== "string") {
    return null;
  }

  const country = value.trim().toUpperCase();

  if (!COUNTRY_PATTERN.test(country)) {
    return null;
  }

  return country;
}

/* =========================================================
   NORMALISATION DE LA DEVISE
========================================================= */

/**
 * La devise doit respecter le format ISO 4217.
 *
 * Exemples :
 * xof -> XOF
 * eur -> EUR
 * usd -> USD
 *
 * Une devise syntaxiquement valide n'est pas
 * automatiquement une devise acceptée.
 */

function normalizeCurrency(
  value: string | null
): CurrencyCode | null {
  if (typeof value !== "string") {
    return null;
  }

  const currency = value.trim().toUpperCase();

  if (!CURRENCY_PATTERN.test(currency)) {
    return null;
  }

  return currency;
}

/* =========================================================
   NORMALISATION DU TYPE DE COMMANDE
========================================================= */

/**
 * Types internes :
 *
 * ticket
 * donation
 *
 * Compatibilité avec l'interface publique actuelle :
 *
 * tickets -> ticket
 *
 * Les noms de catégories utilisés dans l'interface
 * ne changent donc pas.
 */

function normalizeCheckoutType(
  value: string | null
): CheckoutType | null {
  if (typeof value !== "string") {
    return null;
  }

  const type = value.trim().toLowerCase();

  if (type === "ticket" || type === "tickets") {
    return "ticket";
  }

  if (type === "donation") {
    return "donation";
  }

  return null;
}

/* =========================================================
   VALIDATION DE LA DEMANDE
========================================================= */

/**
 * Toutes les données provenant du navigateur
 * sont considérées comme non fiables.
 *
 * Cette validation ne remplace pas :
 * - La validation de la commande
 * - La validation du montant
 * - La validation du stock
 * - La vérification du paiement
 */

function validateQuery(
  params: URLSearchParams
): ValidationResult {
  if (!hasValidParameters(params)) {
    return {
      success: false,
      code: "INVALID_QUERY",
    };
  }

  /* -------------------------
     Pays du client
  ------------------------- */

  const countryCode = normalizeCountry(
    params.get("countryCode")
  );

  if (params.has("countryCode") && !countryCode) {
    return {
      success: false,
      code: "INVALID_COUNTRY",
    };
  }

  /* -------------------------
     Devise de la commande
  ------------------------- */

  const currencyCode = normalizeCurrency(
    params.get("currencyCode")
  );

  if (!currencyCode) {
    return {
      success: false,
      code: "INVALID_CURRENCY",
    };
  }

  /* -------------------------
     Type de commande
  ------------------------- */

  const checkoutType = normalizeCheckoutType(
    params.get("checkoutType")
  );

  if (!checkoutType) {
    return {
      success: false,
      code: "INVALID_CHECKOUT_TYPE",
    };
  }

  /* -------------------------
     Données validées
  ------------------------- */

  const amountMinor = params.get("amountMinor") ?? "1";
  if (!/^[1-9][0-9]{0,18}$/.test(amountMinor) || BigInt(amountMinor) > 9223372036854775807n) return { success: false, code: "INVALID_QUERY" };
  return {
    success: true,

    query: {
      amountMinor,
      countryCode: countryCode ?? "",
      currencyCode,
      checkoutType,
    },
  };
}

/* =========================================================
   GET — MOYENS DE PAIEMENT
========================================================= */

/**
 * Exemple :
 *
 * GET /api/checkout/payment-methods
 *   ?countryCode=BJ
 *   &currencyCode=XOF
 *   &checkoutType=ticket
 *
 * Réponse :
 *
 * {
 *   "success": true,
 *   "countryCode": "BJ",
 *   "currencyCode": "XOF",
 *   "methods": [
 *     {
 *       "id": "bj_mtn_mobile_money",
 *       "name": "MTN Mobile Money",
 *       "category": "mobile_money",
 *       "logoUrl": null,
 *       "mayRequireExternalAuthentication": true,
 *       "displayOrder": 10
 *     }
 *   ],
 *   "checkedAt": "..."
 * }
 *
 * Cet exemple suppose que la méthode est
 * correctement activée et vérifiée.
 *
 * Une liste vide est une réponse valide :
 * aucune méthode ne peut être proposée pour
 * cette combinaison de pays et de devise.
 */

export async function GET(
  request: NextRequest
): Promise<
  NextResponse<
    PaymentMethodsResponse | ApiErrorResponse
  >
> {
  try {
    /* =====================================================
       CONTRÔLE DE LA LONGUEUR DE LA REQUÊTE
    ===================================================== */

    const url = new URL(request.url);

    if (url.search.length > MAX_QUERY_LENGTH) {
      return errorResponse(
        "INVALID_QUERY",
        400
      );
    }

    /* =====================================================
       VALIDATION DES PARAMÈTRES
    ===================================================== */

    const validation = validateQuery(
      url.searchParams
    );

    if (!validation.success) {
      return errorResponse(
        validation.code,
        400
      );
    }

    /* =====================================================
       RÉCUPÉRATION DES MÉTHODES
    ===================================================== */

    const result = await getPublicPaymentMethods(
      validation.query
    );

    /* =====================================================
       CONTRÔLE DU FORMAT PUBLIC
    ===================================================== */

    if (
      result.success !== true ||
      !Array.isArray(result.methods)
    ) {
      return errorResponse(
        "SERVICE_UNAVAILABLE",
        503
      );
    }

    /* =====================================================
       RÉPONSE AU CHECKOUT
    ===================================================== */

    return successResponse(result);
  } catch (error: unknown) {
    unstable_rethrow(error);
    /**
     * Les erreurs techniques sont conservées
     * uniquement dans les journaux serveur.
     *
     * Ne jamais retourner l'objet error
     * directement au navigateur.
     */

    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[TIKEMIA_PAY_METHODS]",
        error
      );
    } else {
      console.error(
        "[TIKEMIA_PAY_METHODS] Service unavailable"
      );
    }

    return errorResponse(
      "SERVICE_UNAVAILABLE",
      503
    );
  }
}

/* =========================================================
   MÉTHODES HTTP NON AUTORISÉES
========================================================= */

/**
 * Cette API est exclusivement destinée
 * à la consultation des moyens de paiement.
 *
 * Elle ne doit jamais modifier une commande,
 * créer une transaction ou enregistrer un paiement.
 */

function methodNotAllowed(): NextResponse {
  return new NextResponse(null, {
    status: 405,

    headers: {
      ...RESPONSE_HEADERS,

      Allow: "GET, HEAD",
    },
  });
}

export async function POST(): Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PUT(): Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PATCH(): Promise<NextResponse> {
  return methodNotAllowed();
}

export async function DELETE(): Promise<NextResponse> {
  return methodNotAllowed();
}
