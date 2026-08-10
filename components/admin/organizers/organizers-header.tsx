"use client";

import {
  BadgeCheck,
  Building2,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";

type Summary = {
  total: number;
  active: number;
  inactive: number;
  verified: number;
  unverified: number;
};

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {value.toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-neutral-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function OrganizersHeader({
  summary,
}: {
  summary: Summary;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[11px] font-bold text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Administration Tikemia
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Organisateurs
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
            Consultez les comptes organisateurs, leurs événements et leur activité.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total"
          value={summary.total}
          icon={Building2}
        />
        <StatCard
          label="Actifs"
          value={summary.active}
          icon={UserCheck}
        />
        <StatCard
          label="Inactifs"
          value={summary.inactive}
          icon={UserX}
        />
        <StatCard
          label="E-mails vérifiés"
          value={summary.verified}
          icon={BadgeCheck}
        />
      </div>
    </div>
  );
}
