import type { z } from "zod";

export type SafeParseAiJsonResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      rawPreview: string;
      stage: "json" | "schema";
    };

/** Remove markdown code fences and leading/trailing whitespace. */
export function stripCodeFences(text: string): string {
  let cleaned = text.trim();

  const fencedMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  if (fencedMatch) {
    cleaned = fencedMatch[1].trim();
  }

  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/i, "");

  return cleaned.trim();
}

/** Remove trailing commas before `}` or `]`. */
function repairTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, "$1");
}

/**
 * Extract the first balanced JSON object from text, respecting quoted strings.
 */
export function extractJsonObject(text: string): string | null {
  const cleaned = stripCodeFences(text);
  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i += 1) {
    const char = cleaned[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return cleaned.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function parseJsonObject(text: string): {
  success: true;
  data: unknown;
} | {
  success: false;
  error: string;
} {
  const cleaned = stripCodeFences(text);

  const attempts = [
    cleaned,
    extractJsonObject(cleaned),
    extractJsonObject(cleaned)
      ? repairTrailingCommas(extractJsonObject(cleaned)!)
      : null,
  ].filter((value): value is string => Boolean(value));

  const uniqueAttempts = [...new Set(attempts)];

  let lastError = "No JSON object found in response.";

  for (const candidate of uniqueAttempts) {
    try {
      return { success: true, data: JSON.parse(candidate) };
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "JSON parse failed.";
    }
  }

  return { success: false, error: lastError };
}

export function safeParseAiJson<T extends z.ZodType>(
  text: string,
  schema: T
): SafeParseAiJsonResult<z.infer<T>> {
  const rawPreview = stripCodeFences(text).slice(0, 300);

  const jsonResult = parseJsonObject(text);
  if (!jsonResult.success) {
    return {
      success: false,
      error: jsonResult.error,
      rawPreview,
      stage: "json",
    };
  }

  const validated = schema.safeParse(jsonResult.data);
  if (!validated.success) {
    const issueSummary = validated.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    return {
      success: false,
      error: issueSummary || "Schema validation failed.",
      rawPreview,
      stage: "schema",
    };
  }

  return { success: true, data: validated.data };
}

export function previewAiResponse(text: string, maxLength = 300): string {
  return stripCodeFences(text).slice(0, maxLength);
}
