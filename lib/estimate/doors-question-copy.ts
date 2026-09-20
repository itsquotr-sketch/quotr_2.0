/**
 * DOORS-02 — builder-facing Details copy for nested Door Sets.
 */

export const DOORS_INSTALLATION_OPTIONS = [
  "Prehung door set",
  "Replacement door leaf",
  "Other door system",
] as const;

export const DOORS_LEAF_OPTIONS = [
  "Hollow core",
  "Solid core",
  "Other",
] as const;

export const DOORS_HARDWARE_OPTIONS = [
  "Included",
  "Excluded / reuse existing",
] as const;

export const DOORS_HEIGHT_OPTIONS = [
  "1980 mm (assumed default)",
  "2200 mm",
  "2400 mm",
] as const;

export const DOORS_WIDTH_OPTIONS = [
  "410 mm",
  "610 mm",
  "760 mm",
  "810 mm",
  "860 mm",
  "910 mm",
] as const;

const QUESTIONS: Record<string, string> = {
  "doors.portion.installation_type":
    "What type of door installation is required?",
  "doors.portion.leaf_construction": "What type of door leaf is required?",
  "doors.portion.height_mm": "What is the door height?",
  "doors.portion.width_mm": "What is the door width?",
  "doors.portion.quantity": "How many identical doors are required?",
  "doors.portion.hardware_included":
    "Is standard latch/lever door hardware included?",
  "doors.portion.label": "Where are these doors located?",
  "doors.portion.other_description":
    "What door leaf material or type is required?",
};

const LABELS: Record<string, string> = {
  "doors.portion.installation_type": "Installation type",
  "doors.portion.leaf_construction": "Leaf construction",
  "doors.portion.height_mm": "Door height",
  "doors.portion.width_mm": "Door width",
  "doors.portion.quantity": "Door quantity",
  "doors.portion.hardware_included": "Hardware",
  "doors.portion.label": "Location",
  "doors.portion.other_description": "Description",
};

export const DOORS_REPLACEMENT_FRAME_DISCLOSURE =
  "Existing frame/jamb retained. No opening alteration included." as const;

export const DOORS_UNSUPPORTED_DESCRIPTION_QUESTION =
  "What door system is required?" as const;

export function doorQuestionCopy(
  factKey: string,
  params?: {
    readonly unsupported?: boolean;
    readonly otherLeaf?: boolean;
  }
): string {
  if (factKey === "doors.portion.other_description" && params?.unsupported) {
    return DOORS_UNSUPPORTED_DESCRIPTION_QUESTION;
  }
  return QUESTIONS[factKey] ?? LABELS[factKey] ?? factKey;
}

export function doorQuestionLabel(factKey: string): string | null {
  return LABELS[factKey] ?? null;
}

export function doorQuestionOptions(factKey: string): readonly string[] | undefined {
  if (factKey === "doors.portion.installation_type") {
    return DOORS_INSTALLATION_OPTIONS;
  }
  if (factKey === "doors.portion.leaf_construction") {
    return DOORS_LEAF_OPTIONS;
  }
  if (factKey === "doors.portion.hardware_included") {
    return DOORS_HARDWARE_OPTIONS;
  }
  if (factKey === "doors.portion.height_mm") {
    return DOORS_HEIGHT_OPTIONS;
  }
  if (factKey === "doors.portion.width_mm") {
    return DOORS_WIDTH_OPTIONS;
  }
  return undefined;
}

export function doorQuestionUnit(factKey: string): string | undefined {
  if (factKey === "doors.portion.height_mm" || factKey === "doors.portion.width_mm") {
    return "mm";
  }
  if (factKey === "doors.portion.quantity") return "doors";
  return undefined;
}

export function doorQuestionInputType(
  factKey: string
): "boolean" | "select" | "number" | "text" {
  if (factKey === "doors.portion.quantity") return "number";
  if (
    factKey === "doors.portion.label" ||
    factKey === "doors.portion.other_description"
  ) {
    return "text";
  }
  return "select";
}
