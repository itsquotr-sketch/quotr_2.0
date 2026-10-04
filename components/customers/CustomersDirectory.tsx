"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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

function contactLine(customer: Customer): string | null {
  const parts = [customer.email, customer.phone].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function CustomersDirectory({
  customers,
  archived,
  canCreate,
  canEdit,
}: CustomersDirectoryProps) {
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
        <Link
          href={archived ? "/app/customers" : "/app/customers?archived=1"}
          className="inline-flex min-h-11 items-center rounded-md px-1 text-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
        >
          {archived ? "Show active customers" : "Show archived"}
        </Link>
      </div>

      {emptyDirectory ? (
        <div className="rounded-xl border bg-background px-4 py-10 text-center">
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
        <p className="rounded-xl border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
          No customers match that search.
        </p>
      ) : null}

      {visible.length > 0 ? (
        <ul className="flex flex-col gap-3" data-customer-list="stacked">
          {visible.map((customer) => {
            const contact = contactLine(customer);
            return (
              <li
                key={customer.id}
                className="rounded-xl border bg-background px-4 py-3"
                data-customer-row
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">{customer.name}</p>
                    {contact ? (
                      <p className="mt-0.5 break-words text-sm text-muted-foreground">{contact}</p>
                    ) : (
                      <p className="mt-0.5 text-sm text-muted-foreground">No email or phone</p>
                    )}
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {archived ? (
                        <RestoreCustomerButton customerId={customer.id} />
                      ) : (
                        <>
                          <CustomerFormDialog
                            mode="edit"
                            customer={customer}
                            triggerLabel="Edit"
                          />
                          <ArchiveCustomerButton customer={customer} />
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
