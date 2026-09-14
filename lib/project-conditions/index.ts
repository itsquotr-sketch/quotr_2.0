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
  applicableProjectConditionKeySet,
  evaluateApplicableProjectConditions,
  getRequiredApplicableKeys,
  getUnresolvedRequiredProjectConditionKeys,
  isProjectConditionKeyApplicable,
  isProjectConditionResolved,
  PROJECT_CONDITIONS_APPLICABILITY_VERSION,
  PROJECT_CONDITIONS_ESTIMATE_BLOCK_MESSAGE,
  toConfirmedInterviewInput,
  type ApplicableProjectCondition,
  type ProjectConditionReadinessClass,
} from "@/lib/project-conditions/applicability";

export {
  CONSUMED_PROJECT_CONDITION_KEYS,
  consumedConditionIsReadyBlocking,
  consumedProjectConditionAskClass,
  disclosedProjectConditionForNotSure,
  getConsumedProjectConditionDef,
  isRequiredConsumedProjectCondition,
  labourAccessWorkAreaPresent,
  listConsumedProjectConditionDefs,
  projectConsumesConsumedCondition,
  type ConsumedProjectConditionAskClass,
  type ConsumedProjectConditionDef,
} from "@/lib/project-conditions/consumed-authority";

export {
  resolveLegacyCartingMetres,
  resolveLegacyFloorLevel,
  resolveLegacyHazmat,
  resolveLegacyServicesIsolated,
  resolveLegacyWorkAreaAccess,
  resolveProjectCondition,
  type ResolvedProjectCondition,
} from "@/lib/project-conditions/legacy-adapter";

export {
  HIGH_LEVEL_ACCESS_KEY,
  HIGH_LEVEL_ACCESS_THRESHOLD_M,
  PROJECT_CONDITION_GROUP_LABEL,
  PROJECT_CONDITION_LIBRARY,
  PROJECT_CONDITION_LIBRARY_VERSION,
  getProjectConditionLibraryDef,
  projectConditionDetailsGroupLabel,
  type ProjectConditionAskPolicy,
  type ProjectConditionLibraryDef,
  type ProjectConditionLibraryGroup,
} from "@/lib/project-conditions/library";

export {
  collectInteriorWorkingHeightsM,
  interiorWorkingHeightRequiresHighAccess,
  scaffoldQuestionWouldBeAsked,
} from "@/lib/project-conditions/relevance";
