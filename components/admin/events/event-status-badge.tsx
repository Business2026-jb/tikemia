"use client";

type EventStatusBadgeProps = {
  status: string;
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: "Brouillon",
    className: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  },
  PENDING: {
    label: "En attente",
    className: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  },
  PENDING_REVIEW: {
    label: "En attente",
    className: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  },
  APPROVED: {
    label: "Approuvé",
    className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  },
  PUBLISHED: {
    label: "Publié",
    className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  },
  REJECTED: {
    label: "Refusé",
    className: "border-red-400/20 bg-red-400/10 text-red-300",
  },
  SUSPENDED: {
    label: "Suspendu",
    className: "border-orange-400/20 bg-orange-400/10 text-orange-300",
  },
  CANCELLED: {
    label: "Annulé",
    className: "border-neutral-400/20 bg-neutral-400/10 text-neutral-300",
  },
  CANCELED: {
    label: "Annulé",
    className: "border-neutral-400/20 bg-neutral-400/10 text-neutral-300",
  },
  ARCHIVED: {
    label: "Archivé",
    className: "border-violet-400/20 bg-violet-400/10 text-violet-300",
  },
};

export default function EventStatusBadge({
  status,
}: EventStatusBadgeProps) {
  const normalized = String(status || "").trim().toUpperCase();

  const config = STATUS_STYLES[normalized] ?? {
    label: status || "Inconnu",
    className: "border-white/10 bg-white/[0.04] text-neutral-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${config.className}`}
    >
      {config.label}
    </span>
  );
}
