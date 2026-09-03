"use server";

import { z } from "zod";
import {
  COMPANY_DNA_TASKS,
  getCompanyDnaTask,
  orderCompanyDnaWorkAreas,
  type CompanyDnaWorkAreaType,
} from "@/lib/company-dna/catalogue";
import {
  companyDnaWorkAreaStatus,
  companyDnaWorkAreaStatusLabel,
  deriveCompanyProductivity,
  validateCompanyDnaInputs,
} from "@/lib/company-dna/derive";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { permissionDeniedError } from "@/lib/team/permission-server";

export type CompanyDnaTaskStatus = {
  calibrationTaskKey: string;
  calibrated: boolean;
  derivedProductivity: number | null;
  createdAt: string | null;
};

export type CompanyDnaWorkAreaProgress = {
  workAreaType: CompanyDnaWorkAreaType;
  label: string;
  calibratedCount: number;
  taskTotal: number;
  highImpactCalibrated: number;
  highImpactTotal: number;
  status: "benchmarks" | "partly" | "calibrated";
  statusLabel: string;
  tasks: CompanyDnaTaskStatus[];
};

export type CompanyDnaHubState = {
  preferredWorkAreaTypes: string[];
  orderedWorkAreas: CompanyDnaWorkAreaType[];
  progress: CompanyDnaWorkAreaProgress[];
  canCalibrate: boolean;
};

export type CompanyDnaActionResult = {
  error?: string;
  confirmRequired?: boolean;
  saved?: boolean;
  reset?: boolean;
  derivedProductivity?: number;
  benchmarkProductivity?: number;
  percentVsBenchmark?: number;
  faster?: boolean;
};

const saveSchema = z.object({
  calibrationTaskKey: z.string().trim().min(1).max(128),
  crewSize: z.number(),
  durationHours: z.number(),
  outlierConfirmed: z.boolean().optional(),
});

async function requireCalibrationWrite() {
  const context = await getAuthOrgContext();
  if (!context) {
    return {
      ok: false as const,
      error: {
        error:
          "Your organisation profile could not be loaded. Try signing out and back in.",
      },
    };
  }
  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "company.calibration.manage",
    entitlement: "calibration.basic",
  });
  if (denied) return { ok: false as const, error: denied };
  return { ok: true as const, context };
}

export async function getCompanyDnaHubState(): Promise<CompanyDnaHubState> {
  const context = await getAuthOrgContext();
  if (!context) {
    return {
      preferredWorkAreaTypes: [],
      orderedWorkAreas: [...orderCompanyDnaWorkAreas([])],
      progress: [],
      canCalibrate: false,
    };
  }

  const [{ data: preferredRows }, { data: evidenceRows }, permission] =
    await Promise.all([
      context.supabase
        .from("organisation_work_areas")
        .select("work_area_type")
        .eq("org_id", context.orgId)
        .eq("enabled", true),
      context.supabase
        .from("productivity_calibration_responses")
        .select(
          "calibration_task_key, derived_productivity, created_at, status"
        )
        .eq("org_id", context.orgId)
        .eq("status", "active"),
      permissionDeniedError({
        orgId: context.orgId,
        userId: context.user.id,
        permission: "company.calibration.manage",
        entitlement: "calibration.basic",
      }),
    ]);

  const preferredWorkAreaTypes = (preferredRows ?? []).map(
    (row) => row.work_area_type as string
  );
  const evidenceByTask = new Map(
    (evidenceRows ?? []).map((row) => [
      String(row.calibration_task_key),
      row,
    ])
  );

  const orderedWorkAreas = orderCompanyDnaWorkAreas(preferredWorkAreaTypes);
  const progress = orderedWorkAreas.map((workAreaType) => {
    const tasks = COMPANY_DNA_TASKS.filter(
      (task) => task.workAreaType === workAreaType
    );
    const taskStatuses: CompanyDnaTaskStatus[] = tasks.map((task) => {
      const evidence = evidenceByTask.get(task.calibrationTaskKey);
      return {
        calibrationTaskKey: task.calibrationTaskKey,
        calibrated: Boolean(evidence),
        derivedProductivity:
          evidence?.derived_productivity != null
            ? Number(evidence.derived_productivity)
            : null,
        createdAt:
          evidence?.created_at != null ? String(evidence.created_at) : null,
      };
    });
    const calibratedCount = taskStatuses.filter((task) => task.calibrated)
      .length;
    const highImpactTotal = tasks.filter((task) => task.isHighImpact).length;
    const highImpactCalibrated = tasks.filter(
      (task) =>
        task.isHighImpact &&
        taskStatuses.some(
          (status) =>
            status.calibrationTaskKey === task.calibrationTaskKey &&
            status.calibrated
        )
    ).length;
    const status = companyDnaWorkAreaStatus({
      highImpactTotal,
      highImpactCalibrated,
      anyCalibrated: calibratedCount > 0,
    });
    return {
      workAreaType,
      label:
        workAreaType === "retaining_wall"
          ? "Retaining wall"
          : workAreaType === "fence"
            ? "Fence"
            : "Deck",
      calibratedCount,
      taskTotal: tasks.length,
      highImpactCalibrated,
      highImpactTotal,
      status,
      statusLabel: companyDnaWorkAreaStatusLabel(status),
      tasks: taskStatuses,
    };
  });

  return {
    preferredWorkAreaTypes,
    orderedWorkAreas,
    progress,
    canCalibrate: permission == null,
  };
}

export async function saveCompanyDnaCalibration(input: {
  calibrationTaskKey: string;
  crewSize: number;
  durationHours: number;
  outlierConfirmed?: boolean;
}): Promise<CompanyDnaActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Check crew size and hours, then try again." };
  }

  const task = getCompanyDnaTask(parsed.data.calibrationTaskKey);
  if (!task) {
    return { error: "Unknown calibration task." };
  }

  const derived = deriveCompanyProductivity({
    task,
    crewSize: parsed.data.crewSize,
    durationHours: parsed.data.durationHours,
  });
  const validation = validateCompanyDnaInputs({
    crewSize: parsed.data.crewSize,
    durationHours: parsed.data.durationHours,
    ratioToBenchmark: derived.ratioToBenchmark,
    outlierConfirmed: Boolean(parsed.data.outlierConfirmed),
  });

  if (!validation.ok && validation.code === "OUTLIER_CONFIRM_REQUIRED") {
    return {
      confirmRequired: true,
      derivedProductivity: derived.productivity,
      benchmarkProductivity: task.benchmarkProductivity,
      percentVsBenchmark: derived.percentVsBenchmark,
      faster: derived.faster,
    };
  }

  if (!validation.ok) {
    if (validation.code === "OUTLIER_HARD") {
      return {
        error:
          "That combination is far outside a realistic range. Check crew size and hours.",
      };
    }
    if (validation.code === "INVALID_CREW") {
      return { error: "Crew size must be between 1 and 20 people." };
    }
    return { error: "Time must be between 0.25 and 200 hours." };
  }

  const loaded = await requireCalibrationWrite();
  if (!loaded.ok) return loaded.error;

  const { data, error } = await loaded.context.supabase.rpc(
    "save_productivity_calibration",
    {
      p_calibration_task_key: parsed.data.calibrationTaskKey,
      p_crew_size: parsed.data.crewSize,
      p_duration_hours: parsed.data.durationHours,
      p_outlier_confirmed: Boolean(parsed.data.outlierConfirmed),
    }
  );

  if (error) {
    const message = error.message ?? "";
    if (message.includes("DNA:OUTLIER_CONFIRM_REQUIRED")) {
      return {
        confirmRequired: true,
        derivedProductivity: derived.productivity,
        benchmarkProductivity: task.benchmarkProductivity,
        percentVsBenchmark: derived.percentVsBenchmark,
        faster: derived.faster,
      };
    }
    if (message.includes("DNA:FORBIDDEN")) {
      return { error: "You don't have permission to do that." };
    }
    if (message.includes("DNA:OUTLIER_HARD")) {
      return {
        error:
          "That combination is far outside a realistic range. Check crew size and hours.",
      };
    }
    return { error: "Could not save calibration. Please try again." };
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  const savedProductivity =
    payload.derived_productivity != null
      ? Number(payload.derived_productivity)
      : derived.productivity;

  return {
    saved: true,
    derivedProductivity: savedProductivity,
    benchmarkProductivity: task.benchmarkProductivity,
    percentVsBenchmark: derived.percentVsBenchmark,
    faster: derived.faster,
  };
}

export async function resetCompanyDnaCalibration(
  calibrationTaskKey: string
): Promise<CompanyDnaActionResult> {
  const task = getCompanyDnaTask(calibrationTaskKey);
  if (!task) {
    return { error: "Unknown calibration task." };
  }

  const loaded = await requireCalibrationWrite();
  if (!loaded.ok) return loaded.error;

  const { error } = await loaded.context.supabase.rpc(
    "reset_productivity_to_benchmark",
    { p_calibration_task_key: calibrationTaskKey }
  );

  if (error) {
    if ((error.message ?? "").includes("DNA:FORBIDDEN")) {
      return { error: "You don't have permission to do that." };
    }
    return { error: "Could not reset to the Quotr benchmark." };
  }

  return { reset: true };
}

export async function hasCompanyDnaCalibration(): Promise<boolean> {
  const context = await getAuthOrgContext();
  if (!context) return false;
  const { data } = await context.supabase
    .from("productivity_calibration_responses")
    .select("id")
    .eq("org_id", context.orgId)
    .eq("status", "active")
    .limit(1);
  return (data ?? []).length > 0;
}
