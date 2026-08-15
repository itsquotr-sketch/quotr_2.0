export {
  CANONICAL_PROJECT_CONDITION_KEYS,
  CONSTRAINT_KEY_TO_TOPIC,
  DUPLICATE_FACT_TO_CONSTRAINT,
  LOCAL_WORK_AREA_ACCESS_FACT_KEYS,
  PROJECT_CONDITION_DUPLICATE_FACT_KEYS,
  PROJECT_CONDITION_KEY_ALIASES,
  PROJECT_CONDITIONS_CONTRACT_VERSION,
  isLocalWorkAreaAccessFactKey,
  isProjectConditionDuplicateFactKey,
  resolveCanonicalProjectConditionKey,
  shouldDropDuplicateFactOnIngest,
  type CanonicalProjectConditionKey,
  type ProjectConditionSemanticTopic,
} from "@/lib/project-conditions/canonical";

export {
  evaluateApplicableProjectConditions,
  getRequiredApplicableKeys,
  getUnresolvedRequiredProjectConditionKeys,
  isProjectConditionKeyApplicable,
  isProjectConditionResolved,
  PROJECT_CONDITIONS_APPLICABILITY_VERSION,
  PROJECT_CONDITIONS_ESTIMATE_BLOCK_MESSAGE,
  type ApplicableProjectCondition,
  type ProjectConditionReadinessClass,
} from "@/lib/project-conditions/applicability";

export {
  resolveLegacyCartingMetres,
  resolveLegacyFloorLevel,
  resolveLegacyHazmat,
  resolveLegacyServicesIsolated,
  resolveLegacyWorkAreaAccess,
  resolveProjectCondition,
  type ResolvedProjectCondition,
} from "@/lib/project-conditions/legacy-adapter";
