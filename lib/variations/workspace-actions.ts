"use server";

import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import { getCompanySettingsWithContext } from "@/lib/settings/company-settings-loader";
import {
  loadRevisedContractValue,
  loadVariation,
} from "@/lib/variations/actions";
import type { InternalVariation, VariationStatus } from "@/lib/variations/domain";
import {
  formatContractMoney,
  variationEligibility,
  variationStatusLabel,
} from "@/lib/variations/presentation";
import type {
  VariationBaselineView,
  VariationListRow,
  VariationListSummary,
  VariationRevisionHistoryRow,
  VariationScopeLineOption,
  VariationWorkAreaOption,
} from "@/lib/variations/workspace-types";

type Fail = { ok: false; error: string };

function money(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeZone: "Pacific/Auckland",
  }).format(date);
}

function isStatus(value: string): value is VariationStatus {
  return (
    value === "draft" ||
    value === "issued" ||
    value === "accepted" ||
    value === "rejected" ||
    value === "withdrawn" ||
    value === "superseded"
  );
}

async function ownedProject(projectId: string) {
  const context = await getAuthOrgContext();
  if (!context) return { ok: false as const, error: "You need to sign in." };
  const owned = await assertOrgOwnsActiveProject(context, projectId);
  if ("error" in owned) return { ok: false as const, error: "That project could not be found." };
  return { ok: true as const, context, projectId: owned.projectId };
}

export async function loadVariationEligibility(projectId: string): Promise<
  | {
      ok: true;
      eligible: boolean;
      reason: string | null;
      projectTitle: string;
      clientName: string;
      siteAddress: string | null;
    }
  | Fail
> {
  const owned = await ownedProject(projectId);
  if (!owned.ok) return owned;
  const [project, snapshot, lifecycle] = await Promise.all([
    owned.context.supabase
      .from("projects")
      .select("title, client_name, site_address, archived_at, business_status")
      .eq("id", owned.projectId)
      .maybeSingle(),
    owned.context.supabase
      .from("accepted_commercial_snapshots")
      .select("id")
      .eq("project_id", owned.projectId)
      .maybeSingle(),
    owned.context.supabase
      .from("project_lifecycle_positions")
      .select("stage")
      .eq("project_id", owned.projectId)
      .maybeSingle(),
  ]);
  if (project.error || !project.data) return { ok: false, error: "That project could not be found." };
  const row = project.data as {
    title: string;
    client_name: string | null;
    site_address: string | null;
    archived_at: string | null;
    business_status: string | null;
  };
  const stage = (lifecycle.data as { stage?: string } | null)?.stage ?? null;
  const eligibility = variationEligibility({
    hasAcceptedSnapshot: Boolean(snapshot.data),
    archived: row.archived_at != null || row.business_status === "archived",
    deleted: false,
    stage,
  });
  return {
    ok: true,
    eligible: eligibility.eligible,
    reason: eligibility.reason,
    projectTitle: row.title,
    clientName: row.client_name?.trim() || "Client",
    siteAddress: row.site_address,
  };
}

export async function loadVariationWorkspace(projectId: string): Promise<
  | {
      ok: true;
      eligible: boolean;
      reason: string | null;
      rows: VariationListRow[];
      summary: VariationListSummary | null;
      projectTitle: string;
      clientName: string;
    }
  | Fail
> {
  const eligibility = await loadVariationEligibility(projectId);
  if (!eligibility.ok) return eligibility;
  if (!eligibility.eligible) {
    return {
      ok: true,
      eligible: false,
      reason: eligibility.reason,
      rows: [],
      summary: null,
      projectTitle: eligibility.projectTitle,
      clientName: eligibility.clientName,
    };
  }
  const owned = await ownedProject(projectId);
  if (!owned.ok) return owned;
  const [variations, revisions, contract] = await Promise.all([
    owned.context.supabase
      .from("variations")
      .select("id, variation_number, title, status, created_at, current_revision_id")
      .eq("project_id", owned.projectId)
      .order("variation_number", { ascending: true }),
    owned.context.supabase
      .from("variation_revisions")
      .select(
        "id, variation_id, revision_number, status, title, total_sell_adjustment_ex_gst, gst_adjustment, total_adjustment_incl_gst, issued_at, accepted_at, rejected_at, withdrawn_at"
      )
      .eq("project_id", owned.projectId),
    loadRevisedContractValue({ projectId: owned.projectId }),
  ]);
  if (variations.error || revisions.error || !contract.ok) {
    return { ok: false, error: "Variations could not be loaded." };
  }
  const revisionRows = (revisions.data ?? []) as Array<{
    id: string;
    variation_id: string;
    revision_number: number;
    status: string;
    title: string | null;
    total_sell_adjustment_ex_gst: unknown;
    gst_adjustment: unknown;
    total_adjustment_incl_gst: unknown;
    issued_at: string | null;
    accepted_at: string | null;
    rejected_at: string | null;
    withdrawn_at: string | null;
  }>;
  const rows: VariationListRow[] = [];
  for (const variation of (variations.data ?? []) as Array<{
    id: string;
    variation_number: number;
    title: string;
    status: string;
    created_at: string;
    current_revision_id: string | null;
  }>) {
    if (!isStatus(variation.status)) continue;
    const current = revisionRows.find((row) => row.id === variation.current_revision_id);
    const outcome =
      variation.status === "accepted"
        ? "Accepted"
        : variation.status === "rejected"
          ? "Rejected"
          : variation.status === "withdrawn"
            ? "Withdrawn"
            : null;
    rows.push({
      id: variation.id,
      variationNumber: variation.variation_number,
      // Current revision title. variations.title is only the denormalised list copy.
      title: current?.title?.trim() || variation.title,
      status: variation.status,
      statusLabel: variationStatusLabel(variation.status),
      revisionNumber: current?.revision_number ?? null,
      netExGst: money(current?.total_sell_adjustment_ex_gst),
      gst: money(current?.gst_adjustment),
      inclGst: money(current?.total_adjustment_incl_gst),
      createdAt: formatDate(variation.created_at) ?? "",
      issuedAt: formatDate(current?.issued_at ?? null),
      outcomeLabel: outcome,
    });
  }
  const summary: VariationListSummary = {
    originalAcceptedExGst: contract.value.originalAcceptedContractExGst,
    originalAcceptedInclGst: contract.value.originalAcceptedContractExGst + 0,
    acceptedAdjustmentExGst: contract.value.netAcceptedVariationAdjustmentExGst,
    revisedAcceptedExGst: contract.value.revisedContractValueExGst,
    revisedAcceptedInclGst: contract.value.revisedContractValueInclGst,
    pendingIssuedExGst: contract.value.pendingVariationValueExGst,
    draftCount: rows.filter((row) => row.status === "draft").length,
    currency: contract.value.currency,
  };
  const baselineIncl = await owned.context.supabase
    .from("accepted_commercial_snapshots")
    .select("sell_incl_gst")
    .eq("project_id", owned.projectId)
    .maybeSingle();
  const incl = money((baselineIncl.data as { sell_incl_gst?: unknown } | null)?.sell_incl_gst);
  if (incl != null) summary.originalAcceptedInclGst = incl;
  return {
    ok: true,
    eligible: true,
    reason: null,
    rows,
    summary,
    projectTitle: eligibility.projectTitle,
    clientName: eligibility.clientName,
  };
}

export async function loadVariationEditor(projectId: string, variationId: string): Promise<
  | {
      ok: true;
      variation: InternalVariation;
      baseline: VariationBaselineView;
      scopeLines: VariationScopeLineOption[];
      workAreas: VariationWorkAreaOption[];
      defaultMarginPercent: number;
      companyName: string;
      projectTitle: string;
      clientName: string;
      siteAddress: string | null;
      history: VariationRevisionHistoryRow[];
      eligible: boolean;
      reason: string | null;
      acceptedRevisions: Array<{
        id: string;
        totalSellAdjustmentExGst: number;
        gstAdjustment: number;
        totalAdjustmentInclGst: number;
      }>;
    }
  | Fail
> {
  const eligibility = await loadVariationEligibility(projectId);
  if (!eligibility.ok) return eligibility;
  const loaded = await loadVariation({ variationId });
  if (!loaded.ok) return loaded;
  if (loaded.variation.projectId !== projectId) {
    return { ok: false, error: "That variation could not be found." };
  }
  const owned = await ownedProject(projectId);
  if (!owned.ok) return owned;
  const [snapshot, lines, areas, marginRow, company, revisionDates, acceptedRows] = await Promise.all([
    owned.context.supabase
      .from("accepted_commercial_snapshots")
      .select("id, currency, gst_rate, tax_treatment, sell_ex_gst, gst_amount, sell_incl_gst, revision_number")
      .eq("project_id", owned.projectId)
      .maybeSingle(),
    owned.context.supabase
      .from("accepted_commercial_snapshot_lines")
      .select("id, client_description, quantity, unit, line_sell_ex_gst, work_area_id, sort_order, snapshot_id")
      .eq("project_id", owned.projectId)
      .order("sort_order", { ascending: true }),
    owned.context.supabase.from("work_areas").select("id, name").eq("project_id", owned.projectId),
    owned.context.supabase
      .from("organisation_settings")
      .select("default_margin_percent")
      .eq("org_id", owned.context.orgId)
      .maybeSingle(),
    getCompanySettingsWithContext(owned.context),
    owned.context.supabase
      .from("variation_revisions")
      .select("id, issued_at")
      .eq("variation_id", variationId),
    owned.context.supabase
      .from("variation_revisions")
      .select("id, total_sell_adjustment_ex_gst, gst_adjustment, total_adjustment_incl_gst")
      .eq("project_id", owned.projectId)
      .eq("status", "accepted"),
  ]);
  const snap = snapshot.data as {
    id: string;
    currency: string;
    gst_rate: unknown;
    tax_treatment: string;
    sell_ex_gst: unknown;
    gst_amount: unknown;
    sell_incl_gst: unknown;
    revision_number: number;
  } | null;
  if (!snap) return { ok: false, error: "Variations become available after the client accepts the quote." };
  const sellEx = money(snap.sell_ex_gst);
  const gstAmount = money(snap.gst_amount);
  const sellIncl = money(snap.sell_incl_gst);
  const gstRate = money(snap.gst_rate);
  if (sellEx == null || gstAmount == null || sellIncl == null || gstRate == null) {
    return { ok: false, error: "Variations could not be loaded." };
  }
  const areaName = new Map(
    ((areas.data ?? []) as Array<{ id: string; name: string }>).map((area) => [area.id, area.name])
  );
  const scopeLines: VariationScopeLineOption[] = (
    (lines.data ?? []) as Array<{
      id: string;
      client_description: string;
      quantity: unknown;
      unit: string | null;
      line_sell_ex_gst: unknown;
      work_area_id: string | null;
      snapshot_id: string;
    }>
  )
    .filter((line) => line.snapshot_id === snap.id)
    .map((line) => {
      const accepted = money(line.line_sell_ex_gst);
      return {
        id: line.id,
        workAreaId: line.work_area_id,
        workAreaName: line.work_area_id ? areaName.get(line.work_area_id) ?? null : null,
        description: line.client_description,
        quantity: money(line.quantity),
        unit: line.unit,
        acceptedSellLabel:
          accepted == null ? null : formatContractMoney(accepted, snap.currency),
      };
    });
  const marginRaw = money(
    (marginRow.data as { default_margin_percent?: unknown } | null)?.default_margin_percent
  );
  const currentRevision = loaded.variation.revisions.find((revision) => revision.status !== "superseded");
  const issuedById = new Map(
    ((revisionDates.data ?? []) as Array<{ id: string; issued_at: string | null }>).map((row) => [
      row.id,
      formatDate(row.issued_at),
    ])
  );
  const history: VariationRevisionHistoryRow[] = [...loaded.variation.revisions]
    .sort((a, b) => a.revisionNumber - b.revisionNumber)
    .map((revision) => ({
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      title: revision.title,
      status: revision.status,
      statusLabel: variationStatusLabel(revision.status),
      issuedAt: issuedById.get(revision.id) ?? null,
      netExGst: revision.totalSellAdjustmentExGst,
      label: revision.id === currentRevision?.id ? "Current" : "Historical",
    }));
  return {
    ok: true,
    variation: loaded.variation,
    baseline: {
      currency: snap.currency,
      gstRate,
      taxTreatment: snap.tax_treatment,
      sellExGst: sellEx,
      gstAmount,
      sellInclGst: sellIncl,
      referenceLabel: `Accepted quote · ${formatContractMoney(sellIncl, snap.currency)} incl GST`,
    },
    scopeLines,
    workAreas: ((areas.data ?? []) as Array<{ id: string; name: string }>).map((area) => ({
      id: area.id,
      name: area.name,
    })),
    defaultMarginPercent: marginRaw ?? DEFAULT_MARGIN_PERCENT,
    companyName: company?.tradingName?.trim() || company?.organisationName || "Your company",
    projectTitle: eligibility.projectTitle,
    clientName: eligibility.clientName,
    siteAddress: eligibility.siteAddress,
    history,
    eligible: eligibility.eligible,
    reason: eligibility.reason,
    acceptedRevisions: ((acceptedRows.data ?? []) as Array<{
      id: string;
      total_sell_adjustment_ex_gst: unknown;
      gst_adjustment: unknown;
      total_adjustment_incl_gst: unknown;
    }>).flatMap((row) => {
      const sell = money(row.total_sell_adjustment_ex_gst);
      const gst = money(row.gst_adjustment);
      const incl = money(row.total_adjustment_incl_gst);
      if (sell == null || gst == null || incl == null) return [];
      return [{
        id: row.id,
        totalSellAdjustmentExGst: sell,
        gstAdjustment: gst,
        totalAdjustmentInclGst: incl,
      }];
    }),
  };
}
