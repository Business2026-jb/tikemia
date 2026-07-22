import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  PencilLine,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import {
  notFound,
  redirect,
} from "next/navigation";

import EditEventForm from "@/components/organizer/events/edit/edit-event-form";
import {
  getEventForEdit,
  GetEventForEditError,
} from "@/lib/events/get-event-for-edit";

export const metadata: Metadata = {
  title: "Modifier un événement | Tikemia",
  description:
    "Modifiez les informations, les images et les billets de votre événement Tikemia.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrganizerEditEventPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrganizerEditEventPage({
  params,
}: OrganizerEditEventPageProps) {
  const { id: rawEventId } = await params;
  const eventId = rawEventId?.trim();

  if (!eventId) {
    notFound();
  }

  try {
    const data = await getEventForEdit(
      eventId,
    );

    return (
      <main className="mx-auto w-full max-w-[1600px]">
        <EditEventForm
          event={data.event}
          options={data.options}
        />
      </main>
    );
  } catch (error) {
    if (
      error instanceof
      GetEventForEditError
    ) {
      if (
        error.status === 401 ||
        error.code === "UNAUTHORIZED" ||
        error.code === "INVALID_SESSION" ||
        error.code === "EXPIRED_SESSION"
      ) {
        redirect(
          error.redirectTo ??
            "/organizer/login",
        );
      }

      if (
        error.status === 404 ||
        error.code === "EVENT_NOT_FOUND"
      ) {
        notFound();
      }

      if (error.redirectTo) {
        redirect(error.redirectTo);
      }

      return (
        <EditEventLoadError
          eventId={eventId}
          message={error.message}
          code={error.code}
        />
      );
    }

    console.error(
      "[ORGANIZER_EDIT_EVENT_PAGE_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return (
      <EditEventLoadError
        eventId={eventId}
        message="Impossible de charger cet événement pour modification."
        code="GET_EVENT_FOR_EDIT_FAILED"
      />
    );
  }
}

type EditEventLoadErrorProps = {
  eventId: string;
  message: string;
  code?: string;
};

function EditEventLoadError({
  eventId,
  message,
  code,
}: EditEventLoadErrorProps) {
  const isEventLocked =
    code ===
      "CANCELLED_EVENT_NOT_EDITABLE" ||
    code ===
      "COMPLETED_EVENT_NOT_EDITABLE" ||
    code === "EVENT_NOT_EDITABLE";

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-180px)] w-full max-w-[920px] items-center justify-center px-1 py-8 sm:px-4">
      <section className="w-full overflow-hidden rounded-2xl border border-orange-500/20 bg-[#081015] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <header className="border-b border-white/[0.07] bg-gradient-to-r from-orange-500/[0.08] via-red-500/[0.035] to-transparent px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/10">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
            </div>

            <div className="min-w-0">
              <h1 className="text-lg font-black tracking-[-0.025em] text-white sm:text-xl">
                {isEventLocked
                  ? "Modification indisponible"
                  : "Événement indisponible"}
              </h1>

              <p className="mt-1.5 text-sm leading-6 text-neutral-500">
                {isEventLocked
                  ? "Le statut actuel de cet événement ne permet plus sa modification."
                  : "Les informations nécessaires au formulaire n’ont pas pu être chargées."}
              </p>
            </div>
          </div>
        </header>

        <div className="p-5 sm:p-6">
          <div
            role="alert"
            className="rounded-xl border border-orange-500/25 bg-orange-500/[0.07] px-4 py-3.5 text-sm leading-6 text-orange-200"
          >
            {message}
          </div>

          <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-start gap-3">
              {isEventLocked ? (
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
              ) : (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
              )}

              <div>
                <p className="text-xs font-bold text-neutral-300">
                  {isEventLocked
                    ? "Protection de l’historique"
                    : "Accès sécurisé"}
                </p>

                <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                  {isEventLocked
                    ? "Les événements annulés ou terminés restent conservés afin de protéger les commandes, paiements, billets et rapports associés."
                    : "Tikemia vérifie la session et l’appartenance de l’événement avant d’autoriser toute modification."}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href="/organizer/events"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux événements
            </Link>

            <Link
              href={`/organizer/events/${encodeURIComponent(
                eventId,
              )}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 text-sm font-bold text-lime-400 transition hover:bg-emerald-500/10"
            >
              <PencilLine className="h-4 w-4" />
              Voir l’événement
            </Link>

            {!isEventLocked && (
              <Link
                href={`/organizer/events/${encodeURIComponent(
                  eventId,
                )}/edit`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_12px_35px_rgba(34,197,94,0.15)] transition hover:scale-[1.01]"
              >
                <RefreshCcw className="h-4 w-4" />
                Réessayer
              </Link>
            )}
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-white/[0.07] px-5 py-3.5 text-[11px] text-neutral-600 sm:px-6">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>
            Tikemia — Modification sécurisée
            des événements
          </span>
        </footer>
      </section>
    </main>
  );
}