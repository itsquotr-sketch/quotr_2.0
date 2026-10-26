# Estimating V3 Stage 2A — Analysis to Details handoff

Development branch `estimating/v3-stage-2a`, cut from `estimating/v3` after `237464b2`. No schema migration. No second estimator. No customer-record write. Quantity formulas, rate precedence, productivity, margin, preliminaries, calibration, and the fascia-length fallback are unchanged.

Runnable evidence: `npx tsx scripts/verify-estimating-v3-stage-2a.ts` and `npx tsx scripts/verify-estimating-v3-stage-2a-briefs.ts`.

The sentences below are the supplementary unit cases. The acceptance briefs are the verbatim texts in [STAGE_2A_ORIGINAL_BRIEFS.md](./STAGE_2A_ORIGINAL_BRIEFS.md).

## Briefs

Partition:

```text
Build a new 4.2 m internal partition, 2.4 m high, timber frame, plasterboard both sides, insulation, one door opening, door assembly and stopping. Painting and skirting excluded.
```

Office:

```text
Office fitout. New internal partitions, plasterboard both sides, with acoustic insulation, doors, skirting and painting. Supply and install 18 m2 of carpet tiles in the meeting room. No removal.
```

Flooring:

```text
Flooring. Bedroom 1, 12 m2 carpet. Bedroom 2, 10 m2 carpet. Hallway 8 m2 vinyl plank. No removal.
```

## What was lost, and what is stored now

| Case | Before | After this slice |
| --- | --- | --- |
| Partition length and door | Height and timber only. Length and the door were dropped. | Length 4.2 m, both-side plasterboard, insulation included, one door opening with no invented size. |
| Painting and skirting | Not mapped from an exclusion sentence. | Stored as excluded. |
| Stopping | Not a level unless the brief named Level 4 or 5. | Still asked. No level is invented. |
| Door assembly | Not a door set. | One prehung door set, quantity 1, width still unanswered. “Door assembly” now counts as door work. A bare door opening still does not. |
| Office finishes | Acoustic insulation, skirting, and painting were not canonical wall facts. | Acoustic insulation, skirting both sides, and painting both sides are on the wall type. |
| Carpet tiles | Ordinary carpet. | Specialist `other_unsupported`, description carpet tiles, sell 0. Not complete. |
| Three rooms | A second room was omitted unless its sentence started with a finish verb. | Bedroom 1 carpet 12, Bedroom 2 carpet 10, Hallway vinyl plank 8. Separate portion ids. |

## Identity and provenance

- A work-area UUID is reused when the extracted name matches, and when a catalogue default name is the only instance of that type. A rename of that sole instance does not insert another row.
- A different specific name still inserts. Several existing instances and an unmatched default name are left unresolved: no insert and no rewrite.
- Flooring reanalysis matches a portion by its saved id, then by a unique measured signature. Labels, clause text, and array position are not identity. Identical measurements stay unresolved.
- One door opening keeps its saved id. A second analysis does not add another opening for the same count.
- A `user` answer or an `assumption` keeps its value and source. A different extracted value sets `conflict_warning`. A `derived` value is replaced when extraction disagrees. A user save clears the warning.
- Older flooring JSON that already has a portion id still parses.

## Still open

- The three supplied acceptance briefs are stored verbatim in [STAGE_2A_ORIGINAL_BRIEFS.md](./STAGE_2A_ORIGINAL_BRIEFS.md) and `scripts/fixtures/stage-2a-original-briefs.ts`. The other five of the eight Stage 0 prompts were not supplied. The supplementary sentences are not those briefs.
- Carpet tiles have no priced recipe and no `flooring.carpet_tile.m2` catalogue row. Supply and installation stay visible and unpriced, with a manual allowance. A zero sell is not complete coverage.
- Stopping level, opening size, door width, and insulation type (when the brief says only “insulation”) stay as follow-up questions.
- Fascia length is still absent from the live deck question list. A 4.8 m × 3.6 m deck with no length fact is still 16.8 lm from the exposed perimeter.
- Live model recognition was not run. These checks use the deterministic parsers only.
- `verify-work-area-instance-model-r1.ts` and `verify-work-area-internal-walls-live-fixture-r1.ts` already fail on `237464b2` for an add-dialog string and the coordination-wall card. This slice does not change those failures.

## Next slice

Map a stated stopping level onto the existing side fields, and ask opening size and door width without inventing them. Leave carpet-tile pricing until an owner-approved rate exists. Do not change the fascia quantity formula until the length question is actually on the live Details queue.
