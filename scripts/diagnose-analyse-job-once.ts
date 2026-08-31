/**
 * ONE-SHOT Analyse Job latency diagnosis.
 *
 * Default: prompt-size only, NO model call.
 * Live call:
 *   DIAGNOSE_ANALYSE_JOB=1 npx tsx scripts/diagnose-analyse-job-once.ts --live
 *
 * Both the env flag AND --live are required so .env.local cannot spend.
 *
 * Does not print brief text, prompts, completions, or API keys.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";
import {
  BRIEF_EXTRACTION_SYSTEM_PROMPT,
  buildBriefExtractionUserPrompt,
} from "../lib/ai/brief-extraction-prompt";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";

const FIXTURE_BRIEF =
  "Replace an existing 5 m x 3 m timber deck approximately 1 m above ground. New timber substructure and kwila decking. Include two steps. Restricted rear access.";

const DIAGNOSTIC_TIMEOUT_MS = 90_000;

function approxTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

async function main() {
  const allowed = getAnalysisCapableWorkAreaTypes();
  const userPrompt = buildBriefExtractionUserPrompt(FIXTURE_BRIEF, allowed);
  const systemChars = BRIEF_EXTRACTION_SYSTEM_PROMPT.length;
  const userChars = userPrompt.length;
  const briefChars = FIXTURE_BRIEF.length;
  const allowedJsonChars = JSON.stringify(allowed).length;

  console.log("diagnose-analyse-job-once (no secrets)");
  console.log(`  model_env_set: ${Boolean(process.env.ANTHROPIC_MODEL)}`);
  console.log(
    `  model_resolved: ${process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6"}`
  );
  console.log(`  allowed_type_count: ${allowed.length}`);
  console.log(`  system_prompt_chars: ${systemChars}`);
  console.log(`  user_prompt_chars: ${userChars}`);
  console.log(`  fixture_brief_chars: ${briefChars}`);
  console.log(`  allowed_types_json_chars: ${allowedJsonChars}`);
  console.log(`  total_prompt_chars: ${systemChars + userChars}`);
  console.log(
    `  approx_input_tokens_chars/4: ${approxTokens(systemChars + userChars)}`
  );
  console.log(`  thinking: not set`);
  console.log(`  temperature: 0`);
  console.log(`  max_tokens: 4096`);
  console.log(`  stream: false`);
  console.log(`  tools: none`);

  if (process.env.DIAGNOSE_ANALYSE_JOB !== "1" || !process.argv.includes("--live")) {
    console.log(
      "  live_call: SKIP (need DIAGNOSE_ANALYSE_JOB=1 and --live)"
    );
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("  live_call: SKIP (ANTHROPIC_API_KEY missing)");
    process.exit(1);
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const client = new Anthropic({
    apiKey,
    maxRetries: 0,
    timeout: DIAGNOSTIC_TIMEOUT_MS,
  });

  console.log("  live_call: START (one request)");
  const t0 = Date.now();
  try {
    const message = await client.messages.create(
      {
        model,
        max_tokens: 4096,
        temperature: 0,
        system: BRIEF_EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      { timeout: DIAGNOSTIC_TIMEOUT_MS, maxRetries: 0 }
    );
    const latencyMs = Date.now() - t0;
    const text = message.content.find((b) => b.type === "text");
    const outputChars = text && text.type === "text" ? text.text.length : 0;
    const usage = message.usage as {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };

    console.log(`  live_call: SUCCESS`);
    console.log(`  latency_ms: ${latencyMs}`);
    console.log(`  stop_reason: ${message.stop_reason}`);
    console.log(`  output_chars: ${outputChars}`);
    console.log(`  input_tokens: ${usage.input_tokens ?? "absent"}`);
    console.log(`  output_tokens: ${usage.output_tokens ?? "absent"}`);
    console.log(
      `  cache_creation_input_tokens: ${usage.cache_creation_input_tokens ?? "absent"}`
    );
    console.log(
      `  cache_read_input_tokens: ${usage.cache_read_input_tokens ?? "absent"}`
    );
    console.log(`  would_hit_45s: ${latencyMs > 45_000}`);
  } catch (error) {
    const latencyMs = Date.now() - t0;
    const err = error as {
      name?: string;
      status?: number;
      message?: string;
    };
    console.log(`  live_call: FAIL`);
    console.log(`  latency_ms: ${latencyMs}`);
    console.log(`  error_name: ${err.name ?? "unknown"}`);
    console.log(`  error_status: ${err.status ?? "absent"}`);
    const msg = String(err.message ?? "");
    const safe =
      msg.includes("timed out") || msg.toLowerCase().includes("timeout")
        ? "timeout"
        : msg.includes("401") || msg.toLowerCase().includes("auth")
          ? "auth"
          : msg.includes("404") || msg.toLowerCase().includes("not_found")
            ? "not_found"
            : msg.includes("429")
              ? "rate_limit"
              : "other";
    console.log(`  error_class: ${safe}`);
    console.log(`  error_message_len: ${msg.length}`);
  }
}

main().catch((error) => {
  console.error("diagnose failed", error instanceof Error ? error.name : "unknown");
  process.exit(1);
});
