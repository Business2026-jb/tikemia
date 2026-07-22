"use client";

import {
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  Copy,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  TicketCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { OrganizerParticipantListItem } from "@/lib/organizer/get-organizer-participants";

type ParticipantCardProps = {
  participant: OrganizerParticipantListItem;
};

type TicketStatusTone = {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
};

function formatDateTime(
  value: string | null,
  timezone?: string,
): string {
  if (!value) {
    return "Non renseigné";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Non renseigné";
  }

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...(timezone
        ? {
            timeZone: timezone,
          }
        : {}),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }
}

function getInitials(name: string): string {
  const normalizedName = name.trim();

  if (!normalizedName) {
    return "PT";
  }

  const parts = normalizedName
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function getTicketStatusTone(
  status: OrganizerParticipantListItem["status"],
): TicketStatusTone {
  switch (status) {
    case "VALID":
      return {
        label: "Valide",
        icon: ShieldCheck,
        className:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      };

    case "USED":
      return {
        label: "Utilisé",
        icon: CheckCircle2,
        className:
          "border-sky-500/25 bg-sky-500/10 text-sky-300",
      };

    case "CANCELLED":
      return {
        label: "Annulé",
        icon: XCircle,
        className:
          "border-red-500/25 bg-red-500/10 text-red-300",
      };

    case "REFUNDED":
      return {
        label: "Remboursé",
        icon: ReceiptText,
        className:
          "border-violet-500/25 bg-violet-500/10 text-violet-300",
      };

    default:
      return {
        label: status,
        icon: TicketCheck,
        className:
          "border-white/10 bg-white/[0.04] text-neutral-300",
      };
  }
}

function getOrderStatusLabel(
  status: OrganizerParticipantListItem["order"]["status"],
): string {
  switch (status) {
    case "PENDING":
      return "En attente";

    case "PAID":
      return "Payée";

    case "CANCELLED":
      return "Annulée";

    case "REFUNDED":
      return "Remboursée";

    case "FAILED":
      return "Échouée";

    default:
      return status;
  }
}

function getPaymentStatusLabel(
  status:
    | NonNullable<
        OrganizerParticipantListItem["order"]["payment"]
      >["status"]
    | null
    | undefined,
): string {
  switch (status) {
    case "PENDING":
      return "En attente";

    case "SUCCESS":
      return "Réussi";

    case "FAILED":
      return "Échoué";

    case "REFUNDED":
      return "Remboursé";

    default:
      return "Non renseigné";
  }
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025]">
        <Icon
          className="h-3.5 w-3.5 text-neutral-500"
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
          {label}
        </p>

        <p className="mt-0.5 truncate text-xs font-medium text-neutral-300">
          {value}
        </p>
      </div>

      {href && (
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
      )}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="flex min-w-0 items-center gap-3 rounded-xl border border-transparent p-2 transition hover:border-white/[0.07] hover:bg-white/[0.025]"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl p-2">
      {content}
    </div>
  );
}

export default function ParticipantCard({
  participant,
}: ParticipantCardProps) {
  const [copied, setCopied] = useState(false);

  const statusTone = getTicketStatusTone(
    participant.status,
  );

  const StatusIcon = statusTone.icon;

  const participantName =
    participant.holder.name || "Participant Tikemia";

  const participantEmail =
    participant.holder.email || "E-mail non renseigné";

  const participantPhone =
    participant.holder.phone || "Téléphone non renseigné";

  const participantCountry =
    participant.holder.country ||
    participant.event.country ||
    "Pays non renseigné";

  const eventLocation = [
    participant.event.venueName,
    participant.event.city,
    participant.event.country,
  ]
    .filter(Boolean)
    .join(", ");

  const isCheckedIn =
    participant.checkedIn ||
    participant.status === "USED";

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(
        participant.code,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1_800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <div className="relative border-b border-white/[0.07] p-4">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-orange-500/[0.025]" />

        <div className="relative flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] text-sm font-black text-emerald-300">
            {getInitials(participantName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black text-white">
                  {participantName}
                </h3>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[10px] font-bold ${statusTone.className}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusTone.label}
                  </span>

                  <span
                    className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[10px] font-bold ${
                      isCheckedIn
                        ? "border-sky-500/25 bg-sky-500/10 text-sky-300"
                        : "border-orange-500/25 bg-orange-500/10 text-orange-300"
                    }`}
                  >
                    {isCheckedIn ? (
                      <ScanLine className="h-3 w-3" />
                    ) : (
                      <Clock3 className="h-3 w-3" />
                    )}

                    {isCheckedIn
                      ? "Entrée validée"
                      : "En attente d’entrée"}
                  </span>
                </div>
              </div>

              <span
                className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold ${
                  participant.isGuestPurchase
                    ? "border-white/10 bg-white/[0.035] text-neutral-400"
                    : "border-violet-500/25 bg-violet-500/10 text-violet-300"
                }`}
              >
                {participant.isGuestPurchase ? (
                  <CircleUserRound className="h-3 w-3" />
                ) : (
                  <UserRound className="h-3 w-3" />
                )}

                {participant.isGuestPurchase
                  ? "Achat invité"
                  : "Compte client"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <section className="grid gap-1 sm:grid-cols-2">
          <InfoRow
            icon={Mail}
            label="E-mail"
            value={participantEmail}
            href={
              participant.holder.email
                ? `mailto:${participant.holder.email}`
                : undefined
            }
          />

          <InfoRow
            icon={Phone}
            label="Téléphone"
            value={participantPhone}
            href={
              participant.holder.phone
                ? `tel:${participant.holder.phone}`
                : undefined
            }
          />

          <InfoRow
            icon={MapPin}
            label="Pays"
            value={participantCountry}
          />

          <InfoRow
            icon={CalendarDays}
            label="Billet créé le"
            value={formatDateTime(
              participant.createdAt,
              participant.event.timezone,
            )}
          />
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-[#040b0f] p-3.5">
          <div className="flex items-start gap-3">
            {participant.event.coverImage ? (
              <img
                src={participant.event.coverImage}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
                <CalendarDays className="h-5 w-5 text-neutral-600" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <Link
                href={`/organizer/events/${participant.event.id}`}
                className="block truncate text-sm font-bold text-white transition hover:text-emerald-300"
              >
                {participant.event.title}
              </Link>

              <p className="mt-1 truncate text-xs font-semibold text-orange-300">
                {participant.ticketType.name}
              </p>

              <div className="mt-2 space-y-1">
                <p className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <CalendarDays className="h-3 w-3 shrink-0" />

                  <span className="truncate">
                    {formatDateTime(
                      participant.event.startsAt,
                      participant.event.timezone,
                    )}
                  </span>
                </p>

                <p className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <MapPin className="h-3 w-3 shrink-0" />

                  <span className="truncate">
                    {eventLocation ||
                      "Lieu non renseigné"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-[#040b0f] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
                Code du billet
              </p>

              <p className="mt-1 truncate font-mono text-sm font-bold text-white">
                {participant.code}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition ${
                copied
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border-white/[0.09] bg-white/[0.025] text-neutral-400 hover:border-white/[0.15] hover:text-white"
              }`}
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}

              {copied ? "Copié" : "Copier"}
            </button>
          </div>
        </section>

        <section className="grid gap-3 rounded-2xl border border-white/[0.07] bg-[#040b0f] p-3.5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
              Commande
            </p>

            <Link
              href={`/organizer/orders/${participant.order.id}`}
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-sky-300 transition hover:text-sky-200"
            >
              {participant.order.reference}
              <ExternalLink className="h-3 w-3" />
            </Link>

            <p className="mt-1 text-[11px] text-neutral-500">
              {getOrderStatusLabel(
                participant.order.status,
              )}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
              Paiement
            </p>

            <p className="mt-1 text-xs font-bold text-white">
              {getPaymentStatusLabel(
                participant.order.payment?.status,
              )}
            </p>

            <p className="mt-1 truncate text-[11px] text-neutral-500">
              {participant.order.payment?.method ||
                "Moyen non renseigné"}
            </p>
          </div>
        </section>

        <section
          className={`rounded-2xl border p-3.5 ${
            isCheckedIn
              ? "border-sky-500/20 bg-sky-500/[0.06]"
              : "border-orange-500/20 bg-orange-500/[0.05]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                isCheckedIn
                  ? "border-sky-500/25 bg-sky-500/10"
                  : "border-orange-500/25 bg-orange-500/10"
              }`}
            >
              {isCheckedIn ? (
                <ScanLine className="h-4 w-4 text-sky-300" />
              ) : (
                <Clock3 className="h-4 w-4 text-orange-300" />
              )}
            </div>

            <div className="min-w-0">
              <p
                className={`text-xs font-bold ${
                  isCheckedIn
                    ? "text-sky-300"
                    : "text-orange-300"
                }`}
              >
                {isCheckedIn
                  ? "Participant déjà enregistré à l’entrée"
                  : "Participant attendu à l’entrée"}
              </p>

              <p className="mt-1 truncate text-[11px] text-neutral-500">
                {isCheckedIn
                  ? formatDateTime(
                      participant.usedAt,
                      participant.event.timezone,
                    )
                  : `Événement prévu le ${formatDateTime(
                      participant.event.startsAt,
                      participant.event.timezone,
                    )}`}
              </p>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}