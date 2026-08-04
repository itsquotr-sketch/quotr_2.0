export type {
  GoldenLineExpectation,
  GoldenCompareReport,
  GoldenLineScenario,
  GoldenAggregateScenario,
  GoldenValidationScenario,
  ScenarioMapEntry,
  ExecutionClassification,
  FieldMismatch,
} from "./fixture-types";

export { GOLDEN } from "./expected-results";
export {
  SCENARIO_EXECUTION_MAP,
  CANONICAL_SCENARIO_IDS,
  SUPPLEMENTAL_SCENARIO_IDS,
  KNOWN_SCENARIO_IDS,
  getExecutableScenarioIds,
  getDeferredScenarioIds,
  isExecutableClassification,
} from "./scenario-map";
export {
  CANONICAL_LINE_FIXTURES,
  LINE_VALIDATION_FIXTURES,
} from "./canonical-line-fixtures";
export {
  CANONICAL_AGGREGATE_FIXTURES,
  AGGREGATE_VALIDATION_FIXTURES,
} from "./canonical-aggregate-fixtures";
export {
  compareLineResultToGolden,
  compareLineScenario,
  compareAggregateScenario,
  compareValidationScenario,
} from "./compare";
