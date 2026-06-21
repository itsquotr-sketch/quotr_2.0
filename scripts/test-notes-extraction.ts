/**
 * Manual smoke test for notes-only initial analysis input format.
 * Run: npx tsx scripts/test-notes-extraction.ts
 */
import { buildInitialAnalysisInput } from "../lib/project-notes/build-analysis-source";

const screenshotNotes = [
  {
    content:
      "Site access is poor, 50m walk around the back of the house.",
    note_type: "access",
    captured_at: "2026-06-21T10:00:00.000Z",
  },
  {
    content: "Fence replacement, 15m long and 2m high, including gate.",
    note_type: "general",
    captured_at: "2026-06-21T10:01:00.000Z",
  },
  {
    content:
      "Pergola installation, will need to contract subcontractor and get this build - aluminium with a roof.",
    note_type: "general",
    captured_at: "2026-06-21T10:02:00.000Z",
  },
  {
    content:
      "4m wide by 10m long kwila deck, including stairs with balustrade. Piles will need to be redone, there are 8.",
    note_type: "general",
    captured_at: "2026-06-21T10:03:00.000Z",
  },
];

const input = buildInitialAnalysisInput({
  briefText: "",
  notes: screenshotNotes,
});

console.log("Input length:", input.length);
console.log("\n--- Full structured input ---\n");
console.log(input);

const checks = [
  ["has brief placeholder", input.includes("No separate project brief provided.")],
  ["has 4 numbered notes", (input.match(/^\d+\. \[/gm) ?? []).length === 4],
  ["has access note label", input.includes("[Access issue]")],
  ["has instructions", input.includes("Instructions:")],
];

console.log("\n--- Validation ---");
for (const [label, ok] of checks) {
  console.log(ok ? "PASS" : "FAIL", label);
}

if (checks.some(([, ok]) => !ok)) {
  process.exit(1);
}
