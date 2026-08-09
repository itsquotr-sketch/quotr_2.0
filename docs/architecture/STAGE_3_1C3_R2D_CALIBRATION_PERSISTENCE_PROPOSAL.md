# Stage 3.1C.3-R2D — Calibration Persistence Proposal

**Status:** Approved — implemented locally as migration **033**; remote pending  
**Migration:** `supabase/migrations/033_calibration_responses.sql`

## Why migration is required

No existing table honestly stores org-scoped, versioned calibration evidence.

| Existing surface | Why unsuitable |
| --- | --- |
| `rates` | Explicit company rate authority — calibration must not write here |
| `organisation_settings` | Flat commercial defaults; not scenario evidence |
| `project_notes` / `calibration_note` | Project-scoped notes; wrong tenant object |
| `estimates` | Project estimates — must not mutate |

## Implemented table: `calibration_responses`

See migration 033 for authoritative DDL. Summary:

- Commercial columns: labour hours/cost, materials, subcontractors, other, expected total/sell, confidence, notes  
- `engine_snapshot` JSONB (bounded compare)  
- `response_metadata` JSONB (non-authoritative)  
- `status` active|superseded + `supersedes_id` + `superseded_at`  
- Partial unique: one active per `(org_id, scenario_id)`  
- Atomic RPC `save_calibration_response` (SECURITY INVOKER)  
- Evidence immutability trigger on UPDATE  

## History semantics

New recalibration → insert `active`, prior → `superseded`. Scenario version frozen on row.

## Application write path

1. Auth via `getAuthOrgContext()`  
2. Validate scenario against static catalogue  
3. Observational compare (read-only rates)  
4. RPC supersede + insert  
5. **Never** upsert rates/projects/facts/estimates/quotes  

## Out of scope

- Company DNA tables  
- Auto rate suggestion tables  
- AI storage  
- Remote apply until separate owner gate  

## Related

- `docs/security/STAGE_3_1C3_R2D_CALIBRATION_SECURITY_REVIEW.md`  
- `docs/runbooks/STAGE_3_1C3_R2D1_REMOTE_033_READINESS.md`  
- `docs/implementation/STAGE_3_1C3_R2D1_CALIBRATION_PERSISTENCE_COMPLETION.md`
