
"use client";
import Image from "next/image";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  Check,
  ChevronRight,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";

import type {
  CheckoutType,
  PaymentMethodCategory,
  PaymentMethodsResponse,
  PublicPaymentMethod,
} from "@/lib/payments/types";

/**
 * =========================================================
 * TIKEMIA PAY — PAYMENT METHODS
 * =========================================================
 *
 * src/components/checkout/PaymentMethods.tsx
 *
 * Fonctionnalités :
 *
 * - Affichage des moyens de paiement
 * - Sélection contrôlée par le checkout
 * - Chargement dynamique par pays et devise
 * - Compatibilité avec la page publique existante
 * - Intégration de FedaPay Checkout.js
 * - Français et anglais
 * - Interface responsive mobile et PC
 * - États loading, erreur et liste vide
 *
 * Sécurité :
 *
 * - Aucun secret API dans le navigateur
 * - Aucun montant calculé dans ce composant
 * - Aucune confirmation de paiement côté client
 * - Aucun lancement automatique de transaction
 * - Checkout.js utilise une transaction existante
 *
 * Ce composant ne :
 *
 * - Crée pas de commande
 * - Calcule pas les frais
 * - Confirme pas le paiement
 * - Génère pas de billet
 * - Confirme pas de don
 *
 * La validation financière reste côté serveur.
 * =========================================================
 */

/* =========================================================
   CONFIGURATION
========================================================= */

const METHODS_ENDPOINT =
  "/api/checkout/payment-methods";

const FEDAPAY_CHECKOUT_SCRIPT =
  "https://cdn.fedapay.com/checkout.js?v=1.1.7";

const SCRIPT_ID =
  "tikemia-fedapay-checkout-js";

const FETCH_TIMEOUT_MS = 15000;

const METHOD_ID_PATTERN =
  /^[a-z][a-z0-9_]{0,79}$/;


const CURRENCY_PATTERN =
  /^[A-Z]{3}$/;

/* =========================================================
   TYPES
========================================================= */

type Locale = "fr" | "en";

type CheckoutEnvironment =
  | "sandbox"
  | "live";

type CompatiblePaymentMethod =
  PublicPaymentMethod & {
    type?: string;
    description?: string | null;
  };

type PaymentMethodsProps = {
  /**
   * Pays ISO 3166-1 alpha-2.
   *
   * Exemple : BJ
   */
  countryCode: string | null;

  /**
   * Devise ISO 4217.
   *
   * Exemple : XOF
   */
  currencyCode: string;
  amountMinor?: string;

  /**
   * Type de commande.
   */
  checkoutType:
    | CheckoutType
    | "tickets";

  /**
   * Français par défaut.
   */
  locale?: Locale;

  /**
   * Identifiant de la méthode sélectionnée.
   */
  value: string;

  /**
   * Remonte la méthode choisie à /checkout.
   */
  onChange: (methodId: string) => void;

  /**
   * Liste déjà fournie par le checkout.
   *
   * Si absente, le composant interroge
   * l'API payment-methods.
   *
   * Le tableau vide signifie qu'aucune
   * méthode n'est disponible.
   */
  methods?: CompatiblePaymentMethod[];

  /**
   * Désactive les interactions pendant
   * le lancement du paiement.
   */
  disabled?: boolean;

  /**
   * État de chargement du parent.
   */
  loading?: boolean;

  /**
   * Affiche un bouton de rafraîchissement.
   */
  showRefresh?: boolean;

  /**
   * Nom optionnel du groupe de sélection.
   */
  name?: string;

  /**
   * Paramètres publics d'une transaction
   * FedaPay DÉJÀ créée côté serveur.
   *
   * Ne jamais construire une transaction
   * depuis un montant fourni par le client.
   *
   * transactionId est l'identifiant FedaPay,
   * pas l'UUID interne TIKEMIA.
   */
  checkoutJs?: {
    publicKey: string;
    environment: CheckoutEnvironment;
    transactionId: number;
  } | null;

  /**
   * Appelé après ouverture de Checkout.js.
   *
   * Cela ne signifie PAS paiement réussi.
   */
  onCheckoutOpened?: () => void;

  /**
   * Appelé après fermeture de Checkout.js.
   *
   * La fermeture n'est PAS une preuve
   * d'échec ou de réussite.
   */
  onCheckoutClosed?: () => void;
};

/* =========================================================
   TYPES FEDAPAY CHECKOUT.JS
========================================================= */

type FedaPayWidget = {
  open: () => void;
};

type FedaPayCheckoutOptions = {
  public_key: string;
  environment: CheckoutEnvironment;
  locale: Locale;
  transaction: {
    id: number;
  };
  container?: string;
  onComplete?: () => void;
};

type FedaPayGlobal = {
  init: (
    options: FedaPayCheckoutOptions
  ) => FedaPayWidget;
};

declare global {
  interface Window {
    FedaPay?: FedaPayGlobal;
  }
}

/* =========================================================
   TRADUCTIONS
========================================================= */

const TEXT = {
  fr: {
    title: "Moyens de paiement",
    subtitle:
      "Choisissez votre moyen de paiement",

    loading:
      "Chargement des moyens de paiement...",

    unavailable:
      "Aucun moyen de paiement activ\u00e9 pour cette devise et ce montant.",

    chooseCountry:
      "Sélectionnez votre pays pour afficher les moyens de paiement.",

    error:
      "Impossible de charger les moyens de paiement.",

    retry: "Réessayer",

    refresh:
      "Actualiser les moyens de paiement",

    secure: "Paiement sécurisé",

    mobileMoney: "Mobile Money",

    card: "Carte bancaire",

    bank: "Virement bancaire",

    wallet: "Portefeuille électronique",

    other: "Autre moyen de paiement",

    selected: "Sélectionné",

    openCheckout:
      "Continuer le paiement sécurisé",

    opening:
      "Ouverture du paiement sécurisé...",

    checkoutError:
      "Le formulaire de paiement est indisponible.",

    checkoutUnavailable:
      "Le paiement intégré n'est pas encore disponible.",

    awaitingConfirmation:
      "Après validation, le paiement sera vérifié automatiquement.",

    noCountry:
      "Pays non sélectionné",
  },

  en: {
    title: "Payment methods",
    subtitle:
      "Choose your payment method",

    loading:
      "Loading payment methods...",

    unavailable:
      "No payment method is enabled for this currency and amount.",

    chooseCountry:
      "Select your country to see available payment methods.",

    error:
      "Unable to load payment methods.",

    retry: "Try again",

    refresh:
      "Refresh payment methods",

    secure: "Secure payment",

    mobileMoney: "Mobile Money",

    card: "Bank card",

    bank: "Bank transfer",

    wallet: "Digital wallet",

    other: "Other payment method",

    selected: "Selected",

    openCheckout:
      "Continue secure payment",

    opening:
      "Opening secure checkout...",

    checkoutError:
      "The payment form is unavailable.",

    checkoutUnavailable:
      "Embedded checkout is not yet available.",

    awaitingConfirmation:
      "After payment, confirmation will be verified automatically.",

    noCountry:
      "Country not selected",
  },
} as const;

function normalizeCurrency(
  value: string
): string | null {
  const currency =
    value.trim().toUpperCase();

  return CURRENCY_PATTERN.test(currency)
    ? currency
    : null;
}

function normalizeCheckoutType(
  value: CheckoutType | "tickets"
): CheckoutType {
  return value === "tickets"
    ? "ticket"
    : value;
}

function validMethod(
  value: unknown
): value is CompatiblePaymentMethod {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const method =
    value as Partial<CompatiblePaymentMethod>;

  const categories:
    PaymentMethodCategory[] = [
      "mobile_money",
      "card",
      "bank_transfer",
      "wallet",
      "other",
    ];

  return (
    typeof method.id === "string" &&
    METHOD_ID_PATTERN.test(method.id) &&
    typeof method.name === "string" &&
    method.name.trim().length > 0 &&
    method.name.length <= 100 &&
    (
      method.category === undefined ||
      categories.includes(method.category)
    )
  );
}

function normalizeMethods(
  values: CompatiblePaymentMethod[]
): CompatiblePaymentMethod[] {
  const unique =
    new Map<string, CompatiblePaymentMethod>();

  for (const method of values) {
    if (!validMethod(method)) {
      continue;
    }

    if (!unique.has(method.id)) {
      unique.set(
        method.id,
        method
      );
    }
  }

  return [...unique.values()].sort(
    (a, b) =>
      (a.displayOrder ?? 100) -
        (b.displayOrder ?? 100) ||
      a.name.localeCompare(b.name)
  );
}

function methodCategory(
  method: CompatiblePaymentMethod
): PaymentMethodCategory {
  if (method.category) {
    return method.category;
  }

  const type =
    (method.type ?? "").toLowerCase();

  if (
    type.includes("mobile") ||
    type.includes("momo")
  ) {
    return "mobile_money";
  }

  if (
    type.includes("card") ||
    type.includes("carte")
  ) {
    return "card";
  }

  if (type.includes("bank")) {
    return "bank_transfer";
  }

  if (type.includes("wallet")) {
    return "wallet";
  }

  return "other";
}

function categoryLabel(
  category: PaymentMethodCategory,
  locale: Locale
): string {
  const t = TEXT[locale];

  switch (category) {
    case "mobile_money":
      return t.mobileMoney;

    case "card":
      return t.card;

    case "bank_transfer":
      return t.bank;

    case "wallet":
      return t.wallet;

    default:
      return t.other;
  }
}

/* =========================================================
   ICÔNE DE MÉTHODE
========================================================= */

function MethodIcon({
  category,
}: {
  category: PaymentMethodCategory;
}) {
  switch (category) {
    case "mobile_money":
      return (
        <Smartphone
          size={22}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      );

    case "card":
      return (
        <CreditCard
          size={22}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      );

    case "wallet":
      return (
        <Wallet
          size={22}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      );

    default:
      return (
        <CreditCard
          size={22}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      );
  }
}

/* =========================================================
   CHARGEMENT FEDAPAY CHECKOUT.JS
========================================================= */

/**
 * Le script est chargé uniquement lorsqu'une
 * transaction FedaPay existante doit être ouverte.
 *
 * Il ne crée pas une deuxième transaction.
 *
 * La clé publique seule peut être utilisée
 * côté navigateur.
 *
 * Aucune clé API secrète ne doit figurer ici.
 */

let checkoutScriptPromise:
  Promise<void> | null = null;

function loadFedaPayCheckoutJs():
  Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("BROWSER_REQUIRED")
    );
  }

  if (
    window.FedaPay &&
    typeof window.FedaPay.init === "function"
  ) {
    return Promise.resolve();
  }

  if (checkoutScriptPromise) {
    return checkoutScriptPromise;
  }

  checkoutScriptPromise =
    new Promise<void>((resolve, reject) => {
      let script =
        document.getElementById(
          SCRIPT_ID
        ) as HTMLScriptElement | null;

      if (!script) {
        script =
          document.createElement("script");

        script.id = SCRIPT_ID;

        script.src =
          FEDAPAY_CHECKOUT_SCRIPT;

        script.async = true;

        document.head.appendChild(script);
      }

      const currentScript = script;

      const timeout =
        window.setTimeout(() => {
          cleanup();

          checkoutScriptPromise = null;
          currentScript.remove();

          reject(
            new Error("FEDAPAY_SCRIPT_TIMEOUT")
          );
        }, FETCH_TIMEOUT_MS);

      function cleanup() {
        window.clearTimeout(timeout);

        currentScript.removeEventListener(
          "load",
          onLoad
        );

        currentScript.removeEventListener(
          "error",
          onError
        );
      }

      function onLoad() {
        cleanup();

        if (
          window.FedaPay &&
          typeof window.FedaPay.init === "function"
        ) {
          resolve();
        } else {
          checkoutScriptPromise = null;

          reject(
            new Error(
              "FEDAPAY_WIDGET_UNAVAILABLE"
            )
          );
        }
      }

      function onError() {
        cleanup();
        currentScript.remove();

        checkoutScriptPromise = null;

        reject(
          new Error(
            "FEDAPAY_SCRIPT_LOAD_FAILED"
          )
        );
      }

      currentScript.addEventListener(
        "load",
        onLoad
      );

      currentScript.addEventListener(
        "error",
        onError
      );

      if (
        window.FedaPay &&
        typeof window.FedaPay.init === "function"
      ) {
        onLoad();
      }
    });

  return checkoutScriptPromise;
}

/* =========================================================
   COMPOSANT
========================================================= */

function PaymentMethodLogo({ method, category }: { method: CompatiblePaymentMethod; category: PaymentMethodCategory }) {
  const [failed, setFailed] = useState(false);
  const source = method.logoUrl;
  if (!source || failed) return <MethodIcon category={category} />;
  return <Image src={source} alt={method.name} width={48} height={48} unoptimized className="h-12 w-12 object-contain" onError={() => setFailed(true)} />;
}

export default function PaymentMethods({
  currencyCode,
  amountMinor = "1",
  checkoutType,
  locale = "fr",
  value,
  onChange,
  methods,
  disabled = false,
  loading = false,
  showRefresh = true,
  name = "paymentMethodId",
  checkoutJs = null,
  onCheckoutOpened,
}: PaymentMethodsProps) {
  const groupId = useId();

  const t = TEXT[locale];


  const currency =
    normalizeCurrency(currencyCode);

  const type =
    normalizeCheckoutType(checkoutType);

  const [remoteMethods, setRemoteMethods] =
    useState<CompatiblePaymentMethod[]>([]);

  const [fetching, setFetching] =
    useState(false);

  const [refreshKey, setRefreshKey] =
    useState(0);

  const [fetchError, setFetchError] =
    useState(false);

  const [openingCheckout, setOpeningCheckout] =
    useState(false);

  const [checkoutError, setCheckoutError] =
    useState(false);

  const requestSequence = useRef(0);

  const previousSelection = useRef(value);

  /**
   * Lorsque le checkout parent fournit methods,
   * cette liste reste prioritaire.
   *
   * Cela permet de conserver le mécanisme
   * actuel de /checkout.
   */

  const controlledMethods =
    methods !== undefined;

  const availableMethods = useMemo(
    () =>
      normalizeMethods(
        controlledMethods
          ? methods ?? []
          : remoteMethods
      ),
    [
      controlledMethods,
      methods,
      remoteMethods,
    ]
  );

  const methodGroups = useMemo(() => {
    const categories: PaymentMethodCategory[] = [];
    for (const method of availableMethods) {
      const category = methodCategory(method);
      if (!categories.includes(category)) categories.push(category);
    }
    return categories.map(category => ({ category, methods: availableMethods.filter(method => methodCategory(method) === category) }));
  }, [availableMethods]);
  const selectedGroup = methodGroups.find(group => group.methods.some(method => method.id === value));

  /* =======================================================
     CHARGEMENT DYNAMIQUE
  ======================================================= */

  const activeMethodsRequest = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    setRefreshKey((previous) => previous + 1);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
    if (controlledMethods) {
      setFetching(false);
      setFetchError(false);
      return;
    }

    if (!currency) {
      setRemoteMethods([]);
      setFetchError(false);
      return;
    }

    const controller =
      new AbortController();
    activeMethodsRequest.current = controller;

    const sequence =
      ++requestSequence.current;

    async function fetchMethods() {
      setFetching(true);
      setFetchError(false);
      setRemoteMethods([]);

      const search =
        new URLSearchParams({
          currencyCode: currency!,
          checkoutType: type,
          amountMinor,
        });

      const timeout =
        window.setTimeout(
          () => controller.abort(),
          FETCH_TIMEOUT_MS
        );

      try {
        const response =
          await fetch(
            `${METHODS_ENDPOINT}?${search.toString()}`,
            {
              method: "GET",
              credentials: "same-origin",
              cache: "no-store",
              signal: controller.signal,
              headers: {
                Accept: "application/json",
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            "METHODS_REQUEST_FAILED"
          );
        }

        const result =
          (await response.json()) as
            PaymentMethodsResponse;

        if (
          result.success !== true ||
          !Array.isArray(result.methods) ||
          result.currencyCode !== currency
        ) {
          throw new Error(
            "INVALID_METHODS_RESPONSE"
          );
        }

        if (
          sequence !==
          requestSequence.current
        ) {
          return;
        }

        setRemoteMethods(
          normalizeMethods(result.methods)
        );
      } catch {
        if (
          controller.signal.aborted ||
          sequence !==
            requestSequence.current
        ) {
          return;
        }

        setRemoteMethods([]);
        setFetchError(true);
      } finally {
        window.clearTimeout(timeout);

        if (
          sequence ===
          requestSequence.current
        ) {
          setFetching(false);
        }
      }
    }

    void fetchMethods();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      activeMethodsRequest.current?.abort();
    };
  }, [
    controlledMethods,
    currency,
    type,
    refreshKey,
    amountMinor,
  ]);

  useEffect(() => {
    if (controlledMethods || disabled || !currency) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") reload(); }, 30000);
    return () => window.clearInterval(timer);
  }, [controlledMethods, disabled, currency, reload]);

  /* =======================================================
     VALIDATION DE LA SÉLECTION
  ======================================================= */

  useEffect(() => {
    const previous =
      previousSelection.current;

    previousSelection.current = value;

    if (!value) {
      return;
    }

    if (
      loading || fetching
    ) {
      return;
    }

    const exists =
      availableMethods.some(
        (method) =>
          method.id === value
      );

    if (!exists && previous === value) {
      onChange("");
    }
  }, [
    value,
    availableMethods,
    loading,
    fetching,
    onChange,
  ]);

  /* =======================================================
     OUVERTURE CHECKOUT.JS
  ======================================================= */

  const openCheckoutJs =
    useCallback(async () => {
      if (
        disabled ||
        openingCheckout ||
        !checkoutJs ||
        !value
      ) {
        return;
      }

      const isAvailable =
        availableMethods.some(
          (method) =>
            method.id === value
        );

      if (!isAvailable) {
        setCheckoutError(true);
        return;
      }

      /**
       * On accepte exclusivement l'identifiant
       * numérique de transaction FedaPay.
       *
       * Aucun montant, devise ou tarif
       * n'est transmis depuis le client.
       */

      if (
        typeof checkoutJs.publicKey !== "string" ||
        !checkoutJs.publicKey.trim() ||
        !Number.isSafeInteger(
          checkoutJs.transactionId
        ) ||
        checkoutJs.transactionId <= 0 ||
        (
          checkoutJs.environment !== "sandbox" &&
          checkoutJs.environment !== "live"
        )
      ) {
        setCheckoutError(true);
        return;
      }

      setCheckoutError(false);
      setOpeningCheckout(true);

      try {
        await loadFedaPayCheckoutJs();

        if (!window.FedaPay) {
          throw new Error(
            "FEDAPAY_NOT_AVAILABLE"
          );
        }

        /*
         * Le widget reçoit l'identifiant
         * de la transaction existante.
         *
         * Il ne crée pas une nouvelle
         * transaction depuis le navigateur.
         */

        const widget =
          window.FedaPay.init({
            public_key:
              checkoutJs.publicKey,

            environment:
              checkoutJs.environment,

            locale,

            transaction: {
              id:
                checkoutJs.transactionId,
            },
          });

        if (
          !widget ||
          typeof widget.open !== "function"
        ) {
          throw new Error(
            "INVALID_FEDAPAY_WIDGET"
          );
        }

        widget.open();

        onCheckoutOpened?.();
      } catch {
        setCheckoutError(true);
      } finally {
        setOpeningCheckout(false);
      }
    }, [
      disabled,
      openingCheckout,
      checkoutJs,
      value,
      availableMethods,
      locale,
      onCheckoutOpened,
    ]);

  /* =======================================================
     ÉTATS D'AFFICHAGE
  ======================================================= */

  const isLoading =
    loading || fetching;

  const isDisabled =
    disabled || isLoading;

  const selectedMethod =
    availableMethods.find(
      (method) => method.id === value
    );

  /* =======================================================
     RENDU
  ======================================================= */

  return (
    <section
      aria-labelledby={`${groupId}-title`}
      className="w-full min-w-0"
    >
      {/* ===================================================
          EN-TÊTE
      =================================================== */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`${groupId}-title`}
            className="text-[17px] font-black text-[#132438] sm:text-[18px]"
          >
            {t.title}
          </h2>

          <p className="mt-1 text-xs text-[#667589]">
            {t.subtitle}
          </p>
        </div>

        {showRefresh && (
          <button
            type="button"
            disabled={
              disabled ||
              isLoading
            }
            onClick={reload}
            aria-label={t.refresh}
            title={t.refresh}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dce8df] bg-white text-[#087d2d] transition hover:bg-[#f1f8f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087d2d] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw
              size={17}
              className={
                isLoading
                  ? "animate-spin"
                  : ""
              }
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {/* ===================================================
          CHARGEMENT
      =================================================== */}

      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex min-h-25 items-center justify-center gap-3 rounded-2xl border border-[#e2eae4] bg-[#fafcfb] px-4 py-6 text-center text-sm text-[#627387]"
        >
          <LoaderCircle
            size={19}
            className="animate-spin text-[#087d2d]"
            aria-hidden="true"
          />

          <span>
            {t.loading}
          </span>
        </div>
      )}

      {/* ===================================================
          PAYS NON SÉLECTIONNÉ
      =================================================== */}

      {/* ===================================================
          ERREUR DE CHARGEMENT
      =================================================== */}

      {!isLoading &&
        fetchError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-[#f0d7d3] bg-[#fff8f7] p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                size={19}
                className="shrink-0 text-[#b65045]"
              />

              <p className="text-[13px] text-[#a1463e]">
                {t.error}
              </p>
            </div>

            <button
              type="button"
              onClick={reload}
              disabled={disabled}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#d9a9a1] px-4 text-xs font-bold text-[#a1463e] disabled:opacity-40"
            >
              <RefreshCw size={15} />
              {t.retry}
            </button>
          </div>
        )}


      {!isLoading && !fetchError && (
        <fieldset disabled={isDisabled} className="mt-4 min-w-0">
          <legend className="sr-only">{t.title}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {methodGroups.map(({ category, methods: groupMethods }) => {
              const active = groupMethods.some(method => method.id === value);
              const first = groupMethods[0];
              return (
                <label key={category} className={[
                  "relative flex min-h-32 min-w-0 flex-col items-center justify-center gap-3 rounded-2xl border-2 px-5 py-4 text-center transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#087d2d]",
                  first ? "cursor-pointer" : "cursor-not-allowed bg-[#fafcfb]",
                  active ? "border-[#087d2d] bg-[#f2faf4]" : "border-[#dfe8e2]",
                ].join(" ")}>
                  <input type="radio" name={name + "-category"} checked={active} disabled={isDisabled || !first}
                    onChange={() => { if (first) onChange(first.id); }} className="sr-only"
                    aria-label={categoryLabel(category, locale)} />
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border border-[#cbd6ce] text-[#087d2d]" aria-hidden="true">
                    {active && <Check size={14} />}
                  </span>
                  <span className="flex min-h-12 flex-wrap items-center justify-center gap-2">
                    {groupMethods.length ? groupMethods.map(method => (
                      <span key={method.id} title={method.name} className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#526b5b]">
                        <PaymentMethodLogo key={method.id + ":" + method.logoUrl} method={method} category={category} />
                      </span>
                    )) : <span className="text-[#8695a3]"><MethodIcon category={category} /></span>}
                  </span>
                  <span className="text-sm font-extrabold text-[#132438]">{(category === "wallet" && groupMethods.every(method => method.id === "wave")) ? "Wave" : categoryLabel(category, locale)}</span>
                  {!first && <span className="text-xs text-[#627387]">
                    {locale === "fr" ? "Indisponible en " + currency : "Unavailable in " + currency}
                  </span>}
                </label>
              );
            })}
          </div>
          {selectedGroup && selectedGroup.category !== "card" && selectedGroup.methods.length > 1 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label={categoryLabel(selectedGroup.category, locale)}>
              {selectedGroup.methods.map(method => (
                <label key={method.id} className="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-[#dfe8e2] px-3 py-2 has-checked:border-[#087d2d] has-checked:bg-[#f2faf4]">
                  <input type="radio" name={name} checked={value === method.id} value={method.id} onChange={() => onChange(method.id)} className="accent-[#087d2d]" />
                  <PaymentMethodLogo key={method.id + ":" + method.logoUrl} method={method} category={selectedGroup.category} />
                  <span className="wrap-break-word text-sm font-bold text-[#132438]">{method.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {/* ===================================================
          CHECKOUT.JS
      =================================================== */}

      {checkoutJs &&
        selectedMethod &&
        !isLoading && (
          <div className="mt-5">
            <button
              type="button"
              disabled={
                disabled ||
                openingCheckout
              }
              onClick={() =>
                void openCheckoutJs()
              }
              className="flex min-h-12.5 w-full items-center justify-center gap-2 rounded-full bg-[#087d2d] px-5 py-3 text-center text-[13px] font-extrabold text-white transition hover:bg-[#076c28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087d2d] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              {openingCheckout ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />

                  {t.opening}
                </>
              ) : (
                <>
                  <LockKeyhole
                    size={17}
                  />

                  {t.openCheckout}

                  <ChevronRight
                    size={17}
                  />
                </>
              )}
            </button>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-[#64748b]">
              {t.awaitingConfirmation}
            </p>

            {checkoutError && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border border-[#f0d7d3] bg-[#fff8f7] px-4 py-3 text-xs text-[#a1463e]"
              >
                <AlertCircle
                  size={17}
                  className="shrink-0"
                />

                <span>
                  {t.checkoutError}
                </span>
              </div>
            )}
          </div>
        )}

      {/* ===================================================
          SÉCURITÉ
      =================================================== */}

      {!isLoading &&
        availableMethods.length > 0 && (
          <div className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] text-[#748378]">
            <ShieldCheck
              size={16}
              className="shrink-0 text-[#087d2d]"
            />

            <span>
              {t.secure}
            </span>
          </div>
        )}
    </section>
  );
}

/* =========================================================
   EXPORTS
========================================================= */

export type {
  PaymentMethodsProps,
  CompatiblePaymentMethod,
};

// Only an existing server-created transaction is mounted. Browser callbacks do
// not authorize tickets or mark a payment successful; status/webhooks do that.
export function EmbeddedPayment({ publicKey, environment, transactionId, locale = "fr" }: {
  publicKey: string; environment: CheckoutEnvironment; transactionId: number; locale?: Locale;
}) {
  const id = "payment-embed-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let frame: HTMLIFrameElement | null = null;
    const element = document.getElementById(id);
    const timer = window.setTimeout(() => { if (!cancelled) { setError(true); setLoading(false); } }, 30000);
    const loaded = () => { if (!cancelled) { window.clearTimeout(timer); setLoading(false); } };
    void loadFedaPayCheckoutJs().then(() => {
      if (cancelled || !element) return;
      if (!window.FedaPay || !new RegExp("^pk_" + environment + "_[A-Za-z0-9_-]+$").test(publicKey) || !Number.isSafeInteger(transactionId) || transactionId <= 0) throw new Error("INVALID_CHECKOUT");
      window.FedaPay.init({ public_key: publicKey, environment, locale, transaction: { id: transactionId }, container: "#" + id });
      frame = element.querySelector("iframe");
      if (!frame) throw new Error("CHECKOUT_FRAME_MISSING");
      frame.title = locale === "fr" ? "Formulaire de paiement s\u00e9curis\u00e9" : "Secure payment form";
      frame.addEventListener("load", loaded, { once: true });
    }).catch(() => { if (!cancelled) { window.clearTimeout(timer); setError(true); setLoading(false); } });
    return () => { cancelled = true; window.clearTimeout(timer); frame?.removeEventListener("load", loaded); element?.replaceChildren(); };
  }, [id, publicKey, environment, transactionId, locale, retry]);
  return <div className="mt-4 w-full min-w-0 bg-white">
    {loading && <p role="status" className="flex items-center justify-center gap-2 p-3 text-sm text-[#617186]">
      <LoaderCircle size={18} className="animate-spin" />{locale === "fr" ? "Ouverture du formulaire de paiement..." : "Opening payment form..."}
    </p>}
    {error && <div role="alert" className="rounded-xl bg-[#fff4f2] p-3 text-sm text-[#a1463e]">
      {locale === "fr" ? "Le formulaire de paiement n'a pas pu se charger." : "The payment form could not load."}
      <button type="button" className="ml-2 underline" onClick={() => { setError(false); setLoading(true); setRetry(previous => previous + 1); }}>{locale === "fr" ? "R\u00e9essayer" : "Retry"}</button>
    </div>}
    <div id={id} className="min-h-150 w-full [&_iframe]:min-h-150 [&_iframe]:w-full [&_iframe]:border-0" />
  </div>;
}
