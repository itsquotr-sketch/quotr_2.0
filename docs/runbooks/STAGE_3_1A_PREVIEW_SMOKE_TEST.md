# Stage 3.1A — Preview Smoke Test

**Status:** Ready for owner-gated Preview **retest** after Stage 3.1A-R1  
**Local status prerequisite:** Complete — Local (3.1A + R1 automated)  
**Do not treat this as deployment authorisation**  
**Do not mark Stage 3.1A or Stage 3.1D fully Complete until this retest passes**

---

## Preconditions

- [ ] Preview environment running Stage 3.1A-R1 commit
- [ ] Signed in to a safe sandbox organisation
- [ ] Stage 2B commercial behaviour unchanged (spot-check estimate totals)

---

## Answer persistence and substructure (BUG-001 / BUG-002 / UX-001 / UX-002 / R1-001 / R1-002)

1. **Answer substructure condition**
   - Open a deck work area on the assistant / Scope Review.
   - Set substructure-related visibility (pile replacement or substructure included) so the question appears.
   - Select **Good existing** (chip must show “Good existing”, not `good_existing`).
   - Confirm save shows **Saving…** then **Saved**.
2. **Missing status disappears**
   - Confirm “Substructure condition” is no longer listed as missing.
   - Confirm readiness / missing badges update without a full manual page reload wait (refresh may still occur in background).
3. **Select None**
   - Change answer to **None**.
   - Confirm it saves and is **not** treated as missing.
4. **Raw underscores never appear (R1-001)**
   - Scan chips, fact rows, submitted summaries, and constraint displays for snake_case (`good_existing`, `good_condition`, `partial_replacement`) — labels must be human-readable.
5. **Rapidly change an answer (R1-002)**
   - Quickly switch between three valid options (A → B → C).
   - Confirm the chip stays on **C** through Saving → Saved (no temporary flash of A or B).
6. **Verify final answer persists**
   - Refresh / reopen the project.
   - Confirm the last selected value remains.
7. **Failed-save state**
   - If practical (network throttle / temporary offline): trigger a save failure.
   - Confirm UI shows **Error / retry**, never **Saved**.
   - Restore network and retry successfully.

---

## Specification level (BUG-003 / R1-003)

8. **Edit specification level from Quick Estimate**
   - From Quick Estimate card, click **Edit**.
   - Confirm the Quality card expands **and scrolls into view**.
   - Editors are visible; select a new level; save.
9. **Edit from Quality card**
   - Collapse Quality if needed; use **Change spec**; confirm same editor flow.
10. **Refresh and confirm**
    - Refresh the page.
    - Confirm the selected spec level remains.
    - Confirm estimate shows stale / regenerate affordance per existing workflow (no formula change).

---

## Client details (BUG-004 / R1-004)

11. **Create project without client details**
    - Create a project leaving client name and address blank.
12. **Add client details via Project Details**
    - Edit project client name and site address; save.
13. **Verify pricing reflects them**
    - Open or return to Pricing; values match project.
    - If Pricing was already open, confirm refresh/revalidation shows updates when the form is not dirty.
14. **Dirty pricing form protection**
    - Start typing a different client name in Pricing without saving; trigger a project refresh if practical — unsaved Pricing draft must not be silently overwritten.
15. **Edit from Pricing**
    - Save client/site from Pricing; confirm project reflects the same values.
16. **Historical quote behaviour**
    - If a sent/accepted quote exists: confirm its stored client fields do **not** change when project/pricing client details are edited.
    - If no historical quote: document N/A and create a draft quote only to confirm draft snapshot uses current details without rewriting older quotes later.

---

## Project Capture (UX-005 / R1-005)

17. **Inspect Project Capture hierarchy**
    - Confirm distinct panels: **Project Brief — Job overview** and **Site Notes — Ongoing observations**.
    - Confirm required purpose copy on each.
    - Confirm no duplicated footer explanation under the card.
18. **Verify brief and notes still reach analysis**
    - With both brief text and at least one site note, run Analyse (or confirm existing analysed project still has both sources).
    - Confirm neither field was merged or lost.

---

## Login and rates UX

19. **Login spacing**
    - Open `/login`.
    - Confirm clear gap between password field and Sign in button (desktop + narrow width).
20. **Rates pages**
    - Open Rates on desktop and narrow/mobile width.
    - Confirm Company Defaults Save button is spaced from fields; no overlapping controls.
    - Confirm rates values still save (no calculation change).

---

## Commercial regression spot-check

21. **No estimate / pricing / quote regression**
    - Generate or open an estimate; totals look unchanged for a known sandbox job.
    - Open pricing; line totals and GST behave as before Stage 3.1A.
    - Open a quote print/preview; stored money unchanged.

---

## Sign-off

| Field | Value |
| --- | --- |
| Tester | |
| Preview URL | |
| Commit SHA | |
| Date | |
| Result | Pass / Fail |
| Notes | |

**Do not mark Stage 3.1A fully Complete until this Preview plan is executed after R1.**  
**Do not close Stage 3.1D on Preview sign-off of 3.1A alone unless explicitly authorised.**
