import {
  LoaderCircle,
  Search,
  Users,
} from "lucide-react";

function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/[0.055] ${className}`}
    />
  );
}

export default function AdminCustomersLoading() {
  return (
    <main className="min-h-full w-full bg-[#030708] text-white">
      <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-white/[0.075] bg-[#071116] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-7 w-44 rounded-full" />
              <Skeleton className="mt-4 h-9 w-40" />
              <Skeleton className="mt-3 h-4 w-full max-w-xl" />
              <Skeleton className="mt-2 h-4 w-full max-w-md" />
            </div>

            <Skeleton className="h-11 w-48" />
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({
            length:
              4,
          }).map(
            (
              _,
              index,
            ) => (
              <div
                key={
                  index
                }
                className="rounded-2xl border border-white/[0.065] bg-[#071014] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-9 w-9 rounded-xl" />
                </div>

                <Skeleton className="mt-4 h-8 w-20" />
              </div>
            ),
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-white/[0.065] bg-[#071014] p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-700" />
              <Skeleton className="h-11 w-full" />
            </div>

            <Skeleton className="h-11 w-full lg:w-44" />
            <Skeleton className="h-11 w-full lg:w-48" />
            <Skeleton className="h-11 w-full lg:w-32" />
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#071014]">
          <div className="hidden border-b border-white/[0.055] bg-white/[0.025] px-4 py-3 lg:grid lg:grid-cols-[1.35fr_1.35fr_0.8fr_0.7fr_0.7fr_0.9fr_0.85fr_0.55fr] lg:gap-4">
            {Array.from({
              length:
                8,
            }).map(
              (
                _,
                index,
              ) => (
                <Skeleton
                  key={
                    index
                  }
                  className="h-3 w-20"
                />
              ),
            )}
          </div>

          <div className="divide-y divide-white/[0.055]">
            {Array.from({
              length:
                8,
            }).map(
              (
                _,
                index,
              ) => (
                <div
                  key={
                    index
                  }
                  className="flex items-center gap-4 px-4 py-4"
                >
                  <Skeleton className="h-10 w-10 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-2 h-3 w-52 max-w-full" />
                  </div>

                  <Skeleton className="hidden h-7 w-20 rounded-full sm:block" />
                  <Skeleton className="hidden h-4 w-14 lg:block" />
                  <Skeleton className="h-9 w-16 shrink-0" />
                </div>
              ),
            )}
          </div>
        </section>

        <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-sm font-bold text-neutral-500">
          <LoaderCircle className="h-4 w-4 animate-spin text-emerald-300" />
          Chargement des clients Tikemia…
        </div>
      </div>
    </main>
  );
}
