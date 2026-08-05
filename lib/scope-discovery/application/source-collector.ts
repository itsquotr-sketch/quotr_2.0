/**
 * Authenticated, bounded source collection for scope discovery.
 * Org derived from auth context — never trusts client org_id.
 * Does not mutate source records. Excludes commercial / pricing / quotes.
 */

import { createHash } from "node:crypto";
import { isInternalProjectNote } from "@/lib/project-notes/types";
import type { PersistenceAuthContext } from "../persistence/context";
import {
  PERSISTENCE_ERROR_CODES,
  ScopeDiscoveryPersistenceError,
} from "../persistence/errors";
import { fingerprintDigest } from "../orchestration/source-snapshot";
import type {
  OrchestrationConstraint,
  OrchestrationFact,
  OrchestrationSiteNote,
  OrchestrationWorkArea,
  PriorDecisionRecord,
  PriorRunSummary,
  ScopeDiscoveryRunResult,
  ScopeDiscoveryRunStatus,
} from "../orchestration/types";
import type {
  PriorProposalRecord,
  RejectionRecord,
  ScopeDiscoverySuggestion,
  ScopeDiscoverySuggestionStatus,
} from "../types";
import { SOURCE_BOUNDS } from "./types";

export interface CollectedProjectSources {
  readonly projectId: string;
  readonly orgId: string;
  readonly briefText: string;
  readonly briefRevision: string;
  readonly siteNotes: readonly OrchestrationSiteNote[];
  readonly acceptedWorkAreas: readonly OrchestrationWorkArea[];
  readonly facts: readonly OrchestrationFact[];
  readonly constraints: readonly OrchestrationConstraint[];
  readonly region: string | null;
  readonly priorRunSummaries: readonly PriorRunSummary[];
  readonly priorSuggestions: readonly ScopeDiscoverySuggestion[];
  readonly priorDecisions: readonly PriorDecisionRecord[];
  readonly priorProposals: readonly PriorProposalRecord[];
  readonly priorRejections: readonly RejectionRecord[];
}

function contentRevision(parts: readonly string[]): string {
  return fingerprintDigest(parts);
}

function shaShort(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function jsonFactValue(
  value: unknown
): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    return jsonFactValue((value as { value: unknown }).value);
  }
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return null;
  }
}

function isTerminalSuccess(status: string): boolean {
  return status === "COMPLETED" || status === "COMPLETED_WITH_WARNINGS" || status === "REUSED";
}

function isFailed(status: string): boolean {
  return (
    status === "FAILED_VALIDATION" ||
    status === "FAILED_DETERMINISTIC" ||
    status === "FAILED_PROVIDER" ||
    status === "FAILED_MERGE"
  );
}

/**
 * Load bounded discovery sources for an owned active project.
 */
export async function collectProjectSources(
  ctx: PersistenceAuthContext,
  projectId: string
): Promise<CollectedProjectSources> {
  const { data: project, error: projectError } = await ctx.supabase
    .from("projects")
    .select("id, org_id, brief_text, deleted_at, updated_at")
    .eq("id", projectId)
    .eq("org_id", ctx.orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (projectError || !project) {
    throw new ScopeDiscoveryPersistenceError(
      PERSISTENCE_ERROR_CODES.PROJECT_NOT_OWNED,
      "Project was not found in your organisation."
    );
  }

  const briefText = String(project.brief_text ?? "").slice(
    0,
    SOURCE_BOUNDS.maxBriefChars
  );
  const briefRevision = contentRevision([
    String(project.updated_at ?? ""),
    shaShort(briefText),
  ]);

  const { data: orgSettings } = await ctx.supabase
    .from("organisation_settings")
    .select("region")
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  const region =
    typeof orgSettings?.region === "string" && orgSettings.region.trim()
      ? orgSettings.region.trim().slice(0, 80)
      : null;

  const { data: noteRows } = await ctx.supabase
    .from("project_notes")
    .select("id, content, note_type, captured_at, updated_at")
    .eq("project_id", projectId)
    .eq("org_id", ctx.orgId)
    .is("deleted_at", null)
    .order("captured_at", { ascending: true })
    .limit(SOURCE_BOUNDS.maxSiteNotes + 10);

  const siteNotes: OrchestrationSiteNote[] = (noteRows ?? [])
    .filter((n) => !isInternalProjectNote(String(n.note_type ?? "")))
    .slice(0, SOURCE_BOUNDS.maxSiteNotes)
    .map((n) => {
      const content = String(n.content ?? "").slice(0, SOURCE_BOUNDS.maxNoteChars);
      return {
        noteId: String(n.id),
        revision: contentRevision([
          String(n.updated_at ?? n.captured_at ?? ""),
          shaShort(content),
        ]),
        content,
      };
    });

  const { data: waRows } = await ctx.supabase
    .from("work_areas")
    .select("id, type, name, status, updated_at, sort_order")
    .eq("project_id", projectId)
    .eq("org_id", ctx.orgId)
    .eq("status", "confirmed")
    .order("sort_order", { ascending: true })
    .limit(SOURCE_BOUNDS.maxWorkAreas);

  const acceptedWorkAreas: OrchestrationWorkArea[] = (waRows ?? []).map((w) => ({
    workAreaId: String(w.id),
    type: String(w.type),
    title: w.name ? String(w.name) : null,
    revision: contentRevision([
      String(w.updated_at ?? ""),
      String(w.type),
      String(w.name ?? ""),
      String(w.status),
    ]),
  }));

  const { data: factRows } = await ctx.supabase
    .from("project_facts")
    .select("id, key, value, updated_at, work_area_id")
    .eq("project_id", projectId)
    .eq("org_id", ctx.orgId)
    .order("updated_at", { ascending: true })
    .limit(SOURCE_BOUNDS.maxFacts);

  const facts: OrchestrationFact[] = (factRows ?? []).map((f) => {
    const value = jsonFactValue(f.value);
    return {
      key: String(f.key),
      value,
      revision: contentRevision([
        String(f.updated_at ?? ""),
        String(f.key),
        shaShort(JSON.stringify(value)),
      ]),
    };
  });

  const { data: constraintRows } = await ctx.supabase
    .from("constraints")
    .select("id, key, value, updated_at")
    .eq("project_id", projectId)
    .eq("org_id", ctx.orgId)
    .order("updated_at", { ascending: true })
    .limit(SOURCE_BOUNDS.maxConstraints);

  const constraints: OrchestrationConstraint[] = (constraintRows ?? []).map(
    (c) => {
      const value = jsonFactValue(c.value);
      return {
        key: String(c.key),
        value,
        revision: contentRevision([
          String(c.updated_at ?? ""),
          String(c.key),
          shaShort(JSON.stringify(value)),
        ]),
      };
    }
  );

  const { data: runRows } = await ctx.supabase
    .from("scope_discovery_runs")
    .select(
      "id, project_id, status, idempotency_key, source_fingerprint, trigger, completed_at, archived_at"
    )
    .eq("project_id", projectId)
    .eq("org_id", ctx.orgId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(SOURCE_BOUNDS.maxPriorRuns);

  const priorRunSummaries: PriorRunSummary[] = (runRows ?? []).map((r) => {
    const status = String(r.status) as ScopeDiscoveryRunStatus;
    return {
      runId: String(r.id),
      projectId: String(r.project_id),
      status,
      idempotencyKey: String(r.idempotency_key),
      sourceFingerprint: String(r.source_fingerprint),
      triggerFamily: "explicit_user",
      inFlight: status === "RUNNING",
      completedSuccessfully: isTerminalSuccess(status),
      failed: isFailed(status),
      result: undefined as ScopeDiscoveryRunResult | undefined,
    };
  });

  // For reuse we need result on completed runs — load suggestions into a thin result later in run service.
  // Keep summaries here without full result; run service hydrates when needed.

  const { data: decisionRows } = await ctx.supabase
    .from("scope_discovery_decisions")
    .select(
      "id, suggestion_id, decision_type, modified_title, modified_description, created_work_area_id, source_revision, run_id"
    )
    .eq("project_id", projectId)
    .eq("org_id", ctx.orgId)
    .order("decided_at", { ascending: false })
    .limit(SOURCE_BOUNDS.maxPriorDecisions);

  const { data: suggestionRows } = await ctx.supabase
    .from("scope_discovery_suggestions")
    .select(
      "id, run_id, suggestion_identity, suggestion_kind, proposed_title, proposed_work_area_type, source_snapshot, stale_reason, superseded_by_suggestion_id"
    )
    .eq("project_id", projectId)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(SOURCE_BOUNDS.maxPriorSuggestions);

  const suggestionById = new Map(
    (suggestionRows ?? []).map((s) => [String(s.id), s])
  );

  const priorRejections: RejectionRecord[] = [];
  const priorProposals: PriorProposalRecord[] = [];
  const priorDecisions: PriorDecisionRecord[] = [];

  for (const d of decisionRows ?? []) {
    const sug = suggestionById.get(String(d.suggestion_id));
    if (!sug) continue;
    const identityKey = String(sug.suggestion_identity);
    const snap = (sug.source_snapshot ?? {}) as Record<string, unknown>;
    const briefRev = String(snap.briefRevision ?? d.source_revision ?? "");
    const sourceSnapshot = {
      briefRevision: briefRev,
      noteRevisionSet: String(snap.noteRevisionSet ?? "notes:empty"),
      factRevisions: String(snap.factRevisions ?? "facts:empty"),
      constraintRevisions: String(snap.constraintRevisions ?? "constraints:empty"),
      workAreaRevisions: String(snap.workAreaRevisions ?? "work_areas:empty"),
      catalogueVersion: String(snap.catalogueVersion ?? ""),
      contractVersion: String(snap.contractVersion ?? ""),
      providerModelId: null,
      formattingRevision: null,
    };

    const decisionTypeRaw = String(d.decision_type).toLowerCase();
    const decisionType =
      decisionTypeRaw === "accept" ||
      decisionTypeRaw === "reject" ||
      decisionTypeRaw === "modify"
        ? decisionTypeRaw
        : null;

    let status: ScopeDiscoverySuggestionStatus = "PROPOSED";
    if (decisionType === "accept") status = "ACCEPTED";
    if (decisionType === "reject") status = "REJECTED";
    if (decisionType === "modify") status = "MODIFIED";

    priorDecisions.push({
      suggestionId: String(d.suggestion_id),
      identityKey,
      status,
      decisionType,
      sourceSnapshotBriefRevision: briefRev,
      sourceSnapshot,
      modifiedTitle: d.modified_title ? String(d.modified_title) : null,
      modifiedDescription: d.modified_description
        ? String(d.modified_description)
        : null,
      resultingWorkAreaId: d.created_work_area_id
        ? String(d.created_work_area_id)
        : null,
    });

    if (decisionType === "reject") {
      priorRejections.push({
        identityKey,
        sourceSnapshot,
        suggestionId: String(d.suggestion_id),
      });
    }

    if (decisionType === "accept" || decisionType === "modify") {
      priorProposals.push({
        identityKey,
        status,
        sourceSnapshot,
        suggestionId: String(d.suggestion_id),
      });
    }
  }

  return {
    projectId,
    orgId: ctx.orgId,
    briefText,
    briefRevision,
    siteNotes,
    acceptedWorkAreas,
    facts,
    constraints,
    region,
    priorRunSummaries,
    priorSuggestions: [],
    priorDecisions,
    priorProposals,
    priorRejections,
  };
}
