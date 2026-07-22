import Link from "next/link";
import {
  Headphones,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";

export default function OrganizerFooter() {
  return (
    <footer className="border-t border-white/[0.07] bg-[#03080c]">
      <div className="mx-auto w-full max-w-[1600px] px-5 py-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          {/* Identité */}
          <div className="max-w-[520px]">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-lime-400" />

              <p className="text-sm font-bold text-white">
                Espace organisateur Tikemia
              </p>
            </div>

            <p className="mt-2 text-xs leading-5 text-neutral-500 sm:text-sm">
              Gérez vos événements, vos ventes et vos paiements depuis votre
              espace professionnel sécurisé.
            </p>
          </div>

          {/* Contact */}
          <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:items-center xl:gap-4">
            <a
              href="mailto:contact@tikemia.com"
              className="group flex min-h-12 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.05]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
                <Mail className="h-4 w-4 text-lime-400" />
              </span>

              <span className="min-w-0">
                <span className="block text-[11px] text-neutral-600">
                  E-mail
                </span>

                <span className="block truncate text-xs font-semibold text-neutral-300 transition group-hover:text-white sm:text-sm">
                  contact@tikemia.com
                </span>
              </span>
            </a>

            <a
              href="tel:+2290169567744"
              className="group flex min-h-12 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.05]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
                <Phone className="h-4 w-4 text-lime-400" />
              </span>

              <span>
                <span className="block text-[11px] text-neutral-600">
                  Téléphone
                </span>

                <span className="block text-xs font-semibold text-neutral-300 transition group-hover:text-white sm:text-sm">
                  +229 01 69 56 77 44
                </span>
              </span>
            </a>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-white/[0.06] pt-5 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-neutral-600">
            © {new Date().getFullYear()} Tikemia. Tous droits réservés.
          </p>

          <nav
            aria-label="Liens du pied de page organisateur"
            className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs"
          >
            <Link
              href="/organizer/support"
              className="inline-flex items-center gap-1.5 text-neutral-500 transition hover:text-lime-400"
            >
              <Headphones className="h-3.5 w-3.5" />
              Assistance
            </Link>

            <Link
              href="/terms"
              className="text-neutral-500 transition hover:text-white"
            >
              Conditions d’utilisation
            </Link>

            <Link
              href="/privacy-policy"
              className="text-neutral-500 transition hover:text-white"
            >
              Confidentialité
            </Link>

            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 font-semibold text-lime-400">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.7)]" />
              Plateforme opérationnelle
            </span>
          </nav>
        </div>
      </div>
    </footer>
  );
}