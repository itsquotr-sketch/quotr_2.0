"use server";

import { revalidatePath } from "next/cache";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { blankToNull, customerSchema } from "@/lib/customers/schema";
import type {
  Customer,
  CustomerActionState,
  CustomerOption,
} from "@/lib/customers/types";
import { toUserError } from "@/lib/errors/user-message";

const CUSTOMER_SAVE_FAILED = "Could not save the customer. Please try again.";
import { permissionDeniedError } from "@/lib/team/permission-server";

const CUSTOMER_COLUMNS =
  "id, name, email, phone, notes, archived_at, created_at";

function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    archived_at: (row.archived_at as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
  };
}

async function requireCustomerContext(permission: "projects.create" | "projects.edit") {
  const context = await getAuthOrgContext();
  if (!context) {
    return {
      ok: false as const,
      error: "Your organisation profile could not be loaded. Try signing out and back in.",
    };
  }
  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission,
    entitlement: "projects.create",
  });
  if (denied) return { ok: false as const, error: denied.error };
  return { ok: true as const, context };
}

export async function listCustomers(options?: {
  archived?: boolean;
}): Promise<Customer[]> {
  const context = await getAuthOrgContext();
  if (!context) return [];

  let query = context.supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("org_id", context.orgId)
    .order("name", { ascending: true });

  query = options?.archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);

  const { data, error } = await query.limit(500);
  if (error) {
    console.error("[listCustomers] query failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => mapCustomer(row as Record<string, unknown>));
}

/** Active customers for new-job and project linking. Archived rows are omitted. */
export async function listSelectableCustomers(): Promise<CustomerOption[]> {
  const customers = await listCustomers({ archived: false });
  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    archived_at: customer.archived_at,
  }));
}

export async function getCustomerOption(
  customerId: string
): Promise<CustomerOption | null> {
  const context = await getAuthOrgContext();
  if (!context) return null;
  const { data, error } = await context.supabase
    .from("customers")
    .select("id, name, email, phone, archived_at")
    .eq("id", customerId)
    .eq("org_id", context.orgId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    archived_at: data.archived_at,
  };
}

export async function createCustomer(
  input: unknown
): Promise<CustomerActionState> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const loaded = await requireCustomerContext("projects.create");
  if (!loaded.ok) return { error: loaded.error };
  const { context } = loaded;

  const { error } = await context.supabase.from("customers").insert({
    org_id: context.orgId,
    created_by: context.user.id,
    name: parsed.data.name,
    email: blankToNull(parsed.data.email),
    phone: blankToNull(parsed.data.phone),
    notes: blankToNull(parsed.data.notes),
  });

  if (error) {
    return { error: toUserError(error, "createCustomer", CUSTOMER_SAVE_FAILED) };
  }
  revalidatePath("/app/customers");
  return { success: true };
}

export async function updateCustomer(
  customerId: string,
  input: unknown
): Promise<CustomerActionState> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const loaded = await requireCustomerContext("projects.edit");
  if (!loaded.ok) return { error: loaded.error };
  const { context } = loaded;

  const { error } = await context.supabase
    .from("customers")
    .update({
      name: parsed.data.name,
      email: blankToNull(parsed.data.email),
      phone: blankToNull(parsed.data.phone),
      notes: blankToNull(parsed.data.notes),
    })
    .eq("id", customerId)
    .eq("org_id", context.orgId);

  if (error) {
    return { error: toUserError(error, "updateCustomer", CUSTOMER_SAVE_FAILED) };
  }
  revalidatePath("/app/customers");
  return { success: true };
}

export async function archiveCustomer(
  customerId: string
): Promise<CustomerActionState> {
  const loaded = await requireCustomerContext("projects.edit");
  if (!loaded.ok) return { error: loaded.error };
  const { context } = loaded;
  const { error } = await context.supabase
    .from("customers")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", customerId)
    .eq("org_id", context.orgId)
    .is("archived_at", null);

  if (error) {
    return { error: toUserError(error, "archiveCustomer", CUSTOMER_SAVE_FAILED) };
  }
  revalidatePath("/app/customers");
  return { success: true };
}

export async function restoreCustomer(
  customerId: string
): Promise<CustomerActionState> {
  const loaded = await requireCustomerContext("projects.edit");
  if (!loaded.ok) return { error: loaded.error };
  const { context } = loaded;
  const { error } = await context.supabase
    .from("customers")
    .update({ archived_at: null })
    .eq("id", customerId)
    .eq("org_id", context.orgId)
    .not("archived_at", "is", null);

  if (error) {
    return { error: toUserError(error, "restoreCustomer", CUSTOMER_SAVE_FAILED) };
  }
  revalidatePath("/app/customers");
  return { success: true };
}
