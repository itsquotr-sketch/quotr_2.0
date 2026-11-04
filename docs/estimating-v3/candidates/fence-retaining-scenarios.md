# Fence and retaining-wall scenarios

Recorded on integration `475acf23b4cccf9fdea3264ff3de0905f5cf6969`. Declared live model calls: 0. No analysis call, no hosted write, and no company rate was changed. Empty rate lists used the existing benchmark path. A missing company rate is not a defect. Reproduction: `npx tsx qa-evidence/fence-retaining/representative-scenarios.ts`.

## Fence

Existing timber vertical contract. One fence, 18 m long and 1.8 m high, system “Timber paling — vertical board”, Radiata Pine, 150 × 19 mm boards, 1.8 m post spacing, one 0.9 m gate within the run, top capping and gate capping included, paling gap 0.

- Expected face area, calculated before the run: 18 × 1.8 = 32.4 m².
- Actual face area: 32.4 m². **PASS**
- Actual post count from `layoutTimberPostsWithGate`: 12. The calculator emitted detailed timber lines and no package lines. Fourteen lines, including posts 28.8 lm, palings 226.8, top capping 18 lm, and one gate.

## Retaining wall

Existing timber retaining-wall contract. One wall, 15 m long, raking from 1.6 m to 0.6 m, H5 SED retaining poles, backfill included, excavation 6 m³ with digger access, drainage included, drainage sock not required, disposal excluded.

- Expected face area, from `faceAreaM2(15, 1.6, 0.6)`: 15 × (1.6 + 0.6) / 2 = 16.5 m².
- Actual geometry and physical face area: 16.5 m². Readiness `SLOPING_HEIGHT_AVAILABLE`. **PASS**
- The calculator emitted detailed timber lines and no package lines. Fourteen lines, including 15 lm novacoil, 121 face boards, eight 1.8 m stock poles, and six 2.4 m stock poles. Excavation labour quantity is the stated 6 m³.

These two runs are the representative scenarios for the completion register. They are not a recipe change.
