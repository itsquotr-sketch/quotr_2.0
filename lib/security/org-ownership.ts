import type { AuthOrgUser } from "@/lib/security/auth-org-evaluation";
import type { createClient } from "@/lib/supabase/server";

export type AuthOrgContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
  user: AuthOrgUser;
};

type OwnershipError = { error: string };

/** Generic not-found — used for both missing and cross-organisation resources. */
function notFound(resource: string): OwnershipError {
  return { error: `${resource} not found.` };
}

export async function assertOrgOwnsProject(
  ctx: AuthOrgContext,
  projectId: string
): Promise<OwnershipError | { projectId: string }> {
  const { data, error } = await ctx.supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error || !data) {
    return notFound("Project");
  }

  return { projectId: data.id };
}

/**
 * Ownership for normal active application queries/mutations.
 * Soft-deleted projects are treated as not found so their children are hidden
 * from active flows without hard-deleting stored child rows (S1-017 / 2A.4).
 * Lifecycle paths that must see deleted projects should use assertOrgOwnsProject.
 *
 * Not request-cached: each loader still enforces org+project predicates
 * (defence in depth). Auth/org discovery is memoised separately.
 */
export async function assertOrgOwnsActiveProject(
  ctx: AuthOrgContext,
  projectId: string
): Promise<OwnershipError | { projectId: string }> {
  const { data, error } = await ctx.supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("org_id", ctx.orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return notFound("Project");
  }

  return { projectId: data.id };
}

export async function assertOrgOwnsEstimate(
  ctx: AuthOrgContext,
  estimateId: string,
  projectId?: string
): Promise<OwnershipError | { estimateId: string; projectId: string }> {
  const { data, error } = await ctx.supabase
    .from("estimates")
    .select("id, project_id")
    .eq("id", estimateId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error || !data) {
    return notFound("Estimate");
  }

  if (projectId && data.project_id !== projectId) {
    return notFound("Estimate");
  }

  return { estimateId: data.id, projectId: data.project_id };
}

export async function assertOrgOwnsPricingDocument(
  ctx: AuthOrgContext,
  pricingDocumentId: string,
  projectId?: string
): Promise<OwnershipError | { pricingDocumentId: string; projectId: string }> {
  const { data, error } = await ctx.supabase
    .from("pricing_documents")
    .select("id, project_id")
    .eq("id", pricingDocumentId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error || !data) {
    return notFound("Pricing document");
  }

  if (projectId && data.project_id !== projectId) {
    return notFound("Pricing document");
  }

  return {
    pricingDocumentId: data.id,
    projectId: data.project_id,
  };
}

export async function assertOrgOwnsQuote(
  ctx: AuthOrgContext,
  quoteId: string,
  projectId?: string
): Promise<OwnershipError | { quoteId: string; projectId: string }> {
  const { data, error } = await ctx.supabase
    .from("quotes")
    .select("id, project_id")
    .eq("id", quoteId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error || !data) {
    return notFound("Quote");
  }

  if (projectId && data.project_id !== projectId) {
    return notFound("Quote");
  }

  return { quoteId: data.id, projectId: data.project_id };
}

export async function assertOrgOwnsWorkArea(
  ctx: AuthOrgContext,
  workAreaId: string,
  projectId?: string
): Promise<OwnershipError | { workAreaId: string; projectId: string }> {
  const { data, error } = await ctx.supabase
    .from("work_areas")
    .select("id, project_id")
    .eq("id", workAreaId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error || !data) {
    return notFound("Work area");
  }

  if (projectId && data.project_id !== projectId) {
    return notFound("Work area");
  }

  return { workAreaId: data.id, projectId: data.project_id };
}

export async function assertOrgOwnsPricingItem(
  ctx: AuthOrgContext,
  pricingItemId: string
): Promise<
  OwnershipError | {
    pricingItemId: string;
    pricingDocumentId: string;
    projectId: string;
  }
> {
  const { data, error } = await ctx.supabase
    .from("pricing_items")
    .select("id, pricing_document_id, project_id")
    .eq("id", pricingItemId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error || !data) {
    return notFound("Pricing item");
  }

  return {
    pricingItemId: data.id,
    pricingDocumentId: data.pricing_document_id,
    projectId: data.project_id,
  };
}

export async function assertOrgOwnsQuoteItem(
  ctx: AuthOrgContext,
  quoteItemId: string,
  quoteId?: string
): Promise<
  OwnershipError | { quoteItemId: string; quoteId: string; projectId: string }
> {
  const { data, error } = await ctx.supabase
    .from("quote_items")
    .select("id, quote_id, project_id")
    .eq("id", quoteItemId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error || !data) {
    return notFound("Quote item");
  }

  if (quoteId && data.quote_id !== quoteId) {
    return notFound("Quote item");
  }

  return {
    quoteItemId: data.id,
    quoteId: data.quote_id,
    projectId: data.project_id,
  };
}
