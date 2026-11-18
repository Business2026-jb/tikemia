
"use client";
import { formatMinorMoney } from "@/i18n/config";


import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import {
  AlertCircle,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FilterX,
  Globe2,
  Landmark,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  UserRound,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

/**
 * ============================================================
 * TIKEMIA — ADMINISTRATION DES RETRAITS
 * ============================================================
 *
 * FICHIER :
 * src/app/admin/withdrawals/page.tsx
 *
 * PAGE :
 * /admin/withdrawals
 *
 * ARCHITECTURE :
 *
 * GET    /api/admin/withdrawals
 * GET    /api/admin/withdrawals/[id]
 * PATCH  /api/admin/withdrawals/[id]
 * POST   /api/admin/withdrawals/[id]/proof
 * GET    /api/admin/withdrawals/[id]/proof
 *
 * PARCOURS ADMINISTRATEUR :
 *
 * 1. Consulter les demandes de retrait.
 * 2. Cliquer sur Voir.
 * 3. Consulter les coordonnées complètes.
 * 4. Copier les informations de paiement.
 * 5. Effectuer le transfert manuellement.
 * 6. Ajouter une preuve PDF ou image.
 * 7. Confirmer définitivement le retrait.
 *
 * APRÈS CONFIRMATION :
 *
 * PostgreSQL :
 * Payout.status = COMPLETED
 *
 * L'espace organisateur pourra lire le
 * statut actualisé.
 *
 * Le backend crée également :
 *
 * - Notification PAYOUT
 * - AuditLog WITHDRAWAL_COMPLETED
 * - AuditLog WITHDRAWAL_EMAIL_QUEUED
 *
 * Le cron indépendant gère l'email.
 *
 * AUCUN paiement automatique.
 * AUCUN Cloudflare R2 dans le frontend.
 * AUCUNE modification du schéma Prisma.
 *
 * Le layout /admin existant conserve
 * la navigation générale de TIKEMIA.
 *
 * ============================================================
 */

const API = "/api/admin/withdrawals";

const PAGE_SIZE = 20;
const REFRESH_INTERVAL = 30000;
const SEARCH_DELAY = 350;

const MAX_PROOF_SIZE = 10 * 1024 * 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ============================================================
   TYPES
============================================================ */

type WithdrawalStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED"
  | "CANCELLED";

type WithdrawalPurpose =
  | "EVENT_REVENUE"
  | "CAMPAIGN_FUNDS";

type StatusFilter =
  | "ALL"
  | WithdrawalStatus;

type Owner = {
  id: string;
  fullName: string;
  email: string;
  phoneE164: string | null;
};

type Organizer = {
  id: string;
  name: string;
  email: string | null;
  phoneE164: string | null;
  countryCode: string | null;
  city: string | null;
  owner: Owner;
};

type Destination = {
  id: string;
  type: string;
  provider: string;
  accountName: string;
  maskedAccountRef: string | null;
  bankName: string | null;
  countryCode: string;
  currency: string;
  label: string | null;
  assetCode: string | null;
  networkCode: string | null;
  isVerified: boolean;
  isActive: boolean;
};

type AccountDetails = {
  accountRef: string;
  iban: string | null;
  bic: string | null;
  swift: string | null;
  accountNumber: string | null;
  bankCode: string | null;
  branchCode: string | null;
  mobileMoneyNumber: string | null;
  walletAddress: string | null;
  additionalInformation: string | null;
};

type WithdrawalSource = {
  type: string;
  id: string | null;
  title: string | null;
};

type WithdrawalItem = {
  id: string;
  reference: string;
  purpose: WithdrawalPurpose;
  status: WithdrawalStatus;
  amountMinor: string;
  currency: string;
  requestedAt: string;
  completedAt: string | null;
  updatedAt: string;
  organizer: Organizer;
  destination: Destination;
  source: WithdrawalSource;
};

type Summary = {
  total: number;
  requested: number;
  underReview: number;
  approved: number;
  processing: number;
  completed: number;
  failed: number;
  rejected: number;
  cancelled: number;
  pendingAction: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type WithdrawalListData = {
  withdrawals: WithdrawalItem[];
  pagination: Pagination;
  summary: Summary;
  refreshedAt: string;
};

type WithdrawalDetail = Omit<
  WithdrawalItem,
  "destination"
> & {
  providerRef: string | null;

  destination: Destination & {
    accountDetails: AccountDetails;
  };

  proof: {
    uploaded: boolean;
    id: string | null;
    mimeType: string | null;
    uploadedAt: string | null;
    matchesWithdrawal: boolean;
    downloadUrl: string | null;
  };

  canConfirm: boolean;

  history: Array<{
    id: string;
    action: string;
    createdAt: string;
  }>;

  refreshedAt: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  code?: string;
  message?: string;
  data?: T;
};

type Feedback = {
  type: "success" | "error";
  message: string;
};

type UploadResult = {
  payoutId: string;
  proofId: string;
  uploaded: boolean;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

type ConfirmationResult = {
  id: string;
  reference: string;
  status: WithdrawalStatus;
  amountMinor: string;
  currency: string;
  completedAt: string | null;
  updatedAt: string;
  proofAuditId: string | null;
};

/* ============================================================
   UTILITAIRES
============================================================ */

function isFinalStatus(
  status: WithdrawalStatus
): boolean {
  return (
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "REJECTED" ||
    status === "CANCELLED"
  );
}

function statusLabel(
  status: WithdrawalStatus
): string {
  switch (status) {
    case "REQUESTED":
      return "En attente";

    case "UNDER_REVIEW":
      return "En vérification";

    case "APPROVED":
      return "Approuvé";

    case "PROCESSING":
      return "En traitement";

    case "COMPLETED":
      return "Retrait effectué";

    case "FAILED":
      return "Échec";

    case "REJECTED":
      return "Rejeté";

    case "CANCELLED":
      return "Annulé";

    default:
      return status;
  }
}

function purposeLabel(
  purpose: WithdrawalPurpose
): string {
  return purpose === "EVENT_REVENUE"
    ? "Recettes d'événement"
    : "Fonds de cagnotte";
}

function methodLabel(
  destination: Destination
): string {
  if (destination.type === "BANK_ACCOUNT") {
    return destination.bankName
      ? `Banque — ${destination.bankName}`
      : "Compte bancaire";
  }

  if (destination.type === "MOBILE_MONEY") {
    return destination.provider
      ? `Mobile Money — ${destination.provider}`
      : "Mobile Money";
  }

  if (destination.type === "CRYPTO") {
    return destination.assetCode
      ? `Crypto — ${destination.assetCode}`
      : "Portefeuille crypto";
  }

  return (
    destination.label ||
    destination.provider ||
    destination.type
  );
}

function formatDate(
  value: string | null | undefined
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(
  value: string | null | undefined
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/**
 * Montant provenant de PostgreSQL en unités mineures.
 *
 * Exemple :
 *
 * EUR : 12500 -> 125,00 EUR
 * XOF : 12500 -> 12 500 FCFA
 *
 * BigInt évite de perdre la précision
 * des montants stockés en base.
 */

function formatMoney(
  amountMinor: string,
  currency: string
): string {
  return formatMinorMoney(amountMinor, currency, "fr");
}

function readableError(
  code?: string
): string {
  const messages: Record<string, string> = {
    UNAUTHORIZED:
      "Votre session administrateur est expirée. Reconnectez-vous.",

    FORBIDDEN:
      "Vous n'êtes pas autorisé à effectuer cette action.",

    INVALID_ORIGIN:
      "La requête a été refusée pour des raisons de sécurité.",

    INVALID_REQUEST:
      "La demande envoyée n'est pas valide.",

    INVALID_WITHDRAWAL_ID:
      "Identifiant de retrait invalide.",

    WITHDRAWAL_NOT_FOUND:
      "Cette demande de retrait est introuvable.",

    WITHDRAWAL_ALREADY_FINAL:
      "Cette demande est déjà clôturée.",

    ALREADY_COMPLETED:
      "Ce retrait a déjà été confirmé.",

    INVALID_TRANSITION:
      "Le statut de cette demande ne permet pas sa validation.",

    DESTINATION_MISMATCH:
      "Les informations du bénéficiaire ne correspondent pas au retrait.",

    DESTINATION_NOT_VERIFIED:
      "Le moyen de paiement n'a pas encore été vérifié.",

    DESTINATION_UNAVAILABLE:
      "Le moyen de paiement n'est plus disponible.",

    PROOF_REQUIRED:
      "Ajoutez une preuve de paiement avant de valider le retrait.",

    PROOF_NOT_FOUND:
      "Aucune preuve de paiement n'a été enregistrée.",

    INVALID_PROOF:
      "La preuve est invalide, introuvable ou ne correspond plus au retrait.",

    INVALID_FILE_FORMAT:
      "Seuls les fichiers PDF, JPG, PNG et WebP sont acceptés.",

    FILE_TOO_LARGE:
      "Le fichier doit faire 10 Mo maximum.",

    FILE_REQUIRED:
      "Sélectionnez une photo ou un PDF.",

    STORAGE_ERROR:
      "Impossible d'enregistrer ou de récupérer la preuve de paiement.",

    DECRYPTION_UNAVAILABLE:
      "Les coordonnées bancaires ne peuvent pas être déchiffrées.",

    DATABASE_ERROR:
      "Le serveur de données est temporairement indisponible.",
  };

  return (
    (code ? messages[code] : undefined) ||
    "Une erreur est survenue. Veuillez réessayer."
  );
}

async function readApi<T>(
  response: Response
): Promise<T> {
  let result: ApiEnvelope<T>;

  try {
    result =
      (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(
      "Le serveur a retourné une réponse invalide."
    );
  }

  if (
    !response.ok ||
    result.success !== true ||
    result.data === undefined
  ) {
    throw new Error(
      readableError(result.code)
    );
  }

  return result.data;
}

function errorMessage(
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : "Une erreur inattendue est survenue.";
}

function isAbortError(
  error: unknown
): boolean {
  return (
    error instanceof Error &&
    error.name === "AbortError"
  );
}

/* ============================================================
   COMPOSANTS DE PRÉSENTATION
============================================================ */

function StatusBadge({
  status,
}: {
  status: WithdrawalStatus;
}) {
  let colors =
    "border-amber-200 bg-amber-50 text-amber-700";

  if (status === "COMPLETED") {
    colors =
      "border-emerald-200 bg-emerald-50 text-emerald-700";
  } else if (
    status === "FAILED" ||
    status === "REJECTED" ||
    status === "CANCELLED"
  ) {
    colors =
      "border-red-200 bg-red-50 text-red-700";
  } else if (
    status === "UNDER_REVIEW" ||
    status === "APPROVED" ||
    status === "PROCESSING"
  ) {
    colors =
      "border-blue-200 bg-blue-50 text-blue-700";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${colors}`}
    >
      {status === "COMPLETED" ? (
        <CheckCircle2 size={13} />
      ) : isFinalStatus(status) ? (
        <XCircle size={13} />
      ) : (
        <Clock3 size={13} />
      )}

      {statusLabel(status)}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: ReactNode;
  color: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#e2e9e5] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-[#758391]">
          {title}
        </span>

        <span className={color}>
          {icon}
        </span>
      </div>

      <div className="mt-3 text-[27px] font-black text-[#14263b]">
        {value}
      </div>
    </div>
  );
}

function Notice({
  feedback,
}: {
  feedback: Feedback;
}) {
  const success = feedback.type === "success";

  return (
    <div
      role={success ? "status" : "alert"}
      className={`flex items-start gap-2 rounded-xl border p-3 text-xs font-semibold leading-relaxed ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {success ? (
        <CheckCircle2
          size={18}
          className="shrink-0"
        />
      ) : (
        <AlertCircle
          size={18}
          className="shrink-0"
        />
      )}

      <span>{feedback.message}</span>
    </div>
  );
}

/* ============================================================
   COPIE DES INFORMATIONS
============================================================ */

async function copyText(
  text: string
): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function CopyField({
  label,
  value,
  onFeedback,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: ReactNode;
  onFeedback: (feedback: Feedback) => void;
}) {
  const [copied, setCopied] = useState(false);

  const timerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const hasValue =
    typeof value === "string" &&
    value.trim().length > 0;

  async function handleCopy() {
    if (!hasValue || !value) return;

    try {
      await copyText(value);

      setCopied(true);

      onFeedback({
        type: "success",
        message: `${label} copié.`,
      });

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(
        () => setCopied(false),
        1800
      );
    } catch {
      onFeedback({
        type: "error",
        message:
          "Copie impossible. Autorisez l'accès au presse-papiers.",
      });
    }
  }

  if (!hasValue) return null;

  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-[#edf1ee] py-3 last:border-0">
      {icon && (
        <div className="shrink-0 text-[#82909d]">
          {icon}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-[#758391]">
          {label}
        </p>

        <p className="mt-1 break-all text-[13px] font-bold text-[#22364b]">
          {hasValue ? value : "Non renseigné"}
        </p>
      </div>

      {hasValue && (
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label={`Copier ${label}`}
          title={`Copier ${label}`}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#cfe5d5] bg-[#f1faf3] px-3 text-xs font-bold text-[#087a32] hover:bg-[#e3f4e8]"
        >
          {copied ? (
            <Check size={15} />
          ) : (
            <Copy size={15} />
          )}

          <span className="hidden sm:inline">
            {copied ? "Copié" : "Copier"}
          </span>
        </button>
      )}
    </div>
  );
}

/* ============================================================
   MODAL — VOIR UN RETRAIT
============================================================ */

function WithdrawalModal({
  withdrawalId,
  onClose,
  onUpdated,
}: {
  withdrawalId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [detail, setDetail] =
    useState<WithdrawalDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [feedback, setFeedback] =
    useState<Feedback | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [transferChecked, setTransferChecked] =
    useState(false);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const dialogRef =
    useRef<HTMLDivElement | null>(null);

  const controllerRef =
    useRef<AbortController | null>(null);

  const requestIdRef = useRef(0);
  const busyRef = useRef(false);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const busy =
    uploading || downloading || confirming;

  /* ==========================================================
     CHARGEMENT DU RETRAIT
  ========================================================== */

  const loadDetail = useCallback(
    async (silent = false) => {
      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;

      const currentId = ++requestIdRef.current;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await fetch(
          `${API}/${encodeURIComponent(withdrawalId)}`,
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

        const result =
          await readApi<WithdrawalDetail>(response);

        if (
          controller.signal.aborted ||
          currentId !== requestIdRef.current
        ) {
          return;
        }

        if (result.id !== withdrawalId) {
          throw new Error(
            "Le serveur a retourné un autre retrait."
          );
        }

        setDetail(result);
        setError(null);
      } catch (err) {
        if (
          controller.signal.aborted ||
          isAbortError(err) ||
          currentId !== requestIdRef.current
        ) {
          return;
        }

        setError(errorMessage(err));
      } finally {
        if (
          !controller.signal.aborted &&
          currentId === requestIdRef.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [withdrawalId]
  );

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadDetail(), 0);

    return () => {
      window.clearTimeout(initialTimer);
      controllerRef.current?.abort();
      requestIdRef.current += 1;
    };
  }, [loadDetail]);

  /* ==========================================================
     ACTUALISATION AUTOMATIQUE
  ========================================================== */

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !busyRef.current
      ) {
        void loadDetail(true);
      }
    }, REFRESH_INTERVAL);

    return () => window.clearInterval(timer);
  }, [loadDetail]);

  /* ==========================================================
     FERMETURE ET ACCESSIBILITÉ
  ========================================================== */

  useEffect(() => {
    const oldOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !busyRef.current
      ) {
        closeRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (element) => element.getClientRects().length > 0
      );

      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow = oldOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  /* ==========================================================
     MESSAGE DE COPIE
  ========================================================== */

  function showFeedback(value: Feedback) {
    setFeedback(value);
  }

  /* ==========================================================
     COPIER TOUTES LES COORDONNÉES
  ========================================================== */

  const copyFields: Array<{
    label: string;
    value: string;
  }> = [];

  if (detail) {
    const destination = detail.destination;
    const account = destination.accountDetails;

    const values: Array<[
      string,
      string | null | undefined
    ]> = [
      ["Référence du retrait", detail.reference],
      [
        "Montant",
        formatMoney(
          detail.amountMinor,
          detail.currency
        ),
      ],
      ["Organisation", detail.organizer.name],
      ["Titulaire", destination.accountName],
      ["Pays", destination.countryCode],
      ["Moyen de paiement", methodLabel(destination)],
      ["Banque", destination.bankName],
      ["Prestataire", destination.provider],
      ["IBAN", account?.iban],
      ["BIC", account?.bic],
      ["SWIFT", account?.swift],
      ["Numéro de compte", account?.accountNumber],
      ["Référence du compte", account?.accountRef],
      ["Code banque", account?.bankCode],
      ["Code agence", account?.branchCode],
      ["Numéro Mobile Money", account?.mobileMoneyNumber],
      ["Portefeuille", account?.walletAddress],
      ["Actif", destination.assetCode],
      ["Réseau", destination.networkCode],
      [
        "Informations complémentaires",
        account?.additionalInformation,
      ],
    ];

    for (const [label, value] of values) {
      if (value && value.trim()) {
        copyFields.push({ label, value });
      }
    }
  }

  async function copyAllDetails() {
    if (copyFields.length === 0) return;

    try {
      await copyText(
        copyFields
          .map(
            ({ label, value }) =>
              `${label} : ${value}`
          )
          .join("\n")
      );

      setFeedback({
        type: "success",
        message:
          "Toutes les coordonnées ont été copiées.",
      });
    } catch {
      setFeedback({
        type: "error",
        message:
          "Impossible de copier les informations.",
      });
    }
  }

  /* ==========================================================
     SÉLECTION DU PDF / IMAGE
  ========================================================== */

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] ?? null;

    setFeedback(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowed.includes(file.type)) {
      setSelectedFile(null);
      event.target.value = "";

      setFeedback({
        type: "error",
        message:
          "Format refusé. Utilisez PDF, JPG, PNG ou WebP.",
      });

      return;
    }

    if (
      file.size <= 0 ||
      file.size > MAX_PROOF_SIZE
    ) {
      setSelectedFile(null);
      event.target.value = "";

      setFeedback({
        type: "error",
        message:
          "La preuve doit avoir une taille maximale de 10 Mo.",
      });

      return;
    }

    setSelectedFile(file);
    setTransferChecked(false);
  }

  /* ==========================================================
     ENREGISTRER LA PREUVE
  ========================================================== */

  async function uploadProof() {
    if (
      !selectedFile ||
      !detail ||
      isFinalStatus(detail.status) ||
      busyRef.current
    ) {
      return;
    }

    busyRef.current = true;
    controllerRef.current?.abort();

    setUploading(true);
    setFeedback(null);

    try {
      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await fetch(
        `${API}/${encodeURIComponent(withdrawalId)}/proof`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          body: formData,
        }
      );

      await readApi<UploadResult>(response);

      setSelectedFile(null);
      setTransferChecked(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setFeedback({
        type: "success",
        message:
          "Preuve enregistrée.",
      });

      await loadDetail(true);
      onUpdated();
    } catch (err) {
      setFeedback({
        type: "error",
        message: errorMessage(err),
      });
    } finally {
      busyRef.current = false;
      setUploading(false);
    }
  }

  /* ==========================================================
     TÉLÉCHARGER LA PREUVE
  ========================================================== */

  async function downloadProof() {
    if (
      !detail?.proof.uploaded ||
      busyRef.current
    ) {
      return;
    }

    busyRef.current = true;
    setDownloading(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `${API}/${encodeURIComponent(withdrawalId)}/proof`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        let code: string | undefined;

        try {
          const body =
            (await response.json()) as ApiEnvelope<unknown>;

          code = body.code;
        } catch {
          // Une erreur serveur peut ne pas être du JSON.
        }

        throw new Error(readableError(code));
      }

      const blob = await response.blob();
      const mime = blob.type.toLowerCase();

      let extension = "pdf";

      if (mime.includes("jpeg")) {
        extension = "jpg";
      } else if (mime.includes("png")) {
        extension = "png";
      } else if (mime.includes("webp")) {
        extension = "webp";
      }

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      link.download =
        `tikemia-preuve-retrait-${withdrawalId}.${extension}`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10000);
    } catch (err) {
      setFeedback({
        type: "error",
        message: errorMessage(err),
      });
    } finally {
      busyRef.current = false;
      setDownloading(false);
    }
  }

  /* ==========================================================
     CONFIRMER DÉFINITIVEMENT LE RETRAIT
  ========================================================== */

  async function confirmWithdrawal() {
    if (!detail || busyRef.current) return;

    if (isFinalStatus(detail.status)) {
      setFeedback({
        type: "error",
        message:
          "Cette demande est déjà clôturée.",
      });

      return;
    }

    if (
      !detail.proof.uploaded ||
      !detail.proof.matchesWithdrawal
    ) {
      setFeedback({
        type: "error",
        message:
          "Enregistrez une preuve valide avant de confirmer.",
      });

      return;
    }

    if (!detail.canConfirm) {
      setFeedback({
        type: "error",
        message:
          "Cette demande ne peut pas être validée actuellement. Vérifiez le moyen de paiement et les informations du retrait.",
      });

      return;
    }

    if (!transferChecked) {
      setFeedback({
        type: "error",
        message:
          "Confirmez d'abord que le transfert a réellement été effectué.",
      });

      return;
    }

    busyRef.current = true;
    controllerRef.current?.abort();

    setConfirming(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `${API}/${encodeURIComponent(withdrawalId)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },

          body: JSON.stringify({
            action: "confirm",
          }),
        }
      );

      const updated =
        await readApi<ConfirmationResult>(response);

      if (updated.status !== "COMPLETED") {
        throw new Error(
          "Le serveur n'a pas confirmé le retrait."
        );
      }

      setTransferChecked(false);

      setFeedback({
        type: "success",
        message:
          "Retrait confirmé. Email de confirmation programmé.",
      });

      await loadDetail(true);
      onUpdated();
    } catch (err) {
      setFeedback({
        type: "error",
        message: errorMessage(err),
      });

      // Relire l'état réel pour éviter une nouvelle
      // validation si le premier appel a abouti.
      await loadDetail(true);
      onUpdated();
    } finally {
      busyRef.current = false;
      setConfirming(false);
    }
  }

  /* ==========================================================
     AUTORISATIONS UI
  ========================================================== */

  const isClosed =
    detail ? isFinalStatus(detail.status) : false;

  const canUpload =
    detail !== null && !isClosed;

  const proofReady =
    detail?.proof.uploaded === true &&
    detail.proof.matchesWithdrawal === true;

  const canValidate =
    detail !== null &&
    !isClosed &&
    detail.canConfirm &&
    proofReady &&
    transferChecked &&
    !busy;

  /* ==========================================================
     INTERFACE MOBILE ET PC
  ========================================================== */

  return (
    <div
      className="fixed inset-0 z-100 flex items-end justify-center bg-[#0a1728]/75 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !busyRef.current
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdrawal-modal-title"
        tabIndex={-1}
        className="flex h-dvh max-h-dvh sm:h-auto w-full max-w-195 flex-col overflow-hidden rounded-none bg-white shadow-2xl outline-none sm:max-h-[93dvh] sm:rounded-3xl"
      >
        {/* HEADER */}

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e4ebe6] bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f6eb] text-[#087a32]">
              <Wallet size={23} />
            </div>

            <div className="min-w-0">
              <h2
                id="withdrawal-modal-title"
                className="text-[17px] font-black text-[#14283d] sm:text-xl"
              >
                Détails du retrait
              </h2>

              <p className="mt-1 text-xs text-[#718293]">
                Informations et validation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fermer les détails"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e0e8e3] text-[#556779] hover:bg-[#f2f7f3] disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        {/* CONTENU */}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#fcfdfc] px-3 py-3 sm:px-5 sm:py-4">
          {loading && !detail ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3">
              <LoaderCircle
                size={32}
                className="animate-spin text-[#087a32]"
              />

              <p className="text-sm text-[#748594]">
                Chargement des informations...
              </p>
            </div>
          ) : error && !detail ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-4 text-center">
              <AlertCircle
                size={34}
                className="text-red-500"
              />

              <p className="text-sm text-[#475569]">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void loadDetail()}
                className="rounded-xl bg-[#087a32] px-5 py-3 text-sm font-bold text-white"
              >
                Réessayer
              </button>
            </div>
          ) : detail ? (
            <>
              {/* MONTANT ET STATUT */}

              <section className="rounded-2xl bg-[#10263d] p-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-white/70">
                    Montant du retrait
                  </p>

                  <StatusBadge status={detail.status} />
                </div>

                <p className="mt-4 wrap-break-word text-[29px] font-black tracking-tight sm:text-[37px]">
                  {formatMoney(
                    detail.amountMinor,
                    detail.currency
                  )}
                </p>

                <p className="mt-2 break-all text-xs text-white/65">
                  Référence : {detail.reference}
                </p>

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/70">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={14} />

                    {formatDateTime(detail.requestedAt)}
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <Globe2 size={14} />

                    {detail.destination.countryCode}
                  </span>
                </div>
              </section>

              {/* ORGANISATEUR */}

              <section>
                <h3 className="mb-3 text-sm font-black text-[#1d3045]">
                  Informations de l&apos;organisateur
                </h3>

                <div className="rounded-2xl border border-[#e2e9e5] bg-white px-4">
                  <CopyField
                    label="Organisation"
                    value={detail.organizer.name}
                    icon={<Building2 size={17} />}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Responsable"
                    value={detail.organizer.owner.fullName}
                    icon={<UserRound size={17} />}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Email"
                    value={detail.organizer.email}
                    icon={<Mail size={17} />}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Téléphone"
                    value={detail.organizer.phoneE164}
                    icon={<Phone size={17} />}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Pays / Ville"
                    value={
                      [
                        detail.organizer.city,
                        detail.organizer.countryCode,
                      ]
                        .filter(Boolean)
                        .join(", ") || null
                    }
                    icon={<MapPin size={17} />}
                    onFeedback={showFeedback}
                  />
                </div>
              </section>

              {/* COORDONNÉES DE PAIEMENT */}

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-[#1d3045]">
                      Coordonnées pour le paiement
                    </h3>

                    <p className="mt-1 text-xs text-[#7b8995]">
                      Informations complètes du bénéficiaire
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void copyAllDetails()}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#c7e5d0] bg-[#eaf8ee] px-3 text-xs font-bold text-[#087a32] hover:bg-[#def2e4]"
                  >
                    <Copy size={16} />
                    Tout copier
                  </button>
                </div>

                <div className="rounded-2xl border border-[#e2e9e5] bg-white px-4">
                  <CopyField
                    label="Moyen de paiement"
                    value={methodLabel(detail.destination)}
                    icon={<CreditCard size={17} />}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Titulaire du compte"
                    value={detail.destination.accountName}
                    icon={<UserRound size={17} />}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Pays du bénéficiaire"
                    value={detail.destination.countryCode}
                    icon={<Globe2 size={17} />}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Banque"
                    value={detail.destination.bankName}
                    icon={<Landmark size={17} />}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Opérateur / prestataire"
                    value={detail.destination.provider}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="IBAN complet"
                    value={detail.destination.accountDetails?.iban}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="BIC"
                    value={detail.destination.accountDetails?.bic}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="SWIFT"
                    value={detail.destination.accountDetails?.swift}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Numéro de compte bancaire"
                    value={
                      detail.destination.accountDetails
                        ?.accountNumber
                    }
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Référence du compte"
                    value={
                      detail.destination.accountDetails
                        ?.accountRef
                    }
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Code banque"
                    value={
                      detail.destination.accountDetails
                        ?.bankCode
                    }
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Code agence"
                    value={
                      detail.destination.accountDetails
                        ?.branchCode
                    }
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Numéro Mobile Money"
                    value={
                      detail.destination.accountDetails
                        ?.mobileMoneyNumber
                    }
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Adresse du portefeuille"
                    value={
                      detail.destination.accountDetails
                        ?.walletAddress
                    }
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Actif"
                    value={detail.destination.assetCode}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Réseau"
                    value={detail.destination.networkCode}
                    onFeedback={showFeedback}
                  />

                  <CopyField
                    label="Informations complémentaires"
                    value={
                      detail.destination.accountDetails
                        ?.additionalInformation
                    }
                    onFeedback={showFeedback}
                  />
                </div>

                <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#edf8f0] p-3 text-xs leading-relaxed text-[#397850]">
                  <ShieldCheck
                    size={17}
                    className="shrink-0"
                  />

                  Vérifiez les coordonnées du bénéficiaire
                  avant d&apos;effectuer le transfert.
                </div>

                {!detail.destination.isVerified && (
                  <div className="mt-3">
                    <Notice
                      feedback={{
                        type: "error",
                        message:
                          "Le moyen de retrait n'est pas vérifié.",
                      }}
                    />
                  </div>
                )}

                {!detail.destination.isActive && (
                  <div className="mt-3">
                    <Notice
                      feedback={{
                        type: "error",
                        message:
                          "Ce moyen de paiement est désactivé.",
                      }}
                    />
                  </div>
                )}
              </section>

              {/* ORIGINE DU RETRAIT */}

              <section className="rounded-2xl border border-[#e2e9e5] bg-white p-4">
                <h3 className="text-sm font-black text-[#1d3045]">
                  Origine de la demande
                </h3>

                <p className="mt-3 text-sm font-bold text-[#33475c]">
                  {purposeLabel(detail.purpose)}
                </p>

                {detail.source.title && (
                  <p className="mt-1 wrap-break-word text-xs text-[#748594]">
                    {detail.source.title}
                  </p>
                )}
              </section>

              {/* PREUVE DE PAIEMENT */}

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <FileCheck2
                    size={20}
                    className="text-[#087a32]"
                  />

                  <h3 className="text-sm font-black text-[#1d3045]">
                    Preuve du paiement
                  </h3>
                </div>

                <div className="rounded-2xl border border-[#e2e9e5] bg-white p-4 sm:p-5">
                  {detail.proof.uploaded ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#cbe8d3] bg-[#f0faf2] p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e0f3e6] text-[#087a32]">
                          <FileCheck2 size={23} />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-[#087a32]">
                            Preuve enregistrée
                          </p>

                          <p className="mt-1 text-[11px] text-[#748594]">
                            {formatDateTime(
                              detail.proof.uploadedAt
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void downloadProof()}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#087a32] px-4 text-xs font-bold text-white hover:bg-[#066b2b] disabled:opacity-50"
                      >
                        {downloading ? (
                          <LoaderCircle
                            size={16}
                            className="animate-spin"
                          />
                        ) : (
                          <Download size={16} />
                        )}

                        Télécharger
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#d7e5dc] bg-[#f8faf9] p-5 text-center">
                      <FileText
                        size={27}
                        className="mx-auto text-[#92a69a]"
                      />

                      <p className="mt-2 text-xs text-[#758594]">
                        Aucune preuve enregistrée.
                      </p>
                    </div>
                  )}

                  {detail.proof.uploaded &&
                    !detail.proof.matchesWithdrawal && (
                      <div className="mt-3">
                        <Notice
                          feedback={{
                            type: "error",
                            message:
                              "La preuve enregistrée ne correspond pas à cette demande. Déposez une nouvelle preuve.",
                          }}
                        />
                      </div>
                    )}

                  {canUpload && (
                    <div className="mt-4">
                      <label
                        htmlFor="tikemia-withdrawal-proof"
                        className="mb-2 block text-xs font-bold text-[#354b5c]"
                      >
                        {detail.proof.uploaded
                          ? "Ajouter une nouvelle preuve"
                          : "Ajouter une photo ou un PDF"}
                      </label>

                      <input
                        id="tikemia-withdrawal-proof"
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        disabled={busy}
                        className="block w-full min-w-0 rounded-xl border border-[#dce6df] bg-[#fafcfb] p-3 text-xs text-[#42556a] file:mr-3 file:rounded-lg file:border-0 file:bg-[#e5f5e9] file:px-3 file:py-2 file:font-bold file:text-[#087a32] disabled:opacity-50"
                      />

                      <p className="mt-2 text-[11px] text-[#82919c]">
                        Formats : PDF, JPG, PNG, WebP — 10 Mo maximum.
                      </p>

                      {selectedFile && (
                        <div className="mt-3 flex min-w-0 items-center gap-2 rounded-lg bg-[#f4f7f5] p-3">
                          <FileText
                            size={17}
                            className="shrink-0 text-[#526b5b]"
                          />

                          <span className="min-w-0 flex-1 break-all text-xs font-semibold text-[#405268]">
                            {selectedFile.name}
                          </span>

                          <span className="shrink-0 text-[11px] text-[#82909a]">
                            {(
                              selectedFile.size /
                              1024 /
                              1024
                            ).toFixed(2)}{" "}
                            Mo
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!selectedFile || busy}
                        onClick={() => void uploadProof()}
                        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#c5e5cf] bg-[#e7f7ec] px-4 text-xs font-extrabold text-[#087a32] transition hover:bg-[#daf1e1] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {uploading ? (
                          <LoaderCircle
                            size={18}
                            className="animate-spin"
                          />
                        ) : (
                          <UploadCloud size={19} />
                        )}

                        {uploading
                          ? "Enregistrement de la preuve..."
                          : "Enregistrer la preuve"}
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* VALIDATION UNIQUE */}

              <section className="rounded-2xl border border-[#d5e8dc] bg-[#f3faf5] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e0f2e6] text-[#087a32]">
                    <ShieldCheck size={23} />
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-[#1b3445]">
                      Validation du retrait
                    </h3>

                    <p className="mt-1 text-xs leading-relaxed text-[#738596]">
                      Confirmez uniquement après avoir
                      effectué le paiement.
                    </p>
                  </div>
                </div>

                {detail.status === "COMPLETED" ? (
                  <div className="mt-4 rounded-xl border border-[#bfe6ca] bg-white p-4">
                    <div className="flex items-center gap-2 text-[#087a32]">
                      <CheckCircle2 size={21} />

                      <p className="text-sm font-black">
                        Retrait validé
                      </p>
                    </div>

                    <p className="mt-2 text-xs text-[#647b6d]">
                      Confirmé le{" "}
                      {formatDateTime(detail.completedAt)}
                    </p>

                    <p className="mt-2 text-xs leading-relaxed text-[#647b6d]">
                      L&apos;organisateur peut consulter
                      le statut « Retrait effectué »
                      dans son espace.
                    </p>
                  </div>
                ) : isClosed ? (
                  <div className="mt-4 rounded-xl border border-red-200 bg-white p-4 text-xs font-semibold text-red-700">
                    Cette demande est clôturée :
                    {" "}
                    {statusLabel(detail.status)}.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-[#dce9df] bg-white p-3">
                      <div className="flex items-center gap-2">
                        {proofReady ? (
                          <CheckCircle2
                            size={18}
                            className="text-[#087a32]"
                          />
                        ) : (
                          <AlertCircle
                            size={18}
                            className="text-amber-600"
                          />
                        )}

                        <p className="text-xs font-bold text-[#3b5063]">
                          {proofReady
                            ? "Preuve de paiement enregistrée"
                            : "Preuve de paiement obligatoire"}
                        </p>
                      </div>
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dce9df] bg-white p-4">
                      <input
                        type="checkbox"
                        checked={transferChecked}
                        disabled={busy}
                        onChange={(event) =>
                          setTransferChecked(
                            event.target.checked
                          )
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#087a32]"
                      />

                      <span className="text-xs font-semibold leading-relaxed text-[#405268]">
                        Je confirme avoir réellement
                        effectué le paiement vers
                        les coordonnées du bénéficiaire
                        et vérifié la preuve enregistrée.
                      </span>
                    </label>

                    <button
                      type="button"
                      disabled={!canValidate}
                      onClick={() =>
                        void confirmWithdrawal()
                      }
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#087a32] px-4 text-sm font-black text-white transition hover:bg-[#056c2a] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {confirming ? (
                        <LoaderCircle
                          size={19}
                          className="animate-spin"
                        />
                      ) : (
                        <CheckCheck size={20} />
                      )}

                      {confirming
                        ? "Validation en cours..."
                        : "Valider le retrait"}
                    </button>

                    {!proofReady && (
                      <p className="text-center text-[11px] text-[#9c742f]">
                        Ajoutez d&apos;abord une preuve
                        de paiement pour activer
                        la validation.
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* HISTORIQUE SIMPLIFIÉ */}

              <section>
                <h3 className="mb-3 text-sm font-black text-[#1d3045]">
                  Historique du retrait
                </h3>

                <div className="rounded-2xl border border-[#e2e9e5] bg-white px-4">
                  {detail.history.length === 0 ? (
                    <p className="py-4 text-xs text-[#7d8c99]">
                      Aucune action administrative enregistrée.
                    </p>
                  ) : (
                    detail.history.map((entry) => {
                      const actionLabels: Record<
                        string,
                        string
                      > = {
                        WITHDRAWAL_PROOF_UPLOADED:
                          "Preuve de paiement ajoutée",

                        WITHDRAWAL_COMPLETED:
                          "Retrait validé",

                        WITHDRAWAL_EMAIL_QUEUED:
                          "Email de confirmation préparé",

                        WITHDRAWAL_EMAIL_SENT:
                          "Email de confirmation envoyé",

                        WITHDRAWAL_EMAIL_ATTEMPT_FAILED:
                          "Échec d'envoi de l'email",
                      };

                      return (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 border-b border-[#edf1ee] py-3 last:border-0"
                        >
                          <Clock3
                            size={16}
                            className="mt-0.5 shrink-0 text-[#087a32]"
                          />

                          <div>
                            <p className="text-xs font-bold text-[#35495e]">
                              {actionLabels[entry.action] ||
                                entry.action
                                  .replace(/^WITHDRAWAL_/, "")
                                  .replaceAll("_", " ")}
                            </p>

                            <p className="mt-1 text-[11px] text-[#84929c]">
                              {formatDateTime(
                                entry.createdAt
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {error && (
                <Notice
                  feedback={{
                    type: "error",
                    message: error,
                  }}
                />
              )}

              {feedback && (
                <Notice feedback={feedback} />
              )}

              <div className="flex items-center justify-between gap-3 border-t border-[#e8eee9] pt-4">
                <p className="text-[11px] text-[#82909b]">
                  Actualisation automatique
                </p>

                <button
                  type="button"
                  disabled={busy || refreshing}
                  onClick={() => void loadDetail(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#dce7df] px-3 py-2 text-xs font-bold text-[#087a32] disabled:opacity-50"
                >
                  <RefreshCw
                    size={15}
                    className={
                      refreshing ? "animate-spin" : ""
                    }
                  />

                  Actualiser
                </button>
              </div>
            </>
          ) : null}
        </div>

        {/* FOOTER */}

        <div className="shrink-0 border-t border-[#e3ebe5] bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10263d] px-5 text-sm font-extrabold text-white hover:bg-[#1a3954] disabled:opacity-50"
          >
            <X size={17} />
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PAGE PRINCIPALE
============================================================ */

export default function AdminWithdrawalsPage() {
  const [list, setList] =
    useState<WithdrawalListData | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [status, setStatus] =
    useState<StatusFilter>("ALL");

  const [currency, setCurrency] = useState("");

  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const controllerRef =
    useRef<AbortController | null>(null);

  const requestIdRef = useRef(0);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  /* ==========================================================
     RECHERCHE AVEC DÉLAI
  ========================================================== */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = searchInput.trim();

      if (value !== search) {
        setSearch(value);
        setPage(1);
      }
    }, SEARCH_DELAY);

    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  /* ==========================================================
     LECTURE DES DEMANDES POSTGRESQL
  ========================================================== */

  const loadWithdrawals = useCallback(
    async (silent = false) => {
      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;

      const currentRequest = ++requestIdRef.current;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          status,
        });

        if (search) {
          params.set("search", search);
        }

        if (currency) {
          params.set("currency", currency);
        }

        const response = await fetch(
          `${API}?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          }
        );

        const result =
          await readApi<WithdrawalListData>(response);

        if (
          controller.signal.aborted ||
          currentRequest !== requestIdRef.current
        ) {
          return;
        }

        if (
          !Array.isArray(result.withdrawals) ||
          !result.pagination ||
          !result.summary
        ) {
          throw new Error(
            "Les données retournées sont invalides."
          );
        }

        if (
          result.pagination.totalPages > 0 &&
          page > result.pagination.totalPages
        ) {
          setPage(result.pagination.totalPages);
          return;
        }

        setList(result);
        setError(null);
      } catch (err) {
        if (
          controller.signal.aborted ||
          isAbortError(err) ||
          currentRequest !== requestIdRef.current
        ) {
          return;
        }

        setError(errorMessage(err));
      } finally {
        if (
          !controller.signal.aborted &&
          currentRequest === requestIdRef.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, search, status, currency]
  );

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadWithdrawals(), 0);

    return () => {
      window.clearTimeout(initialTimer);
      controllerRef.current?.abort();
    };
  }, [loadWithdrawals]);

  /* ==========================================================
     ACTUALISATION AUTOMATIQUE
  ========================================================== */

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadWithdrawals(true);
      }
    }, REFRESH_INTERVAL);

    function refreshOnFocus() {
      void loadWithdrawals(true);
    }

    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener(
        "focus",
        refreshOnFocus
      );
    };
  }, [loadWithdrawals]);

  /* ==========================================================
     OUVERTURE DES DÉTAILS
  ========================================================== */

  function openWithdrawal(id: string) {
    if (!UUID_PATTERN.test(id)) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    setSelectedId(id);
  }

  function closeWithdrawal() {
    setSelectedId(null);

    window.requestAnimationFrame(() => {
      previousFocusRef.current?.focus();
    });
  }

  /* ==========================================================
     FILTRES
  ========================================================== */

  const hasFilters =
    search !== "" ||
    status !== "ALL" ||
    currency !== "";

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("ALL");
    setCurrency("");
    setPage(1);
  }

  const withdrawals = list?.withdrawals ?? [];
  const pagination = list?.pagination;
  const summary = list?.summary;

  const total = pagination?.total ?? 0;

  const start =
    pagination && total > 0
      ? (pagination.page - 1) *
          pagination.pageSize +
        1
      : 0;

  const end = pagination
    ? Math.min(
        pagination.page * pagination.pageSize,
        total
      )
    : 0;

  const pending =
    summary?.pendingAction ??
    (
      summary
        ? summary.requested +
          summary.underReview +
          summary.approved +
          summary.processing
        : 0
    );

  const finished = summary?.completed ?? 0;

  const closed =
    summary
      ? summary.failed +
        summary.rejected +
        summary.cancelled
      : 0;

  /* ==========================================================
     INTERFACE
  ========================================================== */

  return (
    <main className="min-h-full min-w-0 w-full bg-[#f7f9f8] p-3 text-[#18283d] sm:p-4 lg:p-5">
      <div className="w-full">
        {/* HEADER */}

        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e7f5eb] text-[#087a32]">
              <Wallet size={25} />
            </div>

            <div className="min-w-0">
              <h1 className="text-[23px] font-black tracking-tight text-[#14263b] sm:text-[30px]">
                Gestion des retraits
              </h1>

              <p className="mt-1 text-xs text-[#728293] sm:text-sm">
                Demandes de retrait des organisateurs
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading || refreshing}
            onClick={() => void loadWithdrawals(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dbe6df] bg-white px-4 text-xs font-extrabold text-[#087a32] hover:bg-[#eff8f1] disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                refreshing ? "animate-spin" : ""
              }
            />

            Actualiser
          </button>
        </header>

        {/* STATISTIQUES */}

        <section className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            title="Toutes les demandes"
            value={summary?.total ?? "—"}
            icon={<Wallet size={22} />}
            color="text-[#10263d]"
          />

          <SummaryCard
            title="À traiter"
            value={summary ? pending : "—"}
            icon={<Clock3 size={22} />}
            color="text-amber-600"
          />

          <SummaryCard
            title="Retraits effectués"
            value={summary ? finished : "—"}
            icon={<CheckCircle2 size={22} />}
            color="text-[#087a32]"
          />

          <SummaryCard
            title="Autres clôtures"
            value={summary ? closed : "—"}
            icon={<XCircle size={22} />}
            color="text-red-500"
          />
        </section>

        {/* RECHERCHE ET FILTRES */}

        <section className="mb-3 rounded-2xl border border-[#e1e9e3] bg-white p-4 shadow-sm sm:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_210px_140px]">
            <div className="relative min-w-0">
              <Search
                size={19}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#85929c]"
              />

              <input
                type="search"
                value={searchInput}
                maxLength={100}
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
                placeholder="Organisateur, référence, bénéficiaire..."
                aria-label="Rechercher un retrait"
                className="h-12 w-full min-w-0 rounded-xl border border-[#dce6df] bg-[#fbfcfb] pl-11 pr-4 text-[13px] outline-none focus:border-[#0d913b] focus:ring-2 focus:ring-[#d9f1df]"
              />
            </div>

            <select
              value={status}
              aria-label="Filtrer par statut"
              onChange={(event) => {
                setStatus(
                  event.target.value as StatusFilter
                );
                setPage(1);
              }}
              className="h-12 rounded-xl border border-[#dce6df] bg-[#fbfcfb] px-3 text-[13px] font-semibold text-[#405368] outline-none focus:border-[#0d913b]"
            >
              <option value="ALL">
                Tous les statuts
              </option>

              <option value="REQUESTED">
                En attente
              </option>

              <option value="UNDER_REVIEW">
                En vérification
              </option>

              <option value="APPROVED">
                Approuvés
              </option>

              <option value="PROCESSING">
                En traitement
              </option>

              <option value="COMPLETED">
                Retraits effectués
              </option>

              <option value="FAILED">
                Échecs
              </option>

              <option value="REJECTED">
                Rejetés
              </option>

              <option value="CANCELLED">
                Annulés
              </option>
            </select>

            <select
              value={currency}
              aria-label="Filtrer par devise"
              onChange={(event) => {
                setCurrency(event.target.value);
                setPage(1);
              }}
              className="h-12 rounded-xl border border-[#dce6df] bg-[#fbfcfb] px-3 text-[13px] font-semibold text-[#405368] outline-none focus:border-[#0d913b]"
            >
              <option value="">
                Toutes devises
              </option>

              <option value="XOF">XOF</option>
              <option value="NGN">NGN</option>
              <option value="GHS">GHS</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="ZAR">ZAR</option>
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#087a32] hover:underline"
            >
              <FilterX size={16} />
              Effacer les filtres
            </button>
          )}
        </section>

        {/* ERREURS */}

        {error && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle
                size={19}
                className="shrink-0 text-red-600"
              />

              <p className="text-xs text-red-700">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadWithdrawals()
              }
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* LISTE DES DEMANDES */}

        <section className="overflow-hidden rounded-2xl border border-[#e1e9e4] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ede9] px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-base font-black text-[#17283d]">
                Demandes de retrait
              </h2>

              <p className="mt-1 text-[11px] text-[#80909a]">
                {total.toLocaleString("fr-FR")} demande(s)
              </p>
            </div>

            {list?.refreshedAt && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#83909b]">
                <Clock3 size={13} />

                {formatDateTime(
                  list.refreshedAt
                )}
              </span>
            )}
          </div>

          {loading && !list ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3">
              <LoaderCircle
                size={32}
                className="animate-spin text-[#087a32]"
              />

              <p className="text-xs text-[#738392]">
                Chargement des retraits...
              </p>
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center px-4 py-6 text-center">
              <Wallet
                size={38}
                className="text-[#86b497]"
              />

              <h3 className="mt-4 text-sm font-black text-[#24374c]">
                {hasFilters
                  ? "Aucune demande trouvée"
                  : "Aucun retrait pour le moment"}
              </h3>

              <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#7e8b98]">
                {hasFilters
                  ? "Modifiez vos critères de recherche."
                  : "Les demandes effectuées par les organisateurs apparaîtront automatiquement ici."}
              </p>
            </div>
          ) : (
            <>
              {/* TABLEAU PC */}

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-265 border-collapse text-left">
                  <thead className="border-b border-[#e7ede9] bg-[#f7f9f8]">
                    <tr className="text-[11px] font-extrabold uppercase tracking-wide text-[#778593]">
                      <th className="px-5 py-4">
                        Organisateur
                      </th>

                      <th className="px-4 py-4">
                        Montant
                      </th>

                      <th className="px-4 py-4">
                        Moyen
                      </th>

                      <th className="px-4 py-4">
                        Pays
                      </th>

                      <th className="px-4 py-4">
                        Date
                      </th>

                      <th className="px-4 py-4">
                        Statut
                      </th>

                      <th className="px-5 py-4 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {withdrawals.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[#edf1ee] transition hover:bg-[#fafdfa] last:border-0"
                      >
                        <td className="px-5 py-4">
                          <p className="max-w-52.5 truncate text-[13px] font-black text-[#192a40]">
                            {item.organizer.name}
                          </p>

                          <p className="mt-1 max-w-52.5 truncate text-[11px] text-[#7a8995]">
                            {item.organizer.owner.fullName}
                          </p>

                          <p className="mt-1 max-w-52.5 truncate text-[11px] text-[#8b97a0]">
                            {item.reference}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="whitespace-nowrap text-[13px] font-black text-[#16283f]">
                            {formatMoney(
                              item.amountMinor,
                              item.currency
                            )}
                          </p>

                          <p className="mt-1 text-[11px] text-[#7d8a96]">
                            {purposeLabel(
                              item.purpose
                            )}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="max-w-42.5 truncate text-xs font-semibold text-[#3f5166]">
                            {methodLabel(
                              item.destination
                            )}
                          </p>

                          <p className="mt-1 max-w-42.5 truncate text-[11px] text-[#83919b]">
                            {item.destination.maskedAccountRef ||
                              item.destination.accountName}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-xs font-bold text-[#45576a]">
                          {item.destination.countryCode}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-xs text-[#6e7e8e]">
                          {formatDate(
                            item.requestedAt
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            status={item.status}
                          />
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              openWithdrawal(item.id)
                            }
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#cce7d3] bg-[#eff9f1] px-4 text-xs font-extrabold text-[#087a32] hover:bg-[#def2e3]"
                          >
                            <Eye size={16} />
                            Voir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* CARTES MOBILE ET TABLETTE */}

              <div className="divide-y divide-[#ecf0ed] lg:hidden">
                {withdrawals.map((item) => (
                  <article
                    key={item.id}
                    className="p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="wrap-break-word text-sm font-black text-[#192b40]">
                          {item.organizer.name}
                        </p>

                        <p className="mt-1 text-xs text-[#7b8995]">
                          {item.organizer.owner.fullName}
                        </p>
                      </div>

                      <StatusBadge
                        status={item.status}
                      />
                    </div>

                    <p className="mt-3 wrap-break-word text-[22px] font-black text-[#087a32]">
                      {formatMoney(
                        item.amountMinor,
                        item.currency
                      )}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-[#f7f9f8] p-3">
                      <div className="min-w-0">
                        <p className="text-[11px] text-[#82909a]">
                          Moyen de retrait
                        </p>

                        <p className="mt-1 wrap-break-word text-xs font-bold text-[#405268]">
                          {methodLabel(
                            item.destination
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] text-[#82909a]">
                          Pays
                        </p>

                        <p className="mt-1 text-xs font-bold text-[#405268]">
                          {item.destination.countryCode}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 text-[11px] text-[#84919c]">
                        <p>
                          {formatDate(
                            item.requestedAt
                          )}
                        </p>

                        <p className="mt-1 break-all">
                          {item.reference}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          openWithdrawal(item.id)
                        }
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#087a32] px-5 text-xs font-extrabold text-white"
                      >
                        <Eye size={17} />
                        Voir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {/* PAGINATION */}

          {pagination && pagination.total > 0 && (
            <div className="flex flex-col gap-3 border-t border-[#e7ede9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-center text-xs text-[#7b8996] sm:text-left">
                {start}–{end} sur{" "}
                <strong className="text-[#293b50]">
                  {pagination.total}
                </strong>{" "}
                demandes
              </p>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label="Page précédente"
                  disabled={
                    !pagination.hasPreviousPage ||
                    loading
                  }
                  onClick={() =>
                    setPage((current) =>
                      Math.max(1, current - 1)
                    )
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce6df] text-[#405268] disabled:opacity-40"
                >
                  <ChevronLeft size={18} />
                </button>

                <span className="min-w-27.5 text-center text-xs font-extrabold text-[#26394e]">
                  Page {pagination.page} /{" "}
                  {Math.max(
                    pagination.totalPages,
                    1
                  )}
                </span>

                <button
                  type="button"
                  aria-label="Page suivante"
                  disabled={
                    !pagination.hasNextPage ||
                    loading
                  }
                  onClick={() =>
                    setPage((current) => current + 1)
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce6df] text-[#405268] disabled:opacity-40"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* NOTE */}

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#e2ebe4] bg-white p-4">
          <ShieldCheck
            size={18}
            className="shrink-0 text-[#087a32]"
          />

          <p className="text-xs leading-relaxed text-[#758594]">
            Les retraits sont effectués manuellement
            par l&apos;administration TIKEMIA.
            La confirmation nécessite une preuve
            de paiement enregistrée et une
            vérification du transfert réel.
          </p>
        </div>
      </div>

      {/* MODAL SUR LA MÊME PAGE */}

      {selectedId && (
        <WithdrawalModal
          key={selectedId}
          withdrawalId={selectedId}
          onClose={closeWithdrawal}
          onUpdated={() => {
            void loadWithdrawals(true);
          }}
        />
      )}
    </main>
  );
}
