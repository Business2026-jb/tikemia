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

type ParticipantsTableProps = {
  participants: OrganizerParticipantListItem[];
};

type ParticipantTableRowProps = {
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

function getOrderStatusClassName(
  status: OrganizerParticipantListItem["order"]["status"],
): string {
  switch (status) {
    case "PAID":
      return "text-emerald-300";

    case "PENDING":
      return "text-amber-300";

    case "REFUNDED":
      return "text-violet-300";

    case "FAILED":
    case "CANCELLED":
      return "text-red-300";

    default:
      return "text-neutral-400";
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

function getPaymentStatusClassName(
  status:
    | NonNullable<
        OrganizerParticipantListItem["order"]["payment"]
      >["status"]
    | null
    | undefined,
): string {
  switch (status) {
    case "SUCCESS":
      return "text-emerald-300";

    case "PENDING":
      return "text-amber-300";

    case "REFUNDED":
      return "text-violet-300";

    case "FAILED":
      return "text-red-300";

    default:
      return "text-neutral-500";
  }
}

function ParticipantTableRow({
  participant,
}: ParticipantTableRowProps) {
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
    <tr className="group border-b border-white/[0.055] transition last:border-b-0 hover:bg-white/[0.018]">
      <td className="min-w-[245px] px-4 py-4 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] text-xs font-black text-emerald-300">
            {getInitials(participantName)}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">
              {participantName}
            </p>

            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <Mail className="h-3 w-3 shrink-0 text-neutral-600" />

              <span className="truncate text-[11px] text-neutral-500">
                {participantEmail}
              </span>
            </div>

            <p className="mt-1 truncate text-[11px] text-neutral-600">
              {participantPhone}
            </p>
          </div>
        </div>
      </td>

      <td className="min-w-[220px] px-4 py-4 align-middle">
        <div className="min-w-0">
          <Link
            href={`/organizer/events/${participant.event.id}`}
            className="inline-flex max-w-full items-center gap-1.5 text-sm font-bold text-white transition hover:text-emerald-300"
          >
            <span className="truncate">
              {participant.event.title}
            </span>

            <ExternalLink className="h-3 w-3 shrink-0" />
          </Link>

          <p className="mt-1 truncate text-xs font-semibold text-orange-300">
            {participant.ticketType.name}
          </p>

          <div className="mt-2 flex min-w-0 items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0 text-neutral-600" />

            <span className="truncate text-[11px] text-neutral-500">
              {eventLocation || "Lieu non renseigné"}
            </span>
          </div>
        </div>
      </td>

      <td className="min-w-[160px] px-4 py-4 align-middle">
        <div className="space-y-2">
          <span
            className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold ${statusTone.className}`}
          >
            <StatusIcon className="h-3 w-3" />
            {statusTone.label}
          </span>

          <div>
            <span
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold ${
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
                : "En attente"}
            </span>
          </div>
        </div>
      </td>

      <td className="min-w-[160px] px-4 py-4 align-middle">
        <div>
          <p className="text-xs font-semibold text-neutral-300">
            {formatDateTime(
              participant.event.startsAt,
              participant.event.timezone,
            )}
          </p>

          <div className="mt-1.5 flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3 text-neutral-600" />

            <span className="text-[11px] text-neutral-500">
              Événement
            </span>
          </div>
        </div>
      </td>

      <td className="min-w-[155px] px-4 py-4 align-middle">
        <div>
          <div className="flex min-w-0 items-center gap-2">
            <code className="max-w-[115px] truncate rounded-lg border border-white/[0.08] bg-white/[0.025] px-2 py-1.5 text-[11px] font-bold text-neutral-300">
              {participant.code}
            </code>

            <button
              type="button"
              onClick={handleCopyCode}
              aria-label="Copier le code du billet"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
                copied
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border-white/[0.08] bg-white/[0.025] text-neutral-500 hover:border-white/[0.14] hover:text-white"
              }`}
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            {participant.isGuestPurchase ? (
              <CircleUserRound className="h-3 w-3 text-neutral-600" />
            ) : (
              <UserRound className="h-3 w-3 text-violet-400" />
            )}

            <span
              className={`text-[10px] font-semibold ${
                participant.isGuestPurchase
                  ? "text-neutral-500"
                  : "text-violet-300"
              }`}
            >
              {participant.isGuestPurchase
                ? "Achat invité"
                : "Compte client"}
            </span>
          </div>
        </div>
      </td>

      <td className="min-w-[155px] px-4 py-4 align-middle">
        <div>
          <Link
            href={`/organizer/orders/${participant.order.id}`}
            className="inline-flex max-w-full items-center gap-1.5 text-xs font-bold text-sky-300 transition hover:text-sky-200"
          >
            <span className="truncate">
              {participant.order.reference}
            </span>

            <ExternalLink className="h-3 w-3 shrink-0" />
          </Link>

          <p
            className={`mt-1.5 text-[11px] font-semibold ${getOrderStatusClassName(
              participant.order.status,
            )}`}
          >
            {getOrderStatusLabel(
              participant.order.status,
            )}
          </p>

          <p className="mt-1 truncate text-[10px] text-neutral-600">
            {formatDateTime(
              participant.order.createdAt,
            )}
          </p>
        </div>
      </td>

      <td className="min-w-[155px] px-4 py-4 align-middle">
        <div>
          <p
            className={`text-xs font-bold ${getPaymentStatusClassName(
              participant.order.payment?.status,
            )}`}
          >
            {getPaymentStatusLabel(
              participant.order.payment?.status,
            )}
          </p>

          <p className="mt-1 truncate text-[11px] text-neutral-500">
            {participant.order.payment?.method ||
              "Moyen non renseigné"}
          </p>

          <p className="mt-1 truncate text-[10px] text-neutral-600">
            {participant.order.payment?.provider ||
              "Prestataire non renseigné"}
          </p>
        </div>
      </td>

      <td className="min-w-[170px] px-4 py-4 align-middle">
        <div>
          {isCheckedIn ? (
            <>
              <p className="text-xs font-bold text-sky-300">
                Présent
              </p>

              <p className="mt-1 text-[11px] text-neutral-500">
                {formatDateTime(
                  participant.usedAt,
                  participant.event.timezone,
                )}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-orange-300">
                Non enregistré
              </p>

              <p className="mt-1 text-[11px] text-neutral-500">
                Entrée non encore validée
              </p>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function ParticipantsTable({
  participants,
}: ParticipantsTableProps) {
  if (participants.length === 0) {
    return null;
  }

  return (
    <section className="hidden overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014] lg:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1480px] border-collapse">
          <thead>
            <tr className="border-b border-white/[0.08] bg-[#050c10]">
              <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                Participant
              </th>

              <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                Événement
              </th>

              <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                Statut
              </th>

              <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                Date événement
              </th>

              <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                Billet
              </th>

              <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                Commande
              </th>

              <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                Paiement
              </th>

              <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                Présence
              </th>
            </tr>
          </thead>

          <tbody>
            {participants.map((participant) => (
              <ParticipantTableRow
                key={participant.id}
                participant={participant}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}