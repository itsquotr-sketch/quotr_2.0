/**
 * REQ-4A — versioned EstimateRequirement snapshot serialization.
 *
 * Persist calculation evidence, not live rate joins. Parse on read.
 */
import { snapshotRegisteredAuthorities } from "@/lib/estimate/component-authority";
import type {
  ComponentCommercialAuthority,
  RequirementParityClass,
} from "@/lib/estimate/component-authority";
import { ESTIMATE_REQUIREMENT_CONTRACT_VERSION } from "@/lib/estimate/requirements";
import { assertRequirement } from "@/lib/estimate/requirement-validate";
import { normalizeRequirements } from "@/lib/estimate/requirement-normalize";
import type { EstimateRequirement } from "@/lib/estimate/requirements";
import type { CommercialActiveSource } from "@/lib/estimate/component-commercial-selection";
import type { EstimateSellAuthority } from "@/lib/commercial-engine/core/cost-first-authority";
import { isEstimateSellAuthority } from "@/lib/commercial-engine/core/cost-first-authority";

export const ESTIMATE_REQUIREMENT_SNAPSHOT_SCHEMA_VERSION =
  "estimate-requirement-snapshot-v1" as const;

export type EstimateRequirementSnapshotV1 = {
  schemaVersion: typeof ESTIMATE_REQUIREMENT_SNAPSHOT_SCHEMA_VERSION;
  requirementContractVersion: typeof ESTIMATE_REQUIREMENT_CONTRACT_VERSION;
  generatedAt: string;
  generationId: string;
  requirements: readonly EstimateRequirement[];
  componentAuthorities: Array<{
    workAreaType: string;
    componentKey: string;
    authority: ComponentCommercialAuthority;
    parityClass: RequirementParityClass;
  }>;
  /**
   * Optional REQ-4B generation active-source evidence.
   * Absent on pre-REQ-4B snapshots. Policy remains in componentAuthorities.
   */
  commercialSources?: Array<{
    workAreaId: string;
    workAreaType: string;
    componentKey: string;
    registeredAuthority: ComponentCommercialAuthority;
    activeSource: CommercialActiveSource;
    requirementId: string | null;
    requirementCost: number | null;
    legacyCost: number | null;
    activeCost: number | null;
    fallbackReason?: string;
  }>;
  /**
   * Optional RECOVERY-1-R1 generation sell authority.
   * Absent on historical snapshots — interpret from estimates.target_margin_percent.
   */
  estimateSellAuthority?: EstimateSellAuthority;
};

export class RequirementSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequirementSnapshotError";
  }
}

function stripUndefined(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map(stripUndefined);
  }
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    result[key] = stripUndefined(child);
  }
  return result;
}

function assertJsonSafe(value: unknown, path: string): void {
  if (value === undefined) {
    throw new RequirementSnapshotError(`undefined at ${path}`);
  }
  if (typeof value === "function") {
    throw new RequirementSnapshotError(`function at ${path}`);
  }
  if (typeof value === "bigint") {
    throw new RequirementSnapshotError(`bigint at ${path}`);
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new RequirementSnapshotError(`non-finite number at ${path}`);
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    assertJsonSafe(child, `${path}.${key}`);
  }
}

export function serializeEstimateRequirementSnapshot(
  snapshot: EstimateRequirementSnapshotV1
): string {
  if (snapshot.schemaVersion !== ESTIMATE_REQUIREMENT_SNAPSHOT_SCHEMA_VERSION) {
    throw new RequirementSnapshotError("unsupported snapshot schemaVersion");
  }
  const cleaned = stripUndefined(snapshot) as EstimateRequirementSnapshotV1;
  assertJsonSafe(cleaned, "snapshot");
  const json = JSON.stringify(cleaned);
  JSON.parse(json);
  return json;
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    value.includes("T")
  );
}

export function parseEstimateRequirementSnapshot(
  raw: unknown
): EstimateRequirementSnapshotV1 {
  const value =
    typeof raw === "string"
      ? (JSON.parse(raw) as unknown)
      : raw;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequirementSnapshotError("snapshot payload must be an object");
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== ESTIMATE_REQUIREMENT_SNAPSHOT_SCHEMA_VERSION) {
    throw new RequirementSnapshotError(
      `unsupported snapshot schemaVersion: ${String(record.schemaVersion)}`
    );
  }
  if (record.requirementContractVersion !== ESTIMATE_REQUIREMENT_CONTRACT_VERSION) {
    throw new RequirementSnapshotError(
      `unsupported requirementContractVersion: ${String(record.requirementContractVersion)}`
    );
  }
  if (!isIsoDate(record.generatedAt)) {
    throw new RequirementSnapshotError("generatedAt must be an ISO timestamp");
  }
  if (typeof record.generationId !== "string" || record.generationId.length < 8) {
    throw new RequirementSnapshotError("generationId is required");
  }
  if (!Array.isArray(record.requirements)) {
    throw new RequirementSnapshotError("requirements must be an array");
  }
  if (!Array.isArray(record.componentAuthorities)) {
    throw new RequirementSnapshotError("componentAuthorities must be an array");
  }

  const requirements = normalizeRequirements(
    record.requirements as EstimateRequirement[]
  );
  for (const requirement of requirements) {
    assertRequirement(requirement);
  }

  const componentAuthorities = record.componentAuthorities.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new RequirementSnapshotError(`componentAuthorities[${index}] invalid`);
    }
    const item = entry as Record<string, unknown>;
    if (typeof item.workAreaType !== "string" || typeof item.componentKey !== "string") {
      throw new RequirementSnapshotError(
        `componentAuthorities[${index}] missing identity`
      );
    }
    if (typeof item.authority !== "string" || typeof item.parityClass !== "string") {
      throw new RequirementSnapshotError(
        `componentAuthorities[${index}] missing authority`
      );
    }
    return {
      workAreaType: item.workAreaType,
      componentKey: item.componentKey,
      authority: item.authority as ComponentCommercialAuthority,
      parityClass: item.parityClass as RequirementParityClass,
    };
  });

  const commercialSources = parseCommercialSources(record.commercialSources);
  const estimateSellAuthority = isEstimateSellAuthority(record.estimateSellAuthority)
    ? record.estimateSellAuthority
    : undefined;

  const snapshot: EstimateRequirementSnapshotV1 = {
    schemaVersion: ESTIMATE_REQUIREMENT_SNAPSHOT_SCHEMA_VERSION,
    requirementContractVersion: ESTIMATE_REQUIREMENT_CONTRACT_VERSION,
    generatedAt: record.generatedAt,
    generationId: record.generationId,
    requirements,
    componentAuthorities,
    ...(commercialSources ? { commercialSources } : {}),
    ...(estimateSellAuthority ? { estimateSellAuthority } : {}),
  };
  assertJsonSafe(snapshot, "snapshot");
  return snapshot;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RequirementSnapshotError("commercialSources cost must be finite or null");
  }
  return value;
}

function parseCommercialSources(
  raw: unknown
): EstimateRequirementSnapshotV1["commercialSources"] {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new RequirementSnapshotError("commercialSources must be an array");
  }
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new RequirementSnapshotError(`commercialSources[${index}] invalid`);
    }
    const item = entry as Record<string, unknown>;
    if (
      typeof item.workAreaId !== "string" ||
      typeof item.workAreaType !== "string" ||
      typeof item.componentKey !== "string" ||
      typeof item.registeredAuthority !== "string" ||
      typeof item.activeSource !== "string"
    ) {
      throw new RequirementSnapshotError(
        `commercialSources[${index}] missing required fields`
      );
    }
    if (
      item.activeSource !== "REQUIREMENT" &&
      item.activeSource !== "LEGACY_FALLBACK" &&
      item.activeSource !== "LEGACY"
    ) {
      throw new RequirementSnapshotError(
        `commercialSources[${index}] unknown activeSource`
      );
    }
    return {
      workAreaId: item.workAreaId,
      workAreaType: item.workAreaType,
      componentKey: item.componentKey,
      registeredAuthority: item.registeredAuthority as ComponentCommercialAuthority,
      activeSource: item.activeSource as CommercialActiveSource,
      requirementId:
        item.requirementId == null ? null : String(item.requirementId),
      requirementCost: parseOptionalNumber(item.requirementCost),
      legacyCost: parseOptionalNumber(item.legacyCost),
      activeCost: parseOptionalNumber(item.activeCost),
      ...(typeof item.fallbackReason === "string"
        ? { fallbackReason: item.fallbackReason }
        : {}),
    };
  });
}

export function buildEstimateRequirementSnapshotV1(params: {
  generationId: string;
  generatedAt?: string;
  requirements: readonly EstimateRequirement[];
  commercialSources?: EstimateRequirementSnapshotV1["commercialSources"];
  estimateSellAuthority?: EstimateRequirementSnapshotV1["estimateSellAuthority"];
}): EstimateRequirementSnapshotV1 {
  return {
    schemaVersion: ESTIMATE_REQUIREMENT_SNAPSHOT_SCHEMA_VERSION,
    requirementContractVersion: ESTIMATE_REQUIREMENT_CONTRACT_VERSION,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    generationId: params.generationId,
    requirements: normalizeRequirements(params.requirements),
    componentAuthorities: [...snapshotRegisteredAuthorities()],
    ...(params.commercialSources ? { commercialSources: params.commercialSources } : {}),
    ...(params.estimateSellAuthority
      ? { estimateSellAuthority: params.estimateSellAuthority }
      : {}),
  };
}
