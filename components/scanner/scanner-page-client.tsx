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
  Camera,
  History,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
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
    cameraActive,
    setCameraActive,
  ] =
    useState(false);

  const [
    online,
    setOnline,
  ] =
    useState(
      typeof navigator ===
        "undefined"
        ? true
        : navigator.onLine,
    );

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
      const handleOnline =
        () =>
          setOnline(
            true,
          );

      const handleOffline =
        () =>
          setOnline(
            false,
          );

      window.addEventListener(
        "online",
        handleOnline,
      );

      window.addEventListener(
        "offline",
        handleOffline,
      );

      return () => {
        window.removeEventListener(
          "online",
          handleOnline,
        );

        window.removeEventListener(
          "offline",
          handleOffline,
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
          processing
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
            2_000
        ) {
          return;
        }

        lastScanRef.current = {
          value:
            normalizedValue,
          at:
            now,
        };

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

          setScanResult(
            result,
          );

          setCameraActive(
            false,
          );

          playFeedback(
            result.accepted,
          );

          await Promise.all([
            loadEvents(),
            loadHistory(
              selectedEvent.event.id,
            ),
          ]);
        } catch (error) {
          setGlobalError(
            error instanceof Error
              ? error.message
              : "Le billet n’a pas pu être vérifié.",
          );
        } finally {
          setProcessing(
            false,
          );
        }
      },
      [
        loadEvents,
        loadHistory,
        online,
        processing,
        selectedEvent,
      ],
    );

  const scanNext =
    () => {
      setScanResult(
        null,
      );

      setGlobalError("");

      lastScanRef.current =
        null;

      setCameraActive(
        true,
      );
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
        online={online}
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

      <main className="w-full px-4 py-5 sm:px-6">
        {globalError && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-4 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

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
        ) : (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
            <aside className="min-w-0 space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-400">
                  Événements autorisés
                </p>

                <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-white">
                  Choisir un événement
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
                      item={item}
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

                        setScanResult(
                          null,
                        );

                        setCameraActive(
                          false,
                        );

                        setGlobalError("");
                      }}
                    />
                  ),
                )}
              </div>
            </aside>

            {selectedEvent && (
              <section className="min-w-0 space-y-5">
                <ScannerStatistics
                  statistics={
                    selectedEvent.statistics
                  }
                />

                <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
                  <div className="min-w-0 space-y-4">
                    {cameraActive &&
                    !scanResult ? (
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
                    ) : (
                      <div className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6 text-center sm:p-8">
                        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                          <ScanLine className="h-10 w-10" />
                        </span>

                        <h2 className="mt-5 text-2xl font-black tracking-[-0.04em] text-white">
                          Contrôle d’accès prêt
                        </h2>

                        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-500">
                          Ouvrez la caméra puis placez le QR code officiel Tikemia dans le cadre.
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            setScanResult(
                              null,
                            );

                            setGlobalError("");

                            setCameraActive(
                              true,
                            );
                          }}
                          className="mt-6 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white transition hover:scale-[1.01]"
                        >
                          <Camera className="h-5 w-5" />
                          Ouvrir le scanner
                        </button>
                      </div>
                    )}

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

                  <div className="min-w-0 space-y-5">
                    <ScannerResult
                      result={scanResult}
                      onScanNext={
                        scanNext
                      }
                      onClose={() => {
                        setScanResult(
                          null,
                        );

                        setCameraActive(
                          false,
                        );
                      }}
                    />

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
                        items={history}
                        loading={
                          loadingHistory
                        }
                      />
                    </section>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}