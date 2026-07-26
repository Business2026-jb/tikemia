import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  BarChart3,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";

import AdminLoginForm from "@/components/admin/admin-login-form";
import { getAdminSession } from "@/lib/admin/get-admin-session";

export const metadata: Metadata = {
  title: "Connexion Admin | Tikemia",
  description:
    "Accès sécurisé à l’espace d’administration Tikemia.",
};

const features = [
  {
    title: "Gestion centralisée",
    description:
      "Contrôlez les utilisateurs, les événements et les commandes.",
    icon: TicketCheck,
  },
  {
    title: "Données en temps réel",
    description:
      "Suivez les ventes, paiements et performances de la plateforme.",
    icon: BarChart3,
  },
  {
    title: "Accès protégé",
    description:
      "Une session sécurisée réservée aux administrateurs autorisés.",
    icon: ShieldCheck,
  },
];

export default async function AdminLoginPage() {
  const currentSession = await getAdminSession();

  if (currentSession) {
    redirect("/admin/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-950 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(480px,0.95fr)]">
      <section className="relative hidden min-h-screen overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.16),transparent_38%)]" />

        <div className="relative z-10">
          <Image
            src="/logo.png"
            alt="Tikemia"
            width={190}
            height={64}
            priority
            className="h-auto w-44 object-contain object-left"
          />
        </div>

        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
            Administration Tikemia
          </span>

          <h1 className="mt-6 text-4xl font-black leading-tight text-white xl:text-6xl">
            Pilotez toute la plateforme depuis un espace sécurisé.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-8 text-slate-300 xl:text-lg">
            Gérez l’activité de Tikemia, surveillez les
            opérations et prenez les décisions importantes
            depuis un tableau de bord centralisé.
          </p>

          <div className="mt-10 grid gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                    <Icon
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <h2 className="font-bold text-white">
                      {feature.title}
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} Tikemia. Accès
          strictement réservé.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:px-8 lg:px-10 xl:px-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Image
              src="/logo.png"
              alt="Tikemia"
              width={180}
              height={60}
              priority
              className="h-auto w-40 object-contain"
            />
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-9">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
              <ShieldCheck
                className="h-7 w-7"
                aria-hidden="true"
              />
            </div>

            <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-950">
              Connexion Admin
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Entrez les identifiants de votre compte
              administrateur Tikemia.
            </p>

            <AdminLoginForm />
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-slate-500">
            Cet espace est réservé aux administrateurs
            autorisés. Toutes les connexions sont contrôlées.
          </p>
        </div>
      </section>
    </main>
  );
}