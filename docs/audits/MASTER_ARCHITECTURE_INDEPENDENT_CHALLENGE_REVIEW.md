# Master Architecture Independent Challenge Review

**Classification:** HISTORICAL challenge + CANONICAL disposition for PHASE 0-R1  
**Date:** 2026-08-17  
**Product HEAD:** `a4de0f875b3497f11d4bcd0379865a811ca4bf1c`  
**Reviewer:** Independent Claude architecture challenge  
**Disposition:** PHASE 0-R1 reconciliation  
**Verdict recorded:** **REQ-1 = GO** after this pre-emission contract widening.

Does not authorise calculator emission, money change, UI, migrations, AN-1 emitters, or Production.

---

## 1. Challenge summary (faithful)

The Master Architecture Lock is sound. Estimating authority, Project Conditions, cost-first money, recognition ≠ support, and the REQ-1 envelope-first sequence are accepted.

The review identified **cheap pre-emission contract widenings** and **future phase gates** that must be recorded now so they are not rediscovered later. It did **not** require delaying REQ-1 for catalogue, supplier, DNA, RFQ, or quote-acceptance production work.

---

## 2. Finding disposition

| ID | Finding | Disposition | When |
| --- | --- | --- | --- |
| **AC-01** | Per-component pricing authority needed before promoting requirements to money | **GATE BEFORE REQ-4** | Record lifecycle now; do not implement authority table |
| **AC-02** | Requirement/provenance snapshot needed before requirements become commercial authority | **GATE BEFORE REQ-4** | **REQ-SNAPSHOT-01** |
| **AC-03** | DB-level immutable quote protection before public quote acceptance Production | **GATE BEFORE QUOTE ACCEPTANCE PRODUCTION** | **QUOTE-IMMUTABILITY-DB-01** |
| **AC-04** | Material physical identity must separate from pricing unit before Catalogue V2 seeds | **GATE BEFORE CAT-V2** | **CAT-IDENTITY-01** |
| **AC-05** | LabourAdjustmentRef must support multiple contributing factors | **ADOPT NOW** (types) / **GATE BEFORE REQ-3** (emit) | Widen type now; composition algorithm still OD-PC-01 |
| **AC-06** | Rate-source provenance must include `project_override` and `supplier` | **ADOPT NOW** | Types only; live resolver unchanged |
| **AC-07** | Assumptions must be structured before material/labour emission | **ADOPT NOW** | Types only; no assumptions engine |
| **AC-08** | SubcontractRequirement authority/RFQ state before RFQ | **GATE BEFORE RFQ** | **SUB-AUTH-01**; reserved union only |
| **AC-09** | Confidence roll-up needs deterministic/banded semantics | **ADOPT NOW** (docs) | Bands stay high/medium/low; no UI |
| **AC-10** | `priced` / cost-field invariant | **ADOPT NOW** | Helper + tests; no emission |
| **AC-11** | Parity promotion tolerance before REQ-4 | **GATE BEFORE REQ-4** | Semantic vs intentional; no generic 1% rule |
| **AC-12** | Deterministic vs AI-semantic golden strategies must differ | **ADOPT NOW** (docs) | No new AI test system |
| **AC-13** | Edit-evidence event decision before AN-1 | **GATE BEFORE AN-1** | **AN-EVIDENCE-01** |
| **AC-14** | Work Area maturation must support different target depths | **ADOPT NOW** (docs) | Deep / Hybrid / Package |
| **AC-15** | ISD/product id mapping drift should be machine-checked | **FUTURE / NON-BLOCKING** | **ISD-MAP-01**; no merge now |
| **AC-16** | Future procurement qty must not redefine `purchaseQuantity` | **ADOPT NOW** (docs + type comment) | |
| **AC-17** | Catalogue interleaving should be clearer in master-plan phases | **ADOPT NOW** (plan presentation) | |

No findings **REJECTED**. AC-11 **REFINED** (report variance; do not auto-accept a % band). AC-05 composition algorithm **not** locked (OD-PC-01 remains open).

---

## 3. Contract version

| Version | Meaning |
| --- | --- |
| `foundation-r1.0` | FOUNDATION-R1 planning/type freeze before independent review |
| `foundation-r1.1` | PHASE 0-R1 **final pre-emission contract** |

No persisted requirement rows exist. This is not a data migration.

---

## 4. Gates created

| ID | Blocks | Implement now? |
| --- | --- | --- |
| **REQ-SNAPSHOT-01** | REQ-4 promotion | No |
| **QUOTE-IMMUTABILITY-DB-01** | Public quote send/acceptance Production | No |
| **CAT-IDENTITY-01** | Catalogue V2 canonical material seeding | No |
| **AN-EVIDENCE-01** | AN-1 emitters | No |
| **SUB-AUTH-01** | RFQ | No (reserved union only) |
| **ISD-MAP-01** | Future CI; not REQ-1 | No |

---

## 5. REQ-1

Independent review: **GO**.

This reconciliation does **not** start REQ-1. After PHASE 0 freeze, REQ-1 is **READY / NOT STARTED**.
