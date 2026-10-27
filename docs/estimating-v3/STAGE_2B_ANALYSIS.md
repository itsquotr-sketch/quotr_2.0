# Estimating V3 Stage 2B — flooring interpretation

Branch `estimating/v3-stage-2b`, cut from the accepted integration baseline `f45eaedf6996b2db83f23a39008fba06095bff85`. Stage 2A’s acceptance boundary is unchanged: one commercial identity per stopping or painting face, the disclosed 1980 mm door height, and the disclosed 13 mm plasterboard default. No schema migration. Recipes, rates, productivity, preliminaries pricing, calibration, fascia quantity, and unrelated screens were not changed. Production was not deployed.

Runnable evidence: `npx tsx scripts/verify-estimating-v3-stage-2b.ts`. The live comparison script is `scripts/evaluate-estimating-v3-stage-2b-analysis.ts`. It refuses a Production Supabase ref and a live Stripe key, and it writes only plus-address Preview fixtures.

## What was graded

Each original brief in [STAGE_2A_ORIGINAL_BRIEFS.md](./STAGE_2A_ORIGINAL_BRIEFS.md) was sent through the same Anthropic extraction the Analyse action uses, then normalisation, isolated Preview persistence, the Job Plan, and the Details questions. Semantic outcomes were graded. Identical wording was not required. Recognised work that has no recipe, rate, or productivity was not treated as a recognition miss.

Before the correction, credits stopped the live set after the partition (3), the office fitout (3), one three-room run, and one elevated-deck smoke. That deck smoke stored Deck and Flooring. The model had emitted Deck only; enrichment opened Flooring because bare “hardwood” counted as a floor finish. The 20 m² versus 32 m² brief was not model-run before the change. On the deterministic path a stored stated area set `area_input_method` to `direct_m2`, so the Job Plan showed 32 m² and Details did not ask.

## The defect class

Two failures share one cause: a flooring fact was resolved to a priced floor even when the brief named a different assembly, or named two areas that do not agree.

- A finish word that belongs to a deck, platform, joist, fascia, or face-board assembly, including bare “hardwood”, is not an independent Flooring work area. A floor noun or a floor room in the same clause still is.
- When length × width and a stated area disagree by more than `max(0.05, measured × 0.005)` m², both numbers stay stored, no area method is chosen, and Details asks which area the quote should use. A later user choice (`area_method_authority === "user"`) remains a resolution and can price. Agreeing measures stay on the stated area.

`filterTopLevelWorkAreas` already drops a Flooring row when the brief has no independent floor, so a model-emitted Flooring row on a deck-only brief is removed with its facts. No new column was added. The disagreement is derived from length, width, and `area_m2`.

Reserved before the code change, and worded independently of the eight briefs:

- `4200mm by 2.8 m platform, 600 mm above ground. New kwila boards. Pull the old boards off. No balustrade.`
- `140 mm boards. 900 mm above ground. New hardwood. 3.0 m × 2.4 m. Rear platform replacement, old joists out. Balustrade by others.`
- `Vinyl plank. Stated cover 18 m2. The room measures 3600 mm × 4.2 m. Allow 8% waste.`
- `Supply and lay hardwood in the lounge, 22 m². The room is 5.5 m by 4 m. No removal.`

## After the correction

Twenty-four live runs (eight briefs × three), each one model call. Wall time for the set was 508 s. Median call about 19 s. No run retried.

| Brief | Stored areas, 3/3 | Interpretation that changed |
| --- | --- | --- |
| Elevated replacement deck | Deck only | Hardwood stays on the deck. No Flooring row. 5.2 × 3.1 m, 1.2 m high, removal, fascia, one step, balustrade excluded. |
| Low deck | Deck only | 4.8 × 3.6 m, 0.45 m, 90 mm boards. No Flooring row. |
| Three rooms | Flooring | Bedroom 1 carpet 3.6 × 3.2, Bedroom 2 carpet 4.2 × 3.5, Hallway vinyl plank 8 × 1.2. |
| Conflicting area | Flooring | 5 × 4 m and 32 m² both stored. Method unset. Details: “5 × 4 m measures 20 m²; stated area is 32 m². Which area should the quote use?” |
| Laminate | Flooring | 30 m² and 6 × 5 m agree, so the stated 30 m² stays the method. Details does not ask which area. |
| Partition, office, bathroom | Unchanged area sets | Partition walls and doors. Office walls, doors, and unpriced carpet tiles. Bathroom only. |

The four reserved variants, one live call each: both deck wordings stored Deck only (kwila 4.2 × 2.8 m; hardwood 3.0 × 2.4 m, 140 mm). The mixed-unit room stored 3.6 × 4.2 m and 18 m² with the method unset and named 15.12 m² in the question. The lounge hardwood stayed Flooring at 22 m², method `direct_m2`.

Deterministic checks: `verify-estimating-v3-stage-2b.ts` 25 passed, including a Preview persist and delete of the unresolved 20 / 32 portion. `verify-estimating-v3-stage-2a-briefs.ts` 45 passed. `verify-analyse-job-flow.ts` 51 passed. `verify-bathroom-ceiling-lining-01.ts` passed. `verify-flooring-02-extraction-details.ts` is 91 passed and 4 failed, the same four reanalysis checks that already fail on `f45eaedf`. Check 24 now expects the disagreeing 24 m² and 5 × 4 m to stay unresolved.

## Acceptance

The first live sample is incomplete. Credits stopped it after the partition (3), the office (3), one three-room run, and one elevated-deck smoke. That is not a paired before/after for all eight briefs. The 24 runs below were taken after the correction.

Choosing length × width on the isolated Preview conflict project stored `area_input_method: length_width` with `area_method_authority: user`, and kept 5 m, 4 m, and 32 m². Details became Ready. The generated Flooring line is `20 m² × $95/m²`. Choosing the stated area on a separate persisted project reloads at 32 m². Waste stays off the priced quantity (`wasteFactor` 0). Finish, label, and the unused measurement stay as they were.

A mixed brief with external hardwood decking and lounge hardwood flooring keeps both Deck and Flooring. The lounge portion stays hardwood at 18 m². A deck-only brief still does not open Flooring.

The work card follows the chosen basis. Length × width reads “5 × 4 m measures 20 m²; stated 32 m² kept”. The stated choice reads “32 m² stated; 5 × 4 m measures 20 m² kept”.

## Still open

These were graded and left for a later slice. They are not described here as missing recognition when the fact was stored.

- Elevated deck, 3/3: `deck.pile_or_post_replacement_required` is true while the condition text still says the piles may be retained if sound. The conditional was not left uncertain.
- Bathroom, 3/3: customer-supplied vanity, toilet, shower, and tiles are stored, and tiling stays included. One run stored the fixture list as “Other materials”. The Job Plan included list shows strip-out, and wall lining on only one run. Unknown GIB extent remains a free-text note.
- Low deck, 3/3: excluded stairs, balustrade, and demolition are not stored as exclusions. Details asks whether removal and steps are included.
- Partition, 3/3: the model stores a hollow-core leaf the brief did not state. Door height 1980 mm remains the accepted disclosed default. Stated ground-floor access does not stop the site-access and carting questions.
- Office carpet tiles stay specialist and unpriced. Preliminaries stay coverage notes. Fascia length is still not derived. A deck with length and width still asks for an approximate area.
- `verify-flooring-02-extraction-details.ts` checks 76–79 still fail on the parent commit. Reanalysis identity was not changed.
