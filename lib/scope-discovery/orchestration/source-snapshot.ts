/**
 * Deterministic source snapshot + fingerprint helpers.
 * Fingerprint is an idempotency aid, not a security hash.
 */

import { deepFreeze } from "../immutability";
import type { SourceSnapshot } from "../types";
import {
  ORCHESTRATION_ERROR_CODES,
  ScopeDiscoveryOrchestrationError,
} from "./errors";
import type {
  ScopeDiscoveryRequest,
  ScopeDiscoverySourceSnapshot,
} from "./types";
import { SCOPE_DISCOVERY_ORCHESTRATION_VERSION } from "./version";
import { isFactMaterialForDiscoveryStale } from "../scope-impact";

/** Collapse whitespace for formatting-only normalisation of brief text used in hashing content when revision absent. */
export function normaliseFormatting(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** FNV-1a 32-bit digest → hex. Idempotency aid only — not cryptographic. */
export function fingerprintDigest(parts: readonly string[]): string {
  let h = 2166136261;
  const joined = parts.join("\u001f");
  for (let i = 0; i < joined.length; i += 1) {
    h ^= joined.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fp_${(h >>> 0).toString(16).padStart(8, "0")}`;
}

function sortedJoin(
  items: readonly { readonly id: string; readonly revision: string }[]
): string {
  return [...items]
    .map((i) => `${i.id}:${i.revision}`)
    .sort()
    .join("|");
}

/**
 * Build immutable material source snapshot from a validated request.
 * Provider/model is intentionally omitted from the fingerprint inputs.
 */
export function buildSourceSnapshot(
  request: ScopeDiscoveryRequest,
  options: { readonly providerModelId?: string | null } = {}
): ScopeDiscoverySourceSnapshot {
  const notes = [...request.selectedSiteNotes]
    .map((n) => ({
      noteId: n.noteId,
      revision: n.revision,
    }))
    .sort((a, b) => a.noteId.localeCompare(b.noteId));

  const facts = [...request.authoritativeFacts]
    .filter((f) => isFactMaterialForDiscoveryStale(f.key))
    .map((f) => ({ key: f.key, revision: f.revision }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const constraints = [...request.authoritativeConstraints]
    .map((c) => ({ key: c.key, revision: c.revision }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const workAreas = [...request.acceptedWorkAreas]
    .map((w) => ({
      workAreaId: w.workAreaId,
      type: w.type,
      revision: w.revision,
    }))
    .sort((a, b) => a.workAreaId.localeCompare(b.workAreaId));

  // Prefer caller revisions; for brief, also bind a content-normalised digest so
  // formatting-only brief text with identical revision stays stable.
  const briefContentDigest = fingerprintDigest([
    normaliseFormatting(request.projectBrief),
  ]);
  const briefRevision = `${request.projectBriefRevision}|${briefContentDigest}`;

  const noteRevisionSet = sortedJoin(
    notes.map((n) => ({ id: n.noteId, revision: n.revision }))
  );
  const factRevisions = sortedJoin(
    facts.map((f) => ({ id: f.key, revision: f.revision }))
  );
  const constraintRevisions = sortedJoin(
    constraints.map((c) => ({ id: c.key, revision: c.revision }))
  );
  const workAreaRevisions = sortedJoin(
    workAreas.map((w) => ({ id: w.workAreaId, revision: w.revision }))
  );

  return deepFreeze({
    briefRevision,
    noteIdsAndRevisions: notes,
    noteRevisionSet: noteRevisionSet || "notes:empty",
    factKeysAndRevisions: facts,
    factRevisions: factRevisions || "facts:empty",
    constraintKeysAndRevisions: constraints,
    constraintRevisions: constraintRevisions || "constraints:empty",
    workAreaIdsAndRevisions: workAreas,
    workAreaRevisions: workAreaRevisions || "wa:empty",
    contractVersion: request.currentContractVersion,
    catalogueVersion: request.currentCatalogueVersion,
    promptVersion: request.currentPromptVersion,
    region: request.region,
    analysisObjective: request.analysisObjective.trim(),
    providerModelId: options.providerModelId ?? null,
    formattingRevision: null,
    orchestrationVersion: SCOPE_DISCOVERY_ORCHESTRATION_VERSION,
  });
}

/**
 * Project-source fingerprint — excludes provider/model and formatting metadata.
 * Not a security hash.
 */
export function computeSourceFingerprint(
  snapshot: ScopeDiscoverySourceSnapshot
): string {
  return fingerprintDigest([
    snapshot.briefRevision,
    snapshot.noteRevisionSet,
    snapshot.factRevisions,
    snapshot.constraintRevisions,
    snapshot.workAreaRevisions,
    snapshot.contractVersion,
    snapshot.catalogueVersion,
    snapshot.promptVersion,
    snapshot.region ?? "",
    snapshot.analysisObjective,
  ]);
}

/** Map orchestration snapshot → 3.1B.1 SourceSnapshot for catalogue/merge. */
export function toContractSourceSnapshot(
  snapshot: ScopeDiscoverySourceSnapshot
): SourceSnapshot {
  return deepFreeze({
    briefRevision: snapshot.briefRevision,
    noteRevisionSet: snapshot.noteRevisionSet,
    factRevisions: snapshot.factRevisions,
    constraintRevisions: snapshot.constraintRevisions,
    workAreaRevisions: snapshot.workAreaRevisions,
    catalogueVersion: snapshot.catalogueVersion,
    contractVersion: snapshot.contractVersion,
    providerModelId: snapshot.providerModelId,
    formattingRevision: snapshot.formattingRevision,
  });
}

export function assertValidSnapshot(
  snapshot: ScopeDiscoverySourceSnapshot
): void {
  if (!snapshot.briefRevision || !snapshot.contractVersion) {
    throw new ScopeDiscoveryOrchestrationError(
      ORCHESTRATION_ERROR_CODES.INVALID_SOURCE_SNAPSHOT,
      "Source snapshot is incomplete."
    );
  }
}
