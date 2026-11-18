import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { isSupportedCurrency } from "@/i18n/config";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
} from "node:crypto";

import {
  PrismaClient,
} from "@/generated/prisma/client";

import {
  getWithdrawalProviderLogo,
  getWithdrawalCatalog,
  getWithdrawalCountries,
  getCountryCurrency,
  getBankFieldConfiguration,
  getCryptoNetworks,
  isValidCountryCode,
  isWithdrawalRouteEnabled,
  type EnabledWithdrawalRoute,
  type WithdrawalLocale,
  type WithdrawalMethodType,
  type CryptoAssetCode,
  type CryptoNetworkCode,
} from "@/lib/withdrawal-providers";

/* ==========================================================
   TIKEMIA — OPÉRATEURS DE RETRAIT INTERNATIONAUX

   Fichier :
   src/app/api/organizer/settings/
   withdrawal-providers/route.ts

   GET /api/organizer/settings/withdrawal-providers

   Exemples :
   ?country=BJ&locale=fr
   ?country=FR&locale=fr
   ?country=US&locale=en
   ?country=KE&currency=KES

   Fonctionnalités :

   - Session organisateur obligatoire
   - Vérification du rôle ORGANIZER
   - Catalogue international des pays
   - Mobile Money selon le pays
   - Virements bancaires internationaux
   - Champs bancaires adaptés au pays
   - Bitcoin BTC
   - USDT et réseaux blockchain
   - Disponibilité réelle via configuration serveur
   - Français et anglais
   - Protection des données
   - Aucune mise en cache

   IMPORTANT :

   La présence d'un moyen dans le catalogue
   ne garantit pas la possibilité de retrait.

   Une route est activée uniquement si elle
   a été configurée côté serveur après
   vérification de la couverture du partenaire.

   Aucune route n'est activée par défaut.

   Cette API ne réalise aucun transfert d'argent.
========================================================== */




/* ==========================================================
   CONFIGURATION
========================================================== */

const SESSION_COOKIE =
  "tikemia_organizer_session";

const SESSION_TOKEN_PATTERN =
  /^[a-f0-9]{64}$/i;

const MAX_CONFIG_BYTES =
  128 * 1024;

const METHODS = new Set<
  WithdrawalMethodType
>([
  "MOBILE_MONEY",
  "BANK_ACCOUNT",
  "CRYPTO",
]);

const CRYPTO_ASSETS = new Set<
  CryptoAssetCode
>([
  "BTC",
  "USDT",
]);

const CRYPTO_NETWORKS = new Set<
  CryptoNetworkCode
>([
  "BITCOIN",
  "TRC20",
  "ERC20",
  "SOLANA",
  "POLYGON",
  "ARBITRUM",
]);

type JsonRecord =
  Record<string, unknown>;

type ErrorKey =
  | "unauthorized"
  | "invalidCountry"
  | "invalidCurrency"
  | "configurationError"
  | "serverError";

type OrganizerContext = {
  userId: string;
  countryCode: string | null;
  organizationCountryCode: string | null;
};

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TEXT = {
  fr: {
    unauthorized:
      "Veuillez vous connecter à votre espace organisateur.",

    invalidCountry:
      "Veuillez sélectionner un pays valide.",

    invalidCurrency:
      "La devise sélectionnée est invalide.",

    configurationError:
      "Le service des moyens de retrait est temporairement indisponible.",

    serverError:
      "Impossible de récupérer les moyens de retrait.",

    loaded:
      "Moyens de retrait récupérés avec succès.",

    unavailable:
      "Aucun moyen de retrait n'est actuellement activé pour cette sélection.",

    available:
      "Des moyens de retrait sont disponibles pour cette sélection.",

    notConfigured:
      "Les retraits ne sont pas encore configurés.",

    bank:
      "Virement bancaire",

    crypto:
      "Cryptomonnaie",

    mobileMoney:
      "Mobile Money",
  },

  en: {
    unauthorized:
      "Please sign in to your organizer account.",

    invalidCountry:
      "Please select a valid country.",

    invalidCurrency:
      "The selected currency is invalid.",

    configurationError:
      "The withdrawal provider service is temporarily unavailable.",

    serverError:
      "Unable to retrieve withdrawal methods.",

    loaded:
      "Withdrawal methods retrieved successfully.",

    unavailable:
      "No withdrawal method is currently enabled for this selection.",

    available:
      "Withdrawal methods are available for this selection.",

    notConfigured:
      "Withdrawals have not been configured yet.",

    bank:
      "Bank transfer",

    crypto:
      "Cryptocurrency",

    mobileMoney:
      "Mobile Money",
  },
} as const;

/* ==========================================================
   PRISMA 7 — POSTGRESQL
========================================================== */



const getPrisma = getPlatformPrisma;

/* ==========================================================
   LANGUE
========================================================== */

function getLanguage(
  request: NextRequest
): WithdrawalLocale {
  const requested =
    request.nextUrl.searchParams
      .get("locale");

  if (
    requested === "fr" ||
    requested === "en"
  ) {
    return requested;
  }

  const accepted =
    request.headers
      .get("accept-language") ??
    "";

  return accepted
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "fr";
}

/* ==========================================================
   RÉPONSES SÉCURISÉES
========================================================== */

function respond(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    data,
    {
      status,

      headers: {
        "Cache-Control":
          "private, no-store, max-age=0, must-revalidate",

        "Pragma":
          "no-cache",

        "X-Content-Type-Options":
          "nosniff",

        "Vary":
          "Cookie, Accept-Language",
      },
    }
  );
}

function errorResponse(
  locale: WithdrawalLocale,
  key: ErrorKey,
  status: number
) {
  return respond(
    {
      success: false,
      message: TEXT[locale][key],
    },
    status
  );
}

/* ==========================================================
   UTILITAIRES
========================================================== */

function asRecord(
  value: unknown
): JsonRecord {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as JsonRecord;
  }

  return {};
}

function normalizeCode(
  value: string
): string {
  return value
    .trim()
    .toUpperCase();
}

function optionalString(
  value: unknown
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const normalized =
    normalizeCode(value);

  return normalized ||
    undefined;
}

/* ==========================================================
   AUTHENTIFICATION ORGANISATEUR

   Les identifiants proviennent uniquement
   du cookie de session validé.

   On ne fait jamais confiance à un userId
   transmis par le navigateur.
========================================================== */

async function authenticateOrganizer(
  request: NextRequest,
  prisma: PrismaClient
): Promise<OrganizerContext | null> {
  const token =
    request.cookies
      .get(SESSION_COOKIE)
      ?.value;

  if (
    !token ||
    !SESSION_TOKEN_PATTERN.test(token)
  ) {
    return null;
  }

  const tokenHash =
    createHash("sha256")
      .update(
        token,
        "utf8"
      )
      .digest("hex");

  const session =
    await prisma.session.findFirst({
      where: {
        tokenHash,

        revokedAt: null,

        expiresAt: {
          gt: new Date(),
        },
      },

      select: {
        userId: true,
      },
    });

  if (!session) {
    return null;
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id:
          session.userId,
      },

      select: {
        id: true,

        countryCode: true,

        isActive: true,

        isBlocked: true,

        emailVerifiedAt: true,

        roles: {
          where: {
            role:
              "ORGANIZER",
          },

          select: {
            id: true,
          },

          take: 1,
        },
      },
    });

  if (
    !user ||
    !user.isActive ||
    user.isBlocked ||
    !user.emailVerifiedAt ||
    user.roles.length === 0
  ) {
    return null;
  }

  const organization =
    await prisma.organization.findFirst({
      where: {
        ownerId:
          user.id,

        isActive: true,
      },

      select: {
        countryCode: true,
      },

      orderBy: {
        createdAt: "asc",
      },
    });

  if (!organization) {
    return null;
  }

  return {
    userId:
      user.id,

    countryCode:
      user.countryCode,

    organizationCountryCode:
      organization.countryCode,
  };
}

/* ==========================================================
   VALIDATION DES ROUTES CONFIGURÉES

   Les routes de paiement actives ne doivent
   pas être inventées à partir du catalogue.

   Cette API lit une configuration privée,
   définie uniquement côté serveur.

   Variable :
   TIKEMIA_WITHDRAWAL_ROUTES_JSON

   L'activation doit correspondre à une
   intégration partenaire déjà opérationnelle.

   Cette validation ne vérifie pas elle-même
   les contrats ni la santé du partenaire.
========================================================== */

function parseConfiguredRoute(
  value: unknown
): EnabledWithdrawalRoute | null {
  const item =
    asRecord(value);

  const method =
    optionalString(
      item.method
    );

  const providerCode =
    optionalString(
      item.providerCode
    );

  const countryCode =
    optionalString(
      item.countryCode
    );

  if (
    !method ||
    !providerCode ||
    !countryCode
  ) {
    return null;
  }

  if (
    !METHODS.has(
      method as WithdrawalMethodType
    )
  ) {
    return null;
  }

  if (
    !isValidCountryCode(
      countryCode
    )
  ) {
    return null;
  }

  if (
    typeof item.enabled !==
    "boolean"
  ) {
    return null;
  }

  const currency =
    optionalString(
      item.currency
    );

  if (
    currency &&
    !isSupportedCurrency(currency)
  ) {
    return null;
  }

  const assetCode =
    optionalString(
      item.assetCode
    );

  if (
    assetCode &&
    !CRYPTO_ASSETS.has(
      assetCode as CryptoAssetCode
    )
  ) {
    return null;
  }

  const networkCode =
    optionalString(
      item.networkCode
    );

  if (
    networkCode &&
    !CRYPTO_NETWORKS.has(
      networkCode as CryptoNetworkCode
    )
  ) {
    return null;
  }

  if (
    method === "CRYPTO" &&
    (
      !assetCode ||
      !networkCode ||
      providerCode !== assetCode
    )
  ) {
    return null;
  }

  if (
    method === "BANK_ACCOUNT" &&
    providerCode !==
      "BANK_TRANSFER"
  ) {
    return null;
  }

  return {
    method:
      method as WithdrawalMethodType,

    providerCode,

    countryCode,

    enabled:
      item.enabled,

    ...(currency
      ? { currency }
      : {}),

    ...(assetCode
      ? {
          assetCode:
            assetCode as CryptoAssetCode,
        }
      : {}),

    ...(networkCode
      ? {
          networkCode:
            networkCode as CryptoNetworkCode,
        }
      : {}),
  };
}

/* ==========================================================
   CHARGER LES ROUTES ACTIVÉES

   Absence de configuration :
   aucune route active.

   Configuration invalide :
   erreur serveur plutôt que d'annoncer
   une disponibilité trompeuse.

   Aucun secret de prestataire n'est
   transmis dans les réponses.
========================================================== */

function getConfiguredRoutes():
  EnabledWithdrawalRoute[] {
  const raw =
    process.env
      .TIKEMIA_WITHDRAWAL_ROUTES_JSON;

  if (!raw || !raw.trim()) {
    return [];
  }

  if (
    Buffer.byteLength(
      raw,
      "utf8"
    ) > MAX_CONFIG_BYTES
  ) {
    throw new Error(
      "WITHDRAWAL_CONFIG_TOO_LARGE"
    );
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(raw);
  } catch {
    throw new Error(
      "INVALID_WITHDRAWAL_CONFIG_JSON"
    );
  }

  if (
    !Array.isArray(parsed)
  ) {
    throw new Error(
      "INVALID_WITHDRAWAL_CONFIG_FORMAT"
    );
  }

  if (
    parsed.length > 1000
  ) {
    throw new Error(
      "TOO_MANY_WITHDRAWAL_ROUTES"
    );
  }

  const routes:
    EnabledWithdrawalRoute[] =
      [];

  for (
    const entry of parsed
  ) {
    const route =
      parseConfiguredRoute(
        entry
      );

    if (!route) {
      throw new Error(
        "INVALID_WITHDRAWAL_ROUTE"
      );
    }

    routes.push(
      route
    );
  }

  return routes;
}

/* ==========================================================
   SÉLECTION DES ROUTES PAR DEVISE

   Le catalogue reçoit uniquement les routes
   compatibles avec le pays et la devise
   demandés.

   Si une route possède une devise précise,
   elle n'est pas activée pour une autre devise.

   Les routes sans restriction de devise
   peuvent être présentées dans plusieurs
   devises, sous réserve des contrôles
   supplémentaires au moment du retrait.
========================================================== */

function routesForSelection(
  routes: readonly EnabledWithdrawalRoute[],
  countryCode: string,
  currency: string | null
): EnabledWithdrawalRoute[] {
  return routes
    .filter(
      (route) => {
        if (
          !route.enabled
        ) {
          return false;
        }

        if (
          normalizeCode(
            route.countryCode
          ) !== countryCode
        ) {
          return false;
        }

        if (
          route.currency &&
          (
            !currency ||
            normalizeCode(
              route.currency
            ) !== currency
          )
        ) {
          return false;
        }

        return true;
      }
    )
    .map(
      (route) => ({
        ...route,

        // La restriction éventuelle de devise
        // a déjà été contrôlée ci-dessus.
        currency: undefined,
      })
    );
}

/* ==========================================================
   GET — CATALOGUE INTERNATIONAL

   Exemple :
   /api/organizer/settings/withdrawal-providers
     ?country=BJ
     &locale=fr

   Sans pays explicite :
   - pays de l'organisation,
   - puis pays de l'utilisateur.

   Si aucun pays n'est connu :
   retourner une erreur 400.

   Cela évite d'imposer le Bénin
   à tous les utilisateurs internationaux.
========================================================== */

export async function GET(
  request: NextRequest
) {
  const locale =
    getLanguage(
      request
    );

  try {
    /* ----------------------------------------
       1. AUTHENTIFICATION
    ---------------------------------------- */

    const prisma =
      getPrisma();

    const organizer =
      await authenticateOrganizer(
        request,
        prisma
      );

    if (!organizer) {
      return errorResponse(
        locale,
        "unauthorized",
        401
      );
    }

    /* ----------------------------------------
       2. SÉLECTION DU PAYS
    ---------------------------------------- */

    const requestedCountry =
      request.nextUrl.searchParams.get(
        "country"
      ) ??
      request.nextUrl.searchParams.get(
        "countryCode"
      );

    const countryCode =
      normalizeCode(
        requestedCountry ??
          organizer.organizationCountryCode ??
          organizer.countryCode ??
          ""
      );

    if (
      !isValidCountryCode(
        countryCode
      )
    ) {
      return errorResponse(
        locale,
        "invalidCountry",
        400
      );
    }

    /* ----------------------------------------
       3. SÉLECTION DE LA DEVISE

       Par défaut : devise du pays,
       lorsque connue dans le catalogue.
    ---------------------------------------- */

    const requestedCurrency =
      request.nextUrl.searchParams.get(
        "currency"
      );

    const currency =
      requestedCurrency
        ? normalizeCode(
            requestedCurrency
          )
        : getCountryCurrency(
            countryCode
          );

    if (
      currency &&
      !isSupportedCurrency(currency)
    ) {
      return errorResponse(
        locale,
        "invalidCurrency",
        400
      );
    }

    /* ----------------------------------------
       4. ROUTES PARTENAIRES

       Seules les routes réellement
       activées dans la configuration
       serveur pourront être annoncées
       comme disponibles.
    ---------------------------------------- */

    let configuredRoutes:
      EnabledWithdrawalRoute[];

    try {
      configuredRoutes =
        getConfiguredRoutes();
    } catch {
      console.error(
        "[TIKEMIA WITHDRAWAL PROVIDERS] Invalid server configuration"
      );

      return errorResponse(
        locale,
        "configurationError",
        503
      );
    }

    const applicableRoutes =
      routesForSelection(
        configuredRoutes,
        countryCode,
        currency
      );

    /* ----------------------------------------
       5. CATALOGUE DU PAYS
    ---------------------------------------- */

    const catalog =
      getWithdrawalCatalog(
        countryCode,
        locale,
        applicableRoutes
      );

    if (!catalog) {
      return errorResponse(
        locale,
        "invalidCountry",
        400
      );
    }

    /* ----------------------------------------
       6. DISPONIBILITÉ DES RÉSEAUX CRYPTO

       Ne jamais annoncer USDT comme
       disponible sur tous les réseaux
       simplement parce qu'un seul
       réseau est activé.
    ---------------------------------------- */

    const cryptoNetworks =
      [
        ...getCryptoNetworks(
          "BTC"
        ),

        ...getCryptoNetworks(
          "USDT"
        ),
      ].map(
        (network) => {
          const available =
            isWithdrawalRouteEnabled(
              "CRYPTO",
              network.assetCode,
              countryCode,
              applicableRoutes,
              {
                assetCode:
                  network.assetCode,

                networkCode:
                  network.code,
              }
            );

          return {
            code:
              network.code,

            name:
              network.name,

            assetCode:
              network.assetCode,

            chain:
              network.chain,

            addressFormat:
              network.addressFormat,

            available,
          };
        }
      );

    /* ----------------------------------------
       7. INFORMATIONS BANCAIRES

       Les champs varient selon le pays :
       - IBAN
       - Numéro de compte
       - SWIFT / BIC
       - Code de routage local

       La validation finale se fera
       dans l'API d'enregistrement
       des moyens de retrait.
    ---------------------------------------- */

    const bankFields =
      getBankFieldConfiguration(
        countryCode
      );

    /* ----------------------------------------
       8. INDICATEURS GLOBAUX
    ---------------------------------------- */

    const availableMethods =
      catalog.methods.filter(
        (method) =>
          method.available
      );

    const availableMobileMoney =
      catalog.mobileMoney.filter(
        (provider) =>
          provider.available
      );

    const availableCrypto =
      catalog.crypto.filter(
        (asset) =>
          asset.available
      );

    const availableCryptoNetworks =
      cryptoNetworks.filter(
        (network) =>
          network.available
      );

    const anyAvailable =
      availableMethods.length > 0;

    /* ----------------------------------------
       9. LISTE INTERNATIONALE DES PAYS

       La liste vient de libphonenumber-js,
       pas d'une liste africaine limitée.
    ---------------------------------------- */

    const countries =
      getWithdrawalCountries(
        locale
      );

    /* ----------------------------------------
       10. RÉPONSE À LA PAGE PARAMÈTRES

       Les champs restent compatibles
       avec le catalogue existant.

       Aucun secret ni compte bancaire
       personnel n'est renvoyé ici.
    ---------------------------------------- */

    return respond({
      success: true,

      message:
        TEXT[locale].loaded,

      country:
        catalog.country,

      currency,

      countries,

      methods:
        catalog.methods.map(
          (method) => ({
            ...method,

            availability:
              method.available
                ? "AVAILABLE"
                : configuredRoutes.length === 0
                  ? "NOT_CONFIGURED"
                  : "UNAVAILABLE",
          })
        ),

      mobileMoney:
        catalog.mobileMoney.map(provider => ({ ...provider, logoUrl: getWithdrawalProviderLogo(provider.code) })),

      bank: {
        ...catalog.bank,
        logoUrl: getWithdrawalProviderLogo("BANK_TRANSFER"),

        fields:
          bankFields,
      },

      crypto:
        catalog.crypto.map(asset => ({ ...asset, logoUrl: getWithdrawalProviderLogo(asset.code) })),

      cryptoNetworks,

      counts: {
        countries:
          countries.length,

        mobileMoney:
          catalog.mobileMoney.length,

        availableMobileMoney:
          availableMobileMoney.length,

        availableCrypto:
          availableCrypto.length,

        availableCryptoNetworks:
          availableCryptoNetworks.length,

        availableMethods:
          availableMethods.length,
      },

      availability: {
        anyAvailable,

        configured:
          configuredRoutes.length > 0,

        message:
          anyAvailable
            ? TEXT[locale].available
            : configuredRoutes.length === 0
              ? TEXT[locale].notConfigured
              : TEXT[locale].unavailable,
      },
    });
  } catch (error) {
    console.error(
      "[TIKEMIA WITHDRAWAL PROVIDERS GET]",
      error instanceof Error
        ? error.name
        : "UnknownError"
    );

    return errorResponse(
      locale,
      "serverError",
      503
    );
  }
}
