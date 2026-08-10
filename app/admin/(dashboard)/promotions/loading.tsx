import {
  LoaderCircle,
  Megaphone,
} from "lucide-react";

export default function AdminPromotionsLoading() {
  return (
    <div className="min-h-full w-full bg-[#030708] p-4 text-white sm:p-5 lg:p-6">
      <div className="w-full space-y-4">
        <section className="rounded-2xl border border-white/[0.08] bg-[#071019] p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/[0.08] text-fuchsia-300">
              <Megaphone className="h-5 w-5" />
            </div>

            <div className="flex-1">
              <div className="h-3 w-44 animate-pulse rounded-full bg-white/[0.06]" />
              <div className="mt-3 h-8 w-80 max-w-full animate-pulse rounded-lg bg-white/[0.08]" />
              <div className="mt-3 h-4 w-[620px] max-w-full animate-pulse rounded-full bg-white/[0.05]" />
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
            {Array.from({
              length: 8,
            }).map((_, index) => (
              <div
                key={index}
                className={
                  index === 0
                    ? "xl:col-span-4"
                    : "xl:col-span-2"
                }
              >
                <div className="mb-2 h-3 w-20 animate-pulse rounded-full bg-white/[0.05]" />
                <div className="h-11 animate-pulse rounded-xl border border-white/[0.06] bg-black/20" />
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-[360px] items-center justify-center rounded-2xl border border-white/[0.08] bg-[#071019]">
          <div className="text-center">
            <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-fuchsia-300" />
            <p className="mt-3 text-sm font-semibold text-neutral-500">
              Chargement des promotions...
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
