# Stage 2A instance identity

No schema migration is applied.

Work-area matching uses the saved UUID. A unique exact name reuses that row. One saved row and one extracted row reuse the UUID after a rename. An extra extracted row inserts only once every saved row of that type is already matched. If saved and extracted rows remain unmatched on both sides, the result is unresolved: nothing is inserted or merged. The saved facts on those work areas receive `conflict_warning` text: "Reanalysis could not match this work area safely. The saved area was kept and nothing was added or merged."

Flooring portions match by saved id, then by a unique measured signature of finish, specialist, area method, area, length and width. Labels, clause text and array position are not identity. Two portions with the same measurement are unresolved: both saved portions stay, answers are not swapped, and the extracted rows are not appended. The portions fact receives `conflict_warning` text: "Reanalysis could not match these flooring areas safely. Saved areas were kept and nothing was merged."

A user-confirmed fact edit clears `conflict_warning`. An assumption stays an assumption and keeps a visible warning when extraction disagrees. A derived value is replaced when extraction disagrees, so it is not kept as a confirmed answer.

## Additive proposal, not applied

If identical measured rooms must be distinguished before the user answers, add a nullable `instance_key text` on `work_areas` and a nullable `instance_key` inside each flooring portion object.

- Existing rows stay null. Nothing is backfilled and no saved estimate is rewritten.
- New analysis may write a key only when the user confirms a match.
- Readers keep the current UUID and signature behaviour while the key is null.
- The column and the JSON field can be dropped without rewriting historical quote snapshots.

That change is not part of this slice.
