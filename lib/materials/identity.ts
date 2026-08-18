/**
 * CAT-IDENTITY-01 — canonical material identity (no persistence, no prices).
 *
 * Material identity answers "what physical product?" Rate unit and component
 * keys are out of scope. Common catalogue lists are UX convenience only.
 */

export type MaterialTreatmentKind = "unknown" | "known" | "custom";

/**
 * Mill processing / moisture state. Commercially distinct from treatment.
 * KD vs green/wet can have different public $/lm at the same section/grade/H class.
 * Unknown must not become KD.
 */
export type MaterialProcessingState = "kd" | "green";
export type MaterialProcessingKind = "unknown" | "known";

export type MaterialIdentityMatch = "exact" | "partial" | "incompatible";

export type MaterialIdentityCompleteness =
  | "complete_enough_for_physical_model"
  | "partial"
  | "custom_unstructured";

export type MaterialIdentity = {
  family: string;
  productFamily: string | null;
  section: string | null;
  grade: string | null;
  treatment: string | null;
  treatmentKind: MaterialTreatmentKind;
  treatmentCustom: string | null;
  processing: MaterialProcessingState | null;
  processingKind: MaterialProcessingKind;
  species: string | null;
  originalDescription: string | null;
};

const KNOWN_TREATMENTS = new Set(["h1.2", "h3.1", "h3.2", "h4", "h5"]);

export const STRUCTURAL_TIMBER_FAMILY = "timber";
export const STRUCTURAL_FRAMING_PRODUCT_FAMILY = "structural_framing";
/** LVL is a product type, not a timber species and not generic SG framing. */
export const STRUCTURAL_LVL_PRODUCT_FAMILY = "structural_lvl";
export const CONCRETE_FAMILY = "concrete";

export function normalizeMaterialSection(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  const text = raw.replace(/×/g, "x").trim();
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)(?:\s*mm\b)?/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= 0) {
    return null;
  }
  const larger = Math.max(first, second);
  const smaller = Math.min(first, second);
  return `${formatSectionNumber(larger)}x${formatSectionNumber(smaller)}`;
}

function formatSectionNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

export function normalizeMaterialTreatment(raw: string | null | undefined): {
  kind: MaterialTreatmentKind;
  value: string | null;
  custom: string | null;
} {
  if (raw == null) {
    return { kind: "unknown", value: null, custom: null };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { kind: "unknown", value: null, custom: null };
  }

  const tokenMatch = trimmed.match(/\bH\s*([0-9])(?:\s*[._]\s*([0-9]))?\b/i);
  if (tokenMatch) {
    const major = tokenMatch[1];
    const minor = tokenMatch[2];
    const canonical = minor ? `h${major}.${minor}` : `h${major}`;
    if (KNOWN_TREATMENTS.has(canonical)) {
      return { kind: "known", value: canonical, custom: null };
    }
  }

  const compact = trimmed.toLowerCase().replace(/\s+/g, "").replace(/_/g, ".");
  if (KNOWN_TREATMENTS.has(compact)) {
    return { kind: "known", value: compact, custom: null };
  }

  const remainder = stripNonTreatmentTokens(trimmed);
  if (!remainder) {
    return { kind: "unknown", value: null, custom: null };
  }

  return { kind: "custom", value: null, custom: trimmed };
}

/**
 * Remove section, grade, and product-family tokens so a raw like "140x45"
 * is not treated as a custom treatment. Remaining commercial text stays custom.
 */
function stripNonTreatmentTokens(raw: string): string {
  return raw
    .replace(/×/g, "x")
    .replace(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)(?:\s*mm\b)?/gi, " ")
    .replace(/\b(?:M)?SG\s*\d+\b/gi, " ")
    .replace(/\blvl\b/gi, " ")
    .replace(/\bkiln[-\s]?dried\b/gi, " ")
    .replace(/\b(kd|green|wet|gauged)\b/gi, " ")
    .replace(
      /\b(mm|timber|framing|structural|sawn|rough|pine|radiata)\b/gi,
      " "
    )
    .replace(/[^a-zA-Z0-9.\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMaterialGrade(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(?:m)?sg\s*(\d+)$/i);
  if (!match) return null;
  return `sg${match[1]}`;
}

export function parseMaterialDescription(raw: string | null | undefined): {
  section: string | null;
  treatment: ReturnType<typeof normalizeMaterialTreatment>;
  grade: string | null;
  processing: ReturnType<typeof normalizeMaterialProcessing>;
  originalDescription: string | null;
} {
  const original = raw?.trim() ? raw.trim() : null;
  return {
    section: normalizeMaterialSection(raw),
    treatment: normalizeMaterialTreatment(raw),
    grade: extractGradeToken(raw),
    processing: normalizeMaterialProcessing(raw),
    originalDescription: original,
  };
}

export function normalizeMaterialProcessing(
  raw: string | null | undefined
): {
  kind: MaterialProcessingKind;
  value: MaterialProcessingState | null;
} {
  if (raw == null) {
    return { kind: "unknown", value: null };
  }
  const text = raw.trim();
  if (!text) {
    return { kind: "unknown", value: null };
  }

  const hasKd = /\bKD\b/i.test(text) || /\bkiln[-\s]?dried\b/i.test(text);
  const hasGreen = /\bgreen\b/i.test(text) || /\bwet\b/i.test(text);
  if (hasKd && hasGreen) {
    return { kind: "unknown", value: null };
  }
  if (hasKd) {
    return { kind: "known", value: "kd" };
  }
  if (hasGreen) {
    return { kind: "known", value: "green" };
  }
  return { kind: "unknown", value: null };
}

function extractGradeToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/\b(?:M)?SG\s*(\d+)\b/i);
  return match ? `sg${match[1]}` : null;
}

export function buildStructuralTimberIdentity(params: {
  sectionRaw: string | null | undefined;
  treatmentRaw?: string | null;
  gradeRaw?: string | null;
  processingRaw?: string | null;
  species?: string | null;
  originalDescription?: string | null;
  productFamily?: string | null;
}): MaterialIdentity | null {
  const combined = [
    params.originalDescription,
    params.sectionRaw,
    params.treatmentRaw,
    params.gradeRaw,
    params.processingRaw,
  ]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .join(" ");
  const parsed = parseMaterialDescription(combined || params.sectionRaw || null);
  const section =
    normalizeMaterialSection(params.sectionRaw) ?? parsed.section;
  if (!section) {
    return null;
  }
  const treatment = params.treatmentRaw
    ? normalizeMaterialTreatment(params.treatmentRaw)
    : parsed.treatment;
  const grade =
    normalizeMaterialGrade(params.gradeRaw) ?? parsed.grade;
  const processingExplicit = params.processingRaw
    ? normalizeMaterialProcessing(params.processingRaw)
    : null;
  const processing =
    processingExplicit && processingExplicit.kind === "known"
      ? processingExplicit
      : parsed.processing;
  const lvl = isLvlProduct(
    params.productFamily,
    params.species,
    params.originalDescription,
    params.sectionRaw
  );
  const productFamily =
    params.productFamily ??
    (lvl ? STRUCTURAL_LVL_PRODUCT_FAMILY : STRUCTURAL_FRAMING_PRODUCT_FAMILY);
  const species = lvl
    ? null
    : normalizeOptionalToken(params.species);

  return {
    family: STRUCTURAL_TIMBER_FAMILY,
    productFamily,
    section,
    grade,
    treatment: treatment.value,
    treatmentKind: treatment.kind,
    treatmentCustom: treatment.custom,
    processing: processing.value,
    processingKind: processing.kind,
    species,
    originalDescription:
      params.originalDescription?.trim() ||
      [params.sectionRaw, params.treatmentRaw].filter(Boolean).join(" ").trim() ||
      parsed.originalDescription,
  };
}

function normalizeOptionalToken(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isLvlProduct(
  productFamily: string | null | undefined,
  species: string | null | undefined,
  ...texts: Array<string | null | undefined>
): boolean {
  if (productFamily === STRUCTURAL_LVL_PRODUCT_FAMILY) return true;
  const blob = [productFamily, species, ...texts]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /\blvl\b/.test(blob);
}

export function buildSupportMaterialIdentity(params: {
  supportType: string | null | undefined;
  sectionRaw: string | null | undefined;
  treatmentRaw?: string | null;
  originalDescription?: string | null;
}): MaterialIdentity | null {
  const section = normalizeMaterialSection(params.sectionRaw);
  const type = params.supportType?.trim() ?? "";
  if (!section && !type) {
    return null;
  }
  const productFamily = inferSupportProductFamily(type);
  const treatment = normalizeMaterialTreatment(params.treatmentRaw);
  const parsed = parseMaterialDescription(
    [params.originalDescription, params.supportType, params.sectionRaw, params.treatmentRaw]
      .filter(Boolean)
      .join(" ")
  );
  const original =
    params.originalDescription?.trim() ||
    [type, params.sectionRaw, params.treatmentRaw].filter(Boolean).join(" ").trim() ||
    null;
  return {
    family: STRUCTURAL_TIMBER_FAMILY,
    productFamily,
    section,
    grade: parsed.grade,
    treatment: treatment.value,
    treatmentKind: treatment.kind,
    treatmentCustom: treatment.custom,
    processing: parsed.processing.value,
    processingKind: parsed.processing.kind,
    species: null,
    originalDescription: original,
  };
}

function inferSupportProductFamily(supportType: string): string {
  const lower = supportType.toLowerCase();
  if (lower.includes("pile")) return "pile";
  if (lower.includes("post")) return "post";
  return "support";
}

export function buildConcreteMaterialIdentity(params: {
  mixRaw?: string | null;
  originalDescription?: string | null;
}): MaterialIdentity {
  const mix = params.mixRaw?.trim() || null;
  return {
    family: CONCRETE_FAMILY,
    productFamily: null,
    section: null,
    grade: mix,
    treatment: null,
    treatmentKind: "unknown",
    treatmentCustom: null,
    processing: null,
    processingKind: "unknown",
    species: null,
    originalDescription: params.originalDescription?.trim() || mix,
  };
}

export function materialIdentityCompleteness(
  identity: MaterialIdentity
): MaterialIdentityCompleteness {
  if (identity.family === CONCRETE_FAMILY) {
    return identity.grade ? "complete_enough_for_physical_model" : "partial";
  }
  if (!identity.section && identity.originalDescription) {
    return "custom_unstructured";
  }
  if (!identity.section) {
    return "custom_unstructured";
  }
  if (identity.treatmentKind === "unknown" || identity.grade == null) {
    return "partial";
  }
  return "complete_enough_for_physical_model";
}

/**
 * Debug / snapshot key. Must not include component names or rate units.
 * Includes every *known* commercially relevant attribute. Never invents SG8
 * or other unknowns merely to fill the key.
 *
 * Order: family.productFamily.section[.species][.grade][.treatment|custom.slug][.kd|.green]
 *
 * This debug key is a deterministic representation of known attributes.
 * It is NOT a future globally unique persistent Material row ID.
 */
export function serializeMaterialIdentityKey(identity: MaterialIdentity): string {
  const parts = [identity.family];
  if (identity.productFamily) parts.push(identity.productFamily);
  if (identity.section) parts.push(identity.section);
  if (identity.species) parts.push(slugIdentityToken(identity.species));
  if (identity.grade) parts.push(identity.grade);
  if (identity.treatmentKind === "known" && identity.treatment) {
    parts.push(identity.treatment);
  } else if (identity.treatmentKind === "custom" && identity.treatmentCustom) {
    parts.push("custom", slugIdentityToken(identity.treatmentCustom));
  }
  if (identity.processingKind === "known" && identity.processing) {
    parts.push(identity.processing);
  }
  return parts.join(".");
}

function slugIdentityToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Rate table lookup helper — unit is NOT part of material identity. */
export function buildMaterialRateItemKey(
  identity: MaterialIdentity,
  unit: string
): string {
  return `${serializeMaterialIdentityKey(identity)}.${unit}`;
}

/**
 * Structured identity comparison. originalDescription is display/audit only
 * and does not participate: harmless wording differences are not a mismatch
 * when structured fields match. Un-normalizable custom fields remain
 * conservative (custom vs known / different custom → incompatible).
 *
 * Exact identity is NOT rate eligibility. The rate resolver decides whether
 * a source may price a requirement.
 */
export function compareMaterialIdentities(
  left: MaterialIdentity,
  right: MaterialIdentity
): MaterialIdentityMatch {
  if (left.family !== right.family) return "incompatible";
  if ((left.productFamily ?? null) !== (right.productFamily ?? null)) {
    return "incompatible";
  }
  if ((left.section ?? null) !== (right.section ?? null)) {
    if (!left.section || !right.section) return "partial";
    return "incompatible";
  }

  const treatmentMatch = compareTreatment(left, right);
  if (treatmentMatch !== "exact") return treatmentMatch;

  if ((left.grade ?? null) !== (right.grade ?? null)) {
    if (!left.grade || !right.grade) return "partial";
    return "incompatible";
  }

  const processingMatch = compareProcessing(left, right);
  if (processingMatch !== "exact") return processingMatch;

  if ((left.species ?? null) !== (right.species ?? null)) {
    if (!left.species || !right.species) return "partial";
    if (left.species.toLowerCase() !== right.species.toLowerCase()) {
      return "incompatible";
    }
  }

  return "exact";
}

function compareTreatment(
  left: MaterialIdentity,
  right: MaterialIdentity
): MaterialIdentityMatch {
  if (left.treatmentKind === "known" && right.treatmentKind === "known") {
    return left.treatment === right.treatment ? "exact" : "incompatible";
  }
  if (left.treatmentKind === "custom" && right.treatmentKind === "custom") {
    const a = (left.treatmentCustom ?? "").trim().toLowerCase();
    const b = (right.treatmentCustom ?? "").trim().toLowerCase();
    return a === b ? "exact" : "incompatible";
  }
  if (left.treatmentKind === "custom" || right.treatmentKind === "custom") {
    if (
      left.treatmentKind === "known" ||
      right.treatmentKind === "known"
    ) {
      return "incompatible";
    }
    return "partial";
  }
  if (left.treatmentKind !== right.treatmentKind) {
    return "partial";
  }
  return "exact";
}

function compareProcessing(
  left: MaterialIdentity,
  right: MaterialIdentity
): MaterialIdentityMatch {
  const leftKind = left.processingKind ?? "unknown";
  const rightKind = right.processingKind ?? "unknown";
  const leftValue = left.processing ?? null;
  const rightValue = right.processing ?? null;
  if (leftKind === "known" && rightKind === "known") {
    return leftValue === rightValue ? "exact" : "incompatible";
  }
  if (leftKind !== rightKind) {
    return "partial";
  }
  return "exact";
}

/**
 * Identity exactness never grants a rate. Pricing policy lives in the resolver.
 */
export function commercialRateEligibilityFromIdentityMatch(
  match: MaterialIdentityMatch
): "deferred_to_rate_resolver" {
  void match;
  return "deferred_to_rate_resolver";
}

export function materialIdentitiesShareStock(
  left: MaterialIdentity,
  right: MaterialIdentity
): boolean {
  return compareMaterialIdentities(left, right) === "exact";
}

export function identityContainsForbiddenComponentToken(
  identity: MaterialIdentity
): boolean {
  const blob = [
    identity.family,
    identity.productFamily,
    identity.section,
    identity.grade,
    identity.treatment,
    serializeMaterialIdentityKey(identity),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /\b(deck|joist|rim|bearer)\b/.test(blob);
}

export function identityContainsRateUnit(identity: MaterialIdentity): boolean {
  const key = serializeMaterialIdentityKey(identity);
  return /\.(lm|m2|m3|ea)$/i.test(key) || /\b(lm|m2|m3)\b/i.test(key.split(".").pop() ?? "");
}
