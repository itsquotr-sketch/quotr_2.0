"use server";

/**
 * Stage 3.1B.5C / 3.1B.6 — Thin authenticated server actions for gated scope discovery.
 *
 * Assistant UI may import these only when SCOPE_DISCOVERY_ENABLED is true
 * (server-passed prop). Does not alter Analyse Job.
 * Delegates to application services — no repository/provider logic here.
 */

import { z } from "zod";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import {
  acceptScopeSuggestionApp,
  rejectScopeSuggestionApp,
  modifyScopeSuggestionApp,
  batchConfirmScopeItemsApp,
  applyScopeImpactRecommendationApp,
  keepScopeImpactRecommendationApp,
  getScopeDiscoveryResults,
  runScopeDiscovery,
  evaluateScopeDiscoveryStale,
  applicationFailure,
  APPLICATION_ERROR_CODES,
  type ApplicationFailure,
  type DecisionOutcome,
  type ResultsReadOutcome,
  type RunDiscoveryOutcome,
  type StaleOutcome,
  type BatchConfirmScopeOutcome,
  type ScopeImpactRecommendationActionOutcome,
} from "./application";
import { revalidateScopeDiscoveryPaths } from "./application/revalidate";
import type { PersistenceAuthContext } from "./persistence/context";
import { BATCH_SCOPE_STATES } from "./application/batch-confirm-scope";

const uuidSchema = z.string().uuid();

const runInputSchema = z.object({
  projectId: uuidSchema,
  forceNewRun: z.boolean().optional(),
  analysisObjective: z.string().max(500).optional(),
});

const resultsInputSchema = z.object({
  projectId: uuidSchema,
  runId: uuidSchema.optional(),
});

const acceptInputSchema = z.object({
  suggestionId: uuidSchema,
  projectId: uuidSchema,
  sourceRevision: z.string().min(1).max(500),
  reasonCode: z.string().max(120).nullable().optional(),
  userNote: z.string().max(2000).nullable().optional(),
});

const rejectInputSchema = acceptInputSchema;

const modifyInputSchema = z.object({
  suggestionId: uuidSchema,
  projectId: uuidSchema,
  sourceRevision: z.string().min(1).max(500),
  modifiedTitle: z.string().min(1).max(200),
  modifiedDescription: z.string().max(2000).nullable().optional(),
  modifiedWorkAreaType: z.string().min(1).max(80),
  reasonCode: z.string().max(120).nullable().optional(),
  userNote: z.string().max(2000).nullable().optional(),
});

const batchConfirmInputSchema = z.object({
  projectId: uuidSchema,
  runId: uuidSchema,
  sourceRevision: z.string().min(1).max(500),
  items: z
    .array(
      z.object({
        suggestionId: uuidSchema,
        intendedState: z.enum(BATCH_SCOPE_STATES),
        modifiedTitle: z.string().max(200).nullable().optional(),
        modifiedDescription: z.string().max(2000).nullable().optional(),
      })
    )
    .min(1)
    .max(200),
});

const scopeImpactActionInputSchema = z.object({
  projectId: uuidSchema,
  runId: uuidSchema,
  sourceRevision: z.string().min(1).max(500),
  suggestionId: uuidSchema,
  recommendationId: z.string().min(1).max(500),
  intendedState: z.enum(["INCLUDED", "NOT_REQUIRED"]),
});

async function authContext(): Promise<
  | { ok: true; ctx: PersistenceAuthContext }
  | { ok: false; failure: ApplicationFailure }
> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    return {
      ok: false,
      failure: applicationFailure(
        auth.code === "organisation_required"
          ? APPLICATION_ERROR_CODES.ORGANISATION_REQUIRED
          : APPLICATION_ERROR_CODES.NOT_AUTHENTICATED
      ),
    };
  }
  return {
    ok: true,
    ctx: {
      supabase: auth.supabase,
      orgId: auth.orgId,
      userId: auth.user.id,
    },
  };
}

export async function runScopeDiscoveryAction(input: {
  projectId: string;
  forceNewRun?: boolean;
  analysisObjective?: string;
}): Promise<RunDiscoveryOutcome> {
  const parsed = runInputSchema.safeParse(input);
  if (!parsed.success) {
    return applicationFailure(APPLICATION_ERROR_CODES.VALIDATION_FAILED);
  }

  const auth = await authContext();
  if (!auth.ok) return auth.failure;

  return runScopeDiscovery(parsed.data, {
    ctx: auth.ctx,
    revalidate: revalidateScopeDiscoveryPaths,
  });
}

export async function getScopeDiscoveryResultsAction(input: {
  projectId: string;
  runId?: string;
}): Promise<ResultsReadOutcome> {
  const parsed = resultsInputSchema.safeParse(input);
  if (!parsed.success) {
    return applicationFailure(APPLICATION_ERROR_CODES.VALIDATION_FAILED);
  }

  const auth = await authContext();
  if (!auth.ok) return auth.failure;

  return getScopeDiscoveryResults(parsed.data, { ctx: auth.ctx });
}

export async function acceptScopeSuggestionAction(input: {
  suggestionId: string;
  projectId: string;
  sourceRevision: string;
  reasonCode?: string | null;
  userNote?: string | null;
}): Promise<DecisionOutcome> {
  const parsed = acceptInputSchema.safeParse(input);
  if (!parsed.success) {
    return applicationFailure(APPLICATION_ERROR_CODES.VALIDATION_FAILED);
  }

  const auth = await authContext();
  if (!auth.ok) return auth.failure;

  return acceptScopeSuggestionApp(parsed.data, {
    ctx: auth.ctx,
    revalidate: revalidateScopeDiscoveryPaths,
  });
}

export async function rejectScopeSuggestionAction(input: {
  suggestionId: string;
  projectId: string;
  sourceRevision: string;
  reasonCode?: string | null;
  userNote?: string | null;
}): Promise<DecisionOutcome> {
  const parsed = rejectInputSchema.safeParse(input);
  if (!parsed.success) {
    return applicationFailure(APPLICATION_ERROR_CODES.VALIDATION_FAILED);
  }

  const auth = await authContext();
  if (!auth.ok) return auth.failure;

  return rejectScopeSuggestionApp(parsed.data, {
    ctx: auth.ctx,
    revalidate: revalidateScopeDiscoveryPaths,
  });
}

export async function modifyScopeSuggestionAction(input: {
  suggestionId: string;
  projectId: string;
  sourceRevision: string;
  modifiedTitle: string;
  modifiedDescription?: string | null;
  modifiedWorkAreaType: string;
  reasonCode?: string | null;
  userNote?: string | null;
}): Promise<DecisionOutcome> {
  const parsed = modifyInputSchema.safeParse(input);
  if (!parsed.success) {
    return applicationFailure(APPLICATION_ERROR_CODES.VALIDATION_FAILED);
  }

  const auth = await authContext();
  if (!auth.ok) return auth.failure;

  return modifyScopeSuggestionApp(parsed.data, {
    ctx: auth.ctx,
    revalidate: revalidateScopeDiscoveryPaths,
  });
}

export async function batchConfirmScopeItemsAction(input: {
  projectId: string;
  runId: string;
  sourceRevision: string;
  items: {
    suggestionId: string;
    intendedState: "INCLUDED" | "NOT_REQUIRED" | "UNRESOLVED_CLARIFICATION";
    modifiedTitle?: string | null;
    modifiedDescription?: string | null;
  }[];
}): Promise<BatchConfirmScopeOutcome> {
  const parsed = batchConfirmInputSchema.safeParse(input);
  if (!parsed.success) {
    return applicationFailure(APPLICATION_ERROR_CODES.VALIDATION_FAILED);
  }

  const auth = await authContext();
  if (!auth.ok) return auth.failure;

  return batchConfirmScopeItemsApp(parsed.data, {
    ctx: auth.ctx,
    revalidate: revalidateScopeDiscoveryPaths,
  });
}

export async function applyScopeImpactRecommendationAction(input: {
  projectId: string;
  runId: string;
  sourceRevision: string;
  suggestionId: string;
  recommendationId: string;
  intendedState: "INCLUDED" | "NOT_REQUIRED";
}): Promise<ScopeImpactRecommendationActionOutcome> {
  const parsed = scopeImpactActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return applicationFailure(APPLICATION_ERROR_CODES.VALIDATION_FAILED);
  }

  const auth = await authContext();
  if (!auth.ok) return auth.failure;

  return applyScopeImpactRecommendationApp(parsed.data, {
    ctx: auth.ctx,
    revalidate: revalidateScopeDiscoveryPaths,
  });
}

export async function keepScopeImpactRecommendationAction(input: {
  projectId: string;
  runId: string;
  sourceRevision: string;
  suggestionId: string;
  recommendationId: string;
  intendedState: "INCLUDED" | "NOT_REQUIRED";
}): Promise<ScopeImpactRecommendationActionOutcome> {
  const parsed = scopeImpactActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return applicationFailure(APPLICATION_ERROR_CODES.VALIDATION_FAILED);
  }

  const auth = await authContext();
  if (!auth.ok) return auth.failure;

  return keepScopeImpactRecommendationApp(parsed.data, {
    ctx: auth.ctx,
    revalidate: revalidateScopeDiscoveryPaths,
  });
}

export async function evaluateScopeDiscoveryStaleAction(input: {
  projectId: string;
}): Promise<StaleOutcome> {
  const parsed = z.object({ projectId: uuidSchema }).safeParse(input);
  if (!parsed.success) {
    return applicationFailure(APPLICATION_ERROR_CODES.VALIDATION_FAILED);
  }

  const auth = await authContext();
  if (!auth.ok) return auth.failure;

  return evaluateScopeDiscoveryStale(parsed.data.projectId, { ctx: auth.ctx });
}
