"use client";

import {
  FormEvent,
  useState,
} from "react";
import {
  Keyboard,
  Loader2,
  Search,
} from "lucide-react";

function normalizeText(
  value: string,
): string {
  return value.trim();
}

export default function ScannerManualCodeForm({
  disabled,
  processing,
  onSubmit,
}: {
  disabled?: boolean;
  processing: boolean;
  onSubmit: (
    value: string,
  ) => void;
}) {
  const [
    value,
    setValue,
  ] =
    useState("");

  const submit =
    (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      const normalizedValue =
        normalizeText(
          value,
        );

      if (
        !normalizedValue ||
        disabled ||
        processing
      ) {
        return;
      }

      onSubmit(
        normalizedValue,
      );
    };

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-white/[0.08] bg-[#071015] p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-400/15 bg-orange-400/[0.07] text-orange-300">
          <Keyboard className="h-5 w-5" />
        </span>

        <div>
          <h3 className="text-sm font-black text-white">
            Saisie manuelle
          </h3>

          <p className="mt-1 text-xs leading-5 text-neutral-600">
            Utilisez le code imprimé sur le billet si la caméra ne peut pas lire le QR.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={value}
          onChange={(event) =>
            setValue(
              event.target.value,
            )
          }
          disabled={
            disabled ||
            processing
          }
          autoComplete="off"
          spellCheck={false}
          placeholder="Ex. TKM-2026-XXXXXX"
          className="h-12 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[#03090d] px-4 font-mono text-sm font-bold text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-400/40 disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={
            disabled ||
            processing ||
            !normalizeText(
              value,
            )
          }
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {processing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}

          Vérifier
        </button>
      </div>
    </form>
  );
}
