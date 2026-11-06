/**
 * Reserved after the Stage 2B baseline ranking and before the correction.
 * Independently worded. Not copies of the eight original briefs.
 */
export type Stage2BReservedVariant = {
  id: string;
  text: string;
  kind: "variant";
  probes: string;
};

export const STAGE_2B_RESERVED_VARIANTS: readonly Stage2BReservedVariant[] = [
  {
    id: "deck-boards-mixed-units",
    kind: "variant",
    probes: "A deck stated in mixed units must not become Flooring.",
    text: "4200mm by 2.8 m platform, 600 mm above ground. New kwila boards. Pull the old boards off. No balustrade.",
  },
  {
    id: "deck-hardwood-reordered",
    kind: "variant",
    probes: "Hardwood named apart from the deck still belongs to the deck.",
    text: "140 mm boards. 900 mm above ground. New hardwood. 3.0 m × 2.4 m. Rear platform replacement, old joists out. Balustrade by others.",
  },
  {
    id: "floor-area-conflict-mixed",
    kind: "variant",
    probes: "A stated area and mixed-unit dimensions that disagree stay unresolved.",
    text: "Vinyl plank. Stated cover 18 m2. The room measures 3600 mm × 4.2 m. Allow 8% waste.",
  },
  {
    id: "hardwood-floor-agrees",
    kind: "variant",
    probes: "A real hardwood floor whose area matches its dimensions stays Flooring.",
    text: "Supply and lay hardwood in the lounge, 22 m². The room is 5.5 m by 4 m. No removal.",
  },
];
