"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Loader2,
  MapPin,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  TicketCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

import ScannerCamera from "@/components/scanner/scanner-camera";
import ScannerEventCard, {
  type ScannerEventItem,
} from "@/components/scanner/scanner-event-card";
import ScannerHeader from "@/components/scanner/scanner-header";
import ScannerHistoryList, {
  type ScannerHistoryItem,
} from "@/components/scanner/scanner-history-list";
import ScannerManualCodeForm from "@/components/scanner/scanner-manual-code-form";
import ScannerResult, {
  type ScannerScanResult,
} from "@/components/scanner/scanner-result";
import ScannerStatistics from "@/components/scanner/scanner-statistics";

type ScannerAccessRole =
  | "ORGANIZER"
  | "SCANNER";

type ScannerAccessMode =
  | "ORGANIZER_OWNER"
  | "ASSIGNED_SCANNER";

type ScannerPageClientProps = {
  scanner: Readonly<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: ScannerAccessRole;
    accessMode?: ScannerAccessMode;
  }>;
  initialEvents?: readonly ScannerEventItem[];
  initialEventId?: string | null;
};

type ScannerEventApiItem =
  Omit<
    ScannerEventItem,
    "assignmentId" | "assignedAt"
  > & {
    assignmentId?: string | null;
    assignedAt?: string | null;
    accessSource?:
      | "ORGANIZER_OWNER"
      | "ASSIGNMENT";
  };

type ApiErrorPayload = {
  success?: boolean;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function getApiErrorMessage(
  payload: unknown,
  fallback: string,
): string {
  if (
    payload &&
    typeof payload ===
      "object"
  ) {
    const candidate =
      payload as ApiErrorPayload;

    return (
      normalizeText(
        candidate.error?.message,
      ) ||
      normalizeText(
        candidate.message,
      ) ||
      fallback
    );
  }

  return fallback;
}

function normalizeScannerEventItem(
  value: unknown,
  index: number,
): ScannerEventItem | null {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return null;
  }

  const item =
    value as
      ScannerEventApiItem;

  const eventId =
    normalizeText(
      item.event?.id,
    );

  if (!eventId) {
    return null;
  }

  const startsAt =
    normalizeText(
      item.event.startsAt,
    );

  return {
    ...item,

    assignmentId:
      normalizeText(
        item.assignmentId,
      ) ||
      `organizer-${eventId}-${index}`,

    assignedAt:
      normalizeText(
        item.assignedAt,
      ) ||
      startsAt ||
      new Date(0).toISOString(),
  } as ScannerEventItem;
}

function normalizeScannerEvents(
  value: unknown,
): ScannerEventItem[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value
    .map(
      (
        item,
        index,
      ) =>
        normalizeScannerEventItem(
          item,
          index,
        ),
    )
    .filter(
      (
        item,
      ): item is ScannerEventItem =>
        item !== null,
    );
}

function createDeviceId(): string {
  if (
    typeof window ===
    "undefined"
  ) {
    return "";
  }

  const storageKey =
    "tikemia_scanner_device_id";

  const existing =
    window.localStorage.getItem(
      storageKey,
    );

  if (existing) {
    return existing;
  }

  const value =
    typeof crypto !==
      "undefined" &&
    "randomUUID" in crypto
      ? crypto.randomUUID()
      : `scanner-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`;

  window.localStorage.setItem(
    storageKey,
    value,
  );

  return value;
}

function playFeedback(
  accepted: boolean,
): void {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    if (
      "vibrate" in
      navigator
    ) {
      navigator.vibrate(
        accepted
          ? [80]
          : [120, 60, 120],
      );
    }

    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const context =
      new AudioContextClass();

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.frequency.value =
      accepted
        ? 880
        : 220;

    gain.gain.value =
      0.05;

    oscillator.connect(
      gain,
    );

    gain.connect(
      context.destination,
    );

    oscillator.start();

    oscillator.stop(
      context.currentTime +
        0.12,
    );

    oscillator.addEventListener(
      "ended",
      () => {
        void context.close();
      },
      {
        once:
          true,
      },
    );
  } catch {
    // Le retour visuel reste suffisant.
  }
}

export default function ScannerPageClient({
  scanner,
  initialEvents = [],
  initialEventId = null,
}: ScannerPageClientProps) {
  const [
    events,
    setEvents,
  ] =
    useState<
      ScannerEventItem[]
    >([
      ...initialEvents,
    ]);

  const [
    selectedEventId,
    setSelectedEventId,
  ] =
    useState<
      string | null
    >(
      initialEventId ||
        initialEvents[0]
          ?.event.id ||
        null,
    );

  const [
    scanResult,
    setScanResult,
  ] =
    useState<
      ScannerScanResult | null
    >(null);

  const [
    history,
    setHistory,
  ] =
    useState<
      ScannerHistoryItem[]
    >([]);

  const [
    processing,
    setProcessing,
  ] =
    useState(false);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    loadingHistory,
    setLoadingHistory,
  ] =
    useState(false);

  const [
    online,
    setOnline,
  ] =
    useState(true);

  const [
    hydrated,
    setHydrated,
  ] =
    useState(false);

  const [
    globalError,
    setGlobalError,
  ] =
    useState("");

  const lastScanRef =
    useRef<{
      value: string;
      at: number;
    } | null>(null);


  const processingRef =
    useRef(false);

  const resultTimerRef =
    useRef<number | null>(
      null,
    );

  /*
   * Après un scan, on ne recharge plus les événements + l'historique
   * à chaque billet. Sur un gros flux, cela ferait deux requêtes
   * supplémentaires pour chaque personne.
   *
   * On limite les rafraîchissements de fond à une fois toutes les
   * 3 secondes par terminal. La validation du billet, elle, reste
   * immédiate et prioritaire.
   */
  const lastBackgroundRefreshRef =
    useRef(0);

  const backgroundRefreshTimerRef =
    useRef<number | null>(
      null,
    );

  const selectedEvent =
    useMemo(
      () =>
        events.find(
          (
            item,
          ) =>
            item.event.id ===
            selectedEventId,
        ) ??
        null,
      [
        events,
        selectedEventId,
      ],
    );

  const displayedOnline =
    hydrated
      ? online
      : true;

  const scannerName =
    `${scanner.firstName} ${scanner.lastName}`
      .replace(
        /\s+/g,
        " ",
      )
      .trim() ||
    scanner.email;

  const isOrganizer =
    scanner.role ===
      "ORGANIZER" ||
    scanner.accessMode ===
      "ORGANIZER_OWNER";

  useEffect(
    () => {
      return () => {
        if (
          resultTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            resultTimerRef.current,
          );
        }

        if (
          backgroundRefreshTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            backgroundRefreshTimerRef.current,
          );
        }
      };
    },
    [],
  );

  useEffect(
    () => {
      /*
       * Hydration-safe network state:
       * the server and first client render are identical.
       * navigator.onLine is read only after React mounts.
       */
      setHydrated(
        true,
      );

      const updateOnlineStatus =
        () => {
          setOnline(
            navigator.onLine,
          );
        };

      updateOnlineStatus();

      window.addEventListener(
        "online",
        updateOnlineStatus,
      );

      window.addEventListener(
        "offline",
        updateOnlineStatus,
      );

      return () => {
        window.removeEventListener(
          "online",
          updateOnlineStatus,
        );

        window.removeEventListener(
          "offline",
          updateOnlineStatus,
        );
      };
    },
    [],
  );

  const loadEvents =
    useCallback(
      async () => {
        setRefreshing(
          true,
        );

        setGlobalError("");

        try {
          const response =
            await fetch(
              "/api/scanner/events",
              {
                method:
                  "GET",
                credentials:
                  "include",
                cache:
                  "no-store",
                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const payload =
            await response.json();

          if (!response.ok) {
            throw new Error(
              getApiErrorMessage(
                payload,
                "Impossible de charger les événements.",
              ),
            );
          }

          const nextEvents =
            normalizeScannerEvents(
              payload.events,
            );

          setEvents(
            nextEvents,
          );

          setSelectedEventId(
            (
              current,
            ) => {
              if (
                current &&
                nextEvents.some(
                  (
                    item:
                      ScannerEventItem,
                  ) =>
                    item.event.id ===
                    current,
                )
              ) {
                return current;
              }

              return (
                nextEvents[0]
                  ?.event.id ??
                null
              );
            },
          );
        } catch (error) {
          setGlobalError(
            error instanceof Error
              ? error.message
              : "Impossible de charger les événements.",
          );
        } finally {
          setRefreshing(
            false,
          );
        }
      },
      [],
    );

  const loadHistory =
    useCallback(
      async (
        eventId: string,
      ) => {
        setLoadingHistory(
          true,
        );

        try {
          const response =
            await fetch(
              `/api/scanner/history?eventId=${encodeURIComponent(
                eventId,
              )}&limit=20`,
              {
                method:
                  "GET",
                credentials:
                  "include",
                cache:
                  "no-store",
                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const payload =
            await response.json();

          if (!response.ok) {
            throw new Error(
              getApiErrorMessage(
                payload,
                "Impossible de charger l’historique.",
              ),
            );
          }

          setHistory(
            Array.isArray(
              payload.items,
            )
              ? payload.items
              : Array.isArray(
                    payload.history,
                  )
                ? payload.history
                : [],
          );
        } catch {
          setHistory([]);
        } finally {
          setLoadingHistory(
            false,
          );
        }
      },
      [],
    );

  useEffect(
    () => {
      if (
        initialEvents.length ===
        0
      ) {
        void loadEvents();
      }
    },
    [
      initialEvents.length,
      loadEvents,
    ],
  );

  useEffect(
    () => {
      if (selectedEventId) {
        void loadHistory(
          selectedEventId,
        );
      } else {
        setHistory([]);
      }
    },
    [
      loadHistory,
      selectedEventId,
    ],
  );

  const scheduleBackgroundRefresh =
    useCallback(
      (
        eventId: string,
      ) => {
        const now =
          Date.now();

        const elapsed =
          now -
          lastBackgroundRefreshRef.current;

        const runRefresh =
          () => {
            lastBackgroundRefreshRef.current =
              Date.now();

            backgroundRefreshTimerRef.current =
              null;

            void Promise.allSettled([
              loadEvents(),
              loadHistory(
                eventId,
              ),
            ]);
          };

        if (
          elapsed >=
          3_000
        ) {
          runRefresh();
          return;
        }

        if (
          backgroundRefreshTimerRef.current !==
          null
        ) {
          return;
        }

        backgroundRefreshTimerRef.current =
          window.setTimeout(
            runRefresh,
            3_000 -
              elapsed,
          );
      },
      [
        loadEvents,
        loadHistory,
      ],
    );

  const submitScan =
    useCallback(
      async (
        value: string,
      ) => {
        const normalizedValue =
          normalizeText(
            value,
          );

        if (
          !normalizedValue ||
          !selectedEvent ||
          processingRef.current
        ) {
          return;
        }

        if (
          !hydrated
        ) {
          return;
        }

        if (!online) {
          setGlobalError(
            "Connexion réseau indisponible. Aucun billet n’a été consommé.",
          );
          return;
        }

        const now =
          Date.now();

        if (
          lastScanRef.current &&
          lastScanRef.current.value ===
            normalizedValue &&
          now -
            lastScanRef.current.at <
            1_400
        ) {
          return;
        }

        lastScanRef.current = {
          value:
            normalizedValue,
          at:
            now,
        };

        processingRef.current =
          true;

        setProcessing(
          true,
        );

        setGlobalError("");

        try {
          const response =
            await fetch(
              "/api/scanner/tickets/scan",
              {
                method:
                  "POST",
                credentials:
                  "include",
                headers: {
                  "Content-Type":
                    "application/json",
                  Accept:
                    "application/json",
                },
                body:
                  JSON.stringify({
                    eventId:
                      selectedEvent.event.id,
                    qrValue:
                      normalizedValue,
                    deviceId:
                      createDeviceId(),
                    deviceName:
                      navigator.userAgent,
                    gateName:
                      selectedEvent.gateName,
                  }),
              },
            );

          const payload =
            await response.json();

          if (!response.ok) {
            throw new Error(
              getApiErrorMessage(
                payload,
                "Le billet n’a pas pu être vérifié.",
              ),
            );
          }

          const result =
            (
              payload.scan ??
              payload.result ??
              payload
            ) as ScannerScanResult;

          if (
            resultTimerRef.current !==
            null
          ) {
            window.clearTimeout(
              resultTimerRef.current,
            );
          }

          setScanResult(
            result,
          );

          playFeedback(
            result.accepted,
          );

          resultTimerRef.current =
            window.setTimeout(
              () => {
                setScanResult(
                  null,
                );

                resultTimerRef.current =
                  null;
              },
              result.accepted
                ? 1_100
                : 1_700,
            );

          scheduleBackgroundRefresh(
            selectedEvent.event.id,
          );
        } catch (error) {
          setGlobalError(
            error instanceof Error
              ? error.message
              : "Le billet n’a pas pu être vérifié.",
          );
        } finally {
          processingRef.current =
            false;

          setProcessing(
            false,
          );
        }
      },
      [
        hydrated,
        online,
        scheduleBackgroundRefresh,
        selectedEvent,
      ],
    );

  const scanNext =
    () => {
      if (
        resultTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          resultTimerRef.current,
        );

        resultTimerRef.current =
          null;
      }

      setScanResult(
        null,
      );

      setGlobalError("");
    };

  const logout =
    async () => {
      try {
        await fetch(
          "/api/scanner/auth/logout",
          {
            method:
              "POST",
            credentials:
              "include",
          },
        );
      } finally {
        window.location.href =
          "/scanner/login";
      }
    };

  return (
    <div className="min-h-screen bg-[#03070a] text-white">
      <ScannerHeader
        scannerName={scannerName}
        eventTitle={
          selectedEvent?.event.title
        }
        gateName={
          selectedEvent?.gateName
        }
        online={
          displayedOnline
        }
        refreshing={refreshing}
        onRefresh={() => {
          void Promise.all([
            loadEvents(),
            selectedEventId
              ? loadHistory(
                  selectedEventId,
                )
              : Promise.resolve(),
          ]);
        }}
        onLogout={() =>
          void logout()
        }
      />

      <main className="w-full px-3 pb-8 pt-3 sm:px-5 sm:pb-10 sm:pt-4 lg:px-6">
        {events.length ===
        0 ? (
          <div className="mx-auto max-w-2xl rounded-[28px] border border-dashed border-white/[0.10] bg-[#071015] p-8 text-center">
            {refreshing ? (
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-lime-400" />
            ) : (
              <ShieldCheck className="mx-auto h-12 w-12 text-white/[0.12]" />
            )}

            <h2 className="mt-5 text-xl font-black text-white">
              Aucun événement affecté
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">
              {isOrganizer
                ? "Aucun événement publié ou terminé n’est encore disponible dans votre espace organisateur."
                : "Votre compte scanner doit être affecté à un événement actif par l’organisateur ou l’administrateur."}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadEvents()
              }
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/[0.08] px-5 text-sm font-black text-lime-300"
            >
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </button>
          </div>
        ) : selectedEvent ? (
          <div className="mx-auto w-full max-w-[1500px]">
            {/*
             * ZONE OPÉRATIONNELLE PRIORITAIRE
             *
             * C'est la première chose visible après le header.
             * L'agent n'a pas besoin de descendre pour savoir si
             * le billet est accepté ou refusé.
             */}
            <section className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#061015] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div className="flex flex-col gap-3 border-b border-white/[0.07] bg-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                    <ScanLine className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black text-white sm:text-base">
                        {selectedEvent.event.title}
                      </p>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
                          displayedOnline
                            ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300"
                            : "border-red-400/20 bg-red-400/[0.07] text-red-300"
                        }`}
                      >
                        {displayedOnline ? (
                          <Wifi className="h-3 w-3" />
                        ) : (
                          <WifiOff className="h-3 w-3" />
                        )}

                        {displayedOnline
                          ? "Scanner opérationnel"
                          : "Hors connexion"}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" />
                        {selectedEvent.event.venueName ||
                          selectedEvent.event.city}
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-3 w-3" />
                        {selectedEvent.gateName}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-center">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-600">
                      Entrées
                    </p>

                    <p className="mt-0.5 text-sm font-black text-white">
                      {selectedEvent.statistics.acceptedScans}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-center">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-600">
                      Restants
                    </p>

                    <p className="mt-0.5 text-sm font-black text-lime-300">
                      {selectedEvent.statistics.remainingTickets}
                    </p>
                  </div>
                </div>
              </div>

              {globalError ? (
                <div className="mx-3 mt-3 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.08] p-3.5 text-sm text-red-200 sm:mx-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

                  <span className="leading-5">
                    {globalError}
                  </span>
                </div>
              ) : null}

              <div className="grid min-w-0 gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)] lg:gap-4">
                <div className="min-w-0">
                  <ScannerCamera
                    active
                    processing={
                      processing
                    }
                    onDetected={(
                      value,
                    ) =>
                      void submitScan(
                        value,
                      )
                    }
                    onError={(
                      message,
                    ) =>
                      setGlobalError(
                        message,
                      )
                    }
                  />
                </div>

                <div className="min-w-0 space-y-3">
                  <div
                    className={`overflow-hidden rounded-[24px] border transition ${
                      scanResult
                        ? scanResult.accepted
                          ? "border-emerald-400/30 bg-emerald-400/[0.06]"
                          : "border-red-400/30 bg-red-400/[0.06]"
                        : "border-white/[0.08] bg-black/20"
                    }`}
                  >
                    {scanResult ? (
                      <ScannerResult
                        result={
                          scanResult
                        }
                        onScanNext={
                          scanNext
                        }
                        onClose={
                          scanNext
                        }
                      />
                    ) : (
                      <div className="flex min-h-[220px] flex-col items-center justify-center px-5 py-6 text-center lg:min-h-[300px]">
                        {processing ? (
                          <>
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] text-amber-300">
                              <Loader2 className="h-7 w-7 animate-spin" />
                            </div>

                            <p className="mt-4 text-xl font-black text-white">
                              Vérification…
                            </p>

                            <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
                              Contrôle du billet en cours. La caméra reste active.
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.07] text-lime-300">
                              <TicketCheck className="h-7 w-7" />
                            </div>

                            <p className="mt-4 text-xl font-black text-white">
                              Prêt à scanner
                            </p>

                            <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
                              Présentez un QR code. Le résultat apparaîtra ici immédiatement.
                            </p>

                            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Enchaînement automatique
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <ScannerManualCodeForm
                    disabled={
                      !selectedEvent
                    }
                    processing={
                      processing
                    }
                    onSubmit={(
                      value,
                    ) =>
                      void submitScan(
                        value,
                      )
                    }
                  />
                </div>
              </div>
            </section>

            {/*
             * Les informations de pilotage restent disponibles mais
             * elles passent APRÈS la zone scanner.
             */}
            <section className="mt-5">
              <ScannerStatistics
                statistics={
                  selectedEvent.statistics
                }
              />
            </section>

            <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-400">
                      Activité récente
                    </p>

                    <h3 className="mt-1 text-lg font-black text-white">
                      Historique des scans
                    </h3>
                  </div>

                  <History className="h-5 w-5 text-neutral-600" />
                </div>

                <ScannerHistoryList
                  items={
                    history
                  }
                  loading={
                    loadingHistory
                  }
                />
              </section>

              <aside className="min-w-0">
                <div className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-4 sm:p-5">
                  <div className="mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-400">
                      Événements autorisés
                    </p>

                    <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-white">
                      Changer d’événement
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {events.map(
                      (
                        item,
                      ) => (
                        <ScannerEventCard
                          key={
                            item.assignmentId ||
                            item.event.id
                          }
                          item={
                            item
                          }
                          selected={
                            item.event.id ===
                            selectedEventId
                          }
                          onSelect={(
                            selected,
                          ) => {
                            setSelectedEventId(
                              selected.event.id,
                            );

                            if (
                              resultTimerRef.current !==
                              null
                            ) {
                              window.clearTimeout(
                                resultTimerRef.current,
                              );

                              resultTimerRef.current =
                                null;
                            }

                            if (
                              backgroundRefreshTimerRef.current !==
                              null
                            ) {
                              window.clearTimeout(
                                backgroundRefreshTimerRef.current,
                              );

                              backgroundRefreshTimerRef.current =
                                null;
                            }

                            lastScanRef.current =
                              null;

                            setScanResult(
                              null,
                            );

                            setGlobalError("");
                          }}
                        />
                      ),
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}