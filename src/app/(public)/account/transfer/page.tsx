
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import Image from "next/image";
import { PublicAccountShell } from "@/components/public/PublicNavigation";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Ticket,
} from "lucide-react";

const TRANSFER_API = "/api/public/account/transfer";
const VERIFY_API = "/api/public/account/transfer/verify";
const TICKETS_URL = "/account/tickets";
const LOGIN_URL = "/login";

const PAGE_SIZE = 50;
const MAX_SELECTION = 20;
const OTP_LENGTH = 6;

type Locale = "fr" | "en";
type Step = "select" | "verify" | "success";

type TicketItem = {
  id: string;
  number: string;
  status: string;
  category: {
    id: string;
    name: string;
  };
  event: {
    id: string;
    slug: string;
    title: string;
    imageUrl: string | null;
    timeZone: string;
    venue: {
      name: string;
      city: string;
      country: string;
    } | null;
  };
  schedule: {
    startsAt: string;
    endsAt: string | null;
  } | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type TicketListResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  data?: {
    tickets?: TicketItem[];
    pagination?: Pagination;
  };
};

type TransferRequestResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  transferIds?: string[];
  expiresAt?: string;
};

type VerifyResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  transferredCount?: number;
  recipientEmail?: string;
  deliveryStatus?: string;
};

const TEXT = {
  fr: {
    title: "Transférer un billet",
    subtitle: "Envoyez vos billets par email.",
    ticketTitle: "Billets à transférer",
    available: "Billets disponibles",
    selected: "Sélectionnés",
    email: "Adresse email du destinataire",
    emailPlaceholder: "destinataire@exemple.com",
    choose: "Choisir un billet",
    allCategories: "Toutes les catégories",
    category: "Catégorie",
    ticketNumber: "N° billet",
    noTickets: "Aucun billet transférable",
    noTicketsDescription: "Aucun billet disponible.",
    noSelection: "Sélectionnez au moins un billet.",
    maxSelection: "20 billets maximum par transfert.",
    noEmail: "Saisissez l'adresse email du destinataire.",
    invalidEmail: "Adresse email invalide.",
    invalidRecipient: "Destinataire invalide.",
    selectAndSend: "Transférer les billets",
    transferOne: "Transférer le billet",
    cancel: "Annuler",
    back: "Retour",
    loadMore: "Afficher plus de billets",
    loading: "Chargement...",
    sending: "Envoi du code...",
    confirming: "Confirmation...",
    codeTitle: "Vérifiez votre email",
    codeSubtitle: "Saisissez le code à 6 chiffres.",
    code: "Code de vérification",
    confirm: "Confirmer le transfert",
    codeMissing: "Saisissez les 6 chiffres.",
    expired: "Code expiré. Recommencez.",
    tooManyAttempts: "Demandez un nouveau code.",
    invalidCode: "Code incorrect ou expiré.",
    expiresIn: "Expire dans",
    restart: "Recommencer",
    successTitle: "Transfert réussi !",
    successMessage: "Billets transférés",
    emailPending: "Envoi des nouveaux billets en préparation.",
    recipient: "Destinataire",
    count: "Billets",
    myTickets: "Mes billets",
    error: "Une erreur est survenue.",
    unavailable: "Service indisponible.",
    unauthorized: "Connexion requise.",
    retry: "Réessayer",
    date: "Date non renseignée",
    location: "Lieu non renseigné",
    noImage: "Image indisponible",
    search: "Rechercher un événement...",
    emptyFilter: "Aucun billet trouvé.",
    totalAvailable: "billets disponibles",
    requestPending: "Transfert déjà en attente.",
    rateLimited: "Réessayez plus tard.",
    openAccount: "Se connecter",
  },
  en: {
    title: "Transfer a ticket",
    subtitle: "Send your tickets by email.",
    ticketTitle: "Tickets to transfer",
    available: "Available tickets",
    selected: "Selected",
    email: "Recipient email address",
    emailPlaceholder: "recipient@example.com",
    choose: "Choose a ticket",
    allCategories: "All categories",
    category: "Category",
    ticketNumber: "Ticket number",
    noTickets: "No transferable tickets",
    noTicketsDescription: "No available tickets.",
    noSelection: "Select at least one ticket.",
    maxSelection: "Maximum 20 tickets per transfer.",
    noEmail: "Enter the recipient email.",
    invalidEmail: "Invalid email address.",
    invalidRecipient: "Invalid recipient.",
    selectAndSend: "Transfer tickets",
    transferOne: "Transfer ticket",
    cancel: "Cancel",
    back: "Back",
    loadMore: "Show more tickets",
    loading: "Loading...",
    sending: "Sending code...",
    confirming: "Confirming...",
    codeTitle: "Check your email",
    codeSubtitle: "Enter the 6-digit code.",
    code: "Verification code",
    confirm: "Confirm transfer",
    codeMissing: "Enter all 6 digits.",
    expired: "Code expired. Start again.",
    tooManyAttempts: "Request a new code.",
    invalidCode: "Invalid or expired code.",
    expiresIn: "Expires in",
    restart: "Start again",
    successTitle: "Transfer successful!",
    successMessage: "Tickets transferred",
    emailPending: "New ticket delivery pending.",
    recipient: "Recipient",
    count: "Tickets",
    myTickets: "My tickets",
    error: "An error occurred.",
    unavailable: "Service unavailable.",
    unauthorized: "Sign in required.",
    retry: "Try again",
    date: "Date unavailable",
    location: "Location unavailable",
    noImage: "Image unavailable",
    search: "Search events...",
    emptyFilter: "No tickets found.",
    totalAvailable: "available tickets",
    requestPending: "Transfer already pending.",
    rateLimited: "Try again later.",
    openAccount: "Sign in",
  },
} as const;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function validEmail(value: string) {
  const email = normalizeEmail(value);

  return (
    email.length >= 3 &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function dateText(
  value: string | null | undefined,
  zone: string,
  locale: Locale
) {
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
        timeZone: zone || "UTC",
      }
    ).format(date);
  } catch {
    return new Intl.DateTimeFormat(
      "fr-FR",
      {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }
    ).format(date);
  }
}

function countdownText(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    rest
  ).padStart(2, "0")}`;
}

function TicketPicture({
  src,
  title,
}: {
  src: string | null;
  title: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);



  return (
    <div className="relative h-22.5 w-25 shrink-0 overflow-hidden rounded-xl bg-[#e8f4eb] sm:h-28 sm:w-36.25">
      {src && failed !== src ? (
        <Image
          src={src}
          alt={title}
          fill
          unoptimized
          sizes="(max-width: 640px) 100px, 145px"
          className="object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#0b8634]">
          <Ticket size={32} />
        </div>
      )}
    </div>
  );
}

export default function TransferTicketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTicketId =
    searchParams.get("ticket") ?? "";

  const [locale, setLocale] = useState<Locale>("fr");
  const [step, setStep] = useState<Step>("select");

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [pagination, setPagination] =
    useState<Pagination | null>(null);

  const [listPage, setListPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialTicketId ? [initialTicketId] : []);

  const [recipientEmail, setRecipientEmail] =
    useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [transferIds, setTransferIds] =
    useState<string[]>([]);

  const [expiresAt, setExpiresAt] =
    useState<string | null>(null);

  const [remainingSeconds, setRemainingSeconds] =
    useState(0);

  const [otp, setOtp] = useState<string[]>(
    Array(OTP_LENGTH).fill("")
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<VerifyResponse | null>(null);

  const otpRefs =
    useRef<Array<HTMLInputElement | null>>([]);

  const requestLocked = useRef(false);
  const latestRequest = useRef<AbortController | null>(
    null
  );

  const t = TEXT[locale];

  /* ======================================================
     LANGUE TIKEMIA
  ====================================================== */

  useEffect(() => {
    const synchronize = () => {
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
    };

    synchronize();

    window.addEventListener("storage", synchronize);
    window.addEventListener(
      "tikemia:locale-changed",
      synchronize
    );

    return () => {
      window.removeEventListener(
        "storage",
        synchronize
      );
      window.removeEventListener(
        "tikemia:locale-changed",
        synchronize
      );
    };
  }, []);

  /* ======================================================
     LISTE DES BILLETS TRANSFÉRABLES
  ====================================================== */

  const loadTickets = useCallback(
    async (page: number, append: boolean) => {
      const controller = new AbortController();
      latestRequest.current?.abort();
      latestRequest.current = controller;

      if (append) {
        setMoreLoading(true);
      } else {
        setListLoading(true);
      }

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });

        const response = await fetch(
          `${TRANSFER_API}?${params}`,
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

        if (response.status === 401 || response.status === 403) {
          setUnauthorized(true);
          setTickets([]);
          return;
        }

        const result =
          (await response.json()) as TicketListResponse;

        if (
          !response.ok ||
          result.success !== true ||
          !result.data ||
          !Array.isArray(result.data.tickets)
        ) {
          throw new Error(result.message || "LOAD_FAILED");
        }

        if (controller.signal.aborted) return;

        const validTickets = result.data.tickets.filter(
          (item) =>
            item.status === "VALID" &&
            Boolean(item.id) &&
            Boolean(item.event?.id)
        );

        setTickets((previous) => {
          if (!append) return validTickets;

          const all = new Map(
            previous.map((ticket) => [ticket.id, ticket])
          );

          for (const item of validTickets) {
            all.set(item.id, item);
          }

          return Array.from(all.values());
        });

        setPagination(result.data.pagination ?? null);
        setListPage(page);
        setUnauthorized(false);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;

        setError(
          cause instanceof Error && cause.message !== "LOAD_FAILED"
            ? cause.message
            : TEXT.fr.error
        );
      } finally {
        if (!controller.signal.aborted) {
          setListLoading(false);
          setMoreLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadTickets(1, false), 0);

    return () => {
      window.clearTimeout(initialLoad);
      latestRequest.current?.abort();
    };
  }, [loadTickets]);

  /* ======================================================
     PRÉSÉLECTION DEPUIS MES BILLETS
  ====================================================== */



  /* ======================================================
     COMPTE À REBOURS OTP
  ====================================================== */

  useEffect(() => {
    if (!expiresAt || step !== "verify") {
      return;
    }

    const update = () => {
      const value = Math.max(
        0,
        Math.ceil(
          (new Date(expiresAt).getTime() - Date.now()) /
            1000
        )
      );

      setRemainingSeconds(value);
    };

    const initialTick = window.setTimeout(update, 0);

    const interval = window.setInterval(update, 1000);

    return () => { window.clearTimeout(initialTick); window.clearInterval(interval); };
  }, [expiresAt, step]);

  /* ======================================================
     CATÉGORIES EXISTANTES
  ====================================================== */

  const categories = useMemo(() => {
    const values = new Map<string, string>();

    for (const ticket of tickets) {
      if (ticket.category?.id) {
        values.set(
          ticket.category.id,
          ticket.category.name
        );
      }
    }

    return Array.from(values.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [tickets]);

  const displayedTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        ticket.event.title.toLowerCase().includes(query) ||
        ticket.number.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "all" ||
        ticket.category.id === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [tickets, search, categoryFilter]);

  const selectedTickets = useMemo(() => {
    const selected = new Set(selectedIds);
    return tickets.filter((ticket) =>
      selected.has(ticket.id)
    );
  }, [tickets, selectedIds]);

  /* ======================================================
     SÉLECTION
  ====================================================== */

  function toggleTicket(ticketId: string) {
    if (busy || step !== "select") return;

    setError(null);

    setSelectedIds((previous) => {
      if (previous.includes(ticketId)) {
        return previous.filter((id) => id !== ticketId);
      }

      if (previous.length >= MAX_SELECTION) {
        setError(t.maxSelection);
        return previous;
      }

      return [...previous, ticketId];
    });
  }

  /* ======================================================
     DEMANDER LE CODE OTP

     Aucun transfert effectif ici.
  ====================================================== */

  async function requestTransfer(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy || requestLocked.current) return;

    if (selectedIds.length === 0) {
      setError(t.noSelection);
      return;
    }

    const email = normalizeEmail(recipientEmail);

    if (!email) {
      setError(t.noEmail);
      return;
    }

    if (!validEmail(email)) {
      setError(t.invalidEmail);
      return;
    }

    requestLocked.current = true;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(TRANSFER_API, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketIds: [...selectedIds].sort(),
          recipientEmail: email,
          locale,
        }),
      });

      const result =
        (await response.json()) as TransferRequestResponse;

      if (
        !response.ok ||
        result.success !== true ||
        !Array.isArray(result.transferIds) ||
        result.transferIds.length !== selectedIds.length ||
        !result.expiresAt
      ) {
        const code = result.code;

        setError(
          code === "selfTransfer"
            ? t.invalidRecipient
            : code === "pending"
              ? t.requestPending
              : code === "cooldown" || code === "limit"
                ? t.rateLimited
                : code === "noTickets"
                  ? t.noTickets
                  : result.message || t.unavailable
        );

        return;
      }

      setRecipientEmail(email);
      setTransferIds([...result.transferIds].sort());
      setExpiresAt(result.expiresAt);
      setOtp(Array(OTP_LENGTH).fill(""));
      setStep("verify");
      setError(null);
    } catch {
      setError(t.unavailable);
    } finally {
      requestLocked.current = false;
      setBusy(false);
    }
  }

  /* ======================================================
     SAISIE OTP
  ====================================================== */

  function fillOtp(start: number, raw: string) {
    const content = digitsOnly(raw).slice(0, OTP_LENGTH);

    if (!content) return;

    const offset =
      content.length === OTP_LENGTH ? 0 : start;

    setOtp((previous) => {
      const next = [...previous];

      for (let i = 0; i < content.length; i++) {
        if (offset + i >= OTP_LENGTH) break;
        next[offset + i] = content[i];
      }

      return next;
    });

    setError(null);

    const nextIndex = Math.min(
      offset + content.length,
      OTP_LENGTH - 1
    );

    requestAnimationFrame(() => {
      otpRefs.current[nextIndex]?.focus();
    });
  }

  function handleOtpChange(
    index: number,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const value = event.target.value;

    if (!value) {
      setOtp((previous) => {
        const next = [...previous];
        next[index] = "";
        return next;
      });
      return;
    }

    fillOtp(index, value);
  }

  function handleOtpKey(
    index: number,
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Backspace") {
      event.preventDefault();

      if (otp[index]) {
        setOtp((previous) => {
          const next = [...previous];
          next[index] = "";
          return next;
        });
      } else if (index > 0) {
        setOtp((previous) => {
          const next = [...previous];
          next[index - 1] = "";
          return next;
        });

        otpRefs.current[index - 1]?.focus();
      }

      setError(null);
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      otpRefs.current[index - 1]?.focus();
    }

    if (
      event.key === "ArrowRight" &&
      index < OTP_LENGTH - 1
    ) {
      event.preventDefault();
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(
    event: ClipboardEvent<HTMLInputElement>
  ) {
    event.preventDefault();
    fillOtp(0, event.clipboardData.getData("text"));
  }

  /* ======================================================
     CONFIRMER LE TRANSFERT

     Le serveur :
     - Vérifie le code
     - Verrouille les billets
     - Remplace les empreintes QR
     - Réattribue les billets
     - Enregistre la livraison PDF

     Le succès n'est affiché que
     si l'API confirme la transaction.
  ====================================================== */

  async function verifyTransfer(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy || requestLocked.current) return;

    const code = otp.join("");

    if (!/^\d{6}$/.test(code)) {
      setError(t.codeMissing);
      return;
    }

    if (remainingSeconds <= 0) {
      setError(t.expired);
      return;
    }

    if (!transferIds.length) {
      setError(t.error);
      return;
    }

    requestLocked.current = true;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(VERIFY_API, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transferIds,
          code,
          locale,
        }),
      });

      const result =
        (await response.json()) as VerifyResponse;

      if (
        !response.ok ||
        result.success !== true ||
        typeof result.transferredCount !== "number"
      ) {
        setError(
          result.code === "code"
            ? t.invalidCode
            : result.code === "attempts"
              ? t.tooManyAttempts
              : result.code === "tickets"
                ? t.noTickets
                : result.message || t.unavailable
        );

        if (
          result.code === "attempts" ||
          result.code === "tickets"
        ) {
          setOtp(Array(OTP_LENGTH).fill(""));
        }

        return;
      }

      setConfirmation(result);
      setStep("success");
      setOtp(Array(OTP_LENGTH).fill(""));
      setTransferIds([]);
      setExpiresAt(null);
      setError(null);

      setTickets((previous) =>
        previous.filter(
          (ticket) => !selectedIds.includes(ticket.id)
        )
      );
    } catch {
      setError(t.unavailable);
    } finally {
      requestLocked.current = false;
      setBusy(false);
    }
  }

  /* ======================================================
     ANNULER CÔTÉ INTERFACE

     Une demande en attente expirera
     côté serveur selon son délai.

     Aucun succès fictif.
  ====================================================== */

  function cancelForm() {
    if (busy) return;

    if (step === "select") {
      router.push(TICKETS_URL);
      return;
    }

    setStep("select");
    setTransferIds([]);
    setExpiresAt(null);
    setOtp(Array(OTP_LENGTH).fill(""));
    setError(null);

    void loadTickets(1, false);
  }

  /* ======================================================
     LIGNE D'UN BILLET
  ====================================================== */

  function renderTicket(
    ticket: TicketItem,
    selectable = true
  ) {
    const checked = selectedIds.includes(ticket.id);

    const date = dateText(
      ticket.schedule?.startsAt,
      ticket.event.timeZone,
      locale
    );

    const location = ticket.event.venue
      ? [
          ticket.event.venue.name,
          ticket.event.venue.city,
        ]
          .filter(Boolean)
          .join(", ")
      : null;

    const content = (
      <>
        {selectable && (
          <span
            className={`flex size-5.25 shrink-0 items-center justify-center rounded-md border-2 ${
              checked
                ? "border-[#087d2d] bg-[#087d2d] text-white"
                : "border-[#a6b6ac] bg-white"
            }`}
          >
            {checked && <Check size={14} />}
          </span>
        )}

        <TicketPicture
          src={ticket.event.imageUrl}
          title={ticket.event.title}
        />

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[13px] font-black leading-snug text-[#142033] sm:text-[16px]">
            {ticket.event.title}
          </h3>

          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[#40516a] sm:text-[12px]">
            <CalendarDays size={14} className="shrink-0" />
            <span>{date ?? t.date}</span>
          </p>

          <p className="mt-1 flex items-start gap-1.5 text-[11px] text-[#40516a] sm:text-[12px]">
            <MapPin size={14} className="shrink-0" />
            <span className="line-clamp-2">
              {location ?? t.location}
            </span>
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[#dff8db] px-2.5 py-1 text-[10px] font-extrabold text-[#076c29]">
              {ticket.category.name}
            </span>

            <span className="max-w-full truncate rounded-full bg-[#eff1fa] px-2.5 py-1 text-[10px] font-bold text-[#465172]">
              {ticket.number}
            </span>
          </div>
        </div>
      </>
    );

    if (!selectable) {
      return (
        <article
          key={ticket.id}
          className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#e5ebe7] bg-white p-3 shadow-sm"
        >
          {content}
        </article>
      );
    }

    return (
      <button
        key={ticket.id}
        type="button"
        disabled={busy}
        onClick={() => toggleTicket(ticket.id)}
        aria-pressed={checked}
        className={`flex w-full min-w-0 items-start gap-2.5 rounded-2xl border p-3 text-left shadow-sm transition-colors disabled:opacity-60 sm:gap-3 ${
          checked
            ? "border-[#0a9234] bg-[#f0fbf2]"
            : "border-[#e5ebe7] bg-white hover:border-[#9cceaa]"
        }`}
      >
        {content}
      </button>
    );
  }

  /* ======================================================
     RENDU
  ====================================================== */

  return (
    <>
      

      <PublicAccountShell locale={locale}><main
        id="tikemia-transfer-page"
        className="w-full min-w-0 flex-1 bg-[#f8faf9] text-[#152036]"
      >
        <div className="w-full px-3 py-5 sm:px-5 md:px-7 md:py-5 xl:px-10">

          {/* HEADER DE LA PAGE */}

          <div className="mb-5 flex items-start gap-3 sm:gap-4">
            <ArrowLeftRight
              size={37}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-[#07832d] sm:size-12"
            />

            <div className="min-w-0 flex-1">
              <h1 className="text-[24px] font-black leading-tight tracking-tight text-[#0f192c] sm:text-[34px]">
                {t.title}
              </h1>

              <p className="mt-1 text-[12px] text-[#405175] sm:text-[14px]">
                {t.subtitle}
              </p>
            </div>

            <Link
              href={TICKETS_URL}
              aria-label={t.back}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#dce9de] bg-white text-[#087d2d] sm:size-10"
            >
              <ArrowLeft size={18} />
            </Link>
          </div>

          {/* CHARGEMENT */}

          {listLoading && tickets.length === 0 && (
            <div className="flex min-h-65 items-center justify-center">
              <LoaderCircle
                size={32}
                className="animate-spin text-[#087d2d]"
              />
            </div>
          )}

          {/* SESSION ABSENTE */}

          {!listLoading && unauthorized && (
            <div className="mx-auto flex max-w-125 flex-col items-center gap-4 rounded-2xl border bg-white p-7 text-center">
              <CircleAlert
                size={34}
                className="text-[#087d2d]"
              />

              <p className="font-bold">{t.unauthorized}</p>

              <Link
                href={LOGIN_URL}
                className="rounded-full bg-[#087d2d] px-6 py-3 text-sm font-extrabold text-white"
              >
                {t.openAccount}
              </Link>
            </div>
          )}

          {!unauthorized &&
            (!listLoading || tickets.length > 0) && (
              <>
                {/* =======================================
                    ETAPE 1 — SÉLECTION ET EMAIL
                ======================================= */}

                {step === "select" && (
                  <form
                    onSubmit={requestTransfer}
                    className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5"
                  >
                    {/* COLONNE BILLETS */}

                    <section className="min-w-0 rounded-[22px] border border-[#e5eae6] bg-white p-3 shadow-[0_4px_18px_rgba(18,44,28,0.05)] sm:p-5">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-[17px] font-black text-[#121c2e] sm:text-[20px]">
                          {t.ticketTitle}
                        </h2>

                        <span className="rounded-full bg-[#e4f9e3] px-3 py-1.5 text-xs font-extrabold text-[#08742c]">
                          {selectedIds.length} {t.selected}
                        </span>
                      </div>

                      {tickets.length > 0 && (
                        <div className="mb-4 grid gap-2 sm:grid-cols-2">
                          <input
                            type="search"
                            value={search}
                            onChange={(event) =>
                              setSearch(event.target.value)
                            }
                            placeholder={t.search}
                            aria-label={t.search}
                            className="h-11 w-full min-w-0 rounded-xl border border-[#dce4df] px-3 text-sm outline-none focus:border-[#087d2d]"
                          />

                          <div className="relative">
                            <select
                              value={categoryFilter}
                              onChange={(event) =>
                                setCategoryFilter(
                                  event.target.value
                                )
                              }
                              aria-label={t.category}
                              className="h-11 w-full appearance-none rounded-xl border border-[#dce4df] bg-white px-3 pr-9 text-sm font-semibold outline-none focus:border-[#087d2d]"
                            >
                              <option value="all">
                                {t.allCategories}
                              </option>

                              {categories.map(([id, name]) => (
                                <option key={id} value={id}>
                                  {name}
                                </option>
                              ))}
                            </select>

                            <ChevronDown
                              size={17}
                              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#42556b]"
                            />
                          </div>
                        </div>
                      )}

                      <div className="max-h-140 space-y-2.5 overflow-y-auto pr-0.5">
                        {displayedTickets.length > 0 ? (
                          displayedTickets.map((ticket) =>
                            renderTicket(ticket)
                          )
                        ) : (
                          <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center">
                            <Ticket
                              size={32}
                              className="text-[#a1baa7]"
                            />

                            <p className="text-sm font-semibold text-[#657588]">
                              {tickets.length
                                ? t.emptyFilter
                                : t.noTickets}
                            </p>
                          </div>
                        )}
                      </div>

                      {pagination?.hasNextPage && (
                        <button
                          type="button"
                          disabled={moreLoading}
                          onClick={() =>
                            void loadTickets(
                              listPage + 1,
                              true
                            )
                          }
                          className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-[#087d2d] text-xs font-extrabold text-[#087d2d] disabled:opacity-50"
                        >
                          {moreLoading ? (
                            <LoaderCircle
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <ChevronDown size={16} />
                          )}

                          {t.loadMore}
                        </button>
                      )}
                    </section>

                    {/* COLONNE FORMULAIRE */}

                    <section className="min-w-0 rounded-[22px] border border-[#e5eae6] bg-white p-4 shadow-[0_4px_18px_rgba(18,44,28,0.05)] sm:p-5">
                      {selectedTickets.length > 0 && (
                        <div className="mb-5 space-y-2">
                          {selectedTickets.map((ticket) =>
                            renderTicket(ticket, false)
                          )}
                        </div>
                      )}

                      <label
                        htmlFor="tikemia-transfer-email"
                        className="mb-2 block text-[13px] font-extrabold text-[#172438]"
                      >
                        {t.email}
                        <span className="ml-1 text-red-600">
                          *
                        </span>
                      </label>

                      <div className="relative">
                        <Mail
                          size={19}
                          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#35475b]"
                        />

                        <input
                          id="tikemia-transfer-email"
                          type="email"
                          autoComplete="email"
                          required
                          maxLength={254}
                          value={recipientEmail}
                          disabled={busy}
                          onChange={(event) => {
                            setRecipientEmail(event.target.value);
                            setError(null);
                          }}
                          placeholder={t.emailPlaceholder}
                          className="h-12.75 w-full rounded-xl border border-[#d5dfe8] bg-[#fbfcff] pr-3 pl-11 text-sm outline-none focus:border-[#087d2d] disabled:opacity-50"
                        />
                      </div>

                      {error && (
                        <div
                          role="alert"
                          className="mt-4 flex items-start gap-2 rounded-xl bg-[#fff0f0] px-3 py-3 text-xs font-semibold text-[#aa3232]"
                        >
                          <CircleAlert
                            size={17}
                            className="shrink-0"
                          />
                          {error}
                        </div>
                      )}

                      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                        <button
                          type="submit"
                          disabled={
                            busy ||
                            selectedIds.length === 0
                          }
                          className="flex min-h-12.25 flex-1 items-center justify-center gap-2 rounded-full bg-linear-to-b from-[#1aac00] to-[#006e28] px-4 text-[14px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? (
                            <>
                              <LoaderCircle
                                size={18}
                                className="animate-spin"
                              />
                              {t.sending}
                            </>
                          ) : (
                            <>
                              <ArrowLeftRight size={20} />
                              {selectedIds.length === 1
                                ? t.transferOne
                                : t.selectAndSend}
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={cancelForm}
                          className="min-h-12.25 rounded-full border border-[#98a9b8] bg-white px-7 text-sm font-extrabold text-[#182338] disabled:opacity-50"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    </section>
                  </form>
                )}

                {/* =======================================
                    ETAPE 2 — CODE OTP
                ======================================= */}

                {step === "verify" && (
                  <div className="mx-auto w-full max-w-142.5 rounded-3xl border border-[#e4eae5] bg-white p-5 shadow-[0_7px_25px_rgba(15,45,25,0.07)] sm:p-8">
                    <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#e5f8e8] text-[#087d2d]">
                      <Mail size={32} />
                    </div>

                    <h2 className="mt-4 text-center text-[23px] font-black text-[#111c2d] sm:text-[28px]">
                      {t.codeTitle}
                    </h2>

                    <p className="mt-2 text-center text-[13px] text-[#617083]">
                      {t.codeSubtitle}
                    </p>

                    <form
                      onSubmit={verifyTransfer}
                      className="mt-6"
                    >
                      <label
                        htmlFor="tikemia-transfer-otp-0"
                        className="mb-3 block text-[13px] font-extrabold text-[#202c3d]"
                      >
                        {t.code}
                      </label>

                      <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5">
                        {otp.map((digit, index) => (
                          <input
                            key={index}
                            ref={(element) => {
                              otpRefs.current[index] =
                                element;
                            }}
                            id={`tikemia-transfer-otp-${index}`}
                            type="text"
                            inputMode="numeric"
                            autoComplete={
                              index === 0
                                ? "one-time-code"
                                : "off"
                            }
                            maxLength={OTP_LENGTH}
                            value={digit}
                            disabled={busy}
                            aria-label={`${t.code} ${index + 1}`}
                            onChange={(event) =>
                              handleOtpChange(index, event)
                            }
                            onKeyDown={(event) =>
                              handleOtpKey(index, event)
                            }
                            onPaste={handleOtpPaste}
                            className="h-13.5 w-full min-w-0 rounded-xl border border-[#d0dce4] bg-[#fbfcff] text-center text-[24px] font-black text-[#07572e] outline-none focus:border-[#087d2d] disabled:opacity-50 sm:h-15.75"
                          />
                        ))}
                      </div>

                      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#617083]">
                        <Clock3 size={15} />
                        {t.expiresIn}{" "}
                        {countdownText(remainingSeconds)}
                      </p>

                      {error && (
                        <div
                          role="alert"
                          className="mt-4 flex items-center gap-2 rounded-xl bg-[#fff0f0] px-3 py-3 text-xs font-semibold text-[#ab3434]"
                        >
                          <CircleAlert size={17} />
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={
                          busy ||
                          remainingSeconds <= 0 ||
                          otp.some((digit) => !digit)
                        }
                        className="mt-6 flex min-h-12.75 w-full items-center justify-center gap-2 rounded-full bg-linear-to-b from-[#19a900] to-[#006d29] px-5 text-[15px] font-extrabold text-white disabled:opacity-50"
                      >
                        {busy ? (
                          <>
                            <LoaderCircle
                              size={19}
                              className="animate-spin"
                            />
                            {t.confirming}
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={21} />
                            {t.confirm}
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={cancelForm}
                        className="mt-2.5 flex min-h-11.5 w-full items-center justify-center gap-2 rounded-full border border-[#9aaab8] bg-white text-sm font-bold text-[#172439] disabled:opacity-50"
                      >
                        <ArrowLeft size={17} />
                        {remainingSeconds > 0
                          ? t.back
                          : t.restart}
                      </button>
                    </form>
                  </div>
                )}

                {/* =======================================
                    ETAPE 3 — SUCCÈS
                ======================================= */}

                {step === "success" && confirmation && (
                  <div className="mx-auto w-full max-w-142.5 rounded-3xl border border-[#e3ebe5] bg-white p-5 text-center shadow-[0_7px_25px_rgba(15,45,25,0.07)] sm:p-8">
                    <div className="mx-auto flex size-18.5 items-center justify-center rounded-full bg-linear-to-b from-[#1db100] to-[#006a29] text-white">
                      <Check size={41} strokeWidth={2.5} />
                    </div>

                    <h2 className="mt-5 text-[25px] font-black text-[#101c2e] sm:text-[30px]">
                      {t.successTitle}
                    </h2>

                    <div className="mt-5 rounded-xl bg-[#effaef] px-4 py-4 text-left">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-[#536676]">
                          {t.count}
                        </span>

                        <span className="font-black text-[#075b2b]">
                          {confirmation.transferredCount}
                        </span>
                      </div>

                      <div className="mt-3 h-px bg-[#d9e8db]" />

                      <div className="mt-3 flex min-w-0 items-start justify-between gap-3 text-sm">
                        <span className="shrink-0 font-semibold text-[#536676]">
                          {t.recipient}
                        </span>

                        <span className="min-w-0 break-all text-right font-extrabold text-[#122c1d]">
                          {confirmation.recipientEmail ||
                            recipientEmail}
                        </span>
                      </div>
                    </div>

                    {confirmation.deliveryStatus ===
                      "QUEUED" && (
                      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[#52687a]">
                        <Mail size={16} />
                        {t.emailPending}
                      </p>
                    )}

                    <Link
                      href={TICKETS_URL}
                      className="mt-6 flex min-h-12.75 w-full items-center justify-center gap-2 rounded-full bg-linear-to-b from-[#19a900] to-[#006d29] px-4 text-sm font-extrabold text-white"
                    >
                      <Ticket size={19} />
                      {t.myTickets}
                      <ArrowRight size={17} />
                    </Link>
                  </div>
                )}

                {/* =======================================
                    ERREUR DE CHARGEMENT
                ======================================= */}

                {step === "select" &&
                  error &&
                  tickets.length === 0 && (
                    <div className="mt-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          void loadTickets(1, false)
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-[#087d2d] px-5 py-2.5 text-sm font-bold text-[#087d2d]"
                      >
                        <RefreshCw size={17} />
                        {t.retry}
                      </button>
                    </div>
                  )}
              </>
            )}
        </div>
      </main></PublicAccountShell>
    </>
  );
}
