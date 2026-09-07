/**
 * Preview-only Bathroom DNA catalogue seed (WA-BATHROOM-08).
 *
 * Not a numbered migration. Production must not apply this.
 * Hosted DNA save needs these rows because save_productivity_calibration
 * looks up productivity_calibration_catalogue.
 *
 * Run: npx --yes tsx scripts/seed-preview-bathroom-dna-catalogue.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  COMPANY_DNA_BATHROOM_TASKS,
  companyDnaPersistableCatalogueFields,
} from "../lib/company-dna/v2-foundation";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(filePath)) return env;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx)] = value;
  }
  return env;
}

const env = {
  ...parseEnvFile(join(process.cwd(), ".env.local")),
  ...process.env,
};
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? "";
const service = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !service) {
  console.error("Missing Preview Supabase URL or service role.");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0] ?? "";
if (ref !== PREVIEW_SUPABASE_PROJECT_REF) {
  console.error(`Refusing to seed non-Preview project ${ref}`);
  process.exit(1);
}

const rows = COMPANY_DNA_BATHROOM_TASKS.map((task) => {
  const fields = companyDnaPersistableCatalogueFields(task);
  return {
    calibration_task_key: fields.calibrationTaskKey,
    scenario_version: fields.scenarioVersion,
    work_area_type: fields.workAreaType,
    productivity_rate_key: fields.productivityRateKey,
    label: fields.label,
    prompt: fields.prompt,
    scenario_summary: fields.scenarioSummary,
    reference_quantity: fields.referenceQuantity,
    reference_unit: fields.referenceUnit,
    authority_quantity: fields.authorityQuantity,
    authority_unit: fields.authorityUnit,
    benchmark_productivity: fields.benchmarkProductivity,
    rate_label: fields.rateLabel,
    is_high_impact: fields.isHighImpact,
    sort_order: fields.sortOrder,
  };
});

async function main() {
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin
    .from("productivity_calibration_catalogue")
    .upsert(rows, { onConflict: "calibration_task_key" });
  if (error) {
    console.error("Preview Bathroom DNA catalogue seed failed:", error.message);
    process.exit(1);
  }
  console.log(
    `Seeded ${rows.length} Bathroom DNA catalogue rows on Preview ${ref}.`
  );
}

void main();
