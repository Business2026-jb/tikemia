import { createHash } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CircleUserRound,
  ClipboardList,
  CreditCard,
  Headphones,
  LogOut,
  MapPin,
  Settings,
  ShieldCheck,
  Ticket,
  UserRound,
} from "lucide-react";

import { requireClient } from "@/lib/client/auth/require-client";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Mon compte | Tikemia",
  description:
    "Gérez vos billets, vos commandes et vos informations personnelles Tikemia.",
};

export const dynamic = "force-dynamic";

const CLIENT_SESSION_COOKIE_NAME =
  process.env.CLIENT_SESSION_COOKIE_NAME?.trim() ||
  "tikemia_client_session";

type ClientAccountLayoutProps = Readonly<{
  children: ReactNode;
}>;

type AccountNavigationItem = {
  label: string;
  description: string;
  href: string;
  icon: typeof Ticket;
};

const accountNavigation: AccountNavigationItem[] = [
  {
    label: "Mes billets",
    description: "Billets et accès aux événements",
    href: "/account/tickets",
    icon: Ticket,
  },
  {
    label: "Mes commandes",
    description: "Achats et historique",
    href: "/account/orders",
    icon: ClipboardList,
  },
  {
    label: "Mon profil",
    description: "Informations personnelles",
    href: "/account/profile",
    icon: UserRound,
  },
];

function getInitials(
  firstName: string,
  lastName: string,
): string {
  const firstInitial =
    firstName.trim().charAt(0).toUpperCase();

  const lastInitial =
    lastName.trim().charAt(0).toUpperCase();

  return `${firstInitial}${lastInitial}` || "TK";
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

async function logoutClient() {
  "use server";

  const cookieStore =
    await cookies();

  const sessionToken =
    cookieStore.get(
      CLIENT_SESSION_COOKIE_NAME,
    )?.value;

  if (sessionToken) {
    const tokenHash =
      hashSessionToken(
        sessionToken,
      );

    await prisma.session
      .deleteMany({
        where: {
          tokenHash,
        },
      })
      .catch((error) => {
        console.error(
          "[CLIENT_ACCOUNT_LOGOUT_ERROR]",
          error,
        );
      });
  }

  cookieStore.set({
    name: CLIENT_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  redirect("/login");
}

export default async function ClientAccountLayout({
  children,
}: ClientAccountLayoutProps) {
  const { customer } =
    await requireClient(
      "/account/tickets",
    );

  const initials =
    getInitials(
      customer.firstName,
      customer.lastName,
    );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03070a] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-64 top-20 h-[520px] w-[520px] rounded-full bg-emerald-500/[0.07] blur-[160px]" />

        <div className="absolute -right-64 top-[-100px] h-[600px] w-[600px] rounded-full bg-lime-500/[0.05] blur-[180px]" />

        <div className="absolute bottom-[-260px] left-[45%] h-[560px] w-[650px] rounded-full bg-orange-500/[0.05] blur-[190px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12">
        <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#071015]/90 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="relative overflow-hidden border-b border-white/[0.07] px-5 py-6 sm:px-7 lg:px-8 lg:py-8">
            <div
              aria-hidden="true"
              className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-500/[0.09] blur-[100px]"
            />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-xl font-black text-lime-300 shadow-[0_15px_40px_rgba(34,197,94,0.12)] sm:h-20 sm:w-20 sm:text-2xl">
                  {initials}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-lime-400">
                    Compte client
                  </p>

                  <h1 className="mt-2 truncate text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">
                    {customer.firstName}{" "}
                    {customer.lastName}
                  </h1>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500 sm:text-sm">
                    <span className="flex items-center gap-2">
                      <CircleUserRound className="h-4 w-4" />

                      {customer.email}
                    </span>

                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />

                      {customer.country}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 text-xs font-bold text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />

                  Compte vérifié
                </span>

                <Link
                  href="/events"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-xs font-black text-white shadow-[0_15px_35px_rgba(34,197,94,0.14)] transition hover:scale-[1.01]"
                >
                  Voir les événements

                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="grid min-h-[620px] lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="border-b border-white/[0.07] bg-[#050c10]/70 lg:border-b-0 lg:border-r">
              <div className="hidden p-5 lg:block lg:p-6">
                <p className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-600">
                  Mon espace
                </p>

                <nav className="mt-4 space-y-2">
                  {accountNavigation.map(
                    (item) => {
                      const Icon =
                        item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3.5 transition hover:border-emerald-400/15 hover:bg-emerald-400/[0.05]"
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-500 transition group-hover:border-emerald-400/20 group-hover:bg-emerald-400/[0.08] group-hover:text-lime-300">
                            <Icon className="h-5 w-5" />
                          </span>

                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black text-neutral-200 group-hover:text-white">
                              {item.label}
                            </span>

                            <span className="mt-1 block truncate text-[11px] text-neutral-600">
                              {item.description}
                            </span>
                          </span>
                        </Link>
                      );
                    },
                  )}
                </nav>

                <div className="mt-6 border-t border-white/[0.07] pt-5">
                  <Link
                    href="/support"
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-neutral-500 transition hover:bg-white/[0.04] hover:text-white"
                  >
                    <Headphones className="h-5 w-5" />

                    Assistance
                  </Link>

                  <form action={logoutClient}>
                    <button
                      type="submit"
                      className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-neutral-500 transition hover:bg-red-500/[0.07] hover:text-red-300"
                    >
                      <LogOut className="h-5 w-5" />

                      Se déconnecter
                    </button>
                  </form>
                </div>
              </div>

              <div className="lg:hidden">
                <nav className="flex w-full gap-2 overflow-x-auto px-4 py-4 sm:px-5">
                  {accountNavigation.map(
                    (item) => {
                      const Icon =
                        item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex min-w-[142px] shrink-0 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-sm font-black text-neutral-300 transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.06] hover:text-white"
                        >
                          <Icon className="h-4.5 w-4.5 shrink-0 text-lime-400" />

                          {item.label}
                        </Link>
                      );
                    },
                  )}

                  <form
                    action={logoutClient}
                    className="shrink-0"
                  >
                    <button
                      type="submit"
                      className="flex h-full min-w-[132px] items-center gap-2.5 rounded-xl border border-red-400/10 bg-red-400/[0.04] px-3 py-3 text-sm font-black text-red-300"
                    >
                      <LogOut className="h-4.5 w-4.5" />

                      Déconnexion
                    </button>
                  </form>
                </nav>
              </div>
            </aside>

            <section className="min-w-0 bg-[#03090d]/65">
              <div className="min-h-full w-full min-w-0 p-4 sm:p-6 lg:p-8">
                {children}
              </div>
            </section>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AccountShortcut
            href="/account/tickets"
            title="Mes billets"
            icon={Ticket}
          />

          <AccountShortcut
            href="/account/orders"
            title="Mes commandes"
            icon={CreditCard}
          />

          <AccountShortcut
            href="/account/profile"
            title="Mon profil"
            icon={Settings}
          />

          <AccountShortcut
            href="/events"
            title="Événements"
            icon={CalendarDays}
          />
        </section>
      </div>
    </main>
  );
}

function AccountShortcut({
  href,
  title,
  icon: Icon,
}: {
  href: string;
  title: string;
  icon: typeof Ticket;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#071015]/80 p-4 transition hover:border-emerald-400/15 hover:bg-emerald-400/[0.04]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-500 transition group-hover:border-emerald-400/20 group-hover:text-lime-300">
        <Icon className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1 truncate text-sm font-black text-neutral-300 group-hover:text-white">
        {title}
      </span>

      <ArrowRight className="h-4 w-4 text-neutral-700 transition group-hover:translate-x-0.5 group-hover:text-lime-400" />
    </Link>
  );
}