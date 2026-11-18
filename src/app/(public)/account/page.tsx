
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import Image from "next/image";
import { formatMinorMoney } from "@/i18n/config";
import { PublicAccountShell } from "@/components/public/PublicNavigation";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Mail,
  MapPin,
  Pencil,
  Phone,
  QrCode,
  RefreshCw,
  ShoppingCart,
  Ticket,
  UserRound,
  Wallet,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — ESPACE MON COMPTE PUBLIC

   FICHIER :
   src/app/(public)/account/page.tsx

   ROUTE :
   /account

   API EXISTANTE :
   GET /api/public/account

   OBJECTIF :
   - Afficher le profil du client
   - Afficher son nom et sa photo
   - Afficher son email et son téléphone
   - Afficher les statistiques réelles
   - Afficher ses billets encore valables
   - Exclure les billets déjà scannés
   - Afficher les photos des événements
   - Accéder aux billets et aux transferts
   - Actualiser régulièrement les données

   VERSION PC :
   - Header public existant
   - Aucun menu latéral supplémentaire
   - Titre Mon compte
   - Carte du profil horizontale
   - Trois cartes statistiques
   - Billets en lignes horizontales
   - Footer public existant

   VERSION MOBILE :
   - Header mobile existant
   - Bandeau profil vert
   - Carte coordonnées
   - Trois statistiques compactes
   - Billets en cartes horizontales
   - Bouton transférer un billet
   - Navigation mobile existante
   - Aucun footer

   DONNÉES :
   Exclusivement depuis PostgreSQL
   via /api/public/account.

   SÉCURITÉ :
   - Session contrôlée par le serveur
   - Aucun email libre utilisé
     pour rechercher les billets
   - Aucun QR privé exposé ici
   - Aucun billet fictif
   - Aucun faux compteur
   - Aucun nouveau fichier CSS
   - Aucun menu dupliqué
========================================================== */

const API_URL = "/api/public/account";

const LOGIN_URL = "/login";



const TICKETS_URL = "/account/tickets";

const TRANSFER_URL = "/account/transfer";

const REFRESH_INTERVAL_MS = 10_000;

const PAGE_SIZE = 12;

type Locale = "fr" | "en";

type Profile = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phoneE164: string | null;
  countryCode: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
};

type Money = {
  amountMinor: string;
  currency: string;
};

type Statistics = {
  validTickets: number;
  totalPurchases: number;
  spentByCurrency: Money[];
};

type AccountTicket = {
  id: string;
  number: string;
  status: "VALID";
  issuedAt: string;

  event: {
    id: string;
    slug: string;
    title: string;
    imageUrl: string | null;
    category: string;
    timeZone: string;

    venue: {
      name: string;
      address: string;
      city: string;
      country: string;
    } | null;
  };

  schedule: {
    id: string;
    startsAt: string;
    endsAt: string | null;
    label: string | null;
  } | null;

  ticketCategory: {
    id: string;
    name: string;
  };

  order: {
    id: string;
    reference: string;
    currency: string;
    paidAt: string | null;
  };
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type AccountData = {
  profile: Profile;
  statistics: Statistics;
  tickets: AccountTicket[];
  pagination: Pagination;
};

type AccountResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  generatedAt?: string;
  data?: AccountData;
};

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TEXT = {
  fr: {
    title: "Mon compte",
    subtitle: "Gérez vos informations et vos billets.",

    editProfile: "Modifier le profil",

    validTickets: "Billets valables",
    totalPurchases: "Achats totaux",
    totalSpent: "Montant dépensé",

    myTickets: "Mes billets valables",

    valid: "Billet valable",

    viewTicket: "Voir le billet",
    transfer: "Transférer",
    transferTicket: "Transférer un billet",

    noTickets: "Aucun billet valable",
    noTicketsDescription:
      "Vos billets disponibles apparaîtront ici après leur achat et leur attribution à votre compte.",

    exploreEvents: "Explorer les événements",

    noName: "Mon profil",

    noPhone: "Numéro non renseigné",

    noImage: "Image indisponible",

    datePending: "Date non renseignée",
    locationPending: "Lieu non renseigné",

    loading: "Chargement de votre compte...",
    refreshing: "Actualisation...",
    refresh: "Actualiser",

    error: "Impossible de charger votre compte.",
    retry: "Réessayer",

    sessionExpired:
      "Votre session a expiré. Veuillez vous connecter.",

    previous: "Précédent",
    next: "Suivant",

    page: "Page",
    of: "sur",

    multipleCurrencies:
      "Dépenses par devise",

    noPurchases: "Aucun achat",

    updated: "Informations actualisées",

    ticketNumber: "Billet",
  },

  en: {
    title: "My account",
    subtitle: "Manage your information and tickets.",

    editProfile: "Edit profile",

    validTickets: "Valid tickets",
    totalPurchases: "Total purchases",
    totalSpent: "Amount spent",

    myTickets: "My valid tickets",

    valid: "Valid ticket",

    viewTicket: "View ticket",
    transfer: "Transfer",
    transferTicket: "Transfer a ticket",

    noTickets: "No valid tickets",
    noTicketsDescription:
      "Your available tickets will appear here after purchase and assignment to your account.",

    exploreEvents: "Explore events",

    noName: "My profile",

    noPhone: "Phone number not provided",

    noImage: "Image unavailable",

    datePending: "Date not provided",
    locationPending: "Location not provided",

    loading: "Loading your account...",
    refreshing: "Refreshing...",
    refresh: "Refresh",

    error: "Unable to load your account.",
    retry: "Try again",

    sessionExpired:
      "Your session has expired. Please sign in.",

    previous: "Previous",
    next: "Next",

    page: "Page",
    of: "of",

    multipleCurrencies:
      "Spending by currency",

    noPurchases: "No purchases",

    updated: "Information updated",

    ticketNumber: "Ticket",
  },
} as const;

/* ==========================================================
   FORMATAGE DES MONTANTS

   Prisma renvoie les montants
   en unités monétaires mineures.

   XOF : 1 unité = 1 FCFA
   EUR : 100 unités = 1 euro
   USD : 100 unités = 1 dollar

   On utilise BigInt pour éviter
   les erreurs de précision.

   Aucun mélange entre devises.
========================================================== */

function formatMoney(amountMinor: string, currency: string, locale: Locale): string { return formatMinorMoney(amountMinor, currency, locale); }

/* ==========================================================
   FORMATAGE DES DATES

   Les dates sont reçues en ISO.

   Utilisation du fuseau horaire
   de l'événement.

   Ne jamais inventer une date
   lorsqu'aucune séance n'est fournie.
========================================================== */

function formatEventDate(
  iso: string | null,
  timeZone: string,
  locale: Locale
): string | null {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);

  if (
    Number.isNaN(date.getTime())
  ) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(
      locale === "fr"
        ? "fr-FR"
        : "en-GB",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }
    ).format(date);
  } catch {
    return new Intl.DateTimeFormat(
      locale === "fr"
        ? "fr-FR"
        : "en-GB",
      {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }
    ).format(date);
  }
}

/* ==========================================================
   INITIALISATION DU PROFIL
========================================================== */

function getInitials(
  name: string,
  email: string
): string {
  const source =
    name.trim() ||
    email.split("@")[0] ||
    "T";

  const pieces =
    source.split(/\s+/).filter(Boolean);

  return pieces
    .slice(0, 2)
    .map((piece) =>
      piece.charAt(0).toUpperCase()
    )
    .join("");
}

/* ==========================================================
   IMAGE PUBLIQUE

   Les références d'images arrivent
   déjà résolues depuis l'API.

   Aucune URL privée de stockage
   n'est affichée.

   Next Image en mode unoptimized
   pour conserver la compatibilité
   avec les URLs publiques existantes.
========================================================== */

function AccountAvatar({
  name,
  email,
  src,
  size = "large",
}: {
  name: string;
  email: string;
  src: string | null;
  size?: "large" | "medium";
}) {
  const [imageFailed, setImageFailed] = useState<string | null>(null);



  const dimensions =
    size === "large"
      ? "size-26 sm:size-29"
      : "size-18";

  return (
    <div
      className={`relative ${dimensions} shrink-0 overflow-hidden rounded-full border-[3px] border-[#f7d64a] bg-linear-to-br from-[#ecfbb1] to-[#07852b]`}
    >
      {src && imageFailed !== src ? (
        <Image
          src={src}
          alt={name || email}
          fill
          sizes={
            size === "large"
              ? "116px"
              : "72px"
          }
          unoptimized
          className="object-cover"
          onError={() =>
            setImageFailed(src)
          }
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[25px] font-black text-[#064329]">
          {getInitials(name, email)}
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   IMAGE DU BILLET
========================================================== */

function TicketImage({
  src,
  title,
}: {
  src: string | null;
  title: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);



  return (
    <div className="relative h-19 w-19 shrink-0 overflow-hidden rounded-xl bg-[#e8f3eb] sm:h-23.5 sm:w-33">
      {src && failed !== src ? (
        <Image
          src={src}
          alt={title}
          fill
          sizes="(max-width: 640px) 76px, 132px"
          unoptimized
          className="object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#11893b]">
          <Ticket size={32} />
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   PAGE MON COMPTE
========================================================== */

export default function AccountPage() {
  const router = useRouter();
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profilePhoneInput, setProfilePhoneInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  /* ========================================================
     LANGUE
  ======================================================== */

  const [locale, setLocale] =
    useState<Locale>("fr");

  const t = TEXT[locale];

  /* ========================================================
     DONNÉES RÉELLES
  ======================================================== */

  const [account, setAccount] =
    useState<AccountData | null>(null);

  const [page, setPage] =
    useState(1);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [, setUpdatedAt] =
    useState<string | null>(null);

  /* ========================================================
     RÉFÉRENCES TECHNIQUES

     Permettent d'éviter :
     - Les réponses obsolètes
     - Les requêtes simultanées
     - Les modifications après
       démontage du composant
  ======================================================== */

  const controllerRef =
    useRef<AbortController | null>(null);

  const requestIdRef =
    useRef(0);

  const mountedRef =
    useRef(true);

  /* ========================================================
     LANGUE PUBLIQUE TIKEMIA
  ======================================================== */

  useEffect(() => {
    function synchronizeLanguage() {
      try {
        const stored =
          localStorage.getItem(
            "tikemia_locale"
          );

        if (
          stored === "fr" ||
          stored === "en"
        ) {
          setLocale(stored);
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

    synchronizeLanguage();

    window.addEventListener(
      "storage",
      synchronizeLanguage
    );

    window.addEventListener(
      "tikemia:locale-changed",
      synchronizeLanguage
    );

    return () => {
      window.removeEventListener(
        "storage",
        synchronizeLanguage
      );

      window.removeEventListener(
        "tikemia:locale-changed",
        synchronizeLanguage
      );
    };
  }, []);

  /* ========================================================
     CHARGER LE COMPTE

     Requête exclusivement :
     GET /api/public/account

     Aucun identifiant utilisateur,
     email ou téléphone n'est envoyé
     dans la requête.

     Le serveur identifie le client
     grâce au cookie HttpOnly.
  ======================================================== */

  const loadAccount = useCallback(
    async (
      targetPage: number,
      silent = false
    ) => {
      const requestId =
        ++requestIdRef.current;

      controllerRef.current?.abort();

      const controller =
        new AbortController();

      controllerRef.current =
        controller;

      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);

      try {
        const url =
          `${API_URL}?page=${targetPage}` +
          `&limit=${PAGE_SIZE}`;

        const response = await fetch(
          url,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",

            headers: {
              Accept: "application/json",
            },

            signal: controller.signal,
          }
        );

        /* ==============================================
           SESSION ABSENTE OU EXPIRÉE

           Pas de données personnelles
           accessibles sans connexion.
        ============================================== */

        if (response.status === 401 || response.status === 403) {
          if (
            mountedRef.current &&
            requestId ===
              requestIdRef.current
          ) {
            router.replace(LOGIN_URL);
          }

          return;
        }

        const result =
          (await response.json()) as AccountResponse;

        if (
          !response.ok ||
          result.success !== true ||
          !result.data
        ) {
          throw new Error(
            result.message ||
              "ACCOUNT_LOAD_FAILED"
          );
        }

        if (
          !mountedRef.current ||
          requestId !==
            requestIdRef.current
        ) {
          return;
        }

        /* ==============================================
           DONNÉES CONFIRMÉES PAR L'API
        ============================================== */

        setAccount(result.data);

        setUpdatedAt(
          result.generatedAt ??
            new Date().toISOString()
        );

        setError(null);

        /* ==============================================
           PAGINATION

           Si le dernier billet de
           la page disparaît après
           un scan, revenir à une
           page existante.
        ============================================== */

        if (
          targetPage > 1 &&
          targetPage >
            Math.max(
              1,
              result.data.pagination
                .totalPages
            )
        ) {
          setPage(
            Math.max(
              1,
              result.data.pagination
                .totalPages
            )
          );
        }
      } catch (reason) {
        if (
          controller.signal.aborted ||
          !mountedRef.current ||
          requestId !==
            requestIdRef.current
        ) {
          return;
        }

        setError(
          reason instanceof Error
            ? reason.message
            : "ACCOUNT_LOAD_FAILED"
        );
      } finally {
        if (
          mountedRef.current &&
          requestId ===
            requestIdRef.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [router]
  );

  /* ========================================================
     PREMIER CHARGEMENT ET PAGINATION
  ======================================================== */

  useEffect(() => {
    mountedRef.current = true;

    const initialLoad = window.setTimeout(() => void loadAccount(page), 0);

    return () => {
      window.clearTimeout(initialLoad);
      controllerRef.current?.abort();
    };
  }, [page, loadAccount]);

  /* ========================================================
     ACTUALISATION AUTOMATIQUE

     Toutes les 10 secondes lorsque
     l'onglet est visible.

     Actualisation supplémentaire :
     - Au retour sur l'onglet
     - Au retour dans la fenêtre

     Un billet utilisé disparaît dès
     que l'API ne le renvoie plus.
  ======================================================== */

  useEffect(() => {
    function refreshIfVisible() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void loadAccount(page, true);
      }
    }

    const interval =
      window.setInterval(() => {
        refreshIfVisible();
      }, REFRESH_INTERVAL_MS);

    document.addEventListener(
      "visibilitychange",
      refreshIfVisible
    );

    window.addEventListener(
      "focus",
      refreshIfVisible
    );

    return () => {
      window.clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        refreshIfVisible
      );

      window.removeEventListener(
        "focus",
        refreshIfVisible
      );
    };
  }, [page, loadAccount]);

  /* ========================================================
     NETTOYAGE FINAL
  ======================================================== */

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      controllerRef.current?.abort();
    };
  }, []);

  /* ========================================================
     DONNÉES DISPONIBLES
  ======================================================== */

  const profile =
    account?.profile ?? null;

  const statistics =
    account?.statistics ?? null;

  const tickets =
    account?.tickets ?? [];

  const pagination =
    account?.pagination ?? null;

  const profileName =
    profile?.name?.trim() ||
    t.noName;

  const spent =
    statistics?.spentByCurrency ?? [];

  const primarySpent =
    spent.length === 1
      ? formatMoney(
          spent[0].amountMinor,
          spent[0].currency,
          locale
        )
      : spent.length === 0
        ? t.noPurchases
        : t.multipleCurrencies;

  /* ========================================================
     ROUTES DES ACTIONS

     Les billets et transferts utilisent
     les chemins déjà définis dans
     la navigation publique.

     L'identifiant du billet permet
     aux pages correspondantes de
     sélectionner le bon billet.
  ======================================================== */

  function openProfileEditor() {
    setProfileNameInput(profile?.name ?? ""); setProfilePhoneInput(profile?.phoneE164 ?? ""); setProfileSaveError(null); setEditingProfile(true);
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (profileSaving) return; setProfileSaving(true); setProfileSaveError(null);
    try { const response = await fetch(API_URL, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ name: profileNameInput, phoneE164: profilePhoneInput }) }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message || t.error); setEditingProfile(false); await loadAccount(page, true); }
    catch (error) { setProfileSaveError(error instanceof Error ? error.message : t.error); }
    finally { setProfileSaving(false); }
  }

  function ticketUrl(
    ticketId: string
  ): string {
    return (
      `${TICKETS_URL}?ticket=` +
      encodeURIComponent(ticketId)
    );
  }

  function transferUrl(
    ticketId: string
  ): string {
    return (
      `${TRANSFER_URL}?ticket=` +
      encodeURIComponent(ticketId)
    );
  }

  /* ========================================================
     CARTE D'UN BILLET

     Deux rendus :
     - PC
     - Mobile

     Les deux utilisent les mêmes
     données réelles.
  ======================================================== */

  function renderTicket(
    ticket: AccountTicket,
    mobile: boolean
  ) {
    const eventDate =
      formatEventDate(
        ticket.schedule?.startsAt ??
          null,
        ticket.event.timeZone,
        locale
      );

    const venue =
      ticket.event.venue;

    const location = venue
      ? [
          venue.name,
          venue.city,
        ]
          .filter(Boolean)
          .join(", ")
      : null;

    /* ==============================================
       MOBILE

       Carte compacte horizontale :
       - Petite image
       - Titre
       - Date / heure
       - Statut
       - Flèche
    ============================================== */

    if (mobile) {
      return (
        <Link
          key={ticket.id}
          href={ticketUrl(ticket.id)}
          className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-[#e5eae7] bg-white p-2.5 shadow-[0_3px_12px_rgba(18,45,30,0.06)] transition-shadow hover:shadow-md"
        >
          <TicketImage
            src={
              ticket.event.imageUrl
            }
            title={
              ticket.event.title
            }
          />

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[12px] font-black text-[#101b2a]">
              {ticket.event.title}
            </h3>

            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[#465467]">
              <CalendarDays
                size={12}
                className="shrink-0"
              />

              <span className="truncate">
                {eventDate ??
                  t.datePending}
              </span>
            </p>

            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#ddf8d4] px-2 py-1 text-[10px] font-extrabold text-[#08742a]">
              <CheckCircle2 size={11} />
              {t.valid}
            </span>
          </div>

          <ChevronRight
            size={19}
            className="shrink-0 text-[#34465a] transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      );
    }

    /* ==============================================
       PC

       Carte horizontale :
       - Image
       - Titre
       - Date / heure
       - Lieu
       - Statut
       - Voir le billet
       - Transférer
    ============================================== */

    return (
      <article
        key={ticket.id}
        className="flex min-w-0 flex-wrap items-center gap-4 rounded-2xl border border-[#e4eae6] bg-white p-3 shadow-[0_3px_12px_rgba(12,40,24,0.05)] xl:flex-nowrap"
      >
        <TicketImage
          src={
            ticket.event.imageUrl
          }
          title={
            ticket.event.title
          }
        />

        <div className="min-w-47.5 flex-1">
          <h3 className="line-clamp-2 text-[16px] font-black text-[#101b2c]">
            {ticket.event.title}
          </h3>

          <p className="mt-1.5 flex items-center gap-2 text-[12px] font-medium text-[#334155]">
            <CalendarDays
              size={15}
              className="shrink-0"
            />

            {eventDate ??
              t.datePending}
          </p>

          <p className="mt-1 flex items-center gap-2 text-[12px] text-[#48576a]">
            <MapPin
              size={15}
              className="shrink-0"
            />

            <span className="line-clamp-1">
              {location ??
                t.locationPending}
            </span>
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#dff9d6] px-3 py-1.5 text-[12px] font-extrabold text-[#08742a]">
          <CheckCircle2 size={16} />

          {t.valid}
        </span>

        <div className="flex w-full shrink-0 flex-row gap-2 xl:w-40 xl:flex-col">
          <Link
            href={ticketUrl(ticket.id)}
            className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full bg-linear-to-b from-[#159b00] to-[#006e2b] px-3 text-[12px] font-extrabold text-white transition-opacity hover:opacity-90"
          >
            <QrCode size={18} />
            {t.viewTicket}
          </Link>

          <Link
            href={transferUrl(ticket.id)}
            className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[#087d2d] bg-white px-3 text-[12px] font-extrabold text-[#087d2d] transition-colors hover:bg-[#f0faf2]"
          >
            <ArrowLeftRight size={17} />
            {t.transfer}
          </Link>
        </div>
      </article>
    );
  }

  /* ========================================================
     RENDU
  ======================================================== */

  return (
    <>
      {/* ==================================================
          FOOTER MOBILE MASQUÉ

          Le header et le menu mobile
          sont déjà fournis par :

          src/app/(public)/layout.tsx

          Aucun nouveau menu créé.

          Le footer PC reste visible.
      ================================================== */}

      

      <PublicAccountShell locale={locale}><div
        id="tikemia-account-page"
        className="flex w-full min-w-0 flex-1 flex-col bg-[#f8faf9] text-[#132338]"
      >
        {/* ==================================================
            CHARGEMENT INITIAL
        ================================================== */}

        {loading && !account ? (
          <div className="flex min-h-105 w-full flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
            <LoaderCircle
              size={34}
              className="animate-spin text-[#08872f]"
            />

            <p className="text-sm font-semibold text-[#526477]">
              {t.loading}
            </p>
          </div>
        ) : !account ? (

          /* ==============================================
             ERREUR INITIALE
          ============================================== */

          <div className="flex min-h-105 w-full flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
            <CircleAlert
              size={34}
              className="text-[#d34848]"
            />

            <h1 className="text-lg font-extrabold">
              {t.error}
            </h1>

            <button
              type="button"
              onClick={() => {
                void loadAccount(page);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-[#087d2d] px-6 py-3 text-sm font-bold text-white"
            >
              <RefreshCw size={17} />
              {t.retry}
            </button>
          </div>
        ) : (
          <>
            {/* ==========================================
                BANDEAU MOBILE

                Fidèle à l'architecture :
                - Fond vert foncé
                - Photo à gauche
                - Mon compte
                - Description courte

                Aucun menu latéral.
            ========================================== */}

            <section className="bg-linear-to-r from-[#003b2d] to-[#00663b] px-4 py-5 text-white md:hidden">
              <div className="flex min-w-0 items-center gap-3">
                <AccountAvatar
                  name={profileName}
                  email={
                    profile?.email ?? ""
                  }
                  src={
                    profile?.avatarUrl ??
                    null
                  }
                  size="medium"
                />

                <div className="min-w-0 flex-1">
                  <h1 className="text-[23px] font-black leading-tight">
                    {t.title}
                  </h1>

                  <p className="mt-1 text-[12px] leading-snug text-white/90">
                    {t.subtitle}
                  </p>
                </div>
              </div>
            </section>

            {/* ==========================================
                CONTENU PRINCIPAL

                Pleine largeur disponible.
                Aucun menu gauche.

                Marges compactes.
            ========================================== */}

            <div className="w-full min-w-0 px-3 py-4 sm:px-5 md:px-6 md:py-5 xl:px-9">

              {/* ========================================
                  ENTÊTE PC
              ======================================== */}

              <div className="mb-5 hidden items-center justify-between gap-4 md:flex">
                <div className="flex items-center gap-4">
                  <UserRound
                    size={48}
                    strokeWidth={1.7}
                    className="text-[#101b2c]"
                  />

                  <div>
                    <h1 className="text-[31px] font-black tracking-tight text-[#0d182a]">
                      {t.title}
                    </h1>

                    <p className="text-[14px] text-[#566578]">
                      {t.subtitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void loadAccount(
                      page,
                      true
                    )
                  }
                  disabled={refreshing}
                  aria-label={t.refresh}
                  className="inline-flex items-center gap-2 rounded-full border border-[#d6e6da] bg-white px-4 py-2 text-xs font-bold text-[#087d2d] disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={
                      refreshing
                        ? "animate-spin"
                        : ""
                    }
                  />

                  {t.refresh}
                </button>
              </div>

              {/* ========================================
                  CARTE DU PROFIL

                  PC :
                  Avatar, nom, email,
                  téléphone, modifier.

                  MOBILE :
                  Coordonnées et bouton.
              ======================================== */}

              <section className="rounded-[22px] border border-[#e5eae6] bg-white p-4 shadow-[0_4px_17px_rgba(17,44,28,0.06)] sm:p-5">

                {/* AVATAR PC */}

                <div className="hidden items-center gap-6 md:flex">
                  <div className="relative shrink-0">
                    <AccountAvatar
                      name={profileName}
                      email={
                        profile?.email ?? ""
                      }
                      src={
                        profile?.avatarUrl ??
                        null
                      }
                    />

                    <button type="button"
                      onClick={openProfileEditor}
                      aria-label={t.editProfile}
                      className="absolute right-0 bottom-0 flex size-9 items-center justify-center rounded-full border-2 border-white bg-[#079128] text-white shadow-sm"
                    >
                      <Pencil size={17} />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="mb-3 truncate text-[24px] font-black text-[#101a2c]">
                      {profileName}
                    </h2>

                    <p className="flex items-center gap-3 text-[14px] text-[#25364a]">
                      <Mail
                        size={20}
                        className="shrink-0"
                      />

                      <span className="min-w-0 truncate">
                        {profile?.email}
                      </span>
                    </p>

                    <p className="mt-3 flex items-center gap-3 text-[14px] text-[#25364a]">
                      <Phone
                        size={20}
                        className="shrink-0"
                      />

                      <span className="truncate">
                        {profile?.phoneE164 ??
                          t.noPhone}
                      </span>
                    </p>
                  </div>

                  <div className="ml-2 flex shrink-0 items-center border-l border-[#e1e7e2] pl-7">
                    <button type="button"
                      onClick={openProfileEditor}
                      className="inline-flex min-h-11.75 items-center justify-center gap-2 rounded-full border border-[#087d2d] px-6 text-[14px] font-extrabold text-[#087d2d] transition-colors hover:bg-[#eff9f1]"
                    >
                      <Pencil size={19} />

                      {t.editProfile}
                    </button>
                  </div>
                </div>

                {/* CARTE MOBILE */}

                <div className="md:hidden">
                  <div className="space-y-3">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <Mail
                          size={20}
                          className="shrink-0 text-[#172437]"
                        />

                        <span className="truncate text-[13px] font-semibold text-[#25354a]">
                          {profile?.email}
                        </span>
                      </div>

                      <ChevronRight
                        size={18}
                        className="shrink-0 text-[#475569]"
                      />
                    </div>

                    <div className="h-px bg-[#edf1ee]" />

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <Phone
                          size={20}
                          className="shrink-0 text-[#172437]"
                        />

                        <span className="truncate text-[13px] font-semibold text-[#25354a]">
                          {profile?.phoneE164 ??
                            t.noPhone}
                        </span>
                      </div>

                      <ChevronRight
                        size={18}
                        className="shrink-0 text-[#475569]"
                      />
                    </div>
                  </div>

                  <button type="button"
                    onClick={openProfileEditor}
                    className="mt-4 flex min-h-10.5 w-full items-center justify-center gap-2 rounded-full border border-[#087d2d] bg-white px-3 text-[13px] font-extrabold text-[#087d2d]"
                  >
                    <Pencil size={17} />

                    {t.editProfile}
                  </button>
                </div>
              </section>

              {/* ========================================
                  TROIS STATISTIQUES

                  PC :
                  3 colonnes larges.

                  MOBILE :
                  3 colonnes compactes.

                  Valeurs réelles de l'API.
              ======================================== */}

              <section
                aria-label={t.title}
                className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 md:mt-5 md:gap-4"
              >
                {/* BILLETS */}

                <div className="flex min-w-0 flex-col items-center justify-center rounded-2xl border border-[#e8edea] bg-white px-1.5 py-3 text-center shadow-[0_3px_10px_rgba(12,40,24,0.05)] sm:flex-row sm:gap-3 sm:p-4">
                  <div className="mb-2 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e3f9de] text-[#0b8a2e] sm:mb-0 sm:size-14">
                    <Ticket
                      size={23}
                      className="sm:size-7"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[#30394a] sm:text-[12px] lg:text-[14px]">
                      {t.validTickets}
                    </p>

                    <p className="mt-1 text-[23px] font-black text-[#10192d] sm:text-[28px]">
                      {statistics?.validTickets ??
                        0}
                    </p>
                  </div>
                </div>

                {/* ACHATS */}

                <div className="flex min-w-0 flex-col items-center justify-center rounded-2xl border border-[#e8edea] bg-white px-1.5 py-3 text-center shadow-[0_3px_10px_rgba(12,40,24,0.05)] sm:flex-row sm:gap-3 sm:p-4">
                  <div className="mb-2 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f0f2f4] text-[#7b8190] sm:mb-0 sm:size-14">
                    <ShoppingCart size={23} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[#30394a] sm:text-[12px] lg:text-[14px]">
                      {t.totalPurchases}
                    </p>

                    <p className="mt-1 text-[23px] font-black text-[#10192d] sm:text-[28px]">
                      {statistics?.totalPurchases ??
                        0}
                    </p>
                  </div>
                </div>

                {/* DÉPENSES */}

                <div className="flex min-w-0 flex-col items-center justify-center rounded-2xl border border-[#e8edea] bg-white px-1.5 py-3 text-center shadow-[0_3px_10px_rgba(12,40,24,0.05)] sm:flex-row sm:gap-3 sm:p-4">
                  <div className="mb-2 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e3f9de] text-[#0b8a2e] sm:mb-0 sm:size-14">
                    <Wallet size={23} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[#30394a] sm:text-[12px] lg:text-[14px]">
                      {t.totalSpent}
                    </p>

                    <p className="mt-1 wrap-break-word text-[13px] font-black text-[#10192d] sm:text-[18px] lg:text-[22px]">
                      {primarySpent}
                    </p>
                  </div>
                </div>
              </section>

              {/* ========================================
                  PLUSIEURS DEVISES

                  Ne jamais afficher un
                  faux montant global.

                  Si plusieurs devises
                  existent, afficher
                  chaque total séparément.
              ======================================== */}

              {spent.length > 1 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {spent.map((item) => (
                    <span
                      key={item.currency}
                      className="rounded-full border border-[#dce9df] bg-white px-3 py-1.5 text-[12px] font-extrabold text-[#075b2a]"
                    >
                      {formatMoney(
                        item.amountMinor,
                        item.currency,
                        locale
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* ========================================
                  SECTION BILLETS VALIDES
              ======================================== */}

              <section className="mt-5 rounded-[22px] border border-[#e7ece8] bg-white p-3 shadow-[0_4px_16px_rgba(12,40,24,0.04)] sm:p-4 md:mt-6 md:p-5">

                {/* TITRE */}

                <div className="mb-4 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Ticket
                      size={26}
                      className="shrink-0 -rotate-12 text-[#0b8b2d]"
                    />

                    <h2 className="text-[15px] font-black tracking-tight text-[#101a2c] sm:text-[21px]">
                      {t.myTickets}{" "}

                      <span>
                        ({statistics?.validTickets ?? 0})
                      </span>
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void loadAccount(
                        page,
                        true
                      )
                    }
                    disabled={refreshing}
                    aria-label={t.refresh}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#087d2d] hover:bg-[#eff8f1] disabled:opacity-50"
                  >
                    <RefreshCw
                      size={17}
                      className={
                        refreshing
                          ? "animate-spin"
                          : ""
                      }
                    />
                  </button>
                </div>

                {/* ERREUR D'ACTUALISATION */}

                {error && account && (
                  <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-xl bg-[#fff1f1] p-3 text-xs text-[#aa3030]"
                  >
                    <CircleAlert
                      size={17}
                      className="shrink-0"
                    />

                    <span>{t.error}</span>
                  </div>
                )}

                {/* ====================================
                    AUCUN BILLET

                    Aucun billet fictif.
                ==================================== */}

                {tickets.length === 0 ? (
                  <div className="flex min-h-52.5 flex-col items-center justify-center px-4 py-8 text-center">
                    <Ticket
                      size={37}
                      className="text-[#91b69c]"
                    />

                    <h3 className="mt-3 text-[17px] font-black text-[#172638]">
                      {t.noTickets}
                    </h3>

                    <p className="mt-2 max-w-87.5 text-[13px] leading-relaxed text-[#728092]">
                      {t.noTicketsDescription}
                    </p>

                    <Link
                      href="/explore"
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#087d2d] px-5 py-2.5 text-[13px] font-extrabold text-white"
                    >
                      {t.exploreEvents}
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* ==================================
                        CARTES MOBILE

                        Même présentation compacte
                        que l'architecture.
                    ================================== */}

                    <div className="space-y-2.5 md:hidden">
                      {tickets.map((ticket) =>
                        renderTicket(
                          ticket,
                          true
                        )
                      )}
                    </div>

                    {/* ==================================
                        CARTES PC

                        Lignes horizontales
                        sur toute la largeur.
                    ================================== */}

                    <div className="hidden space-y-3 md:block">
                      {tickets.map((ticket) =>
                        renderTicket(
                          ticket,
                          false
                        )
                      )}
                    </div>
                  </>
                )}

                {/* ====================================
                    PAGINATION

                    Utile lorsqu'un client
                    possède beaucoup
                    de billets valables.
                ==================================== */}

                {pagination &&
                  pagination.totalPages > 1 && (
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#edf1ed] pt-4">
                      <button
                        type="button"
                        disabled={
                          !pagination.hasPreviousPage ||
                          loading
                        }
                        onClick={() =>
                          setPage(
                            (previous) =>
                              Math.max(
                                1,
                                previous - 1
                              )
                          )
                        }
                        className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[#dce7df] px-3 text-xs font-bold text-[#087d2d] disabled:opacity-35"
                      >
                        <ChevronLeft
                          size={16}
                        />
                        {t.previous}
                      </button>

                      <span className="text-[12px] font-semibold text-[#526174]">
                        {t.page}{" "}
                        {pagination.page}{" "}
                        {t.of}{" "}
                        {pagination.totalPages}
                      </span>

                      <button
                        type="button"
                        disabled={
                          !pagination.hasNextPage ||
                          loading
                        }
                        onClick={() =>
                          setPage(
                            (previous) =>
                              previous + 1
                          )
                        }
                        className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[#dce7df] px-3 text-xs font-bold text-[#087d2d] disabled:opacity-35"
                      >
                        {t.next}
                        <ChevronRight
                          size={16}
                        />
                      </button>
                    </div>
                  )}
              </section>

              {/* ========================================
                  BOUTON TRANSFERT MOBILE

                  Comme sur l'architecture.

                  Le menu transfert existant
                  est réutilisé.
              ======================================== */}

              <Link
                href={TRANSFER_URL}
                className="mt-5 flex min-h-13.5 w-full items-center justify-center gap-3 rounded-full bg-linear-to-b from-[#18a500] to-[#006e29] px-5 text-[15px] font-extrabold text-white shadow-[0_5px_12px_rgba(5,102,37,0.13)] md:hidden"
              >
                <ArrowLeftRight size={24} />
                {t.transferTicket}
              </Link>

              {/* ========================================
                  MARGE MOBILE

                  Laisse la place à la
                  navigation fixe existante.
              ======================================== */}

              <div className="h-4 md:hidden" />
            </div>
          </>
        )}
      </div>{editingProfile && <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4" onClick={() => !profileSaving && setEditingProfile(false)}><section role="dialog" aria-modal="true" aria-labelledby="account-profile-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={event => event.stopPropagation()}><h2 id="account-profile-title" className="text-lg font-extrabold">{t.editProfile}</h2><form onSubmit={saveProfile} className="mt-4 space-y-4"><label className="block text-sm font-bold">{locale === "fr" ? "Nom" : "Name"}<input autoFocus required maxLength={120} autoComplete="name" value={profileNameInput} onChange={event => setProfileNameInput(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label><label className="block text-sm font-bold">{locale === "fr" ? "T\u00e9l\u00e9phone" : "Phone"}<input type="tel" autoComplete="tel" value={profilePhoneInput} onChange={event => setProfilePhoneInput(event.target.value)} placeholder="+229..." className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>{profileSaveError && <p role="alert" className="text-sm text-red-700">{profileSaveError}</p>}<div className="flex flex-wrap gap-2"><button type="submit" disabled={profileSaving} className="min-h-11 flex-1 rounded-xl bg-[#087d30] px-4 font-bold text-white disabled:opacity-50">{locale === "fr" ? "Enregistrer" : "Save"}</button><button type="button" disabled={profileSaving} onClick={() => setEditingProfile(false)} className="min-h-11 rounded-xl border px-4 font-bold">{locale === "fr" ? "Annuler" : "Cancel"}</button></div></form></section></div>}</PublicAccountShell>
    </>
  );
}

/* ==========================================================
   FIN — ESPACE COMPTE PUBLIC

   Aucun menu latéral.
   Aucun header dupliqué.
   Aucun modèle Prisma supplémentaire.
   Aucune statistique fictive.
   Aucun billet scanné affiché.

   Les données sont fournies par :
   GET /api/public/account
========================================================== */
