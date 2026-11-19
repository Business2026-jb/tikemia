
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ScanLine, Camera, Zap, Volume2, VolumeX, Play } from "lucide-react";
import { BrowserQRCodeReader } from "@zxing/browser";

/**
 * ============================================================
 * TIKEMIA — SCANNER QR AUTOMATIQUE
 * ============================================================
 *
 * Fichier :
 * src/components/scanner/TicketScanner.tsx
 *
 * Fonctionnement :
 * - Démarrage après sélection de l'événement
 * - Caméra arrière privilégiée
 * - Lecture continue des QR codes
 * - Vérification auprès de PostgreSQL via API
 * - Résultat automatique sans bouton "suivant"
 * - Protection contre les lectures répétitives
 * - Lampe si disponible
 * - Changement de caméra
 * - Arrêt et redémarrage
 * - Gestion des erreurs réseau
 * - Français / anglais
 * - Compatible mobile / tablette / ordinateur
 *
 * SÉCURITÉ :
 * - Aucune validation locale de billet
 * - Aucune clé secrète dans le navigateur
 * - Aucun stockage des QR codes
 * - Aucune acceptation sans confirmation serveur
 * - Une vérification en cours à la fois
 *
 * API :
 * POST /api/organizer/scan/verify
 *
 * ============================================================
 */

/* ============================================================
   TYPES
============================================================ */

export type ScannerLocale = "fr" | "en";

export type ScanResultCode =
  | "VALID"
  | "ALREADY_USED"
  | "INVALID"
  | "WRONG_EVENT"
  | "CANCELLED"
  | "EXPIRED"
  | "BLOCKED"
  | "TRANSFERRED"
  | "TRANSFER_PENDING"
  | "UNPAID"
  | "UNAUTHORIZED";

export type ScannedTicket = {
  id: string;
  number: string;
  eventId: string;
  eventTitle: string;
  category: string;
  holder: string | null;
  usedAt: string | null;
};

export type ScanResult = {
  success: boolean;
  allowed: boolean;
  code: ScanResultCode;
  message: string;
  description: string;
  scannedAt: string;
  ticket: ScannedTicket | null;
};

export type TicketScannerProps = {
  eventId: string;
  locale?: ScannerLocale;
  onResult?: (result: ScanResult) => void;
  compact?: boolean;
  onPending?: () => void;
};

type CameraControls = {
  stop: () => void;
  switchTorch?: (enabled: boolean) => Promise<void>;
};

type FacingMode = "environment" | "user";

type CameraStatus =
  | "starting"
  | "ready"
  | "stopped"
  | "error";

type FeedbackTone =
  | "success"
  | "warning"
  | "error";

type Feedback = {
  tone: FeedbackTone;
  title: string;
  description: string;
  ticketNumber?: string;
};

type ServerError = {
  success?: unknown;
  allowed?: unknown;
  code?: unknown;
  message?: unknown;
};

/* ============================================================
   CONFIGURATION
============================================================ */

const VERIFY_ENDPOINT =
  "/api/organizer/scan/verify";

const RESULT_DISPLAY_MS = 1400;

const SAME_QR_COOLDOWN_MS = 6000;

const NETWORK_TIMEOUT_MS = 12000;

const MAX_QR_LENGTH = 512;

const MAX_TRACKED_QR = 150;

const VALID_RESULT_CODES = new Set<string>([
  "VALID",
  "ALREADY_USED",
  "INVALID",
  "WRONG_EVENT",
  "CANCELLED",
  "EXPIRED",
  "BLOCKED",
  "TRANSFERRED",
  "TRANSFER_PENDING",
  "UNPAID",
  "UNAUTHORIZED",
]);

/* ============================================================
   TRADUCTIONS
============================================================ */

const TRANSLATIONS = {
  fr: {
    title: "Scanner les billets",
    subtitle: "Lecture QR automatique en continu",
    cameraStarting: "Ouverture de la caméra...",
    cameraReady: "Caméra active",
    cameraStopped: "Caméra arrêtée",
    cameraError: "Caméra indisponible",
    pointCamera: "Présentez un QR code devant la caméra",
    scanning: "En attente d'un billet",
    verifying: "Vérification du billet...",
    start: "Démarrer la caméra",
    stop: "Arrêter la caméra",
    switchCamera: "Changer de caméra",
    torchOn: "Allumer la lampe",
    torchOff: "Éteindre la lampe",
    cameraPermission:
      "Autorisez l'accès à la caméra dans votre navigateur.",
    cameraMissing:
      "Aucune caméra utilisable n'a été détectée.",
    cameraBusy:
      "La caméra est utilisée par une autre application.",
    cameraGeneral:
      "Impossible de démarrer la caméra. Vérifiez les autorisations.",
    secureContext:
      "La caméra nécessite HTTPS ou localhost.",
    networkError:
      "Connexion indisponible. Billet non validé.",
    timeout:
      "Le serveur ne répond pas. Billet non validé.",
    serverError:
      "Vérification impossible. Réessayez ce billet.",
    sessionExpired:
      "Session expirée. Reconnectez-vous.",
    accessDenied:
      "Vous n'êtes pas autorisé à scanner cet événement.",
    valid: "Billet valide",
    invalid: "Billet refusé",
    ticket: "Billet",
    category: "Catégorie",
    holder: "Titulaire",
    verified: "Entrées validées",
    rejected: "Billets refusés",
    continuous: "Scan automatique activé",
    hint: "Le prochain billet est détecté automatiquement.",
    soundOn: "Activer le son",
    soundOff: "Couper le son",
    retry: "Réessayer",
  },

  en: {
    title: "Ticket scanner",
    subtitle: "Continuous automatic QR scanning",
    cameraStarting: "Starting camera...",
    cameraReady: "Camera active",
    cameraStopped: "Camera stopped",
    cameraError: "Camera unavailable",
    pointCamera: "Place a QR code in front of the camera",
    scanning: "Waiting for a ticket",
    verifying: "Verifying ticket...",
    start: "Start camera",
    stop: "Stop camera",
    switchCamera: "Switch camera",
    torchOn: "Turn flashlight on",
    torchOff: "Turn flashlight off",
    cameraPermission:
      "Allow camera access in your browser.",
    cameraMissing:
      "No usable camera was detected.",
    cameraBusy:
      "The camera is being used by another application.",
    cameraGeneral:
      "Unable to start camera. Check its permissions.",
    secureContext:
      "Camera access requires HTTPS or localhost.",
    networkError:
      "Connection unavailable. Ticket not validated.",
    timeout:
      "Server timeout. Ticket not validated.",
    serverError:
      "Verification failed. Please scan this ticket again.",
    sessionExpired:
      "Session expired. Please sign in again.",
    accessDenied:
      "You are not authorized to scan this event.",
    valid: "Valid ticket",
    invalid: "Ticket rejected",
    ticket: "Ticket",
    category: "Category",
    holder: "Holder",
    verified: "Validated entries",
    rejected: "Rejected tickets",
    continuous: "Automatic scanning enabled",
    hint: "The next ticket is detected automatically.",
    soundOn: "Enable sound",
    soundOff: "Mute sound",
    retry: "Retry",
  },
} as const;

/* ============================================================
   UTILITAIRES
============================================================ */

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isScanResult(
  value: unknown,
): value is ScanResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.success === "boolean" &&
    typeof value.allowed === "boolean" &&
    typeof value.code === "string" &&
    VALID_RESULT_CODES.has(value.code) &&
    typeof value.message === "string" &&
    typeof value.description === "string" &&
    typeof value.scannedAt === "string" &&
    (value.ticket === null ||
      (
        isRecord(value.ticket) &&
        typeof value.ticket.id === "string" &&
        typeof value.ticket.number === "string"
      ))
  );
}

function getCameraError(
  error: unknown,
  locale: ScannerLocale,
): string {
  const t = TRANSLATIONS[locale];

  if (!window.isSecureContext) {
    return t.secureContext;
  }

  if (
    error instanceof DOMException &&
    (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError" ||
      error.name === "SecurityError"
    )
  ) {
    return t.cameraPermission;
  }

  if (
    error instanceof DOMException &&
    (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    )
  ) {
    return t.cameraMissing;
  }

  if (
    error instanceof DOMException &&
    (
      error.name === "NotReadableError" ||
      error.name === "TrackStartError"
    )
  ) {
    return t.cameraBusy;
  }

  return t.cameraGeneral;
}

function makeFeedback(
  result: ScanResult,
): Feedback {
  const tone: FeedbackTone = result.allowed
    ? "success"
    : result.code === "ALREADY_USED" ||
        result.code === "TRANSFER_PENDING" ||
        result.code === "TRANSFERRED"
      ? "warning"
      : "error";

  return {
    tone,
    title: result.message,
    description: result.description,
    ticketNumber: result.ticket?.number,
  };
}

function playSignal(
  allowed: boolean,
): void {
  try {
    const AudioContextClass =
      window.AudioContext;

    if (!AudioContextClass) {
      return;
    }

    const context = new AudioContextClass();

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.type = "sine";
    oscillator.frequency.value = allowed ? 880 : 300;

    const start = context.currentTime;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      0.08,
      start + 0.015,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + 0.13,
    );

    oscillator.start(start);
    oscillator.stop(start + 0.14);

    oscillator.onended = () => {
      void context.close().catch(() => {});
    };
  } catch {
    // Le son est facultatif.
  }
}

function vibrate(
  allowed: boolean,
): void {
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(
        allowed ? 70 : [90, 60, 90],
      );
    }
  } catch {
    // La vibration est facultative.
  }
}

/* ============================================================
   COMPOSANT PRINCIPAL
============================================================ */

export default function TicketScanner({
  eventId,
  locale = "fr",
  onResult,
  compact = false,
  onPending,
}: TicketScannerProps) {
  const language: ScannerLocale =
    locale === "en" ? "en" : "fr";

  const t = TRANSLATIONS[language];

  /* ==========================================================
     RÉFÉRENCES
  ========================================================== */

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const controlsRef =
    useRef<CameraControls | null>(null);

  const requestRef =
    useRef<AbortController | null>(null);

  const processingRef = useRef(false);

  const mountedRef = useRef(true);

  const generationRef = useRef(0);

  const feedbackTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastScansRef =
    useRef<Map<string, number>>(new Map());

  const onResultRef = useRef(onResult);
  const onPendingRef = useRef(onPending);

  const soundEnabledRef = useRef(false);

  /* ==========================================================
     ÉTATS
  ========================================================== */

  const [enabled, setEnabled] = useState(true);

  const [pageVisible, setPageVisible] =
    useState(true);

  const [cameraStatus, setCameraStatus] =
    useState<CameraStatus>("starting");

  const [cameraError, setCameraError] =
    useState<string | null>(null);

  const [facingMode, setFacingMode] =
    useState<FacingMode>("environment");

  const [torchSupported, setTorchSupported] =
    useState(false);

  const [torchEnabled, setTorchEnabled] =
    useState(false);

  const [verifying, setVerifying] =
    useState(false);

  const [feedback, setFeedback] =
    useState<Feedback | null>(null);

  const [lastTicket, setLastTicket] =
    useState<ScannedTicket | null>(null);

  const [acceptedCount, setAcceptedCount] =
    useState(0);

  const [rejectedCount, setRejectedCount] =
    useState(0);

  const [soundEnabled, setSoundEnabled] =
    useState(false);

  /* ==========================================================
     SYNCHRONISATION DES CALLBACKS
  ========================================================== */

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  useEffect(() => { onPendingRef.current = onPending; }, [onPending]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  /* ==========================================================
     NETTOYAGE GÉNÉRAL
  ========================================================== */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      generationRef.current += 1;

      requestRef.current?.abort();

      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
      }

      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  /* ==========================================================
     CHANGEMENT D'ÉVÉNEMENT
  ========================================================== */

  useEffect(() => {
    generationRef.current += 1;

    requestRef.current?.abort();

    processingRef.current = false;

    lastScansRef.current.clear();

    if (feedbackTimerRef.current !== null) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    const reset = window.setTimeout(() => {setFeedback(null);setLastTicket(null);setAcceptedCount(0);setRejectedCount(0);setVerifying(false);setEnabled(true);}, 0);
    return () => window.clearTimeout(reset);
  }, [eventId]);

  /* ==========================================================
     VISIBILITÉ DE LA PAGE
  ========================================================== */

  useEffect(() => {
    const handleVisibility = () => {
      setPageVisible(
        document.visibilityState === "visible",
      );
    };

    handleVisibility();

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
    };
  }, []);

  /* ==========================================================
     AFFICHAGE TEMPORAIRE DU RÉSULTAT
  ========================================================== */

  const showFeedback = useCallback(
    (next: Feedback) => {
      if (!mountedRef.current) {
        return;
      }

      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
      }

      setFeedback(next);

      feedbackTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setFeedback(null);
        }

        feedbackTimerRef.current = null;
      }, RESULT_DISPLAY_MS);
    },
    [],
  );

  /* ==========================================================
     VÉRIFICATION SERVEUR
  ========================================================== */

  const verifyQrCode = useCallback(
    async (qrCode: string) => {
      if (
        !eventId ||
        !qrCode ||
        qrCode.length > MAX_QR_LENGTH ||
        processingRef.current
      ) {
        return;
      }

      const now = Date.now();

      const previousScan =
        lastScansRef.current.get(qrCode);

      /**
       * Empêcher la lecture répétitive
       * du même QR toujours devant la caméra.
       *
       * Un QR différent peut être traité
       * dès que la requête précédente se termine.
       */
      if (
        previousScan !== undefined &&
        now - previousScan < SAME_QR_COOLDOWN_MS
      ) {
        return;
      }

      if (
        lastScansRef.current.size >=
        MAX_TRACKED_QR
      ) {
        const oldest = lastScansRef.current.keys().next();

        if (!oldest.done) {
          lastScansRef.current.delete(oldest.value);
        }
      }

      lastScansRef.current.set(qrCode, now);

      processingRef.current = true;
      setFeedback(null);
      onPendingRef.current?.();
      setVerifying(true);

      const generation = generationRef.current;

      const controller = new AbortController();
      requestRef.current = controller;

      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, NETWORK_TIMEOUT_MS);

      try {
        const response = await fetch(
          VERIFY_ENDPOINT,
          {
            method: "POST",

            credentials: "same-origin",

            cache: "no-store",

            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "Accept-Language": language,
            },

            body: JSON.stringify({
              eventId,
              qrCode,
              locale: language,
            }),

            signal: controller.signal,
          },
        );

        const payload: unknown =
          await response.json();

        if (
          !mountedRef.current ||
          generation !== generationRef.current
        ) {
          return;
        }

        /* ==================================================
           ERREURS HTTP
        ================================================== */

        if (!response.ok) {
          const serverError: ServerError =
            isRecord(payload) ? payload : {};

          const message =
            response.status === 401
              ? t.sessionExpired
              : response.status === 403
                ? t.accessDenied
                : typeof serverError.message === "string"
                  ? serverError.message
                  : t.serverError;

          showFeedback({
            tone: "error",
            title: t.invalid,
            description: message,
          });

          /**
           * Session expirée ou accès refusé :
           * on arrête la caméra pour éviter
           * des validations répétées inutiles.
           */
          if (
            response.status === 401 ||
            response.status === 403
          ) {
            setEnabled(false);
          }

          return;
        }

        /* ==================================================
           VALIDATION STRICTE DE LA RÉPONSE
        ================================================== */

        if (!isScanResult(payload)) {
          throw new Error("INVALID_SCAN_RESPONSE");
        }

        /**
         * Protection supplémentaire :
         * seul un résultat VALID explicitement
         * autorisé est traité comme accepté.
         */
        const accepted =
          payload.code === "VALID" &&
          payload.allowed === true &&
          payload.success === true;

        const result: ScanResult = {
          ...payload,
          allowed: accepted,
          success: accepted,
        };

        /* ==================================================
           COMPTEURS DE LA SESSION LOCALE
        ================================================== */

        if (accepted) {
          setAcceptedCount(
            (previous) => previous + 1,
          );
        } else {
          setRejectedCount(
            (previous) => previous + 1,
          );
        }

        setLastTicket(result.ticket);

        /* ==================================================
           AFFICHAGE ET RETOUR
        ================================================== */

        showFeedback(makeFeedback(result));

        if (soundEnabledRef.current) {
          playSignal(accepted);
        }

        vibrate(accepted);

        /**
         * Informe la page organisateur.
         *
         * La page pourra mettre à jour ses
         * statistiques sans relancer la caméra.
         */
        try {
          onResultRef.current?.(result);
        } catch {
          // Une erreur d'affichage dans le parent
          // ne doit pas arrêter le scanner.
        }
      } catch {
        if (
          !mountedRef.current ||
          generation !== generationRef.current
        ) {
          return;
        }

        if (controller.signal.aborted && !timedOut) {
          return;
        }

        showFeedback({
          tone: "error",
          title: t.invalid,
          description: timedOut
            ? t.timeout
            : t.networkError,
        });
      } finally {
        clearTimeout(timeout);

        if (requestRef.current === controller) {
          requestRef.current = null;
        }

        if (
          mountedRef.current &&
          generation === generationRef.current
        ) {
          processingRef.current = false;
          setVerifying(false);
        }
      }
    },
    [
      eventId,
      language,
      showFeedback,
      t.accessDenied,
      t.invalid,
      t.networkError,
      t.serverError,
      t.sessionExpired,
      t.timeout,
    ],
  );

  /* ==========================================================
     DÉMARRAGE ET ARRÊT DE LA CAMÉRA
  ========================================================== */

  useEffect(() => {
    if (
      !enabled ||
      !pageVisible ||
      !eventId
    ) {
      controlsRef.current?.stop();
      controlsRef.current = null;

      const reset = window.setTimeout(() => {setTorchSupported(false);setTorchEnabled(false);setCameraStatus("stopped");},0);
      return () => window.clearTimeout(reset);
    }

    const video = videoRef.current;

    if (!video) {
      return;
    }

    let cancelled = false;

    let localControls: CameraControls | null = null;

    async function startCamera() {
      setCameraStatus("starting");setCameraError(null);setTorchSupported(false);setTorchEnabled(false);
      if (
        !navigator.mediaDevices?.getUserMedia ||
        !window.isSecureContext
      ) {
        if (!cancelled) {
          setCameraError(
            !window.isSecureContext
              ? t.secureContext
              : t.cameraMissing,
          );
          setCameraStatus("error");
        }

        return;
      }

      try {
        const reader = new BrowserQRCodeReader(
          undefined,
          {
            delayBetweenScanAttempts: 100,
            delayBetweenScanSuccess: 120,
          },
        );

        /**
         * Caméra arrière privilégiée.
         *
         * facingMode idéal :
         * le navigateur peut choisir une
         * caméra disponible en alternative.
         */
        const controls =
          await reader.decodeFromConstraints(
            {
              audio: false,

              video: {
                facingMode: {
                  ideal: facingMode,
                },

                width: {
                  ideal: 1280,
                },

                height: {
                  ideal: 720,
                },
              },
            },

            video ?? undefined,

            (result) => {
              if (
                cancelled ||
                !result ||
                !mountedRef.current
              ) {
                return;
              }

              const value = result.getText();

              if (value) {
                void verifyQrCode(value);
              }
            },
          );

        if (cancelled) {
          controls.stop();
          return;
        }

        localControls = controls;
        controlsRef.current = controls;

        setTorchSupported(
          typeof controls.switchTorch === "function",
        );

        setCameraStatus("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCameraError(
          getCameraError(error, language),
        );

        setCameraStatus("error");
      }
    }

    const start = window.setTimeout(() => {void startCamera();},0);

    return () => {
      window.clearTimeout(start);
      cancelled = true;

      if (localControls) {
        localControls.stop();
      }

      if (controlsRef.current === localControls) {
        controlsRef.current = null;
      }
    };
  }, [
    enabled,
    pageVisible,
    eventId,
    facingMode,
    language,
    verifyQrCode,
    t.cameraMissing,
    t.secureContext,
  ]);

  /* ==========================================================
     ACTIONS CAMÉRA
  ========================================================== */

  const stopCamera = useCallback(() => {
    setEnabled(false);
    setTorchEnabled(false);
  }, []);

  const startCamera = useCallback(() => {
    setCameraError(null);
    setEnabled(true);
  }, []);

  const switchCamera = useCallback(() => {
    setTorchEnabled(false);

    setFacingMode((previous) =>
      previous === "environment"
        ? "user"
        : "environment",
    );
  }, []);

  const toggleTorch = useCallback(async () => {
    const controls = controlsRef.current;

    if (!controls?.switchTorch) {
      return;
    }

    const nextValue = !torchEnabled;

    try {
      await controls.switchTorch(nextValue);
      setTorchEnabled(nextValue);
    } catch {
      setTorchSupported(false);
      setTorchEnabled(false);
    }
  }, [torchEnabled]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((previous) => !previous);
  }, []);

  /* ==========================================================
     COULEURS DU RÉSULTAT
  ========================================================== */

  const feedbackStyle =
    feedback?.tone === "success"
      ? {
          background: "#EAF8ED",
          border: "#B7E7C2",
          color: "#087A32",
        }
      : feedback?.tone === "warning"
        ? {
            background: "#FFF6E5",
            border: "#F5D69A",
            color: "#995A00",
          }
        : {
            background: "#FDECEC",
            border: "#F2B8B8",
            color: "#B42318",
          };

  /* ==========================================================
     AFFICHAGE
  ========================================================== */

  return (
    <section
      aria-label={t.title}
      className="flex w-full min-w-0 flex-col gap-4"
    >
      {/* =====================================================
          EN-TÊTE
      ===================================================== */}

      {!compact && <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#142138]">
            {t.title}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {t.subtitle}
          </p>
        </div>

        <div
          className="
            inline-flex items-center gap-2
            rounded-full border border-green-100
            bg-green-50 px-3 py-2
            text-xs font-semibold text-[#087A32]
          "
        >
          <span
            className="
              h-2 w-2 rounded-full
              bg-[#087A32]
            "
          />

          {t.continuous}
        </div>
      </div>}

      {/* =====================================================
          CAMÉRA
      ===================================================== */}

      <div
        className="
          relative w-full overflow-hidden
          rounded-2xl bg-[#081521]
          shadow-lg
        "
      >
        <div className="relative aspect-square w-full sm:aspect-4/3 lg:aspect-4/5 lg:max-h-[65dvh]">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label={t.title}
            className="
              absolute inset-0
              h-full w-full
              object-cover
            "
          />

          {/* Cadre de visée */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="
                relative
                h-48 w-48
                sm:h-64 sm:w-64
              "
            >
              {/* Coins du cadre */}
              <span className="absolute left-0 top-0 h-11 w-11 rounded-tl-xl border-l-4 border-t-4 border-white" />
              <span className="absolute right-0 top-0 h-11 w-11 rounded-tr-xl border-r-4 border-t-4 border-white" />
              <span className="absolute bottom-0 left-0 h-11 w-11 rounded-bl-xl border-b-4 border-l-4 border-white" />
              <span className="absolute bottom-0 right-0 h-11 w-11 rounded-br-xl border-b-4 border-r-4 border-white" />

              {/* Ligne centrale */}
              {cameraStatus === "ready" && !verifying && (
                <span
                  className="
                    absolute left-4 right-4 top-1/2
                    h-0.5 bg-[#38D66B]
                    shadow-[0_0_12px_rgba(56,214,107,0.8)]
                  "
                />
              )}
            </div>
          </div>

          {/* État de la caméra */}
          <div className="absolute left-3 top-3 rounded-full bg-black/65 px-3 py-2 text-xs font-semibold text-white">
            {cameraStatus === "ready"
              ? t.cameraReady
              : cameraStatus === "starting"
                ? t.cameraStarting
                : cameraStatus === "stopped"
                  ? t.cameraStopped
                  : t.cameraError}
          </div>

          {/* Vérification en cours */}
          {verifying && !feedback && (
            <div
              className="
                absolute inset-x-4 bottom-16
                rounded-xl bg-black/75
                px-4 py-3 text-center
                text-sm font-semibold text-white
              "
            >
              {t.verifying}
            </div>
          )}

          {/* Résultat du scan */}
          {feedback && (!compact || feedback.tone !== "success") && (
            <div
              aria-live="polite"
              className="
                absolute inset-x-3 bottom-3
                rounded-xl border-2
                p-4 text-center shadow-xl
              "
              style={{
                backgroundColor:
                  feedbackStyle.background,
                borderColor:
                  feedbackStyle.border,
                color:
                  feedbackStyle.color,
              }}
            >
              <div className="text-xl font-extrabold">
                {feedback.title}
              </div>

              <p className="mt-1 text-sm font-medium">
                {feedback.description}
              </p>

              {feedback.ticketNumber && (
                <p className="mt-2 text-xs font-semibold">
                  {feedback.ticketNumber}
                </p>
              )}
            </div>
          )}

          {/* Message caméra inactive */}
          {cameraStatus !== "ready" &&
            cameraStatus !== "starting" &&
            !feedback && (
              <div
                className="
                  absolute inset-0
                  flex items-center justify-center
                  bg-[#081521]/90 px-5
                "
              >
                <div className="max-w-sm text-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                    className="mx-auto h-12 w-12 text-white/80"
                  >
                    <path d="M14 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="m16 4 4 4m0-4-4 4" />
                  </svg>

                  <p className="mt-3 text-sm font-semibold text-white">
                    {cameraError || t.cameraStopped}
                  </p>

                  <button
                    type="button"
                    onClick={startCamera}
                    className="
                      mt-4 rounded-lg
                      bg-[#087A32]
                      px-5 py-3
                      text-sm font-semibold text-white
                      hover:bg-[#06652A]
                    "
                  >
                    {t.retry}
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* =================================================
            COMMANDES CAMÉRA
        ================================================= */}

        <div className="flex items-center justify-center gap-2 border-t border-slate-100 bg-white p-2 sm:gap-5 sm:p-3">
          <button type="button" onClick={()=>void toggleTorch()} disabled={!torchSupported||cameraStatus!=="ready"} aria-pressed={torchEnabled} aria-label={torchEnabled?t.torchOff:t.torchOn} className="flex min-w-12 flex-col items-center gap-1 text-xs font-semibold text-slate-800 disabled:opacity-40"><span className={`flex size-10 items-center justify-center rounded-full border sm:size-12 border-slate-200 shadow-sm ${torchEnabled?"bg-amber-100":"bg-white"}`}><Zap size={23}/></span>{language==="en"?"Light":"Lampe"}</button>
          <button type="button" onClick={enabled?stopCamera:startCamera} aria-label={enabled?t.stop:t.start} aria-pressed={enabled} className="flex min-w-12 flex-col items-center gap-1 text-xs font-bold text-green-800"><span className="flex size-14 items-center justify-center rounded-full bg-green sm:size-16-700 text-white shadow-sm">{enabled?<ScanLine size={30}/>:<Play size={28}/>}</span>{enabled?(language==="en"?"Pause":"Scanner"):(language==="en"?"Start":"Scanner")}</button>
          <button type="button" onClick={switchCamera} disabled={cameraStatus!=="ready"} aria-label={t.switchCamera} className="flex min-w-12 flex-col items-center gap-1 text-xs font-semibold text-slate-800 disabled:opacity-40"><span className="flex size-10 items-center justify-center rounded-full border sm:size-12 border-slate-200 bg-white shadow-sm"><Camera size={23}/></span>{language==="en"?"Camera":"Caméra"}</button>
          <button type="button" onClick={toggleSound} aria-label={soundEnabled?t.soundOff:t.soundOn} aria-pressed={soundEnabled} className="flex size-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100">{soundEnabled?<Volume2 size={20}/>:<VolumeX size={20}/>}</button>
        </div>
      </div>

      {/* =====================================================
          STATISTIQUES LOCALES
      ===================================================== */}

      {!compact && <div className="grid grid-cols-2 gap-3">
        <div
          className="
            rounded-xl border border-green-100
            bg-green-50 p-4
          "
        >
          <p className="text-xs font-medium text-green-800">
            {t.verified}
          </p>

          <p className="mt-2 text-3xl font-bold text-[#087A32]">
            {acceptedCount}
          </p>
        </div>

        <div
          className="
            rounded-xl border border-red-100
            bg-red-50 p-4
          "
        >
          <p className="text-xs font-medium text-red-800">
            {t.rejected}
          </p>

          <p className="mt-2 text-3xl font-bold text-red-700">
            {rejectedCount}
          </p>
        </div>
      </div>}

      {/* =====================================================
          DERNIER BILLET
      ===================================================== */}

      {!compact && lastTicket && (
        <div
          className="
            rounded-xl border border-slate-200
            bg-white p-4 shadow-sm
          "
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">
                {t.ticket}
              </p>

              <p className="mt-1 break-all text-sm font-semibold text-[#142138]">
                {lastTicket.number}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                {t.category}
              </p>

              <p className="mt-1 text-sm font-semibold text-[#142138]">
                {lastTicket.category}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                {t.holder}
              </p>

              <p className="mt-1 text-sm font-semibold text-[#142138]">
                {lastTicket.holder || "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          INFORMATION
      ===================================================== */}

      {!compact && <p className="text-center text-xs text-slate-500">{t.hint}</p>}
    </section>
  );
}
