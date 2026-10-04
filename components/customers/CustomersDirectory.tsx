"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { filterCustomers } from "@/lib/customers/search";
import type { Customer } from "@/lib/customers/types";
import {
  ArchiveCustomerButton,
  CustomerFormDialog,
  RestoreCustomerButton,
} from "@/components/customers/CustomerFormDialog";
import { Input } from "@/components/ui/input";

type CustomersDirectoryProps = {
  customers: Customer[];
  archived: boolean;
  canCreate: boolean;
  canEdit: boolean;
};

const CUSTOMER_GRID =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_11.5rem] items-center gap-3";

function CustomerActions({
  customer,
  archived,
  canEdit,
}: {
  customer: Customer;
  archived: boolean;
  canEdit: boolean;
}) {
  if (!canEdit) return null;
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {archived ? (
        <RestoreCustomerButton customerId={customer.id} />
      ) : (
        <>
          <CustomerFormDialog mode="edit" customer={customer} triggerLabel="Edit" />
          <ArchiveCustomerButton customer={customer} />
        </>
      )}
    </div>
  );
}

export function CustomersDirectory({
  customers,
  archived,
  canCreate,
  canEdit,
}: CustomersDirectoryProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const visible = useMemo(
    () => filterCustomers(customers, search),
    [customers, search]
  );
  const emptyDirectory = customers.length === 0;
  const emptySearch = !emptyDirectory && visible.length === 0;

  return (
    <div className="flex flex-col gap-4" data-customers-directory>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="block min-w-0 flex-1">
          <span className="sr-only">Search customers</span>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email or phone"
            className="min-h-11"
            autoComplete="off"
            data-customer-search
          />
        </label>
        <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-orange)]">
          <input
            type="checkbox"
            checked={archived}
            onChange={() => {
              router.push(archived ? "/app/customers" : "/app/customers?archived=1");
            }}
            className="size-4 accent-[var(--brand-orange)]"
          />
          <span className="text-sm font-medium">Show archived</span>
        </label>
      </div>

      {emptyDirectory ? (
        <div className="rounded-xl border border-border/70 bg-card px-4 py-10 text-center">
          <p className="text-base font-medium">
            {archived ? "No archived customers" : "No customers yet"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {archived
              ? "Archived customers stay linked to existing projects and stay out of new jobs."
              : "Save a customer once, then choose them when you start a job."}
          </p>
          {!archived && canCreate ? (
            <div className="mt-4 flex justify-center">
              <CustomerFormDialog mode="create" />
            </div>
          ) : null}
        </div>
      ) : null}

      {emptySearch ? (
        <p className="rounded-xl border border-border/70 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No customers match that search.
        </p>
      ) : null}

      {visible.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-card md:block" data-customer-list="aligned">
            <div className={`${CUSTOMER_GRID} border-b px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase`}>
              <span>Name</span>
              <span>Email</span>
              <span>Phone</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul>
              {visible.map((customer) => (
                <li
                  key={customer.id}
                  className={`${CUSTOMER_GRID} border-b px-4 py-2 last:border-b-0`}
                  data-customer-row
                >
                  <p className="min-w-0 truncate font-medium">{customer.name}</p>
                  <p className="min-w-0 truncate text-sm text-muted-foreground">{customer.email ?? ""}</p>
                  <p className="min-w-0 truncate text-sm text-muted-foreground">{customer.phone ?? ""}</p>
                  <CustomerActions customer={customer} archived={archived} canEdit={canEdit} />
                </li>
              ))}
            </ul>
          </div>
          <ul className="flex flex-col gap-3 md:hidden" data-customer-list="stacked">
            {visible.map((customer) => (
              <li
                key={customer.id}
                className="min-w-0 rounded-xl border border-border/70 bg-card px-4 py-3"
                data-customer-row
              >
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-base font-medium">{customer.name}</p>
                    {customer.email ? (
                      <p className="mt-1 break-words text-sm text-muted-foreground">{customer.email}</p>
                    ) : null}
                    {customer.phone ? (
                      <p className="mt-1 break-words text-sm text-muted-foreground">{customer.phone}</p>
                    ) : null}
                  </div>
                  <CustomerActions customer={customer} archived={archived} canEdit={canEdit} />
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
