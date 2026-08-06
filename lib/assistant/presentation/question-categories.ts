/**
 * Stage 3.1B.7C — Presentation-only question category grouping.
 * Does not change eligibility, ordering rules, or persistence.
 */

export const QUESTION_PRESENTATION_CATEGORIES = [
  "measurements",
  "existing_conditions",
  "structure",
  "materials_finishes",
  "access_logistics",
  "compliance_risk",
  "client_requirements",
  "other",
] as const;

export type QuestionPresentationCategory =
  (typeof QUESTION_PRESENTATION_CATEGORIES)[number];

export const QUESTION_CATEGORY_LABELS: Record<
  QuestionPresentationCategory,
  string
> = {
  measurements: "Measurements",
  existing_conditions: "Existing Conditions",
  structure: "Structure",
  materials_finishes: "Materials and Finishes",
  access_logistics: "Access and Logistics",
  compliance_risk: "Compliance and Risk",
  client_requirements: "Client Requirements",
  other: "Other Details",
};

/** Deterministic category from key/label — presentation only. */
export function classifyQuestionPresentationCategory(params: {
  readonly key: string;
  readonly label: string;
  readonly templateCategory?: string | null;
}): QuestionPresentationCategory {
  const hay = `${params.key} ${params.label}`.toLowerCase();
  const template = String(params.templateCategory ?? "").toLowerCase();

  if (
    template === "measurement" ||
    /length|width|height|area|m2|metre|meter|size|dimension|count|span|lm\b|risers/.test(
      hay
    )
  ) {
    return "measurements";
  }
  if (
    /existing|condition|demolition|removal|pile|substrate|substructure|hazardous/.test(
      hay
    )
  ) {
    return "existing_conditions";
  }
  if (
    /framing|joist|bearer|post|beam|structure|foundation|footing|retaining/.test(
      hay
    )
  ) {
    return "structure";
  }
  if (
    template === "finish" ||
    /material|finish|coating|paint|stain|board|decking|fascia|tile|colour|color/.test(
      hay
    )
  ) {
    return "materials_finishes";
  }
  if (/access|carry|logistics|delivery|waste|bin|scaffold|crane/.test(hay)) {
    return "access_logistics";
  }
  if (
    template === "risk" ||
    /balustrade|handrail|permit|consent|code|compliance|engineering|barrier|waterproof|fire|safety/.test(
      hay
    )
  ) {
    return "compliance_risk";
  }
  if (
    /client|preference|allowance|supply_by|client_supplied|selection/.test(hay) ||
    template === "allowance"
  ) {
    return "client_requirements";
  }
  return "other";
}

export type CategorisedQuestionGroup<T extends { key: string; label: string }> =
  {
    readonly category: QuestionPresentationCategory;
    readonly label: string;
    readonly questions: readonly T[];
    readonly hasUnresolvedRequired: boolean;
  };

export function groupQuestionsByPresentationCategory<
  T extends {
    key: string;
    label: string;
    required?: boolean;
    id?: string;
  },
>(params: {
  readonly questions: readonly T[];
  readonly answers?: Readonly<
    Record<string, string | number | boolean | string[] | null | undefined>
  >;
  readonly templateCategoryByKey?: Readonly<Record<string, string>>;
}): readonly CategorisedQuestionGroup<T>[] {
  const buckets = new Map<QuestionPresentationCategory, T[]>();
  for (const cat of QUESTION_PRESENTATION_CATEGORIES) {
    buckets.set(cat, []);
  }

  for (const q of params.questions) {
    const category = classifyQuestionPresentationCategory({
      key: q.key,
      label: q.label,
      templateCategory: params.templateCategoryByKey?.[q.key] ?? null,
    });
    buckets.get(category)!.push(q);
  }

  const results: CategorisedQuestionGroup<T>[] = [];
  for (const category of QUESTION_PRESENTATION_CATEGORIES) {
    const questions = buckets.get(category) ?? [];
    if (questions.length === 0) continue;
    const hasUnresolvedRequired = questions.some((q) => {
      if (!q.required) return false;
      const id = q.id ?? q.key;
      const value = params.answers?.[id];
      return value === null || value === undefined || value === "";
    });
    results.push({
      category,
      label: QUESTION_CATEGORY_LABELS[category],
      questions,
      hasUnresolvedRequired,
    });
  }
  return results;
}

/** First incomplete category prefers expanded; else first category. */
export function defaultExpandedQuestionCategory(
  groups: readonly CategorisedQuestionGroup<{ key: string; label: string }>[]
): QuestionPresentationCategory | null {
  const unresolved = groups.find((g) => g.hasUnresolvedRequired);
  if (unresolved) return unresolved.category;
  return groups[0]?.category ?? null;
}
