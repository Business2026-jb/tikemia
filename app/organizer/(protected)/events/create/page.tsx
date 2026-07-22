import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus2,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import CreateEventForm from "@/components/organizer/events/create/create-event-form";
import {
  getCreateEventOptions,
  GetCreateEventOptionsError,
} from "@/lib/events/get-create-event-options";

export const metadata: Metadata = {
  title: "Créer un événement | Tikemia",
  description:
    "Créez, configurez et envoyez votre événement à Tikemia pour validation.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CreateOrganizerEventPage() {
  try {
    /*
     * Toutes les options sont chargées côté serveur :
     * - catégories actives depuis Supabase ;
     * - pays et devises autorisés ;
     * - fuseaux horaires ;
     * - commission officielle Tikemia ;
     * - limites de création.
     */
    const options = await getCreateEventOptions();

    return (
      <main className="mx-auto w-full max-w-[1600px]">
        <CreateEventForm options={options} />
      </main>
    );
  } catch (error) {
    const message =
      error instanceof GetCreateEventOptionsError
        ? error.message
        : "Impossible de préparer la création de l’événement.";

    console.error(
      "[CREATE_EVENT_PAGE_ERROR]",
      error instanceof Error ? error.message : error,
    );

    return <CreateEventLoadError message={message} />;
  }
}

type CreateEventLoadErrorProps = {
  message: string;
};

function CreateEventLoadError({
  message,
}: CreateEventLoadErrorProps) {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-180px)] w-full max-w-[900px] items-center justify-center px-1 py-8 sm:px-4">
      <section className="w-full overflow-hidden rounded-2xl border border-red-500/20 bg-[#081015] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <div className="border-b border-white/[0.07] bg-gradient-to-r from-red-500/[0.06] via-orange-500/[0.035] to-transparent px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>

            <div className="min-w-0">
              <h1 className="text-lg font-black tracking-[-0.02em] text-white sm:text-xl">
                Création d’événement indisponible
              </h1>

              <p className="mt-1.5 text-sm leading-6 text-neutral-500">
                Les informations nécessaires au formulaire n’ont pas pu
                être chargées.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div
            role="alert"
            className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3.5 text-sm leading-6 text-red-200"
          >
            {message}
          </div>

          <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

              <p className="text-xs leading-5 text-neutral-500">
                Vérifiez que les catégories Tikemia ont bien été
                enregistrées dans Supabase avec la commande{" "}
                <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-neutral-300">
                  npx prisma db seed
                </code>
                .
              </p>
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
              href="/organizer/events/create"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_12px_35px_rgba(34,197,94,0.15)] transition hover:scale-[1.01]"
            >
              <RefreshCcw className="h-4 w-4" />
              Réessayer
            </Link>
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-white/[0.07] px-5 py-3.5 text-[11px] text-neutral-600 sm:px-6">
          <CalendarPlus2 className="h-3.5 w-3.5" />
          <span>Tikemia — Espace organisateur sécurisé</span>
        </footer>
      </section>
    </main>
  );
}