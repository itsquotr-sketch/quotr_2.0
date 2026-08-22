/**
 * DECK-MATURITY-2B — estimating material identity defaults.
 * Not structural sizing certification.
 */
import {
  buildStructuralTimberIdentity,
  buildSupportMaterialIdentity,
  type MaterialIdentity,
} from "@/lib/materials/identity";

export const DEFAULT_JOIST_SECTION = "90x45";
export const DEFAULT_BEARER_SECTION = "140x45";
export const DEFAULT_HEAVY_JOIST_SECTION = "140x45";
export const DEFAULT_HEAVY_BEARER_SECTION = "190x45";
export const DEFAULT_FRAMING_TREATMENT = "H3.2";
export const DEFAULT_FRAMING_GRADE = "SG8";
export const DEFAULT_FRAMING_PROCESSING = "KD";
export const DEFAULT_SUPPORT_TYPE = "House pile";
export const DEFAULT_SUPPORT_SECTION = "125x125";
export const DEFAULT_LIGHT_SUPPORT_SECTION = "100x100";
export const DEFAULT_HEAVY_SUPPORT_SECTION = "125x125";
export const DEFAULT_SUPPORT_TREATMENT = "H5";
export const DEFAULT_STEP_FRAMING_SECTION = "190x45";

export const DECK_IDENTITY_ESTIMATING_DISCLAIMER =
  "Framing sizes are estimating material assumptions, not a structural or compliance selection.";

function framingIdentity(section: string): MaterialIdentity | null {
  return buildStructuralTimberIdentity({
    sectionRaw: section,
    treatmentRaw: DEFAULT_FRAMING_TREATMENT,
    gradeRaw: DEFAULT_FRAMING_GRADE,
    processingRaw: DEFAULT_FRAMING_PROCESSING,
    originalDescription: `${section} ${DEFAULT_FRAMING_GRADE} ${DEFAULT_FRAMING_TREATMENT} ${DEFAULT_FRAMING_PROCESSING}`,
  });
}

export function defaultJoistIdentity(): MaterialIdentity | null {
  return framingIdentity(DEFAULT_JOIST_SECTION);
}

export function defaultBearerIdentity(): MaterialIdentity | null {
  return framingIdentity(DEFAULT_BEARER_SECTION);
}

export function defaultStepFramingIdentity(): MaterialIdentity | null {
  return framingIdentity(DEFAULT_STEP_FRAMING_SECTION);
}

export function defaultSupportIdentity(): MaterialIdentity | null {
  return buildSupportMaterialIdentity({
    supportType: DEFAULT_SUPPORT_TYPE,
    sectionRaw: DEFAULT_SUPPORT_SECTION,
    treatmentRaw: DEFAULT_SUPPORT_TREATMENT,
    originalDescription: "125×125 H5 sawn house pile",
  });
}

export function lightSupportIdentity(): MaterialIdentity | null {
  return buildSupportMaterialIdentity({
    supportType: "Post",
    sectionRaw: DEFAULT_LIGHT_SUPPORT_SECTION,
    treatmentRaw: DEFAULT_SUPPORT_TREATMENT,
    originalDescription: "100×100 H5 timber post",
  });
}

export function resolveFramingIdentityFromFacts(params: {
  section: string | null;
  treatment: string | null;
  sectionDefaulted: boolean;
}): MaterialIdentity | null {
  if (!params.section) return null;
  if (params.sectionDefaulted) {
    return framingIdentity(params.section);
  }
  return buildStructuralTimberIdentity({
    sectionRaw: params.section,
    treatmentRaw: params.treatment,
  });
}
