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
  resolveLegacyCartingMetres,
  resolveLegacyFloorLevel,
  resolveLegacyHazmat,
  resolveLegacyServicesIsolated,
  resolveLegacyWorkAreaAccess,
  resolveProjectCondition,
  type ResolvedProjectCondition,
} from "@/lib/project-conditions/legacy-adapter";
