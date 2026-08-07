import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Contact | Tikemia",
  description: "Coordonnées officielles de Tikemia.",
  alternates: {
    canonical: "/contact",
  },
};

function TikTokIcon({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245h-3.18v13.443a2.896 2.896 0 1 1-2-2.756V9.897a6.098 6.098 0 1 0 5.18 6.034V9.112a7.93 7.93 0 0 0 4.77 1.614V7.548a4.82 4.82 0 0 1-1-.862Z" />
    </svg>
  );
}

function InstagramIcon({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect
        width="18"
        height="18"
        x="3"
        y="3"
        rx="5"
        ry="5"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
      />
      <circle
        cx="17.5"
        cy="6.5"
        r="0.5"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

function FacebookIcon({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M13.5 22v-9h3l.45-3.5H13.5V7.26c0-1.01.28-1.7 1.74-1.7H17.1V2.43c-.32-.04-1.43-.13-2.72-.13-2.69 0-4.53 1.64-4.53 4.66V9.5H6.8V13h3.05v9h3.65Z" />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03070a] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -left-28 top-0 h-80 w-80 rounded-full bg-lime-500/10 blur-3xl" />
        <div className="absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">
              Retour à l&apos;accueil
            </span>
          </Link>

          <Link
            href="/"
            aria-label="Accueil Tikemia"
            className="relative h-12 w-[150px]"
          >
            <Image
              src="/logo.png"
              alt="Tikemia"
              fill
              priority
              sizes="150px"
              className="object-contain"
            />
          </Link>

          <a
            href="mailto:contact@tikemia.com"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 px-4 text-sm font-black text-black transition hover:opacity-90"
          >
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">
              Écrire
            </span>
          </a>
        </header>

        <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-16 text-center sm:py-20">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
            <MessageCircle className="h-7 w-7" />
          </span>

          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-lime-400">
            Contact Tikemia
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
            Contactez-nous
          </h1>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <article className="rounded-[26px] border border-white/[0.08] bg-[#071015] p-6 text-left">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                <MapPin className="h-5 w-5" />
              </span>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
                Adresse
              </p>

              <p className="mt-2 text-base font-black">
                KTINDONOU, Mènontin
              </p>

              <p className="mt-1 text-sm text-neutral-500">
                Cotonou, Bénin
              </p>
            </article>

            <a
              href="tel:+2290169567744"
              className="rounded-[26px] border border-white/[0.08] bg-[#071015] p-6 text-left transition hover:border-lime-400/20"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                <Phone className="h-5 w-5" />
              </span>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
                Téléphone
              </p>

              <p className="mt-2 text-base font-black">
                +229 01 69 56 77 44
              </p>
            </a>

            <a
              href="mailto:contact@tikemia.com"
              className="rounded-[26px] border border-white/[0.08] bg-[#071015] p-6 text-left transition hover:border-lime-400/20"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                <Mail className="h-5 w-5" />
              </span>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
                E-mail
              </p>

              <p className="mt-2 break-all text-base font-black">
                contact@tikemia.com
              </p>
            </a>
          </div>

          <section className="mt-8 rounded-[28px] border border-white/[0.08] bg-[#071015] p-6 sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-400">
              Réseaux sociaux
            </p>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="https://www.tiktok.com/@tikemia0"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 px-5 text-sm font-black transition hover:border-lime-400/20 hover:bg-white/[0.05]"
              >
                <TikTokIcon className="h-5 w-5" />
                <span>TikTok</span>
                <span className="text-neutral-500">
                  @tikemia0
                </span>
              </a>

              <a
                href="https://www.instagram.com/tikemia0/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 px-5 text-sm font-black transition hover:border-lime-400/20 hover:bg-white/[0.05]"
              >
                <InstagramIcon className="h-5 w-5" />
                <span>Instagram</span>
                <span className="text-neutral-500">
                  @tikemia0
                </span>
              </a>

              <a
                href="https://www.facebook.com/tikemia0"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 px-5 text-sm font-black transition hover:border-lime-400/20 hover:bg-white/[0.05]"
              >
                <FacebookIcon className="h-5 w-5" />
                <span>Facebook</span>
                <span className="text-neutral-500">
                  @tikemia0
                </span>
              </a>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}