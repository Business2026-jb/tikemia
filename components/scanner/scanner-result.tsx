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

export function getScannerResultTone(
  result: ScannerScanResult,
): ScannerResultTone {
  if (result.accepted) {
    return "success";
  }

  if (
    result.result === "ALREADY_USED"
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

  if (result === "ALREADY_USED") {
    return Clock3;
  }

  if (
    result === "INVALID" ||
    result === "WRONG_EVENT"
  ) {
    return AlertTriangle;
  }

  return XCircle;
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
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
          <ShieldCheck className="h-7 w-7" />
        </span>

        <h3 className="mt-4 text-lg font-black text-white">
          Prêt pour le contrôle
        </h3>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Positionnez le QR code Tikemia dans le cadre de la caméra.
        </p>
      </div>
    );
  }

  if (result.accepted) {
    return (
      <ScannerSuccessResult
        result={result}
        onScanNext={onScanNext}
        onClose={onClose}
      />
    );
  }

  return (
    <ScannerErrorResult
      result={result}
      onScanNext={onScanNext}
      onClose={onClose}
    />
  );
}
