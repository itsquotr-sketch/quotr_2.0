/**
 * Which legacy IDs must have ≥1 parity fixture in Batch 2B.4.
 * Side-effectful orchestrators / schema / snapshot display are deferred explicitly.
 */

export const REQUIRED_PARITY_LEGACY_IDS = Object.freeze([
  "LEG-E-01",
  "LEG-E-15",
  "LEG-E-16",
  "LEG-P-01",
  "LEG-P-02",
  "LEG-P-03",
  "LEG-P-05",
  "LEG-Q-01",
  "LEG-Q-02",
  "LEG-UI-01",
  "LEG-UI-02",
] as const);

export const DEFERRED_PARITY_LEGACY_IDS = Object.freeze([
  "LEG-E-08", // covered indirectly via estimate/pricing triad fixtures
  "LEG-E-13", // same aggregate as LEG-E-16
  "LEG-E-19", // domain calculators — workflow; money via line modes
  "LEG-E-21", // side-effectful orchestrator
  "LEG-E-24", // presentation partial profit
  "LEG-P-04", // side-effectful persist
  "LEG-P-06", // recalibration workflow
  "LEG-P-07", // display section gst=0
  "LEG-Q-03", // transform
  "LEG-Q-04", // orchestrator
  "LEG-Q-05", // side-effectful
  "LEG-Q-06", // snapshot display
  "LEG-CONST-01", // covered via C-28 fixture
  "LEG-DB-01", // schema only
] as const);
