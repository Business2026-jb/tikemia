import {
  CreditCard,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function OrganizerPromotionCheckoutLoading() {
  return (
    <main className="w-full min-w-0">
      <div className="w-full space-y-5 pb-6 sm:space-y-6">
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#071015]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-orange-500/[0.06]"
          />

          <div className="relative border-b border-white/[0.07] px-4 py-5 sm:px-5 sm:py-6 lg:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-lime-400">
                    <Sparkles className="h-3 w-3" />
                    Visibilité Premium
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold text-neutral-500">
                    <ShieldCheck className="h-3 w-3" />
                    Paiement sécurisé
                  </span>
                </div>

                <div className="mt-4 h-7 w-64 max-w-full animate-pulse rounded-lg bg-white/[0.07] sm:h-8 sm:w-80" />

                <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-md bg-white/[0.045]" />

                <div className="mt-2 h-4 w-3/4 max-w-md animate-pulse rounded-md bg-white/[0.035]" />
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-neutral-500">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#071015]">
            <div className="border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:px-6">
              <div className="h-5 w-44 animate-pulse rounded-md bg-white/[0.07]" />
              <div className="mt-2 h-3.5 w-64 max-w-full animate-pulse rounded bg-white/[0.035]" />
            </div>

            <div className="space-y-4 p-4 sm:p-5 lg:p-6">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="h-5 w-36 animate-pulse rounded-md bg-white/[0.07]" />

                    <div className="mt-3 h-4 w-full max-w-lg animate-pulse rounded bg-white/[0.04]" />

                    <div className="mt-2 h-4 w-4/5 max-w-md animate-pulse rounded bg-white/[0.03]" />
                  </div>

                  <div className="h-9 w-28 shrink-0 animate-pulse rounded-xl bg-white/[0.06]" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="h-3 w-24 animate-pulse rounded bg-white/[0.04]" />
                  <div className="mt-3 h-5 w-32 animate-pulse rounded-md bg-white/[0.07]" />
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="h-3 w-28 animate-pulse rounded bg-white/[0.04]" />
                  <div className="mt-3 h-5 w-24 animate-pulse rounded-md bg-white/[0.07]" />
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="h-3 w-32 animate-pulse rounded bg-white/[0.04]" />
                  <div className="mt-3 h-5 w-28 animate-pulse rounded-md bg-white/[0.07]" />
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="h-3 w-24 animate-pulse rounded bg-white/[0.04]" />
                  <div className="mt-3 h-5 w-36 animate-pulse rounded-md bg-white/[0.07]" />
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
                <div className="h-4 w-40 animate-pulse rounded bg-white/[0.06]" />

                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
                    <div className="h-4 flex-1 animate-pulse rounded bg-white/[0.035]" />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-white/[0.035]" />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.035]" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="xl:sticky xl:top-24 xl:self-start">
            <section className="relative overflow-hidden rounded-2xl border border-emerald-500/15 bg-[#071015]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-orange-500/[0.05]"
              />

              <div className="relative border-b border-white/[0.07] px-4 py-4 sm:px-5">
                <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
              </div>

              <div className="relative p-4 sm:p-5">
                <div className="h-3 w-24 animate-pulse rounded bg-white/[0.04]" />

                <div className="mt-3 h-9 w-40 animate-pulse rounded-lg bg-white/[0.08]" />

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-3 w-24 animate-pulse rounded bg-white/[0.035]" />
                    <div className="h-3 w-16 animate-pulse rounded bg-white/[0.05]" />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="h-3 w-28 animate-pulse rounded bg-white/[0.035]" />
                    <div className="h-3 w-20 animate-pulse rounded bg-white/[0.05]" />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="h-3 w-20 animate-pulse rounded bg-white/[0.035]" />
                    <div className="h-3 w-24 animate-pulse rounded bg-white/[0.05]" />
                  </div>
                </div>

                <div className="my-5 h-px bg-white/[0.07]" />

                <div className="h-12 w-full animate-pulse rounded-xl bg-white/[0.08]" />

                <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" />

                  <div className="min-w-0 flex-1">
                    <div className="h-3 w-28 animate-pulse rounded bg-white/[0.04]" />
                    <div className="mt-2 h-3 w-full animate-pulse rounded bg-white/[0.025]" />
                    <div className="mt-1.5 h-3 w-4/5 animate-pulse rounded bg-white/[0.025]" />
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}