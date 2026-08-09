"use server";

import { z } from "zod";
import { compareCalibrationAnswers } from "@/lib/calibration/compare";
import { getCalibrationScenario, listCalibrationScenarios } from "@/lib/calibration/catalogue";
import {
  buildCalibrationEngineSnapshot,
  getActiveCalibrationByScenario,
  listActiveCalibrationResponses,
  persistCalibrationResponse,
} from "@/lib/calibration/persistence";
import {
  answersFromRecord,
  type CalibrationResponseRecord,
  type CalibrationScenarioStatus,
} from "@/lib/calibration/persistence-types";
import type {
  CalibrationAnswers,
  CalibrationComparison,
} from "@/lib/calibration/types";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";

const answersSchema = z.object({
  labour_hours: z.number().min(0).nullable().optional(),
  labour_cost: z.number().min(0).nullable().optional(),
  materials_cost: z.number().min(0).nullable().optional(),
  subcontractors_cost: z.number().min(0).nullable().optional(),
  other_cost: z.number().min(0).nullable().optional(),
  expected_total_cost: z.number().min(0).nullable().optional(),
  expected_sell: z.number().min(0).nullable().optional(),
  confidence: z.enum(["low", "medium", "high"]).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type CalibrationActionResult = {
  error?: string;
  comparison?: CalibrationComparison;
  savedId?: string;
  saved?: boolean;
};

async function loadOrgRatesAndMargin(context: NonNullable<
  Awaited<ReturnType<typeof getAuthOrgContext>>
>) {
  const [{ data: rates }, { data: settings }] = await Promise.all([
    context.supabase
      .from("rates")
      .select(
        "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active"
      )
      .eq("org_id", context.orgId)
      .eq("active", true),
    context.supabase
      .from("organisation_settings")
      .select("default_margin_percent")
      .eq("org_id", context.orgId)
      .maybeSingle(),
  ]);

  return {
    rates: (rates ?? []) as never,
    defaultMarginPercent:
      settings?.default_margin_percent != null
        ? Number(settings.default_margin_percent)
        : undefined,
  };
}

/**
 * Run observational compare against existing estimate calculators.
 * Loads org rates for personalisation of Quotr side only — never writes rates.
 */
export async function runCalibrationComparison(input: {
  scenarioId: string;
  answers: CalibrationAnswers;
}): Promise<CalibrationActionResult> {
  const scenario = getCalibrationScenario(input.scenarioId);
  if (!scenario) {
    return { error: "Unknown calibration scenario." };
  }

  const parsed = answersSchema.safeParse(input.answers);
  if (!parsed.success) {
    return { error: "Check your numbers — values must be zero or greater." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  try {
    const { rates, defaultMarginPercent } = await loadOrgRatesAndMargin(context);
    const comparison = compareCalibrationAnswers({
      scenario,
      answers: parsed.data,
      rates,
      defaultMarginPercent,
    });
    return { comparison };
  } catch {
    return { error: "We couldn't run the comparison. Please try again." };
  }
}

/**
 * Persist calibration evidence (append/supersede). Never mutates rates/projects.
 */
export async function saveCalibrationResponse(input: {
  scenarioId: string;
  answers: CalibrationAnswers;
}): Promise<CalibrationActionResult> {
  const started = Date.now();
  const context = await getAuthOrgContext();
  if (!context) {
    console.info("[calibration]", {
      event: "calibration_save_failed",
      reason: "not_authenticated",
      elapsedMs: Date.now() - started,
    });
    return { error: "Not authenticated." };
  }

  const scenario = getCalibrationScenario(input.scenarioId);
  if (!scenario) {
    console.info("[calibration]", {
      event: "calibration_save_failed",
      reason: "unknown_scenario",
      elapsedMs: Date.now() - started,
    });
    return { error: "Unknown calibration scenario." };
  }

  console.info("[calibration]", {
    event: "calibration_save_started",
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
  });

  const compared = await runCalibrationComparison(input);
  if (compared.error && !compared.comparison) {
    console.info("[calibration]", {
      event: "calibration_save_failed",
      reason: "compare_failed",
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      elapsedMs: Date.now() - started,
    });
    return compared;
  }

  const comparison = compared.comparison!;
  const parsed = answersSchema.safeParse(input.answers);
  if (!parsed.success) {
    return { error: "Check your numbers — values must be zero or greater." };
  }

  try {
    const saved = await persistCalibrationResponse(context, {
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      workAreaType: scenario.workAreaType,
      answers: parsed.data,
      engineSnapshot: buildCalibrationEngineSnapshot(comparison),
      responseMetadata: {
        source: "setup_calibrate",
      },
    });

    console.info("[calibration]", {
      event: "calibration_save_completed",
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      elapsedMs: Date.now() - started,
      // Never log commercial answers
    });

    return {
      comparison,
      saved: true,
      savedId: saved.id,
    };
  } catch {
    console.info("[calibration]", {
      event: "calibration_save_failed",
      reason: "persist_failed",
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      elapsedMs: Date.now() - started,
    });
    return {
      comparison,
      error:
        "We couldn't save this calibration. Your rates and projects were not changed.",
    };
  }
}

export async function getCalibrationScenarioStatuses(): Promise<
  CalibrationScenarioStatus[]
> {
  const context = await getAuthOrgContext();
  if (!context) return [];

  try {
    const active = await listActiveCalibrationResponses(context);
    const byScenario = new Map(
      active.map((row) => [row.scenario_id, row] as const)
    );
    return listCalibrationScenarios().map((scenario) => ({
      scenarioId: scenario.id,
      workAreaType: scenario.workAreaType,
      calibrated: byScenario.has(scenario.id),
      latest: byScenario.get(scenario.id) ?? null,
    }));
  } catch {
    return listCalibrationScenarios().map((scenario) => ({
      scenarioId: scenario.id,
      workAreaType: scenario.workAreaType,
      calibrated: false,
      latest: null,
    }));
  }
}

export async function getActiveCalibrationForScenario(
  scenarioId: string
): Promise<{
  record: CalibrationResponseRecord | null;
  answers: CalibrationAnswers | null;
}> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { record: null, answers: null };
  }

  try {
    const record = await getActiveCalibrationByScenario(context, scenarioId);
    return {
      record,
      answers: record ? answersFromRecord(record) : null,
    };
  } catch {
    return { record: null, answers: null };
  }
}

export async function orgHasAnyCalibration(): Promise<boolean> {
  const context = await getAuthOrgContext();
  if (!context) return false;
  try {
    const active = await listActiveCalibrationResponses(context);
    return active.length > 0;
  } catch {
    return false;
  }
}
