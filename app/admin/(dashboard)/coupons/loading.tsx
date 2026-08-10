import { LoaderCircle, TicketPercent } from "lucide-react";

export default function AdminCouponsLoading() {
  return (
    <main className="min-h-full w-full bg-[#030708] p-4 text-white sm:p-5 lg:p-6">
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/[0.08] bg-[#071019] p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/[0.08] text-fuchsia-300">
              <TicketPercent className="h-5 w-5" />
            </div>

            <div>
              <div className="h-3 w-40 animate-pulse rounded bg-white/[0.06]" />
              <div className="mt-3 h-8 w-64 animate-pulse rounded bg-white/[0.07]" />
              <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-white/[0.05]" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl border border-white/[0.06] bg-[#071019]"
            />
          ))}
        </div>

        <div className="flex min-h-80 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#071019]">
          <div className="flex items-center gap-3 text-sm font-bold text-neutral-500">
            <LoaderCircle className="h-5 w-5 animate-spin text-fuchsia-300" />
            Chargement des codes promo...
          </div>
        </div>
      </div>
    </main>
  );
}
