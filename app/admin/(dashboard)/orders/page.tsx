import type { Metadata } from "next";

import AdminOrdersPage from "@/components/admin/orders/admin-orders-page";
import {
  getAdminOrders,
  type AdminOrderSort,
  type GetAdminOrdersInput,
} from "@/lib/admin/orders/get-admin-orders";
import { requireAdmin } from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Commandes | Administration Tikemia",
  description:
    "Consultez et gérez toutes les commandes effectuées sur Tikemia.",
};

type SearchParamValue =
  | string
  | string[]
  | undefined;

type OrdersSearchParams = Record<
  string,
  SearchParamValue
>;

type AdminOrdersRouteProps = Readonly<{
  searchParams?:
    | Promise<OrdersSearchParams>
    | OrdersSearchParams;
}>;

function getSearchParam(
  searchParams: OrdersSearchParams,
  key: string,
): string {
  const value =
    searchParams[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function parsePositiveInteger(
  value: string,
): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed =
    Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsed) ||
    parsed < 1
  ) {
    return undefined;
  }

  return parsed;
}

function parseSort(
  value: string,
): AdminOrderSort | undefined {
  switch (value) {
    case "NEWEST":
    case "OLDEST":
    case "TOTAL_DESC":
    case "TOTAL_ASC":
      return value;

    default:
      return undefined;
  }
}

function buildAdminOrdersInput(
  searchParams: OrdersSearchParams,
): GetAdminOrdersInput {
  const search =
    getSearchParam(
      searchParams,
      "search",
    );

  const status =
    getSearchParam(
      searchParams,
      "status",
    );

  const paymentStatus =
    getSearchParam(
      searchParams,
      "paymentStatus",
    );

  const paymentMethod =
    getSearchParam(
      searchParams,
      "paymentMethod",
    );

  const organizerId =
    getSearchParam(
      searchParams,
      "organizerId",
    );

  const eventId =
    getSearchParam(
      searchParams,
      "eventId",
    );

  const currency =
    getSearchParam(
      searchParams,
      "currency",
    );

  const dateFrom =
    getSearchParam(
      searchParams,
      "dateFrom",
    );

  const dateTo =
    getSearchParam(
      searchParams,
      "dateTo",
    );

  const sort =
    parseSort(
      getSearchParam(
        searchParams,
        "sort",
      ),
    );

  const page =
    parsePositiveInteger(
      getSearchParam(
        searchParams,
        "page",
      ),
    );

  const pageSize =
    parsePositiveInteger(
      getSearchParam(
        searchParams,
        "pageSize",
      ),
    );

  return {
    search:
      search || undefined,

    status:
      status
        ? (status as GetAdminOrdersInput["status"])
        : undefined,

    paymentStatus:
      paymentStatus
        ? (paymentStatus as GetAdminOrdersInput["paymentStatus"])
        : undefined,

    paymentMethod:
      paymentMethod ||
      undefined,

    organizerId:
      organizerId ||
      undefined,

    eventId:
      eventId ||
      undefined,

    currency:
      currency ||
      undefined,

    dateFrom:
      dateFrom ||
      undefined,

    dateTo:
      dateTo ||
      undefined,

    sort,

    page,

    pageSize,
  };
}

export default async function AdminOrdersRoute({
  searchParams,
}: AdminOrdersRouteProps) {
  /*
   * Protection serveur.
   *
   * Aucun accès aux commandes n'est possible
   * sans session administrateur valide.
   */
  await requireAdmin();

  /*
   * Next.js récent peut fournir searchParams
   * sous forme de Promise.
   */
  const resolvedSearchParams =
    await Promise.resolve(
      searchParams ?? {},
    );

  const input =
    buildAdminOrdersInput(
      resolvedSearchParams,
    );

  /*
   * Lecture serveur des commandes réelles
   * depuis Prisma.
   *
   * Aucun mock et aucune donnée de démonstration.
   */
  const data =
    await getAdminOrders(
      input,
    );

  return (
    <AdminOrdersPage
      data={data}
    />
  );
}