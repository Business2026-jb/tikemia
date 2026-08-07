import Link from "next/link";
import {
  ChevronLeft,
  History,
  ShieldCheck,
} from "lucide-react";
import {
  redirect,
} from "next/navigation";

import ScannerHistoryList from "@/components/scanner/scanner-history-list";
import {
  getScannerHistory,
} from "@/lib/scanner/get-scanner-history";
import {
  getScannerSession,
} from "@/lib/scanner/get-scanner-session";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

type ScannerHistoryPageProps = {
  searchParams: Promise<{
    eventId?:
      | string
      | string[];

    page?:
      | string
      | string[];
  }>;
};

function firstValue(
  value:
    | string
    | string[]
    | undefined,
): string {
  if (
    Array.isArray(
      value,
    )
  ) {
    return (
      value[0]?.trim() ??
      ""
    );
  }

  return value?.trim() ?? "";
}

function readPage(
  value:
    | string
    | string[]
    | undefined,
): number {
  const parsed =
    Number(
      firstValue(
        value,
      ),
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed < 1
  ) {
    return 1;
  }

  return parsed;
}

export default async function ScannerHistoryPage({
  searchParams,
}: ScannerHistoryPageProps) {
  const session =
    await getScannerSession();

  if (!session) {
    redirect(
      "/scanner/login",
    );
  }

  const resolvedSearchParams =
    await searchParams;

  const eventId =
    firstValue(
      resolvedSearchParams.eventId,
    ) ||
    null;

  const page =
    readPage(
      resolvedSearchParams.page,
    );

  const history =
    await getScannerHistory({
      scannerId:
        session.user.id,

      eventId,

      page,

      limit:
        30,
    });

  const serializedItems =
    history.items.map(
      (
        item,
      ) => ({
        id:
          item.id,

        result:
          item.result,

        scannedAt:
          item.scannedAt.toISOString(),

        gateName:
          item.gateName,

        deviceName:
          item.deviceName,

        ticket:
          item.ticket,
      }),
    );

  const previousHref =
    `/scanner/history?${new URLSearchParams({
      ...(eventId
        ? {
            eventId,
          }
        : {}),

      page:
        String(
          Math.max(
            page - 1,
            1,
          ),
        ),
    }).toString()}`;

  const nextHref =
    `/scanner/history?${new URLSearchParams({
      ...(eventId
        ? {
            eventId,
          }
        : {}),

      page:
        String(
          page + 1,
        ),
    }).toString()}`;

  return (
    <main className="min-h-dvh bg-[#03070a] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href="/scanner"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:text-white"
              aria-label="Retour au scanner"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-400">
                  Contrôle d’accès
                </p>

                <ShieldCheck className="h-4 w-4 text-lime-400" />
              </div>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
                Historique des scans
              </h1>

              <p className="mt-2 text-sm text-neutral-600">
                {history.pagination.total} contrôle(s) enregistré(s)
              </p>
            </div>
          </div>

          <span className="inline-flex h-11 items-center gap-2 self-start rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-xs font-black text-neutral-400 sm:self-auto">
            <History className="h-4 w-4" />
            Page {history.pagination.page} sur {history.pagination.pages}
          </span>
        </header>

        <section className="mt-6">
          <ScannerHistoryList
            items={
              serializedItems
            }
            emptyMessage="Aucun contrôle n’a encore été enregistré pour cette sélection."
          />
        </section>

        <nav
          aria-label="Pagination de l’historique"
          className="mt-6 flex items-center justify-between gap-3"
        >
          {history.pagination.hasPreviousPage ? (
            <Link
              href={previousHref}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-black text-neutral-300 transition hover:text-white"
            >
              Page précédente
            </Link>
          ) : (
            <span />
          )}

          {history.pagination.hasNextPage && (
            <Link
              href={nextHref}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-black transition hover:bg-neutral-200"
            >
              Page suivante
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
