import {
  CreditCard,
  LoaderCircle,
} from "lucide-react";

export default function AdminPaymentsLoading() {
  return (
    <div className="min-h-full w-full bg-[#030708] p-4 text-white sm:p-5 lg:p-6">
      <div className="w-full space-y-4">
        <section className="rounded-2xl border border-white/[0.08] bg-[#071019] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/[0.08] text-sky-300">
                <CreditCard className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="h-3 w-44 animate-pulse rounded-full bg-white/[0.06]" />

                <div className="mt-3 h-8 w-72 max-w-full animate-pulse rounded-lg bg-white/[0.08]" />

                <div className="mt-3 h-4 w-[520px] max-w-full animate-pulse rounded-full bg-white/[0.05]" />
              </div>
            </div>

            <div className="flex gap-2">
              <div className="h-10 w-28 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]" />

              <div className="h-10 w-32 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]" />
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({
            length: 8,
          }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl border border-white/[0.06] bg-[#071019]"
            />
          ))}
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#071019] p-4">
          <div className="grid gap-3 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <div className="mb-2 h-3 w-24 animate-pulse rounded-full bg-white/[0.05]" />
              <div className="h-11 animate-pulse rounded-xl border border-white/[0.06] bg-black/20" />
            </div>

            {Array.from({
              length: 7,
            }).map((_, index) => (
              <div
                key={index}
                className={
                  index < 4
                    ? "xl:col-span-2"
                    : index === 4
                      ? "xl:col-span-3"
                      : "xl:col-span-2"
                }
              >
                <div className="mb-2 h-3 w-20 animate-pulse rounded-full bg-white/[0.05]" />
                <div className="h-11 animate-pulse rounded-xl border border-white/[0.06] bg-black/20" />
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071019]">
          <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-4">
            <div className="grid grid-cols-4 gap-6 lg:grid-cols-8">
              {Array.from({
                length: 8,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-3 animate-pulse rounded-full bg-white/[0.05]"
                />
              ))}
            </div>
          </div>

          <div className="flex min-h-[360px] items-center justify-center">
            <div className="text-center">
              <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-sky-300" />

              <p className="mt-3 text-sm font-semibold text-neutral-500">
                Chargement des paiements...
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
