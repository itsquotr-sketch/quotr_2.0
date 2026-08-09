# Stage 3.1C.3-R2D — Calibration Security Review

**Status:** Implemented locally (033); remote apply still gated  
**Related:** `docs/architecture/STAGE_3_1C3_R2D_CALIBRATION_PERSISTENCE_PROPOSAL.md`

## Assets

Calibration responses contain **sensitive commercial pricing** (expected cost/sell, labour, margins).

## Threats

| Threat | Mitigation |
| --- | --- |
| Cross-org read/write | RLS + `org_id` from `auth_org_id()` only |
| Client-supplied org_id | Forbidden — RPC/server derive org |
| Anon access | Revoke all; no policies for anon |
| Silent rate overwrite | Calibration actions never write `rates` |
| Project/estimate mutation | Calibration does not touch projects/facts/estimates/quotes |
| Log leakage | Events only: started/completed/failed + scenario id/version/elapsed |
| Scenario tampering | Validate id+version against static catalogue |
| Mutable history | Trigger blocks commercial column UPDATEs; supersede-only status transition |
| Non-atomic supersede | Single RPC transaction + advisory lock |

## RLS / grants (033)

- `ENABLE ROW LEVEL SECURITY`  
- SELECT / INSERT / UPDATE for authenticated where `org_id = auth_org_id()`  
- INSERT also requires `created_by = auth.uid()`  
- No DELETE policy for authenticated  
- `REVOKE ALL FROM anon`  
- Authenticated: `SELECT, INSERT, UPDATE` only  
- service_role: SIDU for admin  

## Application invariants

- Compare uses `calculateEstimate` on synthetic context — no DB project writes.  
- Save uses `save_calibration_response` RPC.  
- No AI calls.  
- No commercial formula changes.  
- Calibration not imported by rate/estimate/pricing/quote commercial engines.

## Residual risk

Remote Preview not yet applied — local-only until owner signs remote readiness.
