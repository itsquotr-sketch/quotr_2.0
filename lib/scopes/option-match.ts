import { formatSelectAnswerValue } from "@/lib/scopes/fact-labels";
import { parseYesNoValue } from "@/lib/scopes/fact-values";

function normalised(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function optionStem(option: string): string {
  return normalised(option.split("—")[0] ?? option);
}

export function optionValueMatches(
  option: string,
  value: string | number | boolean | string[] | null | undefined
): boolean {
  if (value == null || value === "") return false;
  if (Array.isArray(value)) {
    return value.some((item) => optionValueMatches(option, item));
  }
  if (value === option) return true;

  const parsed = parseYesNoValue(value);
  if (option === "Yes" || /^yes\b/i.test(option)) {
    return parsed === true || value === true || value === "true";
  }
  if (option === "No" || /^no\b(?!t)/i.test(option)) {
    return parsed === false || value === false || value === "false";
  }
  if (option === "Not sure") {
    return (
      value === "Not sure" ||
      value === "not sure" ||
      value === "not_sure"
    );
  }

  const optionNorm = normalised(option);
  const raw = typeof value === "string" ? value : String(value);
  const valueNorm = normalised(raw);
  if (optionNorm === valueNorm) return true;

  const formatted = normalised(formatSelectAnswerValue(value));
  if (formatted === optionNorm) return true;
  if (formatted !== "—" && optionNorm.startsWith(formatted)) return true;
  if (formatted !== "—" && formatted.startsWith(optionStem(option))) return true;

  const optionHead = optionStem(option);
  if (optionHead && valueNorm.startsWith(optionHead)) return true;
  if (optionHead && optionHead.startsWith(valueNorm)) return true;
  return false;
}
