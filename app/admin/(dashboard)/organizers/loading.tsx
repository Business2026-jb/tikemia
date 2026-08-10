import {
  LoaderCircle,
} from "lucide-react";

function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`}
    />
  );
}

export default function AdminOrganizersLoading() {
  return (
    <main className="min-h-full w-full bg-[#050708]">
      <div className="w-full p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-center">
          <div>
            <Skeleton className="h-3 w-28" />

            <Skeleton className="mt-3 h-8 w-56 sm:w-72" />

            <Skeleton className="mt-3 h-4 w-72 max-w-full sm:w-96" />
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <LoaderCircle className="h-4 w-4 animate-spin text-emerald-400" />

            Chargement...
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({
            length: 4,
          }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
            >
              <Skeleton className="h-9 w-9 rounded-xl" />

              <Skeleton className="mt-5 h-7 w-20" />

              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-[#080b0d]">
          <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 lg:flex-row lg:items-center">
            <Skeleton className="h-11 flex-1 rounded-xl" />

            <div className="flex gap-2">
              <Skeleton className="h-11 w-32 rounded-xl" />
              <Skeleton className="h-11 w-32 rounded-xl" />
            </div>
          </div>

          <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_120px_120px_120px_100px] gap-4 border-b border-white/[0.06] px-4 py-3 lg:grid">
            {Array.from({
              length: 6,
            }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-3 w-20"
              />
            ))}
          </div>

          <div className="divide-y divide-white/[0.06]">
            {Array.from({
              length: 8,
            }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4"
              >
                <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />

                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-40" />

                  <Skeleton className="mt-2 h-3 w-52 max-w-full" />
                </div>

                <Skeleton className="hidden h-7 w-20 rounded-full sm:block" />

                <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}