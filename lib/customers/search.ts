import type { Customer } from "@/lib/customers/types";

export function customerSearchText(customer: Pick<Customer, "name" | "email" | "phone">): string {
  return [customer.name, customer.email, customer.phone]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase();
}

export function filterCustomers<T extends Pick<Customer, "name" | "email" | "phone">>(
  customers: readonly T[],
  search: string
): T[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return [...customers];
  return customers.filter((customer) => customerSearchText(customer).includes(needle));
}
