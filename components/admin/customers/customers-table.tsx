"use client";

import {
  SearchX,
} from "lucide-react";

import CustomerRow from "@/components/admin/customers/customer-row";
import type {
  AdminCustomerListItem,
} from "@/components/admin/customers/admin-customers-page";

export default function CustomersTable({
  customers,
  onViewCustomer,
}: {
  customers: readonly AdminCustomerListItem[];
  onViewCustomer: (
    customer: AdminCustomerListItem,
  ) => void;
}) {
  if (customers.length === 0) {
    return (
      <div className="flex min-h-[330px] items-center justify-center rounded-3xl border border-white/[0.07] bg-[#071014]">
        <div className="px-5 text-center">
          <SearchX className="mx-auto h-8 w-8 text-neutral-700" />
          <p className="mt-3 text-sm font-black text-neutral-400">
            Aucun client trouvé
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Modifiez la recherche ou les filtres.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#071014] shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse">
          <thead>
            <tr className="bg-white/[0.025] text-left">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
                Client
              </th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
                Contact
              </th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
                Statut
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
                Commandes
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
                Billets
              </th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
                Dépensé
              </th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
                Dernier achat
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {customers.map(
              (customer) => (
                <CustomerRow
                  key={customer.customerKey}
                  customer={customer}
                  onView={() =>
                    onViewCustomer(
                      customer,
                    )
                  }
                />
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
