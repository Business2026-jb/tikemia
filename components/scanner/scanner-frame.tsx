"use client";

import {
  Focus,
  ScanLine,
} from "lucide-react";

export default function ScannerFrame({
  active,
  processing,
}: {
  active: boolean;
  processing: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative h-[min(72vw,320px)] w-[min(72vw,320px)]">
        <span className="absolute left-0 top-0 h-12 w-12 rounded-tl-3xl border-l-4 border-t-4 border-lime-400" />
        <span className="absolute right-0 top-0 h-12 w-12 rounded-tr-3xl border-r-4 border-t-4 border-lime-400" />
        <span className="absolute bottom-0 left-0 h-12 w-12 rounded-bl-3xl border-b-4 border-l-4 border-lime-400" />
        <span className="absolute bottom-0 right-0 h-12 w-12 rounded-br-3xl border-b-4 border-r-4 border-lime-400" />

        {active &&
          !processing && (
            <span className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-gradient-to-r from-transparent via-lime-400 to-transparent shadow-[0_0_18px_rgba(163,230,53,0.9)]" />
          )}

        <div className="absolute inset-0 flex items-center justify-center">
          {processing ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.10] bg-black/70 px-5 py-4 text-white backdrop-blur">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-lime-400" />
              <span className="text-xs font-black">
                Vérification Tikemia…
              </span>
            </div>
          ) : (
            <Focus className="h-8 w-8 text-white/35" />
          )}
        </div>

        <ScanLine className="absolute -bottom-10 left-1/2 h-5 w-5 -translate-x-1/2 text-lime-400" />
      </div>
    </div>
  );
}
