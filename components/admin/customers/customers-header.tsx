"use client";

import {
  BadgeCheck,
  ShoppingBag,
  Ticket,
  UserRoundCheck,
  Users,
} from "lucide-react";

import ExportCustomersButton from "@/components/admin/customers/export-customers-button";
import type {
  AdminCustomersResult,
  CustomerSort,
  CustomerStatusFilter,
} from "@/components/admin/customers/admin-customers-page";

function formatNumber(
  value: number,
): string {
  return value.toLocaleString(
    "fr-FR",
  );
}

export default function CustomersHeader({
  summary,
  search,
  status,
  sort,
}: {
  summary: AdminCustomersResult["summary"] | null;
  search: string;
  status: CustomerStatusFilter;
  sort: CustomerSort;
}) {
  const cards = [
    {
      label:
        "Clients acheteurs",
      value:
        summary?.totalCustomers ?? 0,
      icon:
        Users,
    },
    {
      label:
        "Comptes inscrits",
      value:
        summary?.registeredCustomers ?? 0,
      icon:
        UserRoundCheck,
    },
    {
      label:
        "Comptes actifs",
      value:
        summary?.activeCustomers ?? 0,
      icon:
        BadgeCheck,
    },
    {
      label:
        "Billets achetés",
      value:
        summary?.totalTickets ?? 0,
      icon:
        Ticket,
    },
  ] as const;

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.075] bg-[#071116] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.22)] sm:p-6">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-500/[0.08] blur-[90px]"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-emerald-300">
              <ShoppingBag className="h-3.5 w-3.5" />
              Base clients Tikemia
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
              Clients
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Consultez les clients ayant acheté sur Tikemia, leurs coordonnées et leur activité d’achat.
            </p>
          </div>

          <ExportCustomersButton
            search={search}
            status={status}
            sort={sort}
          />
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(
          ({
            label,
            value,
            icon: Icon,
          }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/[0.065] bg-[#071014] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-neutral-500">
                  {label}
                </p>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/10 bg-emerald-400/[0.045] text-emerald-300">
                  <Icon className="h-4 w-4" />
                </span>
              </div>

              <p className="mt-3 text-2xl font-black tracking-tight text-white">
                {formatNumber(value)}
              </p>
            </div>
          ),
        )}
      </section>
    </>
  );
}
