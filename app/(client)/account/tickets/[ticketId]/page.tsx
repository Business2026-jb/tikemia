import { Prisma, TicketStatus } from "@prisma/client";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  History,
  MapPin,
  QrCode,
  ReceiptText,
  Send,
  ShieldCheck,
  Ticket,
  UserRound,
  XCircle,
} from "lucide-react";

import { requireClient } from "@/lib/client/auth/require-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Mon billet | Tikemia",
  description:
    "Affichez les informations et le QR code de votre billet Tikemia.",
};

type ClientTicketDetailPageProps = {
  params: Promise<{
    ticketId: string;
  }>;
};

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeEmail(
  value: string | null | undefined,
): string {
  return normalizeText(value).toLowerCase();
}

function formatDate(
  value: Date,
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatTime(
  value: Date,
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDateTime(
  value: Date,
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatAmount(
  value: Prisma.Decimal,
  currency: string,
): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${value.toFixed(2)} ${currency}`;
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getTicketStatusLabel(
  status: TicketStatus,
): string {
  const labels: Record<TicketStatus, string> = {
    VALID: "Valide",
    USED: "Utilisé",
    CANCELLED: "Annulé",
    REFUNDED: "Remboursé",
    REVOKED: "Révoqué",
    EXPIRED: "Expiré",
  };

  return labels[status];
}

function getTicketStatusClassName(
  status: TicketStatus,
): string {
  switch (status) {
    case TicketStatus.VALID:
      return "border-emerald-400/25 bg-emerald-400/[0.10] text-emerald-300";

    case TicketStatus.USED:
      return "border-blue-400/25 bg-blue-400/[0.10] text-blue-300";

    case TicketStatus.REFUNDED:
      return "border-violet-400/25 bg-violet-400/[0.10] text-violet-300";

    case TicketStatus.CANCELLED:
      return "border-red-400/25 bg-red-400/[0.10] text-red-300";

    case TicketStatus.REVOKED:
      return "border-orange-400/25 bg-orange-400/[0.10] text-orange-300";

    case TicketStatus.EXPIRED:
      return "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300";

    default:
      return "border-white/[0.10] bg-white/[0.04] text-neutral-300";
  }
}

function getTicketStatusIcon(
  status: TicketStatus,
) {
  switch (status) {
    case TicketStatus.VALID:
      return CheckCircle2;

    case TicketStatus.USED:
      return History;

    case TicketStatus.CANCELLED:
      return XCircle;

    case TicketStatus.REFUNDED:
    case TicketStatus.REVOKED:
      return CircleAlert;

    case TicketStatus.EXPIRED:
      return Clock3;

    default:
      return CircleAlert;
  }
}

function buildTicketOwnershipWhere({
  customerId,
  customerEmail,
}: {
  customerId: string;
  customerEmail: string;
}): Prisma.TicketWhereInput {
  const normalizedEmail =
    normalizeEmail(customerEmail);

  const ownershipConditions:
    Prisma.TicketWhereInput[] = [
    {
      ownerId:
        customerId,
    },
  ];

  if (normalizedEmail) {
    ownershipConditions.push({
      AND: [
        {
          ownerId:
            null,
        },
        {
          holderEmail: {
            equals:
              normalizedEmail,
            mode:
              Prisma.QueryMode.insensitive,
          },
        },
      ],
    });
  }

  return {
    OR:
      ownershipConditions,
  };
}

async function generateQrCodeDataUrl(
  value: string,
): Promise<string | null> {
  const normalizedValue =
    normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    return await QRCode.toDataURL(
      normalizedValue,
      {
        type:
          "image/png",

        width:
          520,

        margin:
          2,

        errorCorrectionLevel:
          "H",

        color: {
          dark:
            "#071015",

          light:
            "#FFFFFF",
        },
      },
    );
  } catch (error) {
    console.error(
      "[CLIENT_TICKET_QR_GENERATION_ERROR]",
      error,
    );

    return null;
  }
}

export default async function ClientTicketDetailPage({
  params,
}: ClientTicketDetailPageProps) {
  const { customer } =
    await requireClient(
      "/account/tickets",
    );

  const { ticketId } =
    await params;

  const normalizedTicketId =
    normalizeText(ticketId);

  if (!normalizedTicketId) {
    notFound();
  }

  const ticket =
    await prisma.ticket.findFirst({
      where: {
        id:
          normalizedTicketId,

        AND: [
          buildTicketOwnershipWhere({
            customerId:
              customer.id,

            customerEmail:
              customer.email,
          }),
        ],
      },

      select: {
        id:
          true,

        code:
          true,

        qrCodeValue:
          true,

        holderName:
          true,

        holderEmail:
          true,

        holderPhone:
          true,

        status:
          true,

        usedAt:
          true,

        createdAt:
          true,

        updatedAt:
          true,

        ticketType: {
          select: {
            id:
              true,

            name:
              true,

            description:
              true,

            price:
              true,
          },
        },

        event: {
          select: {
            id:
              true,

            slug:
              true,

            title:
              true,

            coverImage:
              true,

            venueName:
              true,

            address:
              true,

            city:
              true,

            country:
              true,

            startsAt:
              true,

            endsAt:
              true,

            timezone:
              true,

            status:
              true,

            organizer: {
              select: {
                firstName:
                  true,

                lastName:
                  true,

                organizerProfile: {
                  select: {
                    businessName:
                      true,
                  },
                },

                organizerSettings: {
                  select: {
                    allowTicketTransfer:
                      true,
                  },
                },
              },
            },
          },
        },

        order: {
          select: {
            id:
              true,

            reference:
              true,

            currency:
              true,

            subtotal:
              true,

            platformFee:
              true,

            total:
              true,

            status:
              true,

            paidAt:
              true,

            createdAt:
              true,
          },
        },
      },
    });

  if (!ticket) {
    notFound();
  }

  const qrCodeDataUrl =
    await generateQrCodeDataUrl(
      ticket.qrCodeValue ||
        ticket.code,
    );

  const StatusIcon =
    getTicketStatusIcon(
      ticket.status,
    );

  const eventHasNotStarted =
    ticket.event.startsAt.getTime() >
    Date.now();

  const organizerAllowsTransfer =
    ticket.event.organizer
      .organizerSettings
      ?.allowTicketTransfer !==
    false;

  const canTransfer =
    ticket.status ===
      TicketStatus.VALID &&
    eventHasNotStarted &&
    organizerAllowsTransfer;

  const holderPhone =
    normalizeText(
      ticket.holderPhone,
    );

  const organizerName =
    normalizeText(
      ticket.event.organizer
        .organizerProfile
        ?.businessName,
    ) ||
    `${normalizeText(
      ticket.event.organizer
        .firstName,
    )} ${normalizeText(
      ticket.event.organizer
        .lastName,
    )}`
      .replace(
        /\s+/g,
        " ",
      )
      .trim() ||
    "Organisateur Tikemia";

  return (
    <div className="w-full min-w-0 max-w-none self-stretch pb-[calc(7.5rem+env(safe-area-inset-bottom))] lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/account/tickets"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-black text-neutral-400 transition hover:border-white/[0.14] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Mes billets
        </Link>

        <span
          className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-black ${getTicketStatusClassName(
            ticket.status,
          )}`}
        >
          <StatusIcon className="h-4 w-4" />
          {getTicketStatusLabel(
            ticket.status,
          )}
        </span>
      </div>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#071015] shadow-[0_22px_70px_rgba(0,0,0,0.22)]">
          <div className="relative aspect-[16/8] overflow-hidden bg-[#03090d] sm:aspect-[16/7]">
            {ticket.event.coverImage ? (
              <Image
                src={ticket.event.coverImage}
                alt={ticket.event.title}
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 70vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_42%),#03090d]">
                <Ticket className="h-20 w-20 text-white/[0.12]" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-[#071015] via-[#071015]/20 to-black/20" />

            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-lime-400">
                {ticket.ticketType.name}
              </p>

              <h1 className="mt-2 max-w-3xl text-2xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                {ticket.event.title}
              </h1>

              <p className="mt-3 text-sm text-neutral-400">
                Organisé par{" "}
                <span className="font-bold text-neutral-200">
                  {organizerName}
                </span>
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <TicketInformation
                icon={CalendarDays}
                label="Date"
                value={formatDate(
                  ticket.event.startsAt,
                )}
              />

              <TicketInformation
                icon={Clock3}
                label="Heure"
                value={formatTime(
                  ticket.event.startsAt,
                )}
              />

              <TicketInformation
                icon={MapPin}
                label="Lieu"
                value={`${ticket.event.venueName}, ${ticket.event.city}`}
              />

              <TicketInformation
                icon={UserRound}
                label="Détenteur"
                value={ticket.holderName}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/[0.07] bg-[#03090d] p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-400/15 bg-lime-400/[0.07] text-lime-300">
                  <MapPin className="h-4.5 w-4.5" />
                </span>

                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-700">
                    Adresse complète
                  </p>

                  <p className="mt-1 text-sm font-bold leading-6 text-neutral-300">
                    {ticket.event.address},{" "}
                    {ticket.event.city},{" "}
                    {ticket.event.country}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.07] bg-[#03090d] p-4 sm:p-5">
                <div className="flex items-center gap-2 text-lime-300">
                  <UserRound className="h-4 w-4" />

                  <p className="text-[10px] font-black uppercase tracking-[0.13em]">
                    Informations du détenteur
                  </p>
                </div>

                <dl className="mt-4 space-y-3 text-sm">
                  <DetailRow
                    label="Nom"
                    value={ticket.holderName}
                  />

                  <DetailRow
                    label="E-mail"
                    value={ticket.holderEmail}
                  />

                  {holderPhone && (
                    <DetailRow
                      label="Téléphone"
                      value={holderPhone}
                    />
                  )}
                </dl>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-[#03090d] p-4 sm:p-5">
                <div className="flex items-center gap-2 text-orange-300">
                  <ReceiptText className="h-4 w-4" />

                  <p className="text-[10px] font-black uppercase tracking-[0.13em]">
                    Informations de commande
                  </p>
                </div>

                <dl className="mt-4 space-y-3 text-sm">
                  <DetailRow
                    label="Référence"
                    value={ticket.order.reference}
                  />

                  <DetailRow
                    label="Catégorie"
                    value={ticket.ticketType.name}
                  />

                  <DetailRow
                    label="Prix du billet"
                    value={formatAmount(
                      ticket.ticketType.price,
                      ticket.order.currency,
                    )}
                  />

                  <DetailRow
                    label="Total commande"
                    value={formatAmount(
                      ticket.order.total,
                      ticket.order.currency,
                    )}
                  />

                  <DetailRow
                    label="Payé le"
                    value={formatDateTime(
                      ticket.order.paidAt ??
                        ticket.order.createdAt,
                    )}
                  />
                </dl>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/[0.07] bg-[#03090d] p-4 sm:p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-700">
                Code du billet
              </p>

              <p className="mt-2 break-all font-mono text-sm font-bold text-neutral-200">
                {ticket.code}
              </p>
            </div>
          </div>
        </div>

        <aside className="min-w-0">
          <div className="sticky top-24 overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#071015] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)] sm:p-6">
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                <ShieldCheck className="h-6 w-6" />
              </span>

              <h2 className="mt-4 text-xl font-black tracking-[-0.03em] text-white">
                QR code sécurisé
              </h2>

              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Présentez ce QR code à l’entrée de l’événement.
              </p>
            </div>

            <div className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.08] bg-white p-4">
              {qrCodeDataUrl ? (
                <Image
                  src={qrCodeDataUrl}
                  alt={`QR code du billet ${ticket.code}`}
                  width={520}
                  height={520}
                  unoptimized
                  className="mx-auto h-auto w-full max-w-[320px]"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-neutral-100">
                  <QrCode className="h-20 w-20 text-neutral-400" />
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-white/[0.07] bg-[#03090d] p-4 text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-700">
                Identifiant du billet
              </p>

              <p className="mt-2 break-all font-mono text-xs font-bold text-neutral-300">
                {ticket.code}
              </p>
            </div>

            {ticket.status !==
              TicketStatus.VALID && (
              <div className="mt-4 rounded-2xl border border-orange-400/20 bg-orange-400/[0.07] p-4 text-sm leading-6 text-orange-200">
                Ce billet n’est plus dans un état valide. Il ne doit pas être utilisé à l’entrée.
              </div>
            )}

            <div className="mt-5 grid gap-2">
              <Link
                href={`/api/client/tickets/${ticket.id}/download`}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white transition hover:scale-[1.01]"
              >
                <Download className="h-4.5 w-4.5" />
                Télécharger le PDF
              </Link>

              {canTransfer ? (
                <Link
                  href={`/account/transfers?ticket=${encodeURIComponent(
                    ticket.id,
                  )}`}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-orange-400/20 bg-orange-400/[0.07] px-5 text-sm font-black text-orange-300 transition hover:bg-orange-400/[0.12]"
                >
                  <Send className="h-4.5 w-4.5" />
                  Transférer ce billet
                </Link>
              ) : (
                <span className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 text-sm font-black text-neutral-700">
                  <Send className="h-4.5 w-4.5" />
                  Transfert indisponible
                </span>
              )}

              <Link
                href={`/events/${ticket.event.slug}`}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 text-sm font-black text-neutral-400 transition hover:border-white/[0.14] hover:text-white"
              >
                Voir l’événement
              </Link>
            </div>

            <p className="mt-5 text-center text-[11px] leading-5 text-neutral-700">
              Ne partagez pas publiquement ce QR code. Le premier scan valide peut être considéré comme définitif.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function TicketInformation({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ticket;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/[0.07] bg-[#03090d] p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-lime-400">
        <Icon className="h-4.5 w-4.5" />
      </span>

      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-700">
          {label}
        </p>

        <p className="mt-1 text-sm font-bold leading-6 text-neutral-300">
          {value}
        </p>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] pb-3 last:border-b-0 last:pb-0">
      <dt className="text-neutral-600">
        {label}
      </dt>

      <dd className="min-w-0 break-words text-right font-bold text-neutral-300">
        {value}
      </dd>
    </div>
  );
}