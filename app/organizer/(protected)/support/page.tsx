import type { Metadata } from "next";
import {
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Support organisateur | Tikemia",
  description:
    "Contactez le support organisateur Tikemia par e-mail, téléphone ou retrouvez notre adresse.",
};

export default function OrganizerSupportPage() {
  return (
    <main className="min-h-full w-full">
      <section className="w-full">
        <div className="rounded-[28px] border border-white/[0.07] bg-[#071014] p-5 shadow-2xl sm:p-7 lg:p-8">
          <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-300">
                <ShieldCheck className="h-4 w-4" />

                Support Tikemia
              </div>

              <h1 className="mt-4 text-2xl font-black text-white sm:text-3xl">
                Besoin d’aide ?
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500 sm:text-base">
                Notre équipe support est disponible pour vous accompagner dans
                la gestion de votre activité sur Tikemia.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <a
              href="mailto:contact@tikemia.com"
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.04]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300">
                <Mail className="h-5 w-5" />
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-[0.15em] text-neutral-600">
                E-mail
              </p>

              <p className="mt-2 break-all text-base font-black text-white transition group-hover:text-emerald-300">
                contact@tikemia.com
              </p>

              <p className="mt-2 text-sm leading-5 text-neutral-500">
                Envoyez-nous un message pour toute demande d’assistance.
              </p>
            </a>

            <a
              href="tel:+2290169567744"
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition hover:border-sky-400/20 hover:bg-sky-400/[0.04]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/[0.07] text-sky-300">
                <Phone className="h-5 w-5" />
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-[0.15em] text-neutral-600">
                Téléphone
              </p>

              <p className="mt-2 text-base font-black text-white transition group-hover:text-sky-300">
                +229 01 69 56 77 44
              </p>

              <p className="mt-2 text-sm leading-5 text-neutral-500">
                Contactez directement l’équipe Tikemia par téléphone.
              </p>
            </a>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/[0.07] text-amber-300">
                <MapPin className="h-5 w-5" />
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-[0.15em] text-neutral-600">
                Adresse
              </p>

              <p className="mt-2 text-base font-black leading-6 text-white">
                Kindonou, Menontin
                <br />
                Cotonou, Bénin
              </p>

              <p className="mt-2 text-sm leading-5 text-neutral-500">
                Retrouvez Tikemia à Cotonou pour vos besoins d’assistance.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.035] p-5">
            <p className="text-sm font-bold text-neutral-300">
              Support organisateur Tikemia
            </p>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Pour faciliter le traitement de votre demande, indiquez votre nom
              d’organisateur, l’événement concerné et une description claire du
              problème rencontré.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}