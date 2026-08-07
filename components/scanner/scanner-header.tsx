"use client";

import Link from "next/link";
import {
  ChevronLeft,
  LogOut,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

export default function ScannerHeader({
  scannerName,
  eventTitle,
  gateName,
  online,
  refreshing = false,
  onRefresh,
  onLogout,
}: {
  scannerName: string;
  eventTitle?: string | null;
  gateName?: string | null;
  online: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onLogout?: () => void;
}) {
  const [
    mounted,
    setMounted,
  ] =
    useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /*
   * Le serveur et le premier rendu client doivent produire
   * exactement le même HTML.
   *
   * Avant le montage, on affiche donc toujours l’état en ligne.
   * Une fois le composant monté, on utilise la vraie valeur
   * reçue dans la propriété `online`.
   */
  const displayedOnline =
    !mounted || online;

  const normalizedScannerName =
    scannerName.trim() ||
    "Utilisateur Tikemia";

  const normalizedEventTitle =
    eventTitle?.trim() ||
    "";

  const normalizedGateName =
    gateName?.trim() ||
    "";

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#03070a]/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[72px] w-full items-center justify-between gap-3 px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {normalizedEventTitle ? (
            <Link
              href="/scanner"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white"
              aria-label="Retour aux événements"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <ScanLine className="h-5 w-5" />
            </span>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-black text-white sm:text-base">
                {normalizedEventTitle ||
                  "Scanner Tikemia"}
              </h1>

              <ShieldCheck className="h-4 w-4 shrink-0 text-lime-400" />
            </div>

            <p className="mt-0.5 truncate text-[11px] text-neutral-600">
              {normalizedGateName
                ? `${normalizedGateName} · ${normalizedScannerName}`
                : normalizedScannerName}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`hidden h-10 items-center gap-2 rounded-xl border px-3 text-[11px] font-black sm:inline-flex ${
              displayedOnline
                ? "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300"
                : "border-red-400/15 bg-red-400/[0.07] text-red-300"
            }`}
            aria-live="polite"
          >
            {displayedOnline ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}

            {displayedOnline
              ? "En ligne"
              : "Hors ligne"}
          </span>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={
                refreshing
                  ? "Actualisation en cours"
                  : "Actualiser"
              }
              title="Actualiser"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/15 bg-red-400/[0.05] text-red-300 transition hover:border-red-400/25 hover:bg-red-400/[0.10]"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-white/[0.05] px-3 py-2 sm:hidden">
        <span
          className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-black ${
            displayedOnline
              ? "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300"
              : "border-red-400/15 bg-red-400/[0.07] text-red-300"
          }`}
          aria-live="polite"
        >
          {displayedOnline ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}

          {displayedOnline
            ? "En ligne"
            : "Hors ligne"}
        </span>
      </div>
    </header>
  );
}