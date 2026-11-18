
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  LoaderCircle,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";

/**
 * ============================================================
 * TIKEMIA — ADMINISTRATION / CLIENTS
 * ============================================================
 *
 * FICHIER :
 * src/app/admin/clients/page.tsx
 *
 * PAGE :
 * /admin/clients
 *
 * API LISTE :
 * GET /api/admin/clients
 *
 * API EXPORT :
 * GET /api/admin/clients/export
 *
 * FONCTIONNALITÉS :
 *
 * - Liste des clients enregistrés
 * - Acheteurs invités inclus par l'API
 * - Nombre total de clients
 * - Nombre de clients avec téléphone
 * - Nom du client
 * - Adresse email
 * - Numéro de téléphone
 * - Recherche
 * - Pagination
 * - Actualisation automatique
 * - Exportation complète en PDF
 * - Responsive mobile et PC
 * - Gestion des erreurs
 *
 * AUCUN bouton Voir.
 * AUCUNE modification des clients.
 * AUCUNE donnée fictive.
 * AUCUNE modification Prisma.
 *
 * ============================================================
 */

const API_URL = "/api/admin/clients";

const EXPORT_URL =
  "/api/admin/clients/export";

const PAGE_SIZE = 20;

const REFRESH_INTERVAL = 10_000;

const SEARCH_DELAY = 350;

/* ============================================================
   TYPES
============================================================ */

type ClientSource =
  | "REGISTERED"
  | "GUEST";

type ClientItem = {
  id: string;

  name: string;

  email: string;

  phoneE164: string | null;

  source?: ClientSource;

  registeredAt?: string | null;
};

type ClientsSummary = {
  totalClients: number;
  withPhone: number;
};

type Pagination = {
  page: number;

  pageSize: number;

  total: number;

  totalPages: number;

  hasNextPage: boolean;

  hasPreviousPage: boolean;
};

type ClientsData = {
  clients: ClientItem[];

  summary: ClientsSummary;

  pagination: Pagination;

  refreshedAt: string;
};

type ApiResponse<T> = {
  success: boolean;

  data?: T;

  code?: string;

  message?: string;
};

type Feedback = {
  type: "success" | "error";

  message: string;
};

/* ============================================================
   FORMATAGE
============================================================ */

function formatNumber(
  value: number
): string {
  return new Intl.NumberFormat(
    "fr-FR"
  ).format(value);
}

function formatDateTime(
  value: string | null | undefined
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  ).format(date);
}

function displayValue(
  value: string | null | undefined
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return "Non renseigné";
  }

  return value.trim();
}

function errorLabel(
  code?: string
): string {
  const messages: Record<
    string,
    string
  > = {
    UNAUTHORIZED:
      "Votre session administrateur est expirée. Veuillez vous reconnecter.",

    FORBIDDEN:
      "Vous n'avez pas les autorisations nécessaires.",

    INVALID_REQUEST:
      "Les paramètres de recherche sont invalides.",

    INVALID_SEARCH:
      "La recherche envoyée est invalide.",

    DATABASE_ERROR:
      "Impossible de récupérer les clients depuis PostgreSQL.",

    EXPORT_FAILED:
      "La génération du PDF a échoué.",

    PDF_GENERATION_ERROR:
      "Impossible de générer le document PDF.",

    EXPORT_TOO_LARGE:
      "Le PDF contient trop de données pour être généré en une seule fois.",

    INTERNAL_ERROR:
      "Une erreur interne est survenue.",
  };

  return (
    (code ? messages[code] : undefined) ||
    "L'opération a échoué. Veuillez réessayer."
  );
}

function getErrorMessage(
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
   LECTURE DES RÉPONSES API
============================================================ */

async function parseApiResponse<T>(
  response: Response
): Promise<T> {
  let result: ApiResponse<T>;

  try {
    result =
      (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error(
      "Le serveur a retourné une réponse invalide."
    );
  }

  if (
    !response.ok ||
    result?.success !== true ||
    result.data === undefined
  ) {
    throw new Error(
      errorLabel(result?.code)
    );
  }

  return result.data;
}

/* ============================================================
   COMPOSANTS VISUELS
============================================================ */

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#e1e9e4] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-[#718293]">
          {title}
        </p>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f5eb] text-[#087a32]">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-[29px] font-black tracking-tight text-[#14263d] sm:text-[33px]">
        {value}
      </p>

      <p className="mt-2 text-[11px] leading-relaxed text-[#84929d]">
        {description}
      </p>
    </div>
  );
}

function Notice({
  feedback,
  onClose,
}: {
  feedback: Feedback;
  onClose: () => void;
}) {
  const success =
    feedback.type === "success";

  return (
    <div
      role={success ? "status" : "alert"}
      className={`flex items-start gap-3 rounded-xl border p-3.5 ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {success ? (
        <CheckCircle2
          size={19}
          className="mt-0.5 shrink-0"
        />
      ) : (
        <AlertCircle
          size={19}
          className="mt-0.5 shrink-0"
        />
      )}

      <p className="min-w-0 flex-1 text-xs font-semibold leading-relaxed">
        {feedback.message}
      </p>

      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer le message"
        className="shrink-0 opacity-70 hover:opacity-100"
      >
        <X size={17} />
      </button>
    </div>
  );
}

function ClientAvatar({
  name,
}: {
  name: string;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "C";

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e8f5ec] text-sm font-black text-[#087a32]">
      {initials}
    </div>
  );
}

/* ============================================================
   PAGE ADMINISTRATEUR
============================================================ */

export default function AdminClientsPage() {
  /* ==========================================================
     ÉTATS
  ========================================================== */

  const [data, setData] =
    useState<ClientsData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [exporting, setExporting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [feedback, setFeedback] =
    useState<Feedback | null>(null);

  const [searchInput, setSearchInput] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [page, setPage] =
    useState(1);

  const controllerRef =
    useRef<AbortController | null>(null);

  const requestIdRef =
    useRef(0);

  const mountedRef =
    useRef(false);

  const hasLoadedRef =
    useRef(false);

  const exportBusyRef =
    useRef(false);

  /* ==========================================================
     RECHERCHE
  ========================================================== */

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        const value =
          searchInput.trim();

        if (value !== search) {
          setSearch(value);
          setPage(1);
        }
      },
      SEARCH_DELAY
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput, search]);

  /* ==========================================================
     CHARGEMENT DES CLIENTS
  ========================================================== */

  const loadClients = useCallback(
    async (silent = false) => {
      controllerRef.current?.abort();

      const controller =
        new AbortController();

      controllerRef.current =
        controller;

      const currentRequest =
        ++requestIdRef.current;

      if (
        silent &&
        hasLoadedRef.current
      ) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params =
          new URLSearchParams({
            page: String(page),
            pageSize: String(PAGE_SIZE),
          });

        if (search) {
          params.set(
            "search",
            search
          );
        }

        const response =
          await fetch(
            `${API_URL}?${params.toString()}`,
            {
              method: "GET",

              credentials:
                "same-origin",

              cache: "no-store",

              referrerPolicy:
                "no-referrer",

              headers: {
                Accept:
                  "application/json",
              },

              signal:
                controller.signal,
            }
          );

        const result =
          await parseApiResponse<ClientsData>(
            response
          );

        if (
          controller.signal.aborted ||
          currentRequest !==
            requestIdRef.current
        ) {
          return;
        }

        /* ----------------------------------------------
           VÉRIFICATION DU CONTRAT API
        ---------------------------------------------- */

        if (
          !Array.isArray(
            result.clients
          ) ||
          !result.pagination ||
          !result.summary ||
          typeof result.summary.totalClients !== "number" ||
          typeof result.summary.withPhone !== "number"
        ) {
          throw new Error(
            "Le format des données clients est invalide."
          );
        }

        /* ----------------------------------------------
           PAGINATION DEVENUE INVALIDE
        ---------------------------------------------- */

        if (
          result.pagination.totalPages > 0 &&
          page >
            result.pagination.totalPages
        ) {
          setPage(
            result.pagination.totalPages
          );

          return;
        }

        if (
          result.pagination.totalPages === 0 &&
          page !== 1
        ) {
          setPage(1);
          return;
        }

        setData(result);
        setError(null);

        hasLoadedRef.current = true;
      } catch (err) {
        if (
          controller.signal.aborted ||
          isAbortError(err) ||
          currentRequest !==
            requestIdRef.current
        ) {
          return;
        }

        setError(
          getErrorMessage(err)
        );
      } finally {
        if (
          !controller.signal.aborted &&
          currentRequest ===
            requestIdRef.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, search]
  );

  /* ==========================================================
     CHARGEMENT INITIAL
  ========================================================== */

  useEffect(() => {
    mountedRef.current = true;

    const initialTimer = window.setTimeout(() => void loadClients(), 0);

    return () => {
      window.clearTimeout(initialTimer);
      mountedRef.current = false;

      controllerRef.current?.abort();
    };
  }, [loadClients]);

  /* ==========================================================
     ACTUALISATION AUTOMATIQUE
  ========================================================== */

  useEffect(() => {
    const timer =
      window.setInterval(() => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void loadClients(true);
        }
      }, REFRESH_INTERVAL);

    function onVisible() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void loadClients(true);
      }
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);

      document.removeEventListener(
        "visibilitychange",
        onVisible
      );
    };
  }, [loadClients]);

  /* ==========================================================
     EXPORT PDF
  ========================================================== */

  /**
   * Le PDF est généré par le serveur.
   *
   * Cette page ne récupère pas toutes
   * les données personnelles dans
   * le navigateur pour créer le PDF.
   *
   * La route :
   *
   * /api/admin/clients/export
   *
   * doit produire un PDF de tous les clients
   * correspondant au filtre search.
   *
   * La pagination ne doit PAS limiter
   * le nombre de clients dans le PDF.
   */

  async function downloadPdf() {
    if (exportBusyRef.current) {
      return;
    }

    exportBusyRef.current = true;

    setExporting(true);
    setFeedback(null);

    try {
      const params =
        new URLSearchParams();

      if (search) {
        params.set(
          "search",
          search
        );
      }

      const query =
        params.toString();

      const url =
        query
          ? `${EXPORT_URL}?${query}`
          : EXPORT_URL;

      const response =
        await fetch(url, {
          method: "GET",

          cache: "no-store",

          credentials:
            "same-origin",

          referrerPolicy:
            "no-referrer",

          headers: {
            Accept:
              "application/pdf",
          },
        });

      /* ----------------------------------------------
         ERREUR DE GÉNÉRATION
      ---------------------------------------------- */

      if (!response.ok) {
        let errorCode:
          string | undefined;

        try {
          const payload =
            (await response.json()) as
              ApiResponse<unknown>;

          errorCode =
            payload.code;
        } catch {
          // Une erreur HTTP n'est pas
          // nécessairement au format JSON.
        }

        throw new Error(
          errorLabel(errorCode)
        );
      }

      /* ----------------------------------------------
         CONTRÔLER LE TYPE DE FICHIER
      ---------------------------------------------- */

      const contentType =
        response.headers
          .get("content-type")
          ?.toLowerCase() ?? "";

      if (
        !contentType.includes(
          "application/pdf"
        )
      ) {
        throw new Error(
          "Le serveur n'a pas retourné un document PDF."
        );
      }

      const fileBlob =
        await response.blob();

      if (fileBlob.size === 0) {
        throw new Error(
          "Le document PDF généré est vide."
        );
      }

      /* ----------------------------------------------
         VÉRIFICATION DE LA SIGNATURE PDF
      ---------------------------------------------- */

      const signatureBuffer =
        await fileBlob
          .slice(0, 5)
          .arrayBuffer();

      const signature =
        new TextDecoder().decode(
          signatureBuffer
        );

      if (
        signature !== "%PDF-"
      ) {
        throw new Error(
          "Le document reçu n'est pas un PDF valide."
        );
      }

      /* ----------------------------------------------
         TÉLÉCHARGEMENT
      ---------------------------------------------- */

      const objectUrl =
        URL.createObjectURL(
          fileBlob
        );

      const link =
        document.createElement("a");

      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      link.href = objectUrl;

      link.download =
        `tikemia-clients-${today}.pdf`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      window.setTimeout(
        () => {
          URL.revokeObjectURL(
            objectUrl
          );
        },
        10000
      );

      if (mountedRef.current) {
        setFeedback({
          type: "success",
          message:
            "Le téléchargement du PDF a été lancé.",
        });
      }
    } catch (err) {
      if (mountedRef.current) {
        setFeedback({
          type: "error",
          message:
            getErrorMessage(err),
        });
      }
    } finally {
      exportBusyRef.current = false;

      if (mountedRef.current) {
        setExporting(false);
      }
    }
  }

  /* ==========================================================
     FILTRES
  ========================================================== */

  const hasSearch =
    searchInput.trim() !== "";

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  /* ==========================================================
     DONNÉES
  ========================================================== */

  const clients =
    data?.clients ?? [];

  const summary =
    data?.summary;

  const pagination =
    data?.pagination;

  const total =
    pagination?.total ?? 0;

  const start =
    pagination && total > 0
      ? (
          pagination.page - 1
        ) *
          pagination.pageSize +
        1
      : 0;

  const end =
    pagination
      ? Math.min(
          pagination.page *
            pagination.pageSize,
          total
        )
      : 0;

  /* ==========================================================
     INTERFACE
  ========================================================== */

  return (
    <main className="min-h-full min-w-0 w-full bg-[#f7f9f8] p-0 text-[#18283d]">
      <div className="mx-auto w-full max-w-none">

        {/* ======================================================
            EN-TÊTE
        ====================================================== */}

        <header className="mb-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e7f5eb] text-[#087a32]">
              <Users size={25} />
            </div>

            <div className="min-w-0">
              <h1 className="text-[23px] font-black tracking-tight text-[#14263b] sm:text-[30px]">
                Gestion des clients
              </h1>

              <p className="mt-1 text-xs text-[#728293] sm:text-sm">
                Liste des clients de TIKEMIA
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            {/* ACTUALISER */}

            <button
              type="button"
              disabled={
                loading ||
                refreshing
              }
              onClick={() =>
                void loadClients(true)
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dbe6df] bg-white px-4 text-xs font-extrabold text-[#087a32] transition hover:bg-[#eff8f1] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              <span>
                Actualiser
              </span>
            </button>

            {/* TÉLÉCHARGER PDF */}

            <button
              type="button"
              disabled={exporting}
              onClick={() =>
                void downloadPdf()
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#087a32] px-4 text-xs font-extrabold text-white transition hover:bg-[#066a2c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Download size={17} />
              )}

              <span>
                {exporting
                  ? "Préparation du PDF..."
                  : "Télécharger PDF"}
              </span>
            </button>
          </div>
        </header>

        {/* ======================================================
            STATISTIQUES
        ====================================================== */}

        <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">

          <StatCard
            title="Total des clients"
            value={
              summary
                ? formatNumber(
                    summary.totalClients
                  )
                : "—"
            }
            icon={
              <Users size={23} />
            }
            description="Clients enregistrés et acheteurs invités reconnus par PostgreSQL"
          />

          <StatCard
            title="Clients avec téléphone"
            value={
              summary
                ? formatNumber(
                    summary.withPhone
                  )
                : "—"
            }
            icon={
              <Phone size={23} />
            }
            description="Clients disposant d'un numéro de téléphone renseigné"
          />

        </section>

        {/* ======================================================
            RECHERCHE
        ====================================================== */}

        <section className="mb-5 rounded-2xl border border-[#e1e9e3] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

            <div className="relative min-w-0 flex-1">

              <Search
                size={19}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#85929c]"
              />

              <input
                type="search"
                value={searchInput}
                maxLength={100}
                onChange={(event) =>
                  setSearchInput(
                    event.target.value
                  )
                }
                placeholder="Rechercher par nom, email ou téléphone..."
                aria-label="Rechercher un client"
                className="h-12 w-full min-w-0 rounded-xl border border-[#dce6df] bg-[#fbfcfb] pl-11 pr-4 text-[13px] text-[#24364b] outline-none transition placeholder:text-[#96a2ad] focus:border-[#0d913b] focus:ring-2 focus:ring-[#d9f1df]"
              />

            </div>

            {hasSearch && (
              <button
                type="button"
                onClick={clearSearch}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#dce6df] bg-white px-4 text-xs font-bold text-[#526477] hover:bg-[#f5f8f6]"
              >
                <X size={16} />

                Effacer
              </button>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-[#84929d]">
            Recherchez un client parmi tous les comptes et
            acheteurs invités enregistrés dans TIKEMIA.
          </p>
        </section>

        {/* ======================================================
            MESSAGES
        ====================================================== */}

        {feedback && (
          <div className="mb-4">
            <Notice
              feedback={feedback}
              onClose={() =>
                setFeedback(null)
              }
            />
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">

            <div className="flex flex-wrap items-start justify-between gap-3">

              <div className="flex min-w-0 flex-1 items-start gap-2">
                <AlertCircle
                  size={19}
                  className="shrink-0 text-red-600"
                />

                <p className="text-xs leading-relaxed text-red-700">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadClients()
                }
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* ======================================================
            LISTE DES CLIENTS
        ====================================================== */}

        <section className="overflow-hidden rounded-2xl border border-[#e1e9e4] bg-white shadow-sm">

          {/* TITRE LISTE */}

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ede9] px-4 py-4 sm:px-5">

            <div>
              <h2 className="text-base font-black text-[#17283d]">
                Tous les clients
              </h2>

              <p className="mt-1 text-[11px] text-[#80909a]">
                {formatNumber(total)} client(s)
                {search
                  ? " correspondant à la recherche"
                  : " dans la liste"}
              </p>
            </div>

            {data?.refreshedAt && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#83909b]">
                <Clock3 size={13} />

                Actualisé le{" "}
                {formatDateTime(
                  data.refreshedAt
                )}
              </span>
            )}
          </div>

          {/* ==================================================
              CHARGEMENT
          ================================================== */}

          {loading && !data ? (
            <div className="flex min-h-75 flex-col items-center justify-center gap-3">

              <LoaderCircle
                size={33}
                className="animate-spin text-[#087a32]"
              />

              <p className="text-xs font-medium text-[#738392]">
                Chargement des clients...
              </p>
            </div>
          ) : !data && error ? (
            <div className="flex min-h-62.5 flex-col items-center justify-center gap-3 px-5 text-center">
              <AlertCircle
                size={35}
                className="text-red-400"
              />

              <p className="text-xs text-[#728293]">
                La liste des clients n&apos;est pas disponible.
              </p>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex min-h-65 flex-col items-center justify-center px-5 py-10 text-center">

              <Users
                size={39}
                className="text-[#86b497]"
              />

              <h3 className="mt-4 text-sm font-black text-[#24374c]">
                {search
                  ? "Aucun client trouvé"
                  : "Aucun client enregistré"}
              </h3>

              <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#7e8b98]">
                {search
                  ? "Aucun client ne correspond à votre recherche."
                  : "Les clients enregistrés sur la plateforme apparaîtront automatiquement ici."}
              </p>

              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="mt-4 rounded-xl bg-[#087a32] px-4 py-2.5 text-xs font-bold text-white"
                >
                  Afficher tous les clients
                </button>
              )}
            </div>
          ) : (
            <>

              {/* ================================================
                  TABLEAU PC
              ================================================ */}

              <div className="hidden overflow-x-auto lg:block">

                <table className="w-full min-w-190 border-collapse text-left">

                  <thead className="border-b border-[#e7ede9] bg-[#f7f9f8]">

                    <tr className="text-[11px] font-extrabold uppercase tracking-wide text-[#778593]">

                      <th
                        scope="col"
                        className="px-5 py-4"
                      >
                        Client
                      </th>

                      <th
                        scope="col"
                        className="px-5 py-4"
                      >
                        Adresse email
                      </th>

                      <th
                        scope="col"
                        className="px-5 py-4"
                      >
                        Numéro de téléphone
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {clients.map(
                      (client) => (
                        <tr
                          key={client.id}
                          className="border-b border-[#edf1ee] transition hover:bg-[#fafdfa] last:border-0"
                        >

                          {/* NOM */}

                          <td className="px-5 py-4">

                            <div className="flex min-w-0 items-center gap-3">

                              <ClientAvatar
                                name={client.name}
                              />

                              <div className="min-w-0">

                                <p className="max-w-62.5 truncate text-[13px] font-black text-[#192a40]">
                                  {displayValue(
                                    client.name
                                  )}
                                </p>

                                {client.source ===
                                  "GUEST" && (
                                  <p className="mt-1 text-[11px] text-[#84919c]">
                                    Achat sans compte
                                  </p>
                                )}

                              </div>

                            </div>
                          </td>

                          {/* EMAIL */}

                          <td className="px-5 py-4">

                            <div className="flex min-w-0 items-center gap-2">

                              <Mail
                                size={16}
                                className="shrink-0 text-[#8a9aa5]"
                              />

                              <span className="max-w-77.5 break-all text-[13px] font-semibold text-[#405268]">
                                {displayValue(
                                  client.email
                                )}
                              </span>

                            </div>
                          </td>

                          {/* TÉLÉPHONE */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2">

                              <Phone
                                size={16}
                                className="shrink-0 text-[#8a9aa5]"
                              />

                              <span className="text-[13px] font-semibold text-[#405268]">
                                {displayValue(
                                  client.phoneE164
                                )}
                              </span>

                            </div>
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>
                </table>
              </div>

              {/* ================================================
                  CARTES MOBILE ET TABLETTE
              ================================================ */}

              <div className="divide-y divide-[#ecf0ed] lg:hidden">

                {clients.map(
                  (client) => (
                    <article
                      key={client.id}
                      className="p-4 sm:p-5"
                    >

                      {/* CLIENT */}

                      <div className="flex min-w-0 items-center gap-3">

                        <ClientAvatar
                          name={client.name}
                        />

                        <div className="min-w-0 flex-1">

                          <p className="wrap-break-word text-sm font-black text-[#192b40]">
                            {displayValue(
                              client.name
                            )}
                          </p>

                          {client.source ===
                            "GUEST" && (
                            <p className="mt-1 text-[11px] text-[#84919c]">
                              Achat sans compte
                            </p>
                          )}
                        </div>
                      </div>

                      {/* COORDONNÉES */}

                      <div className="mt-4 space-y-3 rounded-xl bg-[#f7f9f8] p-3">

                        {/* EMAIL */}

                        <div className="flex min-w-0 items-start gap-3">

                          <Mail
                            size={17}
                            className="mt-0.5 shrink-0 text-[#087a32]"
                          />

                          <div className="min-w-0 flex-1">

                            <p className="text-[11px] font-semibold text-[#84919c]">
                              Adresse email
                            </p>

                            <p className="mt-1 break-all text-[13px] font-bold text-[#32465a]">
                              {displayValue(
                                client.email
                              )}
                            </p>

                          </div>
                        </div>

                        <div className="border-t border-[#e6ece8]" />

                        {/* TÉLÉPHONE */}

                        <div className="flex min-w-0 items-start gap-3">

                          <Phone
                            size={17}
                            className="mt-0.5 shrink-0 text-[#087a32]"
                          />

                          <div className="min-w-0 flex-1">

                            <p className="text-[11px] font-semibold text-[#84919c]">
                              Numéro de téléphone
                            </p>

                            <p className="mt-1 wrap-break-word text-[13px] font-bold text-[#32465a]">
                              {displayValue(
                                client.phoneE164
                              )}
                            </p>

                          </div>
                        </div>

                      </div>

                    </article>
                  )
                )}

              </div>

            </>
          )}

          {/* ==================================================
              PAGINATION
          ================================================== */}

          {pagination &&
            pagination.total > 0 && (
              <div className="flex flex-col gap-3 border-t border-[#e7ede9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">

                <p className="text-center text-xs text-[#7b8996] sm:text-left">
                  {start}–{end} sur{" "}

                  <strong className="text-[#293b50]">
                    {formatNumber(
                      pagination.total
                    )}
                  </strong>{" "}

                  clients
                </p>

                <div className="flex items-center justify-center gap-2">

                  {/* PRÉCÉDENT */}

                  <button
                    type="button"
                    aria-label="Page précédente"
                    disabled={
                      !pagination.hasPreviousPage ||
                      loading
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce6df] bg-white text-[#405268] transition hover:bg-[#f2f7f3] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {/* PAGE */}

                  <span className="min-w-28.75 text-center text-xs font-extrabold text-[#26394e]">
                    Page{" "}
                    {pagination.page}
                    {" / "}
                    {Math.max(
                      pagination.totalPages,
                      1
                    )}
                  </span>

                  {/* SUIVANT */}

                  <button
                    type="button"
                    aria-label="Page suivante"
                    disabled={
                      !pagination.hasNextPage ||
                      loading
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          current + 1
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce6df] bg-white text-[#405268] transition hover:bg-[#f2f7f3] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={18} />
                  </button>

                </div>
              </div>
            )}

        </section>

        {/* ======================================================
            INFORMATIONS EN BAS DE PAGE
        ====================================================== */}

        

      </div>
    </main>
  );
}
