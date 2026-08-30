import "server-only";

import { notFound } from "next/navigation";
import {
  mapPricingDocument,
  mapPricingItem,
  mapPricingWorkArea,
} from "@/lib/pricing/mappers";
import type {
  PricingSummary,
  PricingWorkspaceData,
} from "@/lib/pricing/types";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import {
  assertOrgOwnsActiveProject,
  assertOrgOwnsPricingDocument,
} from "@/lib/security/org-ownership";

export async function getLatestPricingSummaryWithContext(
  auth: AuthOrgContext,
  projectId: string
): Promise<PricingSummary | null> {
  const ownedProject = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in ownedProject) {
    return null;
  }

  const { data, error } = await auth.supabase
    .from("pricing_documents")
    .select("id, status, needs_recalibration")
    .eq("project_id", projectId)
    .eq("org_id", auth.orgId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    status: data.status as PricingSummary["status"],
    needsRecalibration: Boolean(data.needs_recalibration),
  };
}

export async function getProjectWorkspaceTabContextWithContext(
  auth: AuthOrgContext,
  projectId: string,
  options?: { pricingSummary?: PricingSummary | null }
): Promise<{
  hasEstimate: boolean;
  estimateIsStale: boolean;
  pricingSummary: PricingSummary | null;
}> {
  const ownedProject = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in ownedProject) {
    return {
      hasEstimate: false,
      estimateIsStale: false,
      pricingSummary: null,
    };
  }

  const pricingSummaryPromise =
    options && "pricingSummary" in options
      ? Promise.resolve(options.pricingSummary ?? null)
      : getLatestPricingSummaryWithContext(auth, projectId);

  const [pricingSummary, estimateResult] = await Promise.all([
    pricingSummaryPromise,
    auth.supabase
      .from("estimates")
      .select("is_stale")
      .eq("project_id", projectId)
      .eq("org_id", auth.orgId)
      .maybeSingle(),
  ]);

  return {
    hasEstimate: Boolean(estimateResult.data),
    estimateIsStale: estimateResult.data?.is_stale ?? false,
    pricingSummary,
  };
}

export async function getPricingWorkspaceDataWithContext(
  auth: AuthOrgContext,
  projectId: string,
  pricingDocumentId: string
): Promise<PricingWorkspaceData> {
  const ownedProject = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in ownedProject) {
    notFound();
  }

  const ownedDocument = await assertOrgOwnsPricingDocument(
    auth,
    pricingDocumentId,
    projectId
  );
  if ("error" in ownedDocument) {
    notFound();
  }

  const { supabase, orgId } = auth;

  const [
    { data: project },
    { data: document },
    { data: items },
    { data: workAreas },
    { data: estimate },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, client_name, site_address, deleted_at")
      .eq("id", projectId)
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("pricing_documents")
      .select("*")
      .eq("id", pricingDocumentId)
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("pricing_items")
      .select("*")
      .eq("pricing_document_id", pricingDocumentId)
      .eq("org_id", orgId)
      .order("sort_order"),
    supabase
      .from("work_areas")
      .select("id, name, type, sort_order, quote_description")
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .eq("status", "confirmed")
      .order("sort_order"),
    supabase
      .from("estimates")
      .select("recommended_sell, is_stale")
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  if (!project || project.deleted_at || !document) {
    notFound();
  }

  const mappedDocument = mapPricingDocument(document);
  if (
    mappedDocument.status === "draft" ||
    mappedDocument.status === "reviewed"
  ) {
    mappedDocument.client_name = project.client_name;
    mappedDocument.site_address = project.site_address;
  } else {
    if (!mappedDocument.client_name && project.client_name) {
      mappedDocument.client_name = project.client_name;
    }
    if (!mappedDocument.site_address && project.site_address) {
      mappedDocument.site_address = project.site_address;
    }
  }

  return {
    projectTitle: project.title,
    document: mappedDocument,
    items: (items ?? []).map((row) => mapPricingItem(row)),
    workAreas: (workAreas ?? []).map((row) => mapPricingWorkArea(row)),
    latestEstimateRecommendedSell:
      estimate?.recommended_sell != null
        ? Number(estimate.recommended_sell)
        : null,
    latestEstimateIsStale: estimate?.is_stale ?? false,
  };
}

export async function getLatestPricingSummary(
  projectId: string
): Promise<PricingSummary | null> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    return null;
  }
  return getLatestPricingSummaryWithContext(auth, projectId);
}

export async function getProjectWorkspaceTabContext(projectId: string) {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    return {
      hasEstimate: false,
      estimateIsStale: false,
      pricingSummary: null as PricingSummary | null,
    };
  }
  return getProjectWorkspaceTabContextWithContext(auth, projectId);
}

export async function getPricingWorkspaceData(
  projectId: string,
  pricingDocumentId: string
): Promise<PricingWorkspaceData> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    notFound();
  }
  return getPricingWorkspaceDataWithContext(auth, projectId, pricingDocumentId);
}
