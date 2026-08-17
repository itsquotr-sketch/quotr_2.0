/**
 * REQ-4A — append-only requirement snapshot store.
 *
 * Insert/select only. No payload UPDATE. Identity is generationId (UUID),
 * not created_at.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseEstimateRequirementSnapshot,
  serializeEstimateRequirementSnapshot,
  type EstimateRequirementSnapshotV1,
} from "@/lib/estimate/requirement-snapshot";

export type RequirementSnapshotRecord = {
  id: string;
  orgId: string;
  projectId: string;
  estimateId: string;
  generationId: string;
  schemaVersion: string;
  payload: EstimateRequirementSnapshotV1;
  createdAt: string;
};

export type RequirementSnapshotInsert = {
  orgId: string;
  projectId: string;
  estimateId: string;
  generationId: string;
  payload: EstimateRequirementSnapshotV1;
};

export type RequirementSnapshotStore = {
  insert(input: RequirementSnapshotInsert): Promise<RequirementSnapshotRecord>;
  getById(id: string): Promise<RequirementSnapshotRecord | null>;
  getByGenerationId(
    generationId: string
  ): Promise<RequirementSnapshotRecord | null>;
};

export class SnapshotImmutabilityError extends Error {
  constructor(message = "requirement snapshot payload is immutable") {
    super(message);
    this.name = "SnapshotImmutabilityError";
  }
}

function mapRow(row: {
  id: string;
  org_id: string;
  project_id: string;
  estimate_id: string;
  generation_id: string;
  schema_version: string;
  payload: unknown;
  created_at: string;
}): RequirementSnapshotRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    projectId: row.project_id,
    estimateId: row.estimate_id,
    generationId: row.generation_id,
    schemaVersion: row.schema_version,
    payload: parseEstimateRequirementSnapshot(row.payload),
    createdAt: row.created_at,
  };
}

export function createMemoryRequirementSnapshotStore(): RequirementSnapshotStore & {
  records: RequirementSnapshotRecord[];
} {
  const records: RequirementSnapshotRecord[] = [];
  return {
    records,
    async insert(input) {
      if (records.some((item) => item.generationId === input.generationId)) {
        throw new Error("duplicate snapshot generationId");
      }
      serializeEstimateRequirementSnapshot(input.payload);
      const record: RequirementSnapshotRecord = {
        id: crypto.randomUUID(),
        orgId: input.orgId,
        projectId: input.projectId,
        estimateId: input.estimateId,
        generationId: input.generationId,
        schemaVersion: input.payload.schemaVersion,
        payload: parseEstimateRequirementSnapshot(
          serializeEstimateRequirementSnapshot(input.payload)
        ),
        createdAt: new Date().toISOString(),
      };
      records.push(record);
      return record;
    },
    async getById(id) {
      return records.find((item) => item.id === id) ?? null;
    },
    async getByGenerationId(generationId) {
      return records.find((item) => item.generationId === generationId) ?? null;
    },
  };
}

export function createSupabaseRequirementSnapshotStore(
  supabase: SupabaseClient
): RequirementSnapshotStore {
  return {
    async insert(input) {
      const serialized = serializeEstimateRequirementSnapshot(input.payload);
      const payload = JSON.parse(serialized) as unknown;
      const { data, error } = await supabase
        .from("estimate_requirement_snapshots")
        .insert({
          org_id: input.orgId,
          project_id: input.projectId,
          estimate_id: input.estimateId,
          generation_id: input.generationId,
          schema_version: input.payload.schemaVersion,
          payload,
        })
        .select(
          "id, org_id, project_id, estimate_id, generation_id, schema_version, payload, created_at"
        )
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "requirement snapshot insert failed");
      }
      return mapRow(data);
    },
    async getById(id) {
      const { data, error } = await supabase
        .from("estimate_requirement_snapshots")
        .select(
          "id, org_id, project_id, estimate_id, generation_id, schema_version, payload, created_at"
        )
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return mapRow(data);
    },
    async getByGenerationId(generationId) {
      const { data, error } = await supabase
        .from("estimate_requirement_snapshots")
        .select(
          "id, org_id, project_id, estimate_id, generation_id, schema_version, payload, created_at"
        )
        .eq("generation_id", generationId)
        .maybeSingle();
      if (error || !data) return null;
      return mapRow(data);
    },
  };
}

export function resolveCurrentRequirementSnapshot(params: {
  requirementGenerationId: string | null | undefined;
  latestRequirementSnapshotId: string | null | undefined;
  byId: RequirementSnapshotRecord | null;
  byGenerationId: RequirementSnapshotRecord | null;
}): RequirementSnapshotRecord | null {
  const generationId = params.requirementGenerationId;
  if (!generationId) return null;
  if (
    params.byId &&
    params.latestRequirementSnapshotId === params.byId.id &&
    params.byId.generationId === generationId
  ) {
    return params.byId;
  }
  if (params.byGenerationId?.generationId === generationId) {
    return params.byGenerationId;
  }
  return null;
}
