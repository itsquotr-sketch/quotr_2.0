# Estimating V3 Stage 0 — implementation plan

V3 extends the contracts in `STAGE_0_ARCHITECTURE.md`. It does not replace the estimator, the rate tables, or the quote snapshot.

## Compatibility

Existing `project_facts` rows, flooring and other collection JSON, constraint rows, company rates, and productivity overrides stay valid. A portion id that is already stored remains the instance id. A scalar deck fact remains one row per work area and key.

Question rows are a mirror. On reload, persisted facts win, which is already the rule in `scope-review.ts`. Stage 1 does not migrate question rows.

Issued quotes stay on `lib/quotes/issuer-snapshot.ts` and the revision modules. A later calculation change does not open them and does not regenerate the estimate they were built from. The live estimate is marked stale by the existing fact-write path when an input changes. Stale means the user generates again. It does not mean a silent rebuild.

Where a future stage changes a quantity formula, that stage ships an explicit recipe version on the new estimate only. Old estimate rows keep the version they were generated with. There is no backfill.

## Design additions

### Scope instance

A scope instance is the work-area id plus, when the recipe is nested, the portion or wall-type id already stored in the collection. V3 does not invent a second id space. New instances use the existing client id helpers. Field edits must keep the id, which `applyFlooringFactWrite` already does.

The active-portion pointer remains a convenience. Readiness and pricing address the portion id on the question, not “whatever is first” once a nested id was part of the answer.

### Fact provenance and conflicts

Keep `source` on scalar facts and `*_authority` on nested fields. Values already in use stay: `user`, `assumption`, `ai_extracted`, `extracted`, `derived`.

A conflict is two authorities for the same instance and field. The user value wins until the user clears it. An extracted value does not overwrite `user`. Derived geometry does not overwrite a user override. That is the current derived-edit guard. V3 records the rejected value as a conflict note. It does not delete the user value.

### Question lifecycle

Each question has one identity: work area, fact or constraint key, and nested id when the fact is nested.

States: `not_applicable`, `unasked`, `open`, `answered`, `assumed`, `conflict`. `answered` requires a value the recipe parser accepts. An option label that the number parser rejects is `open` and shows the parser error. It is not a successful save that later reappears as blank.

Order for project conditions is the library order. Adding a work area may add questions at the end of that list. It does not reorder questions already presented. Ask class still decides whether a question can be assumed. It does not decide a new position for a question the user has already seen.

### Coverage

Each instance field is `missing`, `resolved`, `excluded`, or `unsupported`. Unsupported is a recognised recipe with no price authority, which is laminate today. Excluded is an explicit no, such as no removal. Missing stays blocking when the contract says hard minimum. A sell of 0 is not a coverage state.

### Readiness

One list of open items. Each item names the instance, the field, and the action: answer, price, or exclude. Deck excavation and deck concrete are separate items. Post count and hole count are separate items. Generate stays disabled while any hard item is open. Assumable project conditions may still be assumed under the current assumption statement. They are not deleted.

### Regeneration

Calculation changes that affect money carry a recipe version on the newly generated estimate. Opening an old project shows the saved estimate until the user generates again. Snapshots and sent quotes are not in that generate action.

## Stages

| Stage | Scope | Out of scope |
| --- | --- | --- |
| 0 | This audit, the defect register, and `verify-estimating-v3-stage0.ts` | Fixes, deploys, migrations, customer data |
| 1 | The four blocker fixes in `STAGE_1_BLOCKER_SCOPE.md` | New recipes, laminate pricing, P&G, catalogue expansion |
| 2 | Stable project-condition order and question state, still on the current candidate type | A new question database |
| 3 | Coverage states on the existing readiness object, including unsupported versus missing | Repricing laminate or carpet tiles |
| 4 | Recipe version on new estimates only, with one deck or flooring formula change if one is still required | Snapshot migration |
| 5 | Laminate, carpet tiles, multi-room split, and partition length as their own priced recipes, each with a fixture and an owner-approved rate | Using the unused 110/165 laminate pair without that approval |

Stages 2 to 5 are sequenced work. They are not authorised by Stage 0. Each one gets its own branch from the then-current production parent, the same way this branch left the spacing checkout alone.

## Protection checks before any later stage

- Company rate and productivity rows are not updated by a migration.
- Portion JSON keeps its ids.
- `classifyResolvedSell` is not changed so that paired sells become margin.
- Quote snapshot tables are not written.
- Android play-surface files are not deleted to make the website branch match Android.
- Billing, signup, consent, and account deletion stay on their own branches.
