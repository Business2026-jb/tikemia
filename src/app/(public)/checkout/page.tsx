
"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Heart,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

import { formatMinorMoney } from "@/i18n/config";

import PaymentMethods, { EmbeddedPayment } from "@/components/checkout/PaymentMethods";

/**
 * ============================================================
 * TIKEMIA — CHECKOUT PUBLIC
 * ============================================================
 *
 * Fichier :
 * src/app/(public)/checkout/page.tsx
 *
 * Architecture conservée :
 * - Logo TIKEMIA Pay
 * - Récapitulatif de commande
 * - Achat de billets ou don
 * - Email et téléphone du client
 * - Sélection internationale du pays
 * - Moyens de paiement
 * - Total et frais de service
 * - Résultat sur la même page
 * - Responsive mobile et PC
 * - Français par défaut et anglais
 *
 * Connexions :
 *
 * GET  /api/public/checkout
 * POST /api/public/checkout
 * POST /api/checkout/pay
 * GET  /api/checkout/payment-status
 *
 * Les paiements sont confirmés par le serveur.
 * Les billets sont créés par fulfillment.ts.
 * Les PDF sont envoyés par email/worker.ts.
 *
 * Cette page ne génère aucun billet
 * et ne confirme aucun paiement.
 * ============================================================
 */

const CHECKOUT_API = "/api/public/checkout";
const PAY_API = "/api/checkout/pay";
const STATUS_API = "/api/checkout/payment-status";

const PAY_LOGO = "/logo/paylogo.png";

const MAX_PHONE_LENGTH = 35;
const POLL_INTERVAL = 3000;
const REQUEST_TIMEOUT = 20000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

type Locale = "fr" | "en";
type CheckoutType = "tickets" | "donation";

type PageStep =
  | "checkout"
  | "pending"
  | "success"
  | "failed"
  | "cancelled"
  | "refunded";

type NextAction =
  | { type: "none" }
  | {
      type: "mobile_money_prompt";
      message?: string;
    }
  | {
      type: "display_instructions";
      message?: string;
    }
  | {
      type: "redirect";
      url: string;
    }
  | {
      type: "iframe";
      url: string;
    }
  | {
      type: "embedded_checkout";
      publicKey: string;
      environment: "live" | "sandbox";
      transactionId: number;
    };

type Venue = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
};

type EventLine = {
  id: string;
  title: string;
  category: string;
  quantity: number;
  unitPriceMinor: string;
  subtotalMinor: string;

  event: {
    id: string;
    slug: string;
    title: string;
    imageUrl: string | null;
    timeZone: string;
    startsAt: string | null;
    venue: Venue | null;
  };
};

type CheckoutData = {
  type: CheckoutType;
  orderId: string | null;
  donationId: string | null;
  checkoutToken: string;

  item: {
    type: CheckoutType;
    lines?: EventLine[];
    campaign?: {
      id: string;
      slug: string;
      title: string;
      country: string | null;
      city: string | null;
      imageUrl: string | null;
    };
  };

  customer: {
    email: string | null;
    phoneE164: string | null;
  };

  country: {
    code: string | null;
    source: "selected" | "ip" | "unknown";
  };

  currency: string;
  subtotalMinor: string;
  serviceFeeMinor: string;
  totalMinor: string;
  serviceFeeBps: number;
};

type CheckoutResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  data?: CheckoutData;
};

type PayResponse = {
  success?: boolean;
  code?: string;
  message?: string;

  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
  };

  paymentId?: string;
  orderId?: string;
  statusToken?: string;
  status?: string;
  nextAction?: NextAction;
  nextPollSeconds?: number;
};

type EmailDispatchStatus =
  | "not_queued"
  | "queued"
  | "sending"
  | "accepted"
  | "failed";

type PaymentStatusData = {
  nextAction?: NextAction;
  paymentId: string;
  type: CheckoutType;
  status: string;
  message: string;
  confirmed: boolean;
  terminal: boolean;

  paymentStatus: string;
  paymentConfirmed?: boolean;
  fulfillmentStatus: string;

  amountMinor: string;
  currency: string;

  ticketsReady: boolean | null;
  ticketCount?: number | null;
  issuedTicketCount?: number | null;

  emailStatus?: EmailDispatchStatus;
  emailMessage?: string;
  emailQueued?: boolean;
  emailAccepted?: boolean;
  emailDelivered?: boolean | null;

  pdfStatus?:
    | "not_applicable"
    | "pending"
    | "stored"
    | "prepared_for_email"
    | "unknown";

  paidAt: string | null;
  updatedAt: string;
  nextPollSeconds: number | null;
};

type StatusResponse = {
  success?: boolean;
  code?: string;
  data?: PaymentStatusData;
};

type PaymentTracking = {
  paymentId: string;
  statusToken: string;
};

type CountryOption = {
  code: CountryCode;
  name: string;
  dial: string;
  flag: string;
};

/* ============================================================
   TRADUCTIONS
============================================================ */

const TEXT = {
  fr: {
    title: "Paiement sécurisé",
    summary: "Récapitulatif",
    information: "Vos informations",

    email: "Adresse email",
    phone: "Numéro de téléphone",
    country: "Pays du num\u00e9ro de t\u00e9l\u00e9phone",
    chooseCountry: "Sélectionner un pays",

    subtotal: "Sous-total",
    fee: "Frais de service",
    total: "Total à payer",

    pay: "Payer maintenant",
    processing: "Traitement en cours...",
    loading: "Chargement...",
    retry: "Réessayer",
    refresh: "Actualiser",
    back: "Retour",

    invalidOrder: "Commande invalide.",
    emailRequired: "Adresse email invalide.",
    phoneRequired: "Numéro de téléphone invalide.",
    countryRequired: "Sélectionnez un pays.",
    methodRequired: "Choisissez un moyen de paiement.",

    unavailable: "Service temporairement indisponible.",

    paymentUnknown:
      "Paiement en cours de vérification. Ne relancez pas le paiement.",

    statusError:
      "Impossible de vérifier le statut actuellement.",

    pending: "Paiement en attente",
    validating: "Validation en cours",
    success: "Paiement confirmé",
    ticketSuccess: "Billets confirmés",
    donationSuccess: "Don confirmé. Merci !",

    failed: "Paiement échoué",
    cancelled: "Paiement annulé",
    refunded: "Paiement remboursé",

    mobilePrompt:
      "Confirmez le paiement sur votre téléphone.",

    verifying: "Nous vérifions la transaction.",
    preparingTickets: "Préparation de vos billets...",
    ticketsReady: "Vos billets sont générés.",

    emailDelivery: "Suivi de l'envoi par email",
    emailWaiting: "Votre email est en attente d'envoi.",
    emailSending: "Préparation et envoi de votre email en cours.",

    emailAccepted:
      "Votre email a été accepté par notre service d'envoi. Vérifiez votre boîte de réception et vos courriers indésirables.",

    emailFailed:
      "L'envoi de votre email a rencontré une difficulté. Votre paiement reste confirmé.",

    emailNotQueued:
      "L'envoi de votre confirmation n'est pas encore programmé.",

    emailUnknown:
      "Le suivi de l'email n'est pas encore disponible.",

    trackingEmail: "Actualiser le suivi de l'email",

    guestTicketInfo:
      "Vos billets PDF avec QR codes sont destinés à l'adresse email indiquée. Si vous avez acheté sans compte, vous pourrez également retrouver vos billets après connexion avec cette adresse, lorsque votre espace billets sera disponible.",

    donationConfirmed: "Votre don a bien été enregistré.",

    secure: "Propulsé par TIKEMIA Pay",
    continuePayment: "Continuer le paiement",
    changeMethod: "Changer de moyen",

    viewTickets: "Mes billets",
    explore: "Explorer",
    close: "Fermer",

    ticket: "Billet",
    tickets: "Billets",
    noDate: "Date à confirmer",
    noLocation: "Lieu non renseigné",
  },

  en: {
    title: "Secure checkout",
    summary: "Order summary",
    information: "Your information",

    email: "Email address",
    phone: "Phone number",
    country: "Phone number country",
    chooseCountry: "Select country",

    subtotal: "Subtotal",
    fee: "Service fee",
    total: "Total to pay",

    pay: "Pay now",
    processing: "Processing...",
    loading: "Loading...",
    retry: "Try again",
    refresh: "Refresh",
    back: "Back",

    invalidOrder: "Invalid order.",
    emailRequired: "Invalid email address.",
    phoneRequired: "Invalid phone number.",
    countryRequired: "Select a country.",
    methodRequired: "Choose a payment method.",

    unavailable: "Service temporarily unavailable.",

    paymentUnknown:
      "Payment verification is in progress. Do not pay again.",

    statusError:
      "Unable to check the payment status.",

    pending: "Payment pending",
    validating: "Processing payment",
    success: "Payment confirmed",
    ticketSuccess: "Tickets confirmed",
    donationSuccess: "Donation confirmed. Thank you!",

    failed: "Payment failed",
    cancelled: "Payment cancelled",
    refunded: "Payment refunded",

    mobilePrompt:
      "Confirm payment on your phone.",

    verifying: "We are verifying the transaction.",
    preparingTickets: "Preparing your tickets...",
    ticketsReady: "Your tickets have been generated.",

    emailDelivery: "Email delivery status",
    emailWaiting: "Your email is waiting to be sent.",
    emailSending: "Your email is being prepared and sent.",

    emailAccepted:
      "Your email has been accepted by our email provider. Check your inbox and spam folder.",

    emailFailed:
      "There was a problem sending your email. Your payment remains confirmed.",

    emailNotQueued:
      "Your confirmation email has not been queued yet.",

    emailUnknown:
      "Email tracking is not yet available.",

    trackingEmail: "Refresh email status",

    guestTicketInfo:
      "Your PDF tickets with QR codes are intended for the email address you provided. Guest purchases can also be found through the account associated with that address once the ticket area is available.",

    donationConfirmed: "Your donation has been recorded.",

    secure: "Powered by TIKEMIA Pay",
    continuePayment: "Continue payment",
    changeMethod: "Change method",

    viewTickets: "My tickets",
    explore: "Explore",
    close: "Close",

    ticket: "Ticket",
    tickets: "Tickets",
    noDate: "Date to be confirmed",
    noLocation: "Location unavailable",
  },
} as const;

/* ============================================================
   VALIDATIONS
============================================================ */

function validEmail(value: string): boolean {
  const email = value.trim().toLowerCase();

  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function validCountry(
  value: string | null | undefined
): value is CountryCode {
  if (!value) return false;

  return getCountries().includes(
    value.toUpperCase() as CountryCode
  );
}

function phoneE164(
  value: string,
  country: CountryCode
): string | null {
  try {
    const parsed = parsePhoneNumberFromString(
      value.trim(),
      country
    );

    return parsed?.isValid()
      ? parsed.number
      : null;
  } catch {
    return null;
  }
}

function validHttpsUrl(
  value: string | undefined
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function safeImage(
  value: string | null | undefined
): string | null {
  if (!value) return null;

  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }

  return validHttpsUrl(value);
}

function formatDate(
  value: string | null,
  timeZone: string,
  locale: Locale
): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(
      locale === "fr" ? "fr-FR" : "en-GB",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }
    ).format(date);
  } catch {
    return null;
  }
}

function money(
  value: string,
  currency: string,
  locale: Locale
): string {
  return formatMinorMoney(
    value,
    currency,
    locale
  );
}

function flagOf(code: string): string {
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map(
        (character) =>
          character.charCodeAt(0) + 127397
      )
  );
}

function countryName(
  code: CountryCode,
  locale: Locale
): string {
  try {
    return (
      new Intl.DisplayNames(
        [locale],
        { type: "region" }
      ).of(code) ?? code
    );
  } catch {
    return code;
  }
}

/* ============================================================
   REQUÊTES API
============================================================ */

async function requestJson<T>(
  url: string,
  options: RequestInit = {}
): Promise<{
  response: Response;
  body: T;
}> {
  const controller = new AbortController();

  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      credentials: "same-origin",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers ?? {}),
      },
    });

    const body = (await response.json()) as T;

    return {
      response,
      body,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

/* ============================================================
   IMAGE DE COMMANDE
============================================================ */

function OrderPicture({
  src,
  type,
}: {
  src: string | null;
  type: CheckoutType;
}) {
  const [failed, setFailed] =
    useState<string | null>(null);

  return (
    <div className="relative h-20 w-22 shrink-0 overflow-hidden rounded-xl bg-[#e9f5eb] sm:h-23 sm:w-27">
      {src && failed !== src ? (
        <Image
          fill
          sizes="108px"
          unoptimized
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(src)}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#087d2d]">
          {type === "donation" ? (
            <Heart size={30} />
          ) : (
            <Ticket size={30} />
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LOGO TIKEMIA PAY
============================================================ */

function PayLogo({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="flex items-center justify-center">
      <Image
        src={PAY_LOGO}
        alt="TIKEMIA Pay"
        width={215}
        height={61}
        unoptimized
        priority={!compact}
        className={
          compact
            ? "h-9 max-w-38 object-contain"
            : "h-13 max-w-54 object-contain sm:h-15"
        }
      />
    </div>
  );
}

/* ============================================================
   PAGE PRINCIPALE
============================================================ */

function CheckoutContent() {
  const params = useSearchParams();

  const typeParam = params.get("type");

  const type: CheckoutType | null =
    typeParam === "tickets" ||
    typeParam === "donation"
      ? typeParam
      : null;

  const resourceId =
    type === "tickets"
      ? params.get("orderId")
      : type === "donation"
        ? params.get("donationId")
        : null;

  const checkoutToken =
    params.get("checkoutToken");

  /* ==========================================================
     ÉTATS
  ========================================================== */

  const [locale, setLocale] =
    useState<Locale>("fr");

  const [checkout, setCheckout] =
    useState<CheckoutData | null>(null);

  const [country, setCountry] =
    useState<CountryCode | null>(null);

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [methodId, setMethodId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [paying, setPaying] =
    useState(false);

  const [step, setStep] =
    useState<PageStep>("checkout");

  const [error, setError] =
    useState<string | null>(null);

  const [tracking, setTracking] =
    useState<PaymentTracking | null>(null);

  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatusData | null>(null);

  const [nextAction, setNextAction] =
    useState<NextAction>({ type: "none" });

  const [
    paymentFrameOpen,
    setPaymentFrameOpen,
  ] = useState(false);

  const [summaryOpen, setSummaryOpen] =
    useState(true);

  /* ==========================================================
     REFS
  ========================================================== */

  const initialized = useRef(false);

  const countryManuallySelected =
    useRef(false);

  const payInProgress =
    useRef(false);

  const pollInProgress =
    useRef(false);

  const activeRequest =
    useRef<AbortController | null>(null);

  const currentAttemptKey =
    useRef<string | null>(null);

  const t = TEXT[locale];

  /* ==========================================================
     LANGUE
  ========================================================== */

  useEffect(() => {
    function syncLocale() {
      try {
        const saved =
          localStorage.getItem("tikemia_locale");

        if (saved === "fr" || saved === "en") {
          setLocale(saved);
          return;
        }
      } catch {
        // Français par défaut.
      }

      setLocale(
        document.documentElement.lang
          .toLowerCase()
          .startsWith("en")
          ? "en"
          : "fr"
      );
    }

    syncLocale();

    window.addEventListener(
      "storage",
      syncLocale
    );

    window.addEventListener(
      "tikemia:locale-changed",
      syncLocale
    );

    return () => {
      window.removeEventListener(
        "storage",
        syncLocale
      );

      window.removeEventListener(
        "tikemia:locale-changed",
        syncLocale
      );
    };
  }, []);

  /* ==========================================================
     PAYS INTERNATIONAUX
  ========================================================== */

  const countries = useMemo<CountryOption[]>(
    () => {
      const sorter = new Intl.Collator(locale, {
        sensitivity: "base",
      });

      return getCountries()
        .map((code) => ({
          code,
          name: countryName(code, locale),
          dial: getCountryCallingCode(code),
          flag: flagOf(code),
        }))
        .sort((a, b) =>
          sorter.compare(a.name, b.name)
        );
    },
    [locale]
  );

  const selectedCountry =
    countries.find(
      (item) => item.code === country
    ) ?? null;

  const lines =
    checkout?.type === "tickets"
      ? checkout.item.lines ?? []
      : [];

  const campaign =
    checkout?.type === "donation"
      ? checkout.item.campaign
      : null;

  /* ==========================================================
     CHARGEMENT DE LA COMMANDE
  ========================================================== */

  const fetchCheckout = useCallback(
    async (
      selected: CountryCode | null,
      silent = false
    ) => {
      if (
        !type ||
        !resourceId ||
        !UUID_PATTERN.test(resourceId) ||
        !checkoutToken
      ) {
        setError(TEXT[locale].invalidOrder);
        setLoading(false);
        return;
      }

      activeRequest.current?.abort();

      const controller = new AbortController();
      activeRequest.current = controller;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const search = new URLSearchParams({
          type,
          checkoutToken,
          locale,
        });

        search.set(
          type === "tickets"
            ? "orderId"
            : "donationId",
          resourceId
        );

        if (selected) {
          search.set(
            "countryCode",
            selected
          );
        }

        const response = await fetch(
          `${CHECKOUT_API}?${search.toString()}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            referrerPolicy: "no-referrer",
            signal: controller.signal,
          }
        );

        const result =
          (await response.json()) as
            CheckoutResponse;

        if (
          !response.ok ||
          result.success !== true ||
          !result.data
        ) {
          throw new Error(
            result.message ||
              TEXT[locale].unavailable
          );
        }

        if (controller.signal.aborted) {
          return;
        }

        const data = result.data;

        if (
          data.type !== type ||
          (type === "tickets"
            ? data.orderId !== resourceId
            : data.donationId !== resourceId)
        ) {
          throw new Error(
            TEXT[locale].invalidOrder
          );
        }

        setCheckout(data);

        if (
          !countryManuallySelected.current &&
          !selected &&
          validCountry(data.country.code)
        ) {
          setCountry(data.country.code);
        }

        if (!initialized.current) {
          setEmail(
            data.customer.email ?? ""
          );

          setPhone(
            data.customer.phoneE164 ?? ""
          );

          initialized.current = true;
        }

        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          cause instanceof Error
            ? cause.message
            : TEXT[locale].unavailable
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      type,
      resourceId,
      checkoutToken,
      locale,
    ]
  );

  /* ==========================================================
     CHARGEMENT INITIAL
  ========================================================== */

  useEffect(() => {
    if (step !== "checkout") return;

    const timeout = window.setTimeout(() => {
      void fetchCheckout(
        country,
        Boolean(checkout)
      );
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      activeRequest.current?.abort();
    };

    // Les paramètres sont contrôlés ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fetchCheckout,
    country,
    step,
  ]);

  /* ==========================================================
     CHANGER LE PAYS
  ========================================================== */

  function chooseCountry(code: CountryCode) {
    if (
      paying ||
      tracking ||
      step !== "checkout"
    ) {
      return;
    }

    countryManuallySelected.current = true;

    setCountry(code);
    setError(null);

    currentAttemptKey.current = null;
  }

  /* ==========================================================
     VÉRIFIER LE STATUT
  ========================================================== */

  const checkStatus = useCallback(
    async (current: PaymentTracking) => {
      if (pollInProgress.current) return;

      pollInProgress.current = true;

      try {
        const search = new URLSearchParams({
          paymentId: current.paymentId,
          statusToken: current.statusToken,
          locale,
        });

        const { response, body } =
          await requestJson<StatusResponse>(
            `${STATUS_API}?${search.toString()}`,
            {
              method: "GET",
            }
          );

        if (
          !response.ok ||
          body.success !== true ||
          !body.data
        ) {
          setError(
            TEXT[locale].statusError
          );

          return;
        }

        const result = body.data;

        if (
          result.paymentId !== current.paymentId
        ) {
          setError(
            TEXT[locale].statusError
          );

          return;
        }

        setPaymentStatus(result);
        if (result.nextAction?.type === "embedded_checkout") setNextAction(result.nextAction);
        setError(null);

        /* --------------------------------------------------
           PAIEMENT CONFIRMÉ ET FINALISÉ
        -------------------------------------------------- */

        if (
          result.status === "success" &&
          result.confirmed === true &&
          result.fulfillmentStatus ===
            "completed"
        ) {
          setStep("success");
          setPaymentFrameOpen(false);

          /*
           * Le suivi de l'email continue
           * même après confirmation du paiement.
           *
           * On n'arrête le suivi que lorsque
           * le fournisseur accepte l'email
           * ou que l'API arrête le polling.
           */



          return;
        }

        if (result.status === "failed") {
          setStep("failed");
          setPaymentFrameOpen(false);
          setTracking(null);
          return;
        }

        if (result.status === "cancelled") {
          setStep("cancelled");
          setPaymentFrameOpen(false);
          setTracking(null);
          return;
        }

        if (result.status === "refunded") {
          setStep("refunded");
          setPaymentFrameOpen(false);
          setTracking(null);
          return;
        }

        setStep("pending");
      } catch {
        setError(
          TEXT[locale].statusError
        );
      } finally {
        pollInProgress.current = false;
      }
    },
    [locale]
  );

  useEffect(() => {
    if (!resourceId) return;
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem("tikemia:payment:" + resourceId) ?? "null");
        if (saved && UUID_PATTERN.test(saved.paymentId) && STATUS_TOKEN_PATTERN.test(saved.statusToken) &&
            Number.isFinite(saved.savedAt) && Date.now() - saved.savedAt < 86400000) {
          setTracking({ paymentId: saved.paymentId, statusToken: saved.statusToken });
          setStep("pending");
        }
      } catch { /* Storage may be unavailable. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resourceId]);

  useEffect(() => {
    if (!tracking || !resourceId) return;
    try { sessionStorage.setItem("tikemia:payment:" + resourceId, JSON.stringify({ ...tracking, savedAt: Date.now() })); }
    catch { /* Payment tracking remains available in memory. */ }
  }, [tracking, resourceId]);

  /* ==========================================================
     POLLING AUTOMATIQUE
  ========================================================== */

  useEffect(() => {
    if (!tracking || paymentStatus?.nextPollSeconds === null) return;
    const currentTracking = tracking;

    const initialPoll = window.setTimeout(() => {
      void checkStatus(currentTracking);
    }, 0);

    const interval = window.setInterval(() => {
      if (
        document.visibilityState === "visible"
      ) {
        void checkStatus(currentTracking);
      }
    }, POLL_INTERVAL);

    function refresh() {
      if (
        document.visibilityState === "visible"
      ) {
        void checkStatus(currentTracking);
      }
    }

    window.addEventListener(
      "focus",
      refresh
    );

    document.addEventListener(
      "visibilitychange",
      refresh
    );

    return () => {
      window.clearTimeout(initialPoll);
      window.clearInterval(interval);

      window.removeEventListener(
        "focus",
        refresh
      );

      document.removeEventListener(
        "visibilitychange",
        refresh
      );
    };
  }, [
    tracking,
    checkStatus,
    paymentStatus?.nextPollSeconds,
  ]);

  /* ==========================================================
     EFFECTUER LE PAIEMENT
  ========================================================== */

  async function handlePay(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      paying ||
      payInProgress.current ||
      tracking ||
      step !== "checkout" ||
      !checkout ||
      !type ||
      !resourceId ||
      !checkoutToken
    ) {
      return;
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!validEmail(normalizedEmail)) {
      setError(t.emailRequired);
      return;
    }

    if (!country) {
      setError(t.countryRequired);
      return;
    }

    const formattedPhone =
      phoneE164(phone, country);

    if (!formattedPhone) {
      setError(t.phoneRequired);
      return;
    }

    if (!methodId) {
      setError(t.methodRequired);
      return;
    }

    if (refreshing || loading) {
      return;
    }

    payInProgress.current = true;
    setPaying(true);
    setError(null);

    /*
     * Même clé pour une tentative.
     *
     * Le backend doit aussi assurer
     * l'idempotence des créations
     * de paiements FedaPay.
     */

    if (!currentAttemptKey.current) {
      currentAttemptKey.current =
        crypto.randomUUID();
    }

    try {
      const base = {
        type,
        checkoutToken,
        countryCode: country,
        locale,

        ...(type === "tickets"
          ? { orderId: resourceId }
          : { donationId: resourceId }),
      };

      /* --------------------------------------------------
         ENREGISTREMENT DES COORDONNÉES
      -------------------------------------------------- */

      const saved =
        await requestJson<CheckoutResponse>(
          CHECKOUT_API,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              ...base,
              email: normalizedEmail,
              phoneE164: formattedPhone,
            }),
          }
        );

      if (
        !saved.response.ok ||
        saved.body.success !== true ||
        !saved.body.data
      ) {
        throw new Error(
          saved.body.message ||
            t.unavailable
        );
      }

      setCheckout(saved.body.data);

      /* --------------------------------------------------
         INITIALISATION DU PAIEMENT
      -------------------------------------------------- */

      const payment =
        await requestJson<PayResponse>(
          PAY_API,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              ...base,

              paymentMethodId: methodId,
              methodId,

              idempotencyKey:
                currentAttemptKey.current,

              customer: {
                email: normalizedEmail,
                phone: formattedPhone,
                countryCode: country,
              },
            }),
          }
        );

      const result = payment.body;

      /* --------------------------------------------------
         IDENTIFIANTS DU SUIVI
      -------------------------------------------------- */

      if (
        typeof result.paymentId ===
          "string" &&
        UUID_PATTERN.test(
          result.paymentId
        ) &&
        typeof result.statusToken ===
          "string" &&
        STATUS_TOKEN_PATTERN.test(
          result.statusToken
        )
      ) {
        setTracking({
          paymentId: result.paymentId,
          statusToken: result.statusToken,
        });

        setStep("pending");

        const action =
          result.nextAction ?? {
            type: "none" as const,
          };

        setNextAction(action);

        if (
          action.type === "iframe" &&
          validHttpsUrl(action.url)
        ) {
          setPaymentFrameOpen(true);
        }

        if (
          !payment.response.ok ||
          result.success !== true
        ) {
          setError(t.paymentUnknown);
        }

        return;
      }

      /* --------------------------------------------------
         ERREUR
      -------------------------------------------------- */

      if (
        !payment.response.ok ||
        result.success !== true
      ) {
        const message =
          result.error?.message ??
          result.message ??
          t.unavailable;

        /*
         * Si le backend ne sait pas si
         * le paiement a été initié,
         * ne pas demander immédiatement
         * un nouveau paiement.
         */

        if (
          payment.response.status >= 500
        ) {
          setError(t.paymentUnknown);
          return;
        }

        throw new Error(message);
      }

      throw new Error(t.statusError);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t.unavailable
      );
    } finally {
      payInProgress.current = false;
      setPaying(false);
    }
  }

  /* ==========================================================
     RECOMMENCER APRÈS ÉCHEC
  ========================================================== */

  function retryPayment() {
    if (tracking || paying) return;

    currentAttemptKey.current = null;

    setStep("checkout");
    setError(null);
    setPaymentStatus(null);

    setNextAction({
      type: "none",
    });

    setPaymentFrameOpen(false);
    setMethodId("");
  }

  /* ==========================================================
     RÉCAPITULATIF
  ========================================================== */

  function renderSummary() {
    if (!checkout) return null;

    return (
      <section className="overflow-hidden rounded-[22px] border border-[#e1e8e2] bg-white shadow-[0_4px_18px_rgba(15,45,27,0.05)]">
        <button
          type="button"
          onClick={() =>
            setSummaryOpen((previous) => !previous)
          }
          aria-expanded={summaryOpen}
          className="flex w-full items-center justify-between gap-3 border-b border-[#e8eee9] px-4 py-4 text-left sm:px-5"
        >
          <div className="flex items-center gap-2.5">
            {checkout.type === "tickets" ? (
              <Ticket
                size={23}
                className="text-[#087d2d]"
              />
            ) : (
              <Heart
                size={23}
                className="text-[#087d2d]"
              />
            )}

            <h2 className="text-[17px] font-black text-[#122138]">
              {t.summary}
            </h2>
          </div>

          <ChevronDown
            size={19}
            className={`text-[#516473] transition-transform lg:hidden ${
              summaryOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        <div
          className={`${
            summaryOpen ? "block" : "hidden"
          } lg:block`}
        >
          <div className="space-y-3 p-4 sm:p-5">
            {checkout.type === "tickets" ? (
              lines.map((line) => {
                const date = formatDate(
                  line.event.startsAt,
                  line.event.timeZone,
                  locale
                );

                const venue = line.event.venue;

                const location = venue
                  ? [
                      venue.name,
                      venue.city,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : null;

                return (
                  <article
                    key={line.id}
                    className="flex min-w-0 gap-3 border-b border-[#eff1ef] pb-3 last:border-0 last:pb-0"
                  >
                    <OrderPicture
                      src={safeImage(
                        line.event.imageUrl
                      )}
                      type="tickets"
                    />

                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-[13px] font-black text-[#13233b] sm:text-[15px]">
                        {line.title}
                      </h3>

                      {date && (
                        <p className="mt-1 flex items-start gap-1 text-[11px] text-[#526175]">
                          <CalendarDays
                            size={13}
                            className="shrink-0"
                          />
                          {date}
                        </p>
                      )}

                      {location && (
                        <p className="mt-1 flex items-start gap-1 text-[11px] text-[#526175]">
                          <MapPin
                            size={13}
                            className="shrink-0"
                          />

                          <span className="line-clamp-1">
                            {location}
                          </span>
                        </p>
                      )}

                      <p className="mt-2 text-xs font-bold text-[#087d2d]">
                        {line.category}
                        {" × "}
                        {line.quantity}
                      </p>

                      <p className="mt-1 text-[13px] font-black text-[#152438]">
                        {money(
                          line.subtotalMinor,
                          checkout.currency,
                          locale
                        )}
                      </p>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="flex min-w-0 gap-3">
                <OrderPicture
                  src={safeImage(
                    campaign?.imageUrl
                  )}
                  type="donation"
                />

                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-3 text-[15px] font-black text-[#142438]">
                    {campaign?.title}
                  </h3>

                  <p className="mt-2 text-xs text-[#5b6b7d]">
                    {[
                      campaign?.city,
                      campaign?.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>

                  <p className="mt-2 text-sm font-extrabold text-[#087d2d]">
                    {money(
                      checkout.subtotalMinor,
                      checkout.currency,
                      locale
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#e8eee9] bg-[#fafcfb] px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-2 text-[13px] text-[#536477]">
              <span>{t.subtotal}</span>

              <span className="font-bold text-[#17283b]">
                {money(
                  checkout.subtotalMinor,
                  checkout.currency,
                  locale
                )}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 text-[13px] text-[#536477]">
              <span>{t.fee}</span>

              <span className="font-bold text-[#17283b]">
                {money(
                  checkout.serviceFeeMinor,
                  checkout.currency,
                  locale
                )}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#dce6df] pt-4">
              <span className="text-sm font-extrabold text-[#13253a]">
                {t.total}
              </span>

              <span className="text-[21px] font-black text-[#087d2d] sm:text-[25px]">
                {money(
                  checkout.totalMinor,
                  checkout.currency,
                  locale
                )}
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ==========================================================
     RÉSULTAT DU PAIEMENT
  ========================================================== */

  function renderPaymentResult() {
    if (step === "pending" && nextAction.type === "embedded_checkout" && !paymentStatus?.paymentConfirmed) {
      return <section className="min-w-0 rounded-[23px] border border-[#e2eae3] bg-white p-3 shadow-[0_5px_20px_rgba(16,52,28,0.06)] sm:p-5">
        <h2 className="text-center text-xl font-black text-[#142238]">{locale === "fr" ? "Finalisez votre paiement" : "Complete your payment"}</h2>
        <EmbeddedPayment publicKey={nextAction.publicKey} environment={nextAction.environment} transactionId={nextAction.transactionId} locale={locale} />
        {error && <p role="alert" className="mt-3 text-center text-sm text-[#af4439]">{error}</p>}
      </section>;
    }
    const isSuccess = step === "success";
    const isPending = step === "pending";

    const title =
      step === "success"
        ? checkout?.type === "donation"
          ? t.donationSuccess
          : t.ticketSuccess
        : step === "failed"
          ? t.failed
          : step === "cancelled"
            ? t.cancelled
            : step === "refunded"
              ? t.refunded
              : paymentStatus?.status === "processing"
                ? t.validating
                : t.pending;

    const emailStatus =
      paymentStatus?.emailStatus;

    const emailMessage =
      emailStatus === "accepted"
        ? t.emailAccepted
        : emailStatus === "sending"
          ? t.emailSending
          : emailStatus === "queued"
            ? t.emailWaiting
            : emailStatus === "failed"
              ? t.emailFailed
              : emailStatus === "not_queued"
                ? t.emailNotQueued
                : t.emailUnknown;

    return (
      <section className="rounded-[23px] border border-[#e2eae3] bg-white p-5 text-center shadow-[0_5px_20px_rgba(16,52,28,0.06)] sm:p-8">
        <div
          className={`mx-auto flex size-19 items-center justify-center rounded-full ${
            isSuccess
              ? "bg-[#e5f9e4] text-[#07832d]"
              : isPending
                ? "bg-[#e9f3ed] text-[#087d2d]"
                : "bg-[#fff0ed] text-[#c25442]"
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 size={42} />
          ) : isPending ? (
            <LoaderCircle
              size={38}
              className="animate-spin"
            />
          ) : (
            <CircleAlert size={39} />
          )}
        </div>

        <h2 className="mt-4 text-[22px] font-black text-[#142238] sm:text-[28px]">
          {title}
        </h2>

        {isPending && (
          <p className="mt-3 text-[13px] text-[#617186]">
            {nextAction.type ===
            "mobile_money_prompt"
              ? nextAction.message ||
                t.mobilePrompt
              : paymentStatus?.status === "processing"
                ? checkout?.type === "tickets"
                  ? t.preparingTickets
                  : t.verifying
                : t.verifying}
          </p>
        )}

        {checkout && (
          <div className="mt-5 rounded-xl bg-[#f3faf4] px-4 py-4">
            <p className="text-xs font-bold text-[#576879]">
              {t.total}
            </p>

            <p className="mt-1 text-[24px] font-black text-[#087d2d]">
              {money(
                checkout.totalMinor,
                checkout.currency,
                locale
              )}
            </p>
          </div>
        )}

        {/* BILLETS GÉNÉRÉS */}

        {isSuccess &&
          checkout?.type === "tickets" && (
            <div className="mt-5 space-y-2 text-[13px] text-[#536b5b]">
              <p className="flex items-center justify-center gap-2 font-bold">
                <CheckCircle2
                  size={17}
                  className="text-[#087d2d]"
                />

                {paymentStatus?.ticketsReady
                  ? t.ticketsReady
                  : t.preparingTickets}
              </p>

              {paymentStatus?.ticketCount != null && (
                <p className="font-extrabold text-[#087d2d]">
                  {paymentStatus.ticketCount}
                  {" "}
                  {paymentStatus.ticketCount > 1
                    ? t.tickets
                    : t.ticket}
                </p>
              )}
            </div>
          )}

        {/* DON CONFIRMÉ */}

        {isSuccess &&
          checkout?.type === "donation" && (
            <p className="mt-4 text-[13px] text-[#5c7082]">
              {t.donationConfirmed}
            </p>
          )}

        {/* SUIVI RÉEL DE L'EMAIL */}

        {isSuccess && paymentStatus && (
          <div
            role="status"
            aria-live="polite"
            className="mt-5 rounded-2xl border border-[#dce8df] bg-[#f8fcf9] px-4 py-4 text-left sm:px-5"
          >
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#153426]">
              <Mail
                size={18}
                className="shrink-0 text-[#087d2d]"
              />

              {t.emailDelivery}
            </div>

            <p
              className={`mt-2 text-[13px] leading-relaxed ${
                emailStatus === "failed"
                  ? "text-[#a04431]"
                  : "text-[#456052]"
              }`}
            >
              {emailMessage}
            </p>

            {checkout?.type === "tickets" && (
              <p className="mt-3 text-xs leading-relaxed text-[#607268]">
                {t.guestTicketInfo}
              </p>
            )}

            {tracking &&
              emailStatus !== "accepted" && (
                <button
                  type="button"
                  onClick={() =>
                    void checkStatus(tracking)
                  }
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#087d2d] px-4 text-xs font-bold text-[#087d2d]"
                >
                  <RefreshCw size={15} />
                  {t.trackingEmail}
                </button>
              )}
          </div>
        )}

        {/* ERREURS */}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-[#fff4f2] px-4 py-3 text-xs text-[#af4439]"
          >
            {error}
          </div>
        )}

        {/* REDIRECTION DU PRESTATAIRE */}

        {isPending &&
          nextAction.type === "redirect" &&
          validHttpsUrl(nextAction.url) && (
            <a
              href={validHttpsUrl(
                nextAction.url
              )!}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#087d2d] px-4 text-sm font-extrabold text-white"
            >
              {t.continuePayment}
              <ArrowRight size={17} />
            </a>
          )}

        {/* PAIEMENT IFRAME */}

        {isPending &&
          nextAction.type === "iframe" &&
          validHttpsUrl(nextAction.url) &&
          !paymentFrameOpen && (
            <button
              type="button"
              onClick={() =>
                setPaymentFrameOpen(true)
              }
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#087d2d] px-4 text-sm font-extrabold text-white"
            >
              {t.continuePayment}
              <ArrowRight size={17} />
            </button>
          )}

        {/* ACTUALISATION DU STATUT */}

        {isPending && tracking && (
          <button
            type="button"
            onClick={() =>
              void checkStatus(tracking)
            }
            className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#087d2d] px-5 text-xs font-extrabold text-[#087d2d]"
          >
            <RefreshCw size={16} />
            {t.refresh}
          </button>
        )}

        {isSuccess && checkout?.type === "tickets" && tracking && (
          <a href={STATUS_API + "?" + new URLSearchParams({ paymentId: tracking.paymentId, statusToken: tracking.statusToken, locale, download: "tickets" }).toString()}
            referrerPolicy="no-referrer"
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#087d2d] px-4 text-sm font-extrabold text-white">
            <Ticket size={19} />{locale === "fr" ? "T\u00e9l\u00e9charger mes billets PDF" : "Download my PDF tickets"}
          </a>
        )}

        {/* ESPACE BILLETS */}

        {isSuccess &&
          checkout?.type === "tickets" && (
            <Link
              href="/account/tickets"
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#087d2d] px-4 text-sm font-extrabold text-white"
            >
              <Ticket size={19} />
              {t.viewTickets}
            </Link>
          )}

        {/* CAGNOTTES */}

        {isSuccess &&
          checkout?.type === "donation" && (
            <Link
              href="/campaigns"
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#087d2d] px-4 text-sm font-extrabold text-white"
            >
              {t.explore}
              <ArrowRight size={17} />
            </Link>
          )}

        {/* RECOMMENCER APRÈS ÉCHEC */}

        {(step === "failed" ||
          step === "cancelled") && (
          <button
            type="button"
            onClick={retryPayment}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#087d2d] px-4 text-sm font-extrabold text-white"
          >
            <RefreshCw size={18} />
            {t.changeMethod}
          </button>
        )}
      </section>
    );
  }

  /* ==========================================================
     RENDU PRINCIPAL
  ========================================================== */

  return (
    <div
      id="tikemia-checkout-page"
      className="flex w-full min-w-0 flex-1 flex-col bg-[#f8faf9] text-[#142237]"
    >
      {/* EN-TÊTE */}

      <div className="border-b border-[#e6eee8] bg-white px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={
              checkout?.type === "donation"
                ? "/campaigns"
                : "/explore"
            }
            aria-label={t.back}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#dce9df] text-[#087d2d]"
          >
            <ArrowLeft size={20} />
          </Link>

          <PayLogo />

          <div className="flex size-10 shrink-0 items-center justify-center text-[#087d2d]">
            <LockKeyhole size={22} />
          </div>
        </div>
      </div>

      {/* CONTENU */}

      <div className="w-full min-w-0 px-3 py-5 sm:px-6 md:py-7 xl:px-9">
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck
            size={32}
            className="shrink-0 text-[#087d2d] sm:size-10"
          />

          <h1 className="text-[23px] font-black text-[#112037] sm:text-[32px]">
            {t.title}
          </h1>
        </div>

        {/* CHARGEMENT */}

        {loading && !checkout ? (
          <div className="flex min-h-88 items-center justify-center">
            <LoaderCircle
              size={34}
              className="animate-spin text-[#087d2d]"
            />
          </div>
        ) : !checkout ? (
          <div className="mx-auto max-w-150 rounded-2xl border border-[#e2e9e4] bg-white p-7 text-center">
            <CircleAlert
              size={34}
              className="mx-auto text-[#bf4940]"
            />

            <p className="mt-3 text-sm font-bold">
              {error || t.invalidOrder}
            </p>

            <button
              type="button"
              onClick={() =>
                void fetchCheckout(country)
              }
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#087d2d] px-6 py-3 text-sm font-bold text-white"
            >
              <RefreshCw size={17} />
              {t.retry}
            </button>
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6">
            {/* GAUCHE : RÉCAPITULATIF */}

            <div className="min-w-0">
              {renderSummary()}

              <div className="mt-4 hidden items-center justify-center gap-2 text-xs text-[#66776b] lg:flex">
                <LockKeyhole size={15} />
                {t.secure}
              </div>
            </div>

            {/* DROITE : FORMULAIRE OU RÉSULTAT */}

            <div className="min-w-0">
              {step !== "checkout" ? (
                renderPaymentResult()
              ) : (
                <form
                  onSubmit={handlePay}
                  className="rounded-[22px] border border-[#e2eae4] bg-white p-4 shadow-[0_4px_18px_rgba(15,45,27,0.05)] sm:p-6"
                >
                  <h2 className="text-[18px] font-black text-[#122239]">
                    {t.information}
                  </h2>

                  <div className="mt-4 space-y-4">
                    {/* EMAIL */}

                    <div>
                      <label
                        htmlFor="checkout-email"
                        className="mb-2 block text-[13px] font-bold"
                      >
                        {t.email}
                      </label>

                      <div className="relative">
                        <Mail
                          size={19}
                          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#64748b]"
                        />

                        <input
                          id="checkout-email"
                          type="email"
                          name="email"
                          autoComplete="email"
                          required
                          maxLength={254}
                          value={email}
                          onChange={(event) => {
                            setEmail(
                              event.target.value
                            );
                            setError(null);
                          }}
                          placeholder="email@example.com"
                          disabled={paying}
                          className="h-13 w-full rounded-xl border border-[#d8e2dc] bg-[#fbfcfb] pr-3 pl-11 text-sm outline-none focus:border-[#087d2d]"
                        />
                      </div>
                    </div>

                    {/* PAYS */}

                    <div>
                      <label
                        htmlFor="checkout-country"
                        className="mb-2 block text-[13px] font-bold"
                      >
                        {t.country}
                      </label>

                      <div className="relative">
                        <select
                          id="checkout-country"
                          value={country ?? ""}
                          disabled={paying}
                          onChange={(event) => {
                            if (
                              validCountry(
                                event.target.value
                              )
                            ) {
                              chooseCountry(
                                event.target
                                  .value as CountryCode
                              );
                            }
                          }}
                          className="h-13 w-full appearance-none rounded-xl border border-[#d8e2dc] bg-[#fbfcfb] px-4 pr-10 text-sm outline-none focus:border-[#087d2d]"
                        >
                          <option value="">
                            {t.chooseCountry}
                          </option>

                          {countries.map((item) => (
                            <option
                              key={item.code}
                              value={item.code}
                            >
                              {item.flag}
                              {" "}
                              {item.name}
                            </option>
                          ))}
                        </select>

                        <ChevronDown
                          size={18}
                          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#475569]"
                        />
                      </div>
                    </div>

                    {/* TÉLÉPHONE */}

                    <div>
                      <label
                        htmlFor="checkout-phone"
                        className="mb-2 block text-[13px] font-bold"
                      >
                        {t.phone}
                      </label>

                      <div className="flex min-w-0 gap-2">
                        <div className="flex h-13 min-w-23 shrink-0 items-center justify-center gap-1 rounded-xl border border-[#d8e2dc] bg-[#fbfcfb] px-2 text-xs font-bold">
                          {selectedCountry ? (
                            <>
                              <span className="text-lg">
                                {selectedCountry.flag}
                              </span>

                              +{selectedCountry.dial}
                            </>
                          ) : (
                            <Phone size={18} />
                          )}
                        </div>

                        <input
                          id="checkout-phone"
                          type="tel"
                          name="phone"
                          inputMode="tel"
                          autoComplete="tel"
                          required
                          maxLength={MAX_PHONE_LENGTH}
                          value={phone}
                          onChange={(event) => {
                            setPhone(
                              event.target.value
                            );
                            setError(null);
                          }}
                          placeholder={t.phone}
                          disabled={paying}
                          className="h-13 min-w-0 flex-1 rounded-xl border border-[#d8e2dc] bg-[#fbfcfb] px-3 text-sm outline-none focus:border-[#087d2d]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* MOYENS DE PAIEMENT */}

                  <div className="mt-6 border-t border-[#e6ece8] pt-5">
                    <PaymentMethods
                      amountMinor={checkout.totalMinor}
                      countryCode={country}
                      currencyCode={
                        checkout.currency
                      }
                      checkoutType={
                        checkout.type ===
                        "tickets"
                          ? "ticket"
                          : "donation"
                      }
                      locale={locale}
                      value={methodId}
                      onChange={(id) => {
                        setMethodId(id);
                        setError(null);
                      }}
                      disabled={paying}
                      loading={refreshing}
                      showRefresh
                    />
                  </div>

                  {/* ERREUR */}

                  {error && (
                    <div
                      role="alert"
                      className="mt-4 flex items-start gap-2 rounded-xl border border-[#f1d0cc] bg-[#fff5f3] px-3 py-3 text-xs font-semibold text-[#b4453b]"
                    >
                      <CircleAlert
                        size={17}
                        className="shrink-0"
                      />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* TOTAL */}

                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#e6ece7] pt-5">
                    <span className="text-[13px] font-bold text-[#334155]">
                      {t.total}
                    </span>

                    <span className="text-[23px] font-black text-[#087d2d]">
                      {money(
                        checkout.totalMinor,
                        checkout.currency,
                        locale
                      )}
                    </span>
                  </div>

                  {/* CONFIRMATION DU PAIEMENT */}

                  <button
                    type="submit"
                    disabled={
                      paying ||
                      refreshing ||
                      loading ||
                      !country ||
                      !methodId
                    }
                    className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-linear-to-b from-[#19a800] to-[#006a29] px-5 text-[15px] font-extrabold text-white shadow-[0_5px_15px_rgba(0,108,41,0.14)] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {paying ? (
                      <>
                        <LoaderCircle
                          size={20}
                          className="animate-spin"
                        />
                        {t.processing}
                      </>
                    ) : (
                      <>
                        <LockKeyhole size={20} />
                        {t.pay}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>

                  {/* LOGO */}

                  <div className="mt-5 border-t border-[#ecf0ed] pt-4">
                    <PayLogo compact />
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* BAS DE PAGE MOBILE */}

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-semibold text-[#718074] lg:hidden">
          <LockKeyhole size={14} />
          {t.secure}
        </div>
      </div>

      {/* FENÊTRE DE PAIEMENT INTÉGRÉ */}

      {paymentFrameOpen &&
        nextAction.type === "iframe" &&
        validHttpsUrl(
          nextAction.url
        ) && (
          <div className="fixed inset-0 z-120 flex flex-col bg-black/65 p-2 sm:p-5">
            <div className="mx-auto flex h-full w-full max-w-185 flex-col overflow-hidden rounded-[18px] bg-white shadow-2xl">
              <div className="flex min-h-16 items-center justify-between gap-3 border-b border-[#e5eae5] px-4">
                <PayLogo compact />

                <button
                  type="button"
                  onClick={() =>
                    setPaymentFrameOpen(false)
                  }
                  aria-label={t.close}
                  className="flex size-10 items-center justify-center rounded-full border border-[#e0e8e2] text-[#26374a]"
                >
                  <X size={20} />
                </button>
              </div>

              <iframe
                title={t.title}
                src={
                  validHttpsUrl(
                    nextAction.url
                  )!
                }
                referrerPolicy="no-referrer"
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
                className="min-h-0 w-full flex-1 border-0 bg-white"
              />
            </div>
          </div>
        )}
    </div>
  );
}

/* ============================================================
   NEXT.JS SUSPENSE
============================================================ */

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-100 w-full items-center justify-center bg-[#f8faf9]">
          <LoaderCircle
            size={34}
            className="animate-spin text-[#087d2d]"
          />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
