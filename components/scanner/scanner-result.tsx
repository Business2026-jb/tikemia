"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import ScannerErrorResult from "@/components/scanner/scanner-error-result";
import ScannerSuccessResult from "@/components/scanner/scanner-success-result";

export type ScannerApiTicket = Readonly<{
  id: string;
  code: string;
  holderName: string;
  holderEmail?: string | null;
  holderPhone?: string | null;
  status: string;
  usedAt?: string | null;
  scannedAt?: string | null;
  ticketType: Readonly<{
    id?: string;
    name: string;
    description?: string | null;
  }>;
  event: Readonly<{
    id: string;
    title: string;
    slug?: string;
    startsAt?: string;
    endsAt?: string | null;
    venueName?: string;
    city?: string;
    country?: string;
  }>;
}>;

export type ScannerAuthenticity = Readonly<{
  verified: boolean;
  label: string;
  verificationMode:
    | "SIGNED_QR"
    | "DATABASE_QR"
    | "MANUAL_CODE"
    | string;
  qrVersion?: number;
  fingerprint?: string;
}>;

export type ScannerScanResult = Readonly<{
  accepted: boolean;
  result: string;
  message: string;
  scanId?: string | null;
  scannedAt: string;
  ticket: ScannerApiTicket | null;
  authenticity: ScannerAuthenticity | null;
  firstUse?: Readonly<{
    usedAt?: string | null;
    scannedAt?: string | null;
  }> | null;
}>;

export type ScannerResultTone =
  | "success"
  | "warning"
  | "error";

export type ScannerOperationalResult =
  | "VALID"
  | "ALREADY_USED"
  | "INVALID";

/*
 * Pour l'agent de contrôle, Tikemia n'affiche volontairement
 * que trois décisions opérationnelles :
 *
 * 1. VALID        -> billet valide, entrée autorisée
 * 2. ALREADY_USED -> billet authentique déjà consommé
 * 3. INVALID      -> tout QR qui n'est pas acceptable pour ce contrôle
 *
 * Les raisons techniques détaillées peuvent continuer à être conservées
 * côté serveur et dans les logs. L'agent, lui, reçoit une décision simple,
 * immédiate et impossible à confondre.
 */
export function getScannerOperationalResult(
  result: ScannerScanResult,
): ScannerOperationalResult {
  if (result.accepted) {
    return "VALID";
  }

  if (
    result.result ===
    "ALREADY_USED"
  ) {
    return "ALREADY_USED";
  }

  return "INVALID";
}

export function getScannerResultTone(
  result: ScannerScanResult,
): ScannerResultTone {
  const operationalResult =
    getScannerOperationalResult(
      result,
    );

  if (
    operationalResult ===
    "VALID"
  ) {
    return "success";
  }

  if (
    operationalResult ===
    "ALREADY_USED"
  ) {
    return "warning";
  }

  return "error";
}

export function getScannerResultIcon({
  accepted,
  result,
}: Pick<
  ScannerScanResult,
  "accepted" | "result"
>) {
  if (accepted) {
    return CheckCircle2;
  }

  if (
    result ===
    "ALREADY_USED"
  ) {
    return Clock3;
  }

  /*
   * INVALID, WRONG_EVENT, UNKNOWN_QR, TAMPERED_QR, CANCELLED,
   * REFUNDED ou toute autre réponse non acceptée sont présentés
   * opérationnellement comme un billet invalide/faux pour ce contrôle.
   */
  if (
    result === "INVALID" ||
    result === "WRONG_EVENT"
  ) {
    return AlertTriangle;
  }

  return XCircle;
}

function buildOperationalResult(
  result: ScannerScanResult,
): ScannerScanResult {
  const operationalResult =
    getScannerOperationalResult(
      result,
    );

  if (
    operationalResult ===
    "VALID"
  ) {
    return {
      ...result,
      accepted:
        true,
      result:
        "VALID",
      message:
        "Billet valide — entrée autorisée.",
    };
  }

  if (
    operationalResult ===
    "ALREADY_USED"
  ) {
    return {
      ...result,
      accepted:
        false,
      result:
        "ALREADY_USED",
      message:
        "Billet déjà utilisé — entrée refusée.",
    };
  }

  return {
    ...result,
    accepted:
      false,
    result:
      "INVALID",
    message:
      "Faux billet — entrée refusée.",
  };
}

export default function ScannerResult({
  result,
  onScanNext,
  onClose,
}: {
  result: ScannerScanResult | null;
  onScanNext: () => void;
  onClose?: () => void;
}) {
  if (!result) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-[#071015] p-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300 shadow-[0_0_30px_rgba(163,230,53,0.08)]">
          <ShieldCheck className="h-7 w-7" />
        </span>

        <h3 className="mt-4 text-lg font-black text-white">
          Prêt pour le contrôle
        </h3>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Positionnez le QR code Tikemia dans le cadre de la caméra.
        </p>

        <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-2">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-emerald-300">
              Valide
            </p>
          </div>

          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-2 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-amber-300">
              Déjà utilisé
            </p>
          </div>

          <div className="rounded-xl border border-red-400/15 bg-red-400/[0.05] px-2 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-red-300">
              Faux billet
            </p>
          </div>
        </div>
      </div>
    );
  }

  const operationalResult =
    buildOperationalResult(
      result,
    );

  if (
    operationalResult.accepted
  ) {
    return (
      <ScannerSuccessResult
        result={
          operationalResult
        }
        onScanNext={
          onScanNext
        }
        onClose={
          onClose
        }
      />
    );
  }

  return (
    <ScannerErrorResult
      result={
        operationalResult
      }
      onScanNext={
        onScanNext
      }
      onClose={
        onClose
      }
    />
  );
}