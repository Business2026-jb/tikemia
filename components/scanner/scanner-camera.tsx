"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  Camera,
  CameraOff,
  Flashlight,
  RefreshCw,
} from "lucide-react";

import ScannerFrame from "@/components/scanner/scanner-frame";

type CameraStatus =
  | "idle"
  | "starting"
  | "running"
  | "error";

type TorchFeature = {
  isSupported(): boolean;
  apply(enabled: boolean): Promise<void>;
};

type Html5QrCodeInstance = {
  start(
    cameraConfig:
      | string
      | {
          facingMode: string;
        },
    configuration: {
      fps: number;
      qrbox:
        | number
        | {
            width: number;
            height: number;
          }
        | ((
            viewfinderWidth: number,
            viewfinderHeight: number,
          ) => {
            width: number;
            height: number;
          });
      aspectRatio?: number;
      disableFlip?: boolean;
    },
    onSuccess: (
      decodedText: string,
    ) => void,
    onError?: (
      errorMessage: string,
    ) => void,
  ): Promise<null | void>;

  stop(): Promise<void>;
  clear(): Promise<void>;

  pause(
    shouldPauseVideo?: boolean,
  ): void;

  resume(): void;

  getRunningTrackCameraCapabilities?(): {
    torchFeature?(): TorchFeature;
  };
};

const CAMERA_FPS =
  24;

const MIN_QR_BOX_SIZE =
  220;

const MAX_QR_BOX_SIZE =
  380;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function getQrBoxSize(
  viewfinderWidth: number,
  viewfinderHeight: number,
): {
  width: number;
  height: number;
} {
  const shortestSide =
    Math.min(
      viewfinderWidth,
      viewfinderHeight,
    );

  const calculatedSize =
    Math.floor(
      shortestSide *
        0.72,
    );

  const size =
    Math.min(
      Math.max(
        calculatedSize,
        MIN_QR_BOX_SIZE,
      ),
      MAX_QR_BOX_SIZE,
    );

  return {
    width:
      size,

    height:
      size,
  };
}

function getReadableCameraError(
  error: unknown,
): string {
  const message =
    error instanceof Error
      ? normalizeText(
          error.message,
        )
      : normalizeText(
          String(error),
        );

  const normalizedMessage =
    message.toLowerCase();

  if (
    normalizedMessage.includes(
      "notallowederror",
    ) ||
    normalizedMessage.includes(
      "permission",
    ) ||
    normalizedMessage.includes(
      "denied",
    )
  ) {
    return "L’accès à la caméra a été refusé. Autorisez la caméra dans les paramètres du navigateur puis réessayez.";
  }

  if (
    normalizedMessage.includes(
      "notfounderror",
    ) ||
    normalizedMessage.includes(
      "no camera",
    ) ||
    normalizedMessage.includes(
      "camera not found",
    )
  ) {
    return "Aucune caméra compatible n’a été détectée sur cet appareil.";
  }

  if (
    normalizedMessage.includes(
      "notreadableerror",
    ) ||
    normalizedMessage.includes(
      "could not start video source",
    ) ||
    normalizedMessage.includes(
      "trackstarterror",
    )
  ) {
    return "La caméra est déjà utilisée par une autre application ou un autre onglet.";
  }

  if (
    normalizedMessage.includes(
      "secure context",
    ) ||
    normalizedMessage.includes(
      "https",
    )
  ) {
    return "La caméra nécessite une connexion HTTPS sécurisée, sauf sur localhost.";
  }

  return (
    message ||
    "Impossible d’ouvrir la caméra pour le moment."
  );
}

export default function ScannerCamera({
  active,
  processing,
  onDetected,
  onError,
}: {
  active: boolean;
  processing: boolean;

  onDetected: (
    value: string,
  ) => void;

  onError?: (
    message: string,
  ) => void;
}) {
  const reactId =
    useId();

  const readerId =
    `tikemia-scanner-${reactId.replace(
      /[^a-zA-Z0-9_-]/g,
      "",
    )}`;

  const scannerRef =
    useRef<Html5QrCodeInstance | null>(
      null,
    );

  const mountedRef =
    useRef(true);

  const startingRef =
    useRef(false);

  const detectedValueRef =
    useRef("");

  const processingRef =
    useRef(
      processing,
    );

  const onDetectedRef =
    useRef(
      onDetected,
    );

  const onErrorRef =
    useRef(
      onError,
    );

  const [
    cameraStatus,
    setCameraStatus,
  ] =
    useState<CameraStatus>(
      "idle",
    );

  const [
    cameraError,
    setCameraError,
  ] =
    useState("");

  const [
    torchEnabled,
    setTorchEnabled,
  ] =
    useState(false);

  useEffect(
    () => {
      processingRef.current =
        processing;
    },
    [processing],
  );

  useEffect(
    () => {
      onDetectedRef.current =
        onDetected;
    },
    [onDetected],
  );

  useEffect(
    () => {
      onErrorRef.current =
        onError;
    },
    [onError],
  );

  const safelySetStatus =
    useCallback(
      (
        status:
          CameraStatus,
      ) => {
        if (
          mountedRef.current
        ) {
          setCameraStatus(
            status,
          );
        }
      },
      [],
    );

  const stopCamera =
    useCallback(
      async () => {
        const scanner =
          scannerRef.current;

        scannerRef.current =
          null;

        startingRef.current =
          false;

        detectedValueRef.current =
          "";

        if (!scanner) {
          if (
            mountedRef.current
          ) {
            setTorchEnabled(
              false,
            );

            safelySetStatus(
              "idle",
            );
          }

          return;
        }

        try {
          await scanner.stop();
        } catch {
          // Le scanner peut déjà être arrêté.
        }

        try {
          await scanner.clear();
        } catch {
          // Le conteneur peut déjà avoir été nettoyé.
        }

        if (
          mountedRef.current
        ) {
          setTorchEnabled(
            false,
          );

          safelySetStatus(
            "idle",
          );
        }
      },
      [safelySetStatus],
    );

  const startCamera =
    useCallback(
      async () => {
        if (
          typeof window ===
            "undefined" ||
          startingRef.current
        ) {
          return;
        }

        startingRef.current =
          true;

        await stopCamera();

        startingRef.current =
          true;

        if (
          !mountedRef.current
        ) {
          startingRef.current =
            false;

          return;
        }

        setCameraError("");

        safelySetStatus(
          "starting",
        );

        try {
          const {
            Html5Qrcode,
          } =
            await import(
              "html5-qrcode"
            );

          if (
            !mountedRef.current
          ) {
            startingRef.current =
              false;

            return;
          }

          const scanner =
            new Html5Qrcode(
              readerId,
              {
                verbose:
                  false,
              },
            ) as unknown as
              Html5QrCodeInstance;

          scannerRef.current =
            scanner;

          await scanner.start(
            {
              facingMode:
                "environment",
            },
            {
              fps:
                CAMERA_FPS,

              qrbox:
                getQrBoxSize,

              aspectRatio:
                1,

              disableFlip:
                true,
            },
            (
              decodedText,
            ) => {
              const normalizedValue =
                normalizeText(
                  decodedText,
                );

              if (
                !normalizedValue ||
                processingRef.current ||
                detectedValueRef.current ===
                  normalizedValue
              ) {
                return;
              }

              detectedValueRef.current =
                normalizedValue;

              try {
                scanner.pause(
                  true,
                );
              } catch {
                // La vérification serveur reste prioritaire.
              }

              onDetectedRef.current(
                normalizedValue,
              );
            },
            () => {
              /*
               * Les erreurs de lecture sont normales tant qu’aucun QR
               * n’est correctement cadré. Elles ne sont pas affichées.
               */
            },
          );

          startingRef.current =
            false;

          if (
            mountedRef.current
          ) {
            safelySetStatus(
              "running",
            );
          }
        } catch (error) {
          startingRef.current =
            false;

          const message =
            getReadableCameraError(
              error,
            );

          if (
            mountedRef.current
          ) {
            setCameraError(
              message,
            );

            safelySetStatus(
              "error",
            );
          }

          onErrorRef.current?.(
            message,
          );
        }
      },
      [
        readerId,
        safelySetStatus,
        stopCamera,
      ],
    );

  useEffect(
    () => {
      mountedRef.current =
        true;

      detectedValueRef.current =
        "";

      if (active) {
        void startCamera();
      } else {
        void stopCamera();
      }

      return () => {
        mountedRef.current =
          false;

        void stopCamera();
      };
    },
    [
      active,
      startCamera,
      stopCamera,
    ],
  );

  useEffect(
    () => {
      const scanner =
        scannerRef.current;

      if (
        !scanner ||
        cameraStatus !==
          "running"
      ) {
        return;
      }

      if (processing) {
        try {
          scanner.pause(
            true,
          );
        } catch {
          // Le scanner peut être en cours d’arrêt.
        }

        return;
      }

      detectedValueRef.current =
        "";

      try {
        scanner.resume();
      } catch {
        // L’utilisateur peut redémarrer la caméra manuellement.
      }
    },
    [
      cameraStatus,
      processing,
    ],
  );

  const toggleTorch =
    useCallback(
      async () => {
        const scanner =
          scannerRef.current;

        const torchFeature =
          scanner
            ?.getRunningTrackCameraCapabilities?.()
            .torchFeature?.();

        if (
          !torchFeature ||
          !torchFeature.isSupported()
        ) {
          const message =
            "La lampe torche n’est pas disponible sur cet appareil.";

          setCameraError(
            message,
          );

          onErrorRef.current?.(
            message,
          );

          return;
        }

        const nextValue =
          !torchEnabled;

        try {
          await torchFeature.apply(
            nextValue,
          );

          if (
            mountedRef.current
          ) {
            setTorchEnabled(
              nextValue,
            );

            setCameraError("");
          }
        } catch {
          const message =
            "Impossible de modifier la lampe torche.";

          setCameraError(
            message,
          );

          onErrorRef.current?.(
            message,
          );
        }
      },
      [torchEnabled],
    );

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#03090d]">
      <div className="relative aspect-square w-full overflow-hidden bg-black sm:aspect-[4/3]">
        <div
          id={readerId}
          className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />

        <ScannerFrame
          active={
            cameraStatus ===
            "running"
          }
          processing={
            processing
          }
        />

        {cameraStatus !==
          "running" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#03090d] p-6 text-center">
            {cameraStatus ===
            "starting" ? (
              <>
                <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-lime-400" />

                <p className="mt-4 text-sm font-black text-white">
                  Ouverture de la caméra…
                </p>
              </>
            ) : (
              <>
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-neutral-500">
                  {cameraStatus ===
                  "error" ? (
                    <CameraOff className="h-8 w-8" />
                  ) : (
                    <Camera className="h-8 w-8" />
                  )}
                </span>

                <p className="mt-4 text-sm font-black text-white">
                  {cameraStatus ===
                  "error"
                    ? "Caméra indisponible"
                    : "Caméra arrêtée"}
                </p>

                {cameraError && (
                  <p className="mt-2 max-w-sm text-xs leading-5 text-red-300">
                    {cameraError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    void startCamera();
                  }}
                  disabled={
                    startingRef.current
                  }
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/[0.08] px-4 text-xs font-black text-lime-300 transition hover:bg-lime-400/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] p-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-white">
            Caméra arrière
          </p>

          <p className="mt-1 truncate text-[11px] text-neutral-600">
            Placez entièrement le QR code dans le cadre
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              void toggleTorch();
            }}
            disabled={
              cameraStatus !==
              "running"
            }
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40 ${
              torchEnabled
                ? "border-lime-400/30 bg-lime-400/[0.12] text-lime-300"
                : "border-white/[0.08] bg-white/[0.03] text-neutral-400 hover:text-white"
            }`}
            aria-label={
              torchEnabled
                ? "Désactiver la lampe torche"
                : "Activer la lampe torche"
            }
            aria-pressed={
              torchEnabled
            }
          >
            <Flashlight className="h-4.5 w-4.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              void startCamera();
            }}
            disabled={
              cameraStatus ===
              "starting"
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Redémarrer la caméra"
          >
            <RefreshCw
              className={`h-4.5 w-4.5 ${
                cameraStatus ===
                "starting"
                  ? "animate-spin"
                  : ""
              }`}
            />
          </button>
        </div>
      </div>
    </section>
  );
}