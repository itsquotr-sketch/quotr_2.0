/**
 * Stage 2B baseline: real model extraction, the same normalisation the
 * Analyse action uses, then isolated Preview persistence and the Job Plan
 * plus Details questions those rows produce.
 *
 * Refuses Production. Does not send email or quotes.
 *
 *   node --require ./scripts/lib/stub-server-only.cjs ./node_modules/tsx/dist/cli.mjs scripts/evaluate-estimating-v3-stage-2b-analysis.ts
 *
 * STAGE_2B_ONLY=brief-id limits the set. STAGE_2B_RUNS defaults to 3.
 * STAGE_2B_VARIANTS=1 runs the reserved variants instead of the originals.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { STAGE_2A_BRIEF_EXPECTATIONS } from "./fixtures/stage-2a-original-brief-expectations";
import {
  STAGE_2A_BATHROOM_RENOVATION_BRIEF,
  STAGE_2A_CONFLICTING_FLOORING_AREA_BRIEF,
  STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF,
  STAGE_2A_INTERNAL_PARTITION_BRIEF,
  STAGE_2A_LAMINATE_FLOORING_BRIEF,
  STAGE_2A_LOW_DECK_BRIEF,
  STAGE_2A_OFFICE_FITOUT_BRIEF,
  STAGE_2A_THREE_ROOM_FLOORING_BRIEF,
} from "./fixtures/stage-2a-original-briefs";
import { STAGE_2B_RESERVED_VARIANTS } from "./fixtures/stage-2b-reserved-variants";

const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";

type BriefCase = {
  id: string;
  text: string;
  kind: "original" | "variant";
};

const ORIGINALS: BriefCase[] = [
  { id: "internal-partition", text: STAGE_2A_INTERNAL_PARTITION_BRIEF, kind: "original" },
  { id: "office-fitout", text: STAGE_2A_OFFICE_FITOUT_BRIEF, kind: "original" },
  { id: "three-room-flooring", text: STAGE_2A_THREE_ROOM_FLOORING_BRIEF, kind: "original" },
  { id: "elevated-replacement-deck", text: STAGE_2A_ELEVATED_REPLACEMENT_DECK_BRIEF, kind: "original" },
  { id: "laminate-flooring", text: STAGE_2A_LAMINATE_FLOORING_BRIEF, kind: "original" },
  { id: "low-deck", text: STAGE_2A_LOW_DECK_BRIEF, kind: "original" },
  { id: "conflicting-flooring-area", text: STAGE_2A_CONFLICTING_FLOORING_AREA_BRIEF, kind: "original" },
  { id: "bathroom-renovation", text: STAGE_2A_BATHROOM_RENOVATION_BRIEF, kind: "original" },
];

function loadEnv(filePath: string) {
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

function assertPreviewOnly() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes(PREVIEW_REF) || url.includes(PRODUCTION_REF)) {
    throw new Error("Refusing to run: Supabase URL is not the Preview project.");
  }
  const stripe = process.env.STRIPE_SECRET_KEY ?? "";
  if (stripe && !stripe.startsWith("sk_test_")) {
    throw new Error("Refusing to run: Stripe secret is not a test key.");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY.");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
}

function compactValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (depth > 3) return "[nested]";
  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => compactValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "id" || key.endsWith("_authority") || key.endsWith("Authority")) continue;
      out[key] = compactValue(child, depth + 1);
    }
    return out;
  }
  return String(value);
}

function factSignature(facts: readonly { key: string; value: unknown; work_area_type?: string | null }[]) {
  return facts.map((fact) => ({
    type: fact.work_area_type ?? null,
    key: fact.key,
    value: compactValue(fact.value),
  }));
}

function allowServerOnlyImports() {
  const require = createRequire(import.meta.url);
  const Module = require("module") as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return original(request, parent, isMain);
  };
}

async function main() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  assertPreviewOnly();
  allowServerOnlyImports();

  const { createAnthropicMessage, getAnthropicModel } = await import(
    "@/lib/ai/anthropic"
  );
  const {
    BRIEF_EXTRACTION_SYSTEM_PROMPT,
    buildBriefExtractionFromModelText,
    buildBriefExtractionUserPrompt,
  } = await import("@/lib/ai/brief-extraction-result");
  const { coerceExtractionPayload } = await import("@/lib/ai/schema");
  const { parseJsonObject } = await import("@/lib/ai/parse-json");
  const { aiFactsToRows, aiWorkAreasToRows } = await import("@/lib/ai/mappers");
  const { SCOPE_CATALOGUE } = await import("@/lib/scopes/catalogue");
  const { getAnalysisCapableWorkAreaTypes } = await import(
    "@/lib/scopes/capability"
  );
  const { composeJobPlan } = await import("@/lib/assistant/job-plan/compose");
  const { composeClarifyView } = await import("@/lib/assistant/clarify/compose");
  const { isInitialCaptureQuestion } = await import(
    "@/lib/assistant/clarify/question-contract"
  );
  const { buildProjectUnderstandingSummaries } = await import(
    "@/lib/assistant/presentation/assistant-understanding-summary"
  );
  const { ANALYSE_JOB_TIMEOUT_MS } = await import(
    "@/lib/ai/analyse-job-contract"
  );

  const allowedTypes = getAnalysisCapableWorkAreaTypes();
  const catalogueTypes = SCOPE_CATALOGUE.map((item) => item.type);
  const catalogueByType = new Map(SCOPE_CATALOGUE.map((item) => [item.type, item]));
  const runs = Math.max(1, Number(process.env.STAGE_2B_RUNS ?? "3") || 3);
  const only = (process.env.STAGE_2B_ONLY ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const useVariants = process.env.STAGE_2B_VARIANTS === "1";
  const cases = (useVariants ? STAGE_2B_RESERVED_VARIANTS : ORIGINALS).filter(
    (item) => only.length === 0 || only.includes(item.id)
  );
  if (cases.length === 0) throw new Error("No briefs selected.");

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const suffix = randomBytes(4).toString("hex");
  const email = `hello+v3-stage-2b.${suffix}@erccontracting.co.nz`;
  const orgId = randomUUID();
  const created = await admin.auth.admin.createUser({
    email,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? "createUser failed");
  }
  const userId = created.data.user.id;
  const orgInsert = await admin.from("organisations").insert({
    id: orgId,
    name: `Stage 2B analysis ${suffix}`,
  });
  if (orgInsert.error) throw new Error(orgInsert.error.message);
  const profile = await admin.from("profiles").insert({
    id: userId,
    org_id: orgId,
    role: "owner",
    full_name: "Stage 2B analysis probe",
  });
  if (profile.error) throw new Error(profile.error.message);

  const outDir = resolve(process.cwd(), "tmp");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(
    outDir,
    process.env.STAGE_2B_OUT?.trim() ||
      (useVariants ? "stage-2b-variants.json" : "stage-2b-baseline.json")
  );
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    model: getAnthropicModel(),
    orgId,
    userId,
    email,
    previewRef: PREVIEW_REF,
    runs,
    cases: [] as unknown[],
    expectations: STAGE_2A_BRIEF_EXPECTATIONS,
  };

  const persist = () => writeFileSync(outPath, JSON.stringify(report, null, 2));
  persist();

  for (const brief of cases) {
    for (let run = 1; run <= runs; run += 1) {
      const started = Date.now();
      process.stdout.write(`${brief.id} run ${run}/${runs}\n`);
      const projectId = randomUUID();
      const project = await admin.from("projects").insert({
        id: projectId,
        org_id: orgId,
        created_by: userId,
        title: `Stage 2B ${brief.id} ${run} ${suffix}`,
        brief_text: brief.text,
        stage: "brief",
      });
      if (project.error) throw new Error(project.error.message);

      const provider = await createAnthropicMessage(
        {
          model: getAnthropicModel(),
          max_tokens: 4096,
          temperature: 0,
          system: BRIEF_EXTRACTION_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: buildBriefExtractionUserPrompt(brief.text, allowedTypes),
            },
          ],
        },
        { timeoutMs: ANALYSE_JOB_TIMEOUT_MS, label: `stage-2b:${brief.id}:${run}` }
      );
      const textBlock = provider.message.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error(`${brief.id} run ${run}: model returned no text`);
      }
      const parsed = parseJsonObject(textBlock.text);
      if (!parsed.success) throw new Error(`${brief.id} run ${run}: JSON parse failed`);
      const raw = coerceExtractionPayload(parsed.data);
      const extraction = buildBriefExtractionFromModelText({
        rawText: textBlock.text,
        briefText: brief.text,
        allowedTypes,
        catalogueTypes,
      });

      const workAreaRows = aiWorkAreasToRows({
        output: extraction.output,
        orgId,
        projectId,
        catalogueByType,
      });
      const inserted = await admin
        .from("work_areas")
        .insert(workAreaRows)
        .select("id, type, name, status, summary, sort_order");
      if (inserted.error) throw new Error(inserted.error.message);
      const workAreas = inserted.data ?? [];
      const factRows = aiFactsToRows({
        output: extraction.output,
        orgId,
        projectId,
        workAreaIdByType: new Map(workAreas.map((row) => [row.type, row.id])),
        workAreas,
      });
      if (factRows.length > 0) {
        const factsInsert = await admin.from("project_facts").insert(factRows);
        if (factsInsert.error) throw new Error(factsInsert.error.message);
      }
      if (extraction.constraints.length > 0) {
        const constraintsInsert = await admin.from("constraints").insert(
          extraction.constraints.map((constraint) => ({
            org_id: orgId,
            project_id: projectId,
            key: constraint.key,
            label: constraint.label,
            value: constraint.value,
            source: "ai_extracted",
          }))
        );
        if (constraintsInsert.error) throw new Error(constraintsInsert.error.message);
      }
      await admin
        .from("projects")
        .update({
          stage: "confirm_work_areas",
          ...(extraction.qualityLevel
            ? { quality_level: extraction.qualityLevel }
            : {}),
        })
        .eq("id", projectId);

      const storedFacts = await admin
        .from("project_facts")
        .select("key, label, value, unit, source, work_area_id, conflict_warning")
        .eq("project_id", projectId);
      if (storedFacts.error) throw new Error(storedFacts.error.message);
      const storedConstraints = await admin
        .from("constraints")
        .select("key, label, value, source")
        .eq("project_id", projectId);
      if (storedConstraints.error) throw new Error(storedConstraints.error.message);

      const planAreas = workAreas.map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        status: row.status as "suggested" | "confirmed" | "excluded",
        sortOrder: row.sort_order,
      }));
      const estimateFacts = (storedFacts.data ?? []).map((row) => ({
        key: row.key,
        work_area_id: row.work_area_id,
        value: row.value,
      }));
      const jobPlan = composeJobPlan({
        workAreas: planAreas,
        facts: estimateFacts,
        constraints: storedConstraints.data ?? [],
        qualityLevel: extraction.qualityLevel,
        briefText: brief.text,
      });
      const clarify = composeClarifyView({
        stage: "work_area_questions",
        briefText: brief.text,
        qualityLevel: extraction.qualityLevel,
        workAreas: planAreas,
        facts: estimateFacts,
        constraints: storedConstraints.data ?? [],
        jobPlan,
      });
      const understanding = buildProjectUnderstandingSummaries({
        workAreas: planAreas,
        facts: estimateFacts,
      });
      const required = [...clarify.candidates, ...clarify.deferred].filter(
        isInitialCaptureQuestion
      );

      const entry = {
        id: brief.id,
        kind: brief.kind,
        run,
        projectId,
        latencyMs: provider.latencyMs,
        attemptCount: provider.attemptCount,
        model: provider.message.model,
        wallMs: Date.now() - started,
        inputTokens: provider.usage.inputTokens ?? null,
        outputTokens: provider.usage.outputTokens ?? null,
        rawWorkAreas: raw.workAreas.map((row) => ({
          type: row.type,
          name: row.name ?? null,
        })),
        rawFacts: factSignature(raw.facts),
        rawAssumptions: raw.assumptions,
        rawWarnings: raw.warnings,
        normalisedWorkAreas: extraction.output.workAreas.map((row) => ({
          type: row.type,
          name: row.name ?? null,
        })),
        normalisedFacts: factSignature(extraction.output.facts),
        normalisedAssumptions: extraction.output.assumptions,
        normalisedWarnings: extraction.output.warnings,
        qualityLevel: extraction.qualityLevel,
        constraints: extraction.constraints,
        storedWorkAreas: workAreas.map((row) => ({
          id: row.id,
          type: row.type,
          name: row.name,
          status: row.status,
          summary: row.summary,
        })),
        storedFacts: (storedFacts.data ?? []).map((row) => ({
          workAreaId: row.work_area_id,
          key: row.key,
          value: compactValue(row.value),
          unit: row.unit,
          source: row.source,
          conflict: row.conflict_warning,
        })),
        storedConstraints: storedConstraints.data ?? [],
        understanding: understanding.map((row) => ({
          workArea: row.workAreaLabel,
          line: row.compactLine,
        })),
        jobPlan: jobPlan.cards.map((card) => ({
          type: card.workAreaType,
          name: card.name,
          summary: card.summary,
          chips: card.specChips.map((chip) => ({
            label: chip.label,
            value: chip.value,
            assumed: chip.assumed === true,
          })),
          included: card.included.map((item) => item.label),
          notIncluded: card.notIncluded.map((item) => item.label),
          notConfirmed: card.notConfirmed.map((item) => item.label),
        })),
        requiredQuestions: required.map((row) => ({
          workAreaType: row.workAreaType,
          factKey: row.factKey,
          question: row.question,
          askClass: row.askClass,
          blocksEstimate: row.blocksEstimate,
        })),
        disclosedAssumptions: clarify.assumptions.map((row) => ({
          factKey: row.factKey,
          statement: row.statement,
        })),
      };
      (report.cases as unknown[]).push(entry);
      persist();
      process.stdout.write(
        `  ${provider.latencyMs}ms attempts=${provider.attemptCount} areas=${workAreas.map((row) => row.type).join(",")}\n`
      );
    }
  }

  report.finishedAt = new Date().toISOString();
  persist();
  process.stdout.write(`wrote ${outPath}\norg ${orgId}\n`);
  void (admin as SupabaseClient);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
