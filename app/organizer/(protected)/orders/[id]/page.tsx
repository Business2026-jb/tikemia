import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  QrCode,
  ReceiptText,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  TicketCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";

import {
  formatMoney,
} from "@/lib/localization/format-money";
import {
  getOrganizerOrderDetails,
  GetOrganizerOrderDetailsError,
  type OrganizerOrderDetailTicket,
  type OrganizerOrderDetails,
} from "@/lib/organizer/get-organizer-order-details";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrganizerOrderDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function formatDateTime({
  value,
  timezone,
}: {
  value: string | null;
  timezone?: string;
}): string {
  if (!value) {
    return "Non renseigné";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date indisponible";
  }

  try {
    return new Intl.DateTimeFormat(
      "fr-FR",
      {
        day:
          "2-digit",
        month:
          "long",
        year:
          "numeric",
        hour:
          "2-digit",
        minute:
          "2-digit",
        ...(timezone
          ? {
              timeZone:
                timezone,
            }
          : {}),
      },
    ).format(date);
  } catch {
    return new Intl.DateTimeFormat(
      "fr-FR",
      {
        day:
          "2-digit",
        month:
          "long",
        year:
          "numeric",
        hour:
          "2-digit",
        minute:
          "2-digit",
      },
    ).format(date);
  }
}

function normalizeText(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized =
    value?.trim() ?? "";

  return normalized || fallback;
}

async function getConnectedOrganizer() {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    redirect("/organizer/login");
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(
            sessionToken,
          ),
      },

      select: {
        id:
          true,

        expiresAt:
          true,

        user: {
          select: {
            id:
              true,

            role:
              true,

            emailVerified:
              true,

            isActive:
              true,
          },
        },
      },
    });

  if (!session) {
    redirect("/organizer/login");
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id:
            session.id,
        },
      })
      .catch(
        (
          error: unknown,
        ) => {
          console.error(
            "[ORDER_DETAILS_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    redirect("/organizer/login");
  }

  if (
    session.user.role !==
      "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    redirect("/organizer/login");
  }

  return session.user;
}

type OrganizerOrderDetailsPageData = Awaited<
  ReturnType<typeof getOrganizerOrderDetails>
>;

type OrganizerOrderDetailsLoadResult =
  | {
      success: true;
      data: OrganizerOrderDetailsPageData;
    }
  | {
      success: false;
      message: string;
    };

async function loadOrganizerOrderDetailsPageData({
  organizerId,
  orderId,
}: {
  organizerId: string;
  orderId: string;
}): Promise<OrganizerOrderDetailsLoadResult> {
  try {
    const data =
      await getOrganizerOrderDetails({
        organizerId,
        orderId,
      });

    return {
      success:
        true,

      data,
    };
  } catch (error) {
    if (
      error instanceof
      GetOrganizerOrderDetailsError
    ) {
      if (
        error.status ===
          401 ||
        error.status ===
          403
      ) {
        redirect("/organizer/login");
      }

      if (
        error.status ===
        404
      ) {
        notFound();
      }

      return {
        success:
          false,

        message:
          error.message,
      };
    }

    console.error(
      "[ORGANIZER_ORDER_DETAILS_PAGE_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return {
      success:
        false,

      message:
        "Impossible de charger les détails de cette commande pour le moment.",
    };
  }
}

export default async function OrganizerOrderDetailsPage({
  params,
}: OrganizerOrderDetailsPageProps) {
  const organizer =
    await getConnectedOrganizer();

  const resolvedParams =
    await params;

  const orderId =
    resolvedParams.id?.trim();

  if (!orderId) {
    notFound();
  }

  const result =
    await loadOrganizerOrderDetailsPageData({
      organizerId:
        organizer.id,

      orderId,
    });

  if (!result.success) {
    return (
      <OrderDetailsError
        message={
          result.message
        }
      />
    );
  }

  const {
    order,
    generatedAt,
  } = result.data;

  return (
    <div className="space-y-6">
      <OrderHeader
        order={order}
        generatedAt={
          generatedAt
        }
      />

      {order.integrity
        .hasFinancialInconsistency && (
        <IntegrityAlert />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={ShoppingBag}
          label="Statut de la commande"
          value={getOrderStatusLabel(
            order.status,
          )}
          description={`Référence ${order.reference}`}
          tone={getOrderStatusTone(
            order.status,
          )}
        />

        <SummaryCard
          icon={TicketCheck}
          label="Billets générés"
          value={order.ticketSummary.total.toLocaleString(
            "fr-FR",
          )}
          description={`${order.ticketSummary.valid} valide(s), ${order.ticketSummary.used} utilisé(s)`}
          tone="blue"
        />

        <SummaryCard
          icon={CircleDollarSign}
          label="Net organisateur"
          value={formatMoney({
            amount:
              order.organizerNet,
            currency:
              order.currency,
          })}
          description={`Devise ${order.currency}`}
          tone="green"
        />

        <SummaryCard
          icon={CreditCard}
          label="Statut du paiement"
          value={
            order.payment
              ? getPaymentStatusLabel(
                  order.payment.status,
                )
              : "Aucun paiement"
          }
          description={
            order.payment
              ? normalizeText(
                  order.payment.method,
                  "Moyen non renseigné",
                )
              : "Paiement non associé"
          }
          tone={
            order.payment?.status ===
            "SUCCESS"
              ? "green"
              : order.payment?.status ===
                  "PENDING"
                ? "orange"
                : order.payment
                  ? "red"
                  : "neutral"
          }
        />
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <EventCard
            order={order}
          />

          <CustomerCard
            order={order}
          />

          <OrderItemsCard
            order={order}
          />

          <TicketsCard
            order={order}
          />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6">
          <FinancialCard
            order={order}
          />

          <PaymentCard
            order={order}
          />

          <IntegrityCard
            order={order}
          />

          <ActionsCard
            order={order}
          />
        </aside>
      </section>
    </div>
  );
}

function OrderHeader({
  order,
  generatedAt,
}: {
  order: OrganizerOrderDetails;
  generatedAt: string;
}) {
  const status =
    getOrderStatusPresentation(
      order.status,
    );

  const StatusIcon =
    status.icon;

  return (
    <header className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#081015] px-4 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:px-5 sm:py-6 lg:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.08),transparent_30%)]" />

      <div className="relative">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Link
              href="/organizer/orders"
              className="inline-flex items-center gap-2 text-xs font-black text-neutral-500 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux commandes
            </Link>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black ${status.badge}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {status.label}
              </span>

              <span className="rounded-full border border-orange-500/20 bg-orange-500/[0.06] px-3 py-1.5 text-[10px] font-black text-orange-300">
                {order.currency}
              </span>

              {order.customer.isGuest && (
                <span className="rounded-full border border-sky-500/20 bg-sky-500/[0.06] px-3 py-1.5 text-[10px] font-black text-sky-300">
                  Achat invité
                </span>
              )}
            </div>

            <h1 className="mt-4 break-words text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl lg:text-4xl">
              Commande{" "}
              {order.reference}
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-500">
              Consultez les informations complètes de
              la commande, du client, de l’événement,
              du paiement et de chaque billet généré.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-600">
              <span>
                Créée le{" "}
                <strong className="font-black text-neutral-300">
                  {formatDateTime({
                    value:
                      order.createdAt,
                  })}
                </strong>
              </span>

              <span>
                Payée le{" "}
                <strong className="font-black text-neutral-300">
                  {formatDateTime({
                    value:
                      order.paidAt,
                  })}
                </strong>
              </span>

              <span>
                Actualisée le{" "}
                <strong className="font-black text-neutral-300">
                  {formatDateTime({
                    value:
                      generatedAt,
                  })}
                </strong>
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[390px]">
            <ActionLink
              href={`/api/organizer/orders/${order.id}/receipt`}
              icon={Download}
              title="Télécharger le reçu"
              description="Reçu de commande au format PDF"
              external
            />

            <ActionLink
              href={`/api/organizer/orders/${order.id}/tickets`}
              icon={TicketCheck}
              title="Télécharger les billets"
              description="Tous les billets de la commande"
              external
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function IntegrityAlert() {
  return (
    <section className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10">
          <ShieldAlert className="h-5 w-5 text-red-400" />
        </div>

        <div>
          <h2 className="text-sm font-black text-white">
            Vérification interne requise
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Une incohérence a été détectée entre la
            commande, le paiement, l’événement ou les
            billets. Aucun montant ne doit être modifié
            manuellement avant vérification.
          </p>
        </div>
      </div>
    </section>
  );
}

function EventCard({
  order,
}: {
  order: OrganizerOrderDetails;
}) {
  return (
    <SectionCard
      icon={CalendarDays}
      title="Événement"
      description="Événement concerné par la commande"
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] sm:w-[240px]">
          {order.event.coverImage ? (
            <Image
              src={
                order.event.coverImage
              }
              alt={
                order.event.title
              }
              fill
              sizes="(max-width: 640px) 100vw, 240px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <CalendarDays className="h-10 w-10 text-neutral-700" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-1 text-[10px] font-black text-lime-400">
              {order.event.status}
            </span>

            {order.event.category && (
              <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-black text-neutral-500">
                {order.event.category.name}
              </span>
            )}
          </div>

          <h3 className="mt-3 text-xl font-black tracking-[-0.02em] text-white">
            {order.event.title}
          </h3>

          <p className="mt-2 line-clamp-3 text-xs leading-5 text-neutral-500">
            {order.event.description}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InformationLine
              icon={CalendarDays}
              label="Début"
              value={formatDateTime({
                value:
                  order.event.startsAt,
                timezone:
                  order.event.timezone,
              })}
            />

            <InformationLine
              icon={Clock3}
              label="Fin"
              value={formatDateTime({
                value:
                  order.event.endsAt,
                timezone:
                  order.event.timezone,
              })}
            />

            <InformationLine
              icon={MapPin}
              label="Lieu"
              value={`${order.event.venueName}, ${order.event.address}`}
            />

            <InformationLine
              icon={MapPin}
              label="Ville et pays"
              value={`${order.event.city}, ${order.event.country} (${order.event.countryCode})`}
            />
          </div>

          <Link
            href={`/organizer/events/${order.event.id}`}
            className="mt-4 inline-flex items-center gap-2 text-xs font-black text-lime-400 transition hover:text-white"
          >
            Ouvrir l’événement
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </SectionCard>
  );
}

function CustomerCard({
  order,
}: {
  order: OrganizerOrderDetails;
}) {
  return (
    <SectionCard
      icon={UserRound}
      title="Acheteur"
      description="Informations conservées au moment de l’achat"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-violet-500/25 bg-violet-500/10">
              <UserRound className="h-5 w-5 text-violet-400" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-white">
                {normalizeText(
                  order.customer.name,
                  "Acheteur Tikemia",
                )}
              </p>

              <p className="mt-1 text-xs text-neutral-600">
                {order.customer.isGuest
                  ? "Client invité"
                  : "Client enregistré"}
              </p>
            </div>

            {!order.customer.isGuest && (
              <BadgeCheck className="h-5 w-5 shrink-0 text-lime-400" />
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ContactBox
              icon={Mail}
              label="E-mail"
              value={normalizeText(
                order.customer.email,
                "Non renseigné",
              )}
              href={
                order.customer.email
                  ? `mailto:${order.customer.email}`
                  : undefined
              }
            />

            <ContactBox
              icon={Phone}
              label="Téléphone"
              value={normalizeText(
                order.customer.phone,
                "Non renseigné",
              )}
              href={
                order.customer.phone
                  ? `tel:${order.customer.phone}`
                  : undefined
              }
            />

            <ContactBox
              icon={MapPin}
              label="Pays"
              value={
                order.customer.country
                  ? `${order.customer.country}${
                      order.customer.countryCode
                        ? ` (${order.customer.countryCode})`
                        : ""
                    }`
                  : "Non renseigné"
              }
            />

            <ContactBox
              icon={ShieldCheck}
              label="Compte"
              value={
                order.customer.isGuest
                  ? "Aucun compte associé"
                  : order.customer.accountActive
                    ? "Compte actif"
                    : "Compte inactif"
              }
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
          <p className="text-xs font-black text-white">
            Vérification du client
          </p>

          <div className="mt-4 space-y-3">
            <BooleanStatus
              label="Compte enregistré"
              value={
                !order.customer.isGuest
              }
            />

            <BooleanStatus
              label="E-mail vérifié"
              value={
                order.customer.emailVerified
              }
              unknownLabel="Non applicable"
            />

            <BooleanStatus
              label="Compte actif"
              value={
                order.customer.accountActive
              }
              unknownLabel="Non applicable"
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function OrderItemsCard({
  order,
}: {
  order: OrganizerOrderDetails;
}) {
  return (
    <SectionCard
      icon={ReceiptText}
      title="Articles de la commande"
      description="Types de billets, quantités et montants"
    >
      <div className="space-y-3">
        {order.items.map(
          (item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-white">
                      {item.ticketTypeName}
                    </h3>

                    <span className="rounded-full border border-sky-500/20 bg-sky-500/[0.06] px-2.5 py-1 text-[10px] font-black text-sky-300">
                      {item.quantity.toLocaleString(
                        "fr-FR",
                      )}{" "}
                      billet
                      {item.quantity > 1
                        ? "s"
                        : ""}
                    </span>
                  </div>

                  {item.ticketTypeDescription && (
                    <p className="mt-2 text-xs leading-5 text-neutral-600">
                      {item.ticketTypeDescription}
                    </p>
                  )}
                </div>

                <div className="grid min-w-0 gap-2 sm:grid-cols-4 lg:min-w-[570px]">
                  <MiniMoney
                    label="Prix unitaire"
                    value={formatMoney({
                      amount:
                        item.unitPrice,
                      currency:
                        order.currency,
                    })}
                  />

                  <MiniMoney
                    label="Sous-total"
                    value={formatMoney({
                      amount:
                        item.subtotal,
                      currency:
                        order.currency,
                    })}
                  />

                  <MiniMoney
                    label="Commission"
                    value={formatMoney({
                      amount:
                        item.platformFee,
                      currency:
                        order.currency,
                    })}
                    tone="orange"
                  />

                  <MiniMoney
                    label="Total"
                    value={formatMoney({
                      amount:
                        item.total,
                      currency:
                        order.currency,
                    })}
                    tone="green"
                  />
                </div>
              </div>
            </article>
          ),
        )}
      </div>
    </SectionCard>
  );
}

function TicketsCard({
  order,
}: {
  order: OrganizerOrderDetails;
}) {
  return (
    <SectionCard
      icon={QrCode}
      title="Billets générés"
      description="Détenteurs, codes et statut d’utilisation"
    >
      {order.tickets.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {order.tickets.map(
            (ticket) => (
              <TicketCard
                key={
                  ticket.id
                }
                ticket={
                  ticket
                }
              />
            ),
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-10 text-center">
          <TicketCheck className="mx-auto h-7 w-7 text-neutral-700" />

          <p className="mt-3 text-sm font-black text-white">
            Aucun billet généré
          </p>

          <p className="mt-1 text-xs text-neutral-600">
            Les billets apparaîtront ici après validation du paiement.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function TicketCard({
  ticket,
}: {
  ticket: OrganizerOrderDetailTicket;
}) {
  const status =
    getTicketStatusPresentation(
      ticket.status,
    );

  const StatusIcon =
    status.icon;

  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${status.badge}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </span>

          <p className="mt-3 break-all text-sm font-black text-white">
            {ticket.code}
          </p>

          <p className="mt-1 text-[10px] text-neutral-600">
            {ticket.ticketType.name}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
          <QrCode className="h-5 w-5 text-neutral-500" />
        </div>
      </div>

      <div className="mt-4 space-y-2.5 border-t border-white/[0.06] pt-4">
        <DetailRow
          label="Détenteur"
          value={ticket.holder.name}
        />

        <DetailRow
          label="E-mail"
          value={normalizeText(
            ticket.holder.email,
            "Non renseigné",
          )}
        />

        <DetailRow
          label="Téléphone"
          value={normalizeText(
            ticket.holder.phone,
            "Non renseigné",
          )}
        />

        <DetailRow
          label="Utilisé le"
          value={formatDateTime({
            value:
              ticket.usedAt,
          })}
        />
      </div>
    </article>
  );
}

function FinancialCard({
  order,
}: {
  order: OrganizerOrderDetails;
}) {
  return (
    <AsideCard
      icon={CircleDollarSign}
      title="Résumé financier"
      description="Montants définitifs de la commande"
    >
      <div className="space-y-3">
        <MoneyRow
          label="Sous-total"
          value={formatMoney({
            amount:
              order.subtotal,
            currency:
              order.currency,
          })}
        />

        <MoneyRow
          label="Commission Tikemia"
          value={formatMoney({
            amount:
              order.platformFee,
            currency:
              order.currency,
          })}
          tone="orange"
        />

        <MoneyRow
          label="Total facturé"
          value={formatMoney({
            amount:
              order.total,
            currency:
              order.currency,
          })}
        />

        <div className="border-t border-dashed border-white/[0.08]" />

        <MoneyRow
          label="Net organisateur"
          value={formatMoney({
            amount:
              order.organizerNet,
            currency:
              order.currency,
          })}
          tone="green"
          strong
        />
      </div>

      <div className="mt-4 rounded-xl border border-orange-500/18 bg-orange-500/[0.04] p-3">
        <p className="text-[10px] leading-5 text-neutral-600">
          Tous les montants sont conservés en{" "}
          <strong className="text-orange-300">
            {order.currency}
          </strong>
          . Aucune conversion automatique n’est appliquée.
        </p>
      </div>
    </AsideCard>
  );
}

function PaymentCard({
  order,
}: {
  order: OrganizerOrderDetails;
}) {
  return (
    <AsideCard
      icon={CreditCard}
      title="Paiement"
      description="Prestataire et référence financière"
    >
      {order.payment ? (
        <div className="space-y-3">
          <PaymentStatusBadge
            status={
              order.payment.status
            }
          />

          <DetailRow
            label="Prestataire"
            value={normalizeText(
              order.payment.provider,
              "Non renseigné",
            )}
          />

          <DetailRow
            label="Moyen"
            value={normalizeText(
              order.payment.method,
              "Non renseigné",
            )}
          />

          <DetailRow
            label="Référence"
            value={normalizeText(
              order.payment.providerReference,
              "Non disponible",
            )}
          />

          <DetailRow
            label="Montant"
            value={formatMoney({
              amount:
                order.payment.amount,
              currency:
                order.payment.currency,
            })}
          />

          <DetailRow
            label="Payé le"
            value={formatDateTime({
              value:
                order.payment.paidAt,
            })}
          />

          {order.payment.failureReason && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3">
              <p className="text-[10px] font-black text-red-400">
                Motif de l’échec
              </p>

              <p className="mt-1 text-[10px] leading-5 text-neutral-500">
                {order.payment.failureReason}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center">
          <CreditCard className="mx-auto h-6 w-6 text-neutral-700" />

          <p className="mt-3 text-xs font-black text-white">
            Aucun paiement associé
          </p>

          <p className="mt-1 text-[10px] leading-5 text-neutral-600">
            Cette commande ne possède pas encore d’enregistrement de paiement.
          </p>
        </div>
      )}
    </AsideCard>
  );
}

function IntegrityCard({
  order,
}: {
  order: OrganizerOrderDetails;
}) {
  return (
    <AsideCard
      icon={ShieldCheck}
      title="Contrôle d’intégrité"
      description="Vérification automatique des données"
    >
      <div className="space-y-3">
        <BooleanStatus
          label="Devise commande / événement"
          value={
            order.integrity
              .orderCurrencyMatchesEvent
          }
        />

        <BooleanStatus
          label="Devise paiement / commande"
          value={
            order.integrity
              .paymentCurrencyMatchesOrder
          }
          unknownLabel="Aucun paiement"
        />

        <BooleanStatus
          label="Montant paiement / total"
          value={
            order.integrity
              .paymentAmountMatchesOrderTotal
          }
          unknownLabel="Aucun paiement"
        />

        <BooleanStatus
          label="Quantités / billets générés"
          value={
            order.integrity
              .itemQuantitiesMatchTickets
          }
        />
      </div>
    </AsideCard>
  );
}

function ActionsCard({
  order,
}: {
  order: OrganizerOrderDetails;
}) {
  return (
    <AsideCard
      icon={Download}
      title="Documents"
      description="Téléchargements liés à la commande"
    >
      <div className="space-y-2">
        <DocumentLink
          href={`/api/organizer/orders/${order.id}/receipt`}
          icon={ReceiptText}
          label="Reçu de la commande"
          description="Document PDF récapitulatif"
        />

        <DocumentLink
          href={`/api/organizer/orders/${order.id}/tickets`}
          icon={TicketCheck}
          label="Billets de la commande"
          description="Archive des billets générés"
        />

        <DocumentLink
          href={`/api/organizer/orders/${order.id}/export?format=csv`}
          icon={FileText}
          label="Données CSV"
          description="Export technique de la commande"
        />
      </div>
    </AsideCard>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
      <header className="border-b border-white/[0.07] px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2.5">
          <Icon className="h-5 w-5 text-lime-400" />

          <h2 className="text-base font-black text-white">
            {title}
          </h2>
        </div>

        <p className="mt-1 text-xs leading-5 text-neutral-600">
          {description}
        </p>
      </header>

      <div className="p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}

function AsideCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
      <header className="border-b border-white/[0.07] px-4 py-4">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-lime-400" />

          <h2 className="text-sm font-black text-white">
            {title}
          </h2>
        </div>

        <p className="mt-1 text-[10px] leading-5 text-neutral-600">
          {description}
        </p>
      </header>

      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  label: string;
  value: string;
  description: string;
  tone:
    | "green"
    | "orange"
    | "blue"
    | "red"
    | "neutral";
}) {
  const styles = {
    green: {
      wrapper:
        "border-emerald-500/18 bg-emerald-500/[0.035]",
      icon:
        "border-emerald-500/25 bg-emerald-500/10 text-lime-400",
      value:
        "text-lime-400",
    },
    orange: {
      wrapper:
        "border-orange-500/18 bg-orange-500/[0.035]",
      icon:
        "border-orange-500/25 bg-orange-500/10 text-orange-400",
      value:
        "text-orange-400",
    },
    blue: {
      wrapper:
        "border-sky-500/18 bg-sky-500/[0.035]",
      icon:
        "border-sky-500/25 bg-sky-500/10 text-sky-400",
      value:
        "text-sky-400",
    },
    red: {
      wrapper:
        "border-red-500/18 bg-red-500/[0.035]",
      icon:
        "border-red-500/25 bg-red-500/10 text-red-400",
      value:
        "text-red-400",
    },
    neutral: {
      wrapper:
        "border-white/[0.08] bg-[#081015]",
      icon:
        "border-white/[0.08] bg-white/[0.03] text-neutral-400",
      value:
        "text-white",
    },
  } as const;

  const style =
    styles[tone];

  return (
    <article
      className={`rounded-2xl border p-4 ${style.wrapper}`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${style.icon}`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>

      <p
        className={`mt-4 break-words text-xl font-black tracking-[-0.03em] ${style.value}`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs font-black text-neutral-300">
        {label}
      </p>

      <p className="mt-1 text-[10px] leading-5 text-neutral-600">
        {description}
      </p>
    </article>
  );
}

function InformationLine({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" />

      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-[0.1em] text-neutral-700">
          {label}
        </p>

        <p className="mt-1 break-words text-[11px] font-bold leading-5 text-neutral-400">
          {value}
        </p>
      </div>
    </div>
  );
}

function ContactBox({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex min-w-0 items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" />

      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-[0.1em] text-neutral-700">
          {label}
        </p>

        <p className="mt-1 break-words text-[11px] font-bold leading-5 text-neutral-400">
          {value}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3 transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.03]"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
      {content}
    </div>
  );
}

function BooleanStatus({
  label,
  value,
  unknownLabel = "Non disponible",
}: {
  label: string;
  value: boolean | null;
  unknownLabel?: string;
}) {
  const isUnknown =
    value === null;

  const Icon =
    isUnknown
      ? Clock3
      : value
        ? CheckCircle2
        : XCircle;

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-neutral-600">
        {label}
      </span>

      <span
        className={`inline-flex items-center gap-1.5 text-[10px] font-black ${
          isUnknown
            ? "text-neutral-500"
            : value
              ? "text-lime-400"
              : "text-red-400"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />

        {isUnknown
          ? unknownLabel
          : value
            ? "Conforme"
            : "À vérifier"}
      </span>
    </div>
  );
}

function MiniMoney({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?:
    | "default"
    | "green"
    | "orange";
}) {
  const valueClassName =
    tone === "green"
      ? "text-lime-400"
      : tone === "orange"
        ? "text-orange-400"
        : "text-white";

  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-black/10 p-3">
      <p className="text-[9px] uppercase tracking-[0.08em] text-neutral-700">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-[11px] font-black ${valueClassName}`}
      >
        {value}
      </p>
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
    <div className="flex items-start justify-between gap-4">
      <span className="text-[10px] text-neutral-600">
        {label}
      </span>

      <span className="max-w-[220px] break-words text-right text-[10px] font-bold leading-5 text-neutral-300">
        {value}
      </span>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  tone = "default",
  strong = false,
}: {
  label: string;
  value: string;
  tone?:
    | "default"
    | "green"
    | "orange";
  strong?: boolean;
}) {
  const valueClassName =
    tone === "green"
      ? "text-lime-400"
      : tone === "orange"
        ? "text-orange-400"
        : "text-white";

  return (
    <div className="flex items-start justify-between gap-4">
      <span
        className={`text-[11px] ${
          strong
            ? "font-black text-neutral-300"
            : "text-neutral-600"
        }`}
      >
        {label}
      </span>

      <span
        className={`max-w-[190px] break-words text-right ${
          strong
            ? "text-sm"
            : "text-xs"
        } font-black ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

function PaymentStatusBadge({
  status,
}: {
  status: OrganizerOrderDetails["payment"] extends null
    ? never
    : NonNullable<
        OrganizerOrderDetails["payment"]
      >["status"];
}) {
  const presentation =
    getPaymentStatusPresentation(
      status,
    );

  const Icon =
    presentation.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${presentation.badge}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {presentation.label}
    </span>
  );
}

function DocumentLink({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  label: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.035]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
        <Icon className="h-4 w-4 text-neutral-500" />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-black text-white">
          {label}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-neutral-600">
          {description}
        </p>
      </div>
    </a>
  );
}

function ActionLink({
  href,
  icon: Icon,
  title,
  description,
  external = false,
}: {
  href: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  title: string;
  description: string;
  external?: boolean;
}) {
  const className =
    "group flex min-h-[82px] items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-emerald-500/25 hover:bg-emerald-500/[0.045]";

  const content = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
        <Icon className="h-4 w-4 text-neutral-400 transition group-hover:text-lime-400" />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-black text-white">
          {title}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-neutral-600">
          {description}
        </p>
      </div>
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={className}
    >
      {content}
    </Link>
  );
}

function getOrderStatusLabel(
  status: OrganizerOrderDetails["status"],
): string {
  return getOrderStatusPresentation(
    status,
  ).label;
}

function getOrderStatusTone(
  status: OrganizerOrderDetails["status"],
):
  | "green"
  | "orange"
  | "red"
  | "neutral" {
  switch (status) {
    case "PAID":
      return "green";

    case "PENDING":
    case "PROCESSING":
      return "orange";

    case "FAILED":
    case "CANCELLED":
      return "red";

    case "EXPIRED":
    case "PARTIALLY_REFUNDED":
    case "REFUNDED":
    default:
      return "neutral";
  }
}

function getOrderStatusPresentation(
  status: OrganizerOrderDetails["status"],
) {
  switch (status) {
    case "PENDING":
      return {
        label:
          "En attente",
        icon:
          Clock3,
        badge:
          "border-amber-500/25 bg-amber-500/[0.08] text-amber-300",
      };

    case "PROCESSING":
      return {
        label:
          "Paiement en cours",
        icon:
          RefreshCcw,
        badge:
          "border-sky-500/25 bg-sky-500/[0.08] text-sky-300",
      };

    case "PAID":
      return {
        label:
          "Payée",
        icon:
          BadgeCheck,
        badge:
          "border-emerald-500/25 bg-emerald-500/[0.08] text-lime-400",
      };

    case "CANCELLED":
      return {
        label:
          "Annulée",
        icon:
          XCircle,
        badge:
          "border-red-500/25 bg-red-500/[0.08] text-red-400",
      };

    case "EXPIRED":
      return {
        label:
          "Expirée",
        icon:
          Clock3,
        badge:
          "border-orange-500/25 bg-orange-500/[0.08] text-orange-300",
      };

    case "PARTIALLY_REFUNDED":
      return {
        label:
          "Partiellement remboursée",
        icon:
          RefreshCcw,
        badge:
          "border-fuchsia-500/25 bg-fuchsia-500/[0.08] text-fuchsia-300",
      };

    case "REFUNDED":
      return {
        label:
          "Remboursée",
        icon:
          RefreshCcw,
        badge:
          "border-violet-500/25 bg-violet-500/[0.08] text-violet-400",
      };

    case "FAILED":
      return {
        label:
          "Échouée",
        icon:
          XCircle,
        badge:
          "border-red-500/25 bg-red-500/[0.08] text-red-400",
      };

    default:
      return {
        label:
          "Statut inconnu",
        icon:
          AlertTriangle,
        badge:
          "border-white/[0.12] bg-white/[0.04] text-neutral-300",
      };
  }
}

function getPaymentStatusLabel(
  status: NonNullable<
    OrganizerOrderDetails["payment"]
  >["status"],
): string {
  return getPaymentStatusPresentation(
    status,
  ).label;
}

function getPaymentStatusPresentation(
  status: NonNullable<
    OrganizerOrderDetails["payment"]
  >["status"],
) {
  switch (status) {
    case "PENDING":
      return {
        label:
          "En attente",
        icon:
          Clock3,
        badge:
          "border-amber-500/25 bg-amber-500/[0.08] text-amber-300",
      };

    case "PROCESSING":
      return {
        label:
          "Traitement en cours",
        icon:
          RefreshCcw,
        badge:
          "border-sky-500/25 bg-sky-500/[0.08] text-sky-300",
      };

    case "SUCCESS":
      return {
        label:
          "Réussi",
        icon:
          CheckCircle2,
        badge:
          "border-emerald-500/25 bg-emerald-500/[0.08] text-lime-400",
      };

    case "FAILED":
      return {
        label:
          "Échoué",
        icon:
          XCircle,
        badge:
          "border-red-500/25 bg-red-500/[0.08] text-red-400",
      };

    case "CANCELLED":
      return {
        label:
          "Annulé",
        icon:
          XCircle,
        badge:
          "border-neutral-500/25 bg-neutral-500/[0.08] text-neutral-300",
      };

    case "EXPIRED":
      return {
        label:
          "Expiré",
        icon:
          Clock3,
        badge:
          "border-orange-500/25 bg-orange-500/[0.08] text-orange-300",
      };

    case "PARTIALLY_REFUNDED":
      return {
        label:
          "Partiellement remboursé",
        icon:
          RefreshCcw,
        badge:
          "border-fuchsia-500/25 bg-fuchsia-500/[0.08] text-fuchsia-300",
      };

    case "REFUNDED":
      return {
        label:
          "Remboursé",
        icon:
          RefreshCcw,
        badge:
          "border-violet-500/25 bg-violet-500/[0.08] text-violet-400",
      };

    case "DISPUTED":
      return {
        label:
          "Contesté",
        icon:
          ShieldAlert,
        badge:
          "border-red-500/25 bg-red-500/[0.08] text-red-300",
      };

    default:
      return {
        label:
          "Statut inconnu",
        icon:
          AlertTriangle,
        badge:
          "border-white/[0.12] bg-white/[0.04] text-neutral-300",
      };
  }
}

function getTicketStatusPresentation(
  status: OrganizerOrderDetailTicket["status"],
) {
  switch (status) {
    case "VALID":
      return {
        label:
          "Valide",
        icon:
          CheckCircle2,
        badge:
          "border-emerald-500/25 bg-emerald-500/[0.08] text-lime-400",
      };

    case "USED":
      return {
        label:
          "Utilisé",
        icon:
          TicketCheck,
        badge:
          "border-sky-500/25 bg-sky-500/[0.08] text-sky-400",
      };

    case "CANCELLED":
      return {
        label:
          "Annulé",
        icon:
          XCircle,
        badge:
          "border-red-500/25 bg-red-500/[0.08] text-red-400",
      };

    case "REFUNDED":
      return {
        label:
          "Remboursé",
        icon:
          RefreshCcw,
        badge:
          "border-violet-500/25 bg-violet-500/[0.08] text-violet-400",
      };

    case "REVOKED":
      return {
        label:
          "Révoqué",
        icon:
          ShieldAlert,
        badge:
          "border-amber-500/25 bg-amber-500/[0.08] text-amber-300",
      };

    case "EXPIRED":
      return {
        label:
          "Expiré",
        icon:
          Clock3,
        badge:
          "border-neutral-500/25 bg-neutral-500/[0.08] text-neutral-300",
      };

    default:
      return {
        label:
          "Statut inconnu",
        icon:
          AlertTriangle,
        badge:
          "border-white/[0.12] bg-white/[0.04] text-neutral-300",
      };
  }
}

function OrderDetailsError({
  message,
}: {
  message: string;
}) {
  return (
    <section className="rounded-3xl border border-red-500/20 bg-red-500/[0.04] px-4 py-12 text-center sm:px-6 sm:py-16">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10">
        <AlertTriangle className="h-7 w-7 text-red-400" />
      </div>

      <h1 className="mt-5 text-2xl font-black tracking-[-0.03em] text-white">
        Impossible d’afficher la commande
      </h1>

      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-500">
        {message}
      </p>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/organizer/orders"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 text-xs font-black text-neutral-300 transition hover:border-white/[0.15] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux commandes
        </Link>

        <Link
          href="/organizer/dashboard"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-xs font-black text-white transition hover:scale-[1.01]"
        >
          Tableau de bord
        </Link>
      </div>
    </section>
  );
}