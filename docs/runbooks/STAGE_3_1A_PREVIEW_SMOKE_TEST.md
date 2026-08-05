# Stage 3.1A — Preview Smoke Test

**Status:** Ready for owner-gated Preview execution  
**Local status prerequisite:** Complete — Local (automated)  
**Do not treat this as deployment authorisation**

---

## Preconditions

- [ ] Preview environment running Stage 3.1A commit
- [ ] Signed in to a safe sandbox organisation
- [ ] Stage 2B commercial behaviour unchanged (spot-check estimate totals)

---

## Answer persistence and substructure (BUG-001 / BUG-002 / UX-001 / UX-002)

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
4. **Raw underscores never appear**
   - Scan chips and fact displays for snake_case (`good_existing`, `partial_replacement`) — labels must be human-readable.
5. **Rapidly change an answer**
   - Quickly switch between two valid options several times.
6. **Verify final answer persists**
   - Refresh / reopen the project.
   - Confirm the last selected value remains.
7. **Failed-save state**
   - If practical (network throttle / temporary offline): trigger a save failure.
   - Confirm UI shows **Error / retry**, never **Saved**.
   - Restore network and retry successfully.

---

## Specification level (BUG-003)

8. **Edit specification level**
   - From Quick Estimate card, click Edit / Change spec.
   - Confirm the Quality card expands and editors are visible.
   - Select each valid level in turn; save.
9. **Refresh and confirm**
   - Refresh the page.
   - Confirm the selected spec level remains.
   - Confirm estimate shows stale / regenerate affordance per existing workflow (no formula change).

---

## Client details (BUG-004)

10. **Create project without client details**
    - Create a project leaving client name and address blank.
11. **Add client details later**
    - From pricing details (or after preparing pricing), enter client name and site address; save.
12. **Verify pricing reflects them**
    - Refresh pricing; values remain.
    - Confirm project header / edit project also shows the same values.
13. **Historical quote behaviour**
    - If a sent/accepted quote exists: confirm its stored client fields do **not** change when project/pricing client details are edited.
    - If no historical quote: document N/A and create a draft quote only to confirm draft snapshot uses current details without rewriting older quotes later.

---

## Project Capture (UX-005)

14. **Inspect Project Capture separation**
    - Confirm distinct **Project brief** and **Site notes** subsections with clear copy.
15. **Verify brief and notes still reach analysis**
    - With both brief text and at least one site note, run Analyse (or confirm existing analysed project still has both sources).
    - Confirm neither field was merged or lost.

---

## Login and rates UX

16. **Login spacing**
    - Open `/login`.
    - Confirm clear gap between password field and Sign in button (desktop + narrow width).
17. **Rates pages**
    - Open Rates on desktop and narrow/mobile width.
    - Confirm Company Defaults Save button is spaced from fields; no overlapping controls.
    - Confirm rates values still save (no calculation change).

---

## Commercial regression spot-check

18. **No estimate / pricing / quote regression**
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

**Do not mark Stage 3.1A fully Complete until this Preview plan is executed.**
