/**
 * Expected outcomes for the eight Stage 2A acceptance briefs.
 * These describe what the brief itself requires. They do not authorise
 * invented specifications, rates, or recipes.
 */
export type Stage2ABriefExpectation = {
  id: string;
  explicit: readonly string[];
  mustNotInvent: readonly string[];
  unresolved: readonly string[];
};

export const STAGE_2A_BRIEF_EXPECTATIONS: readonly Stage2ABriefExpectation[] = [
  {
    id: "internal-partition",
    explicit: [
      "One internal partition, 6 m by 2.4 m.",
      "Both sides lined and the cavity insulated.",
      "One opening and one door assembly, owned once, including jamb, hinges, and handle.",
      "Stopping retained.",
      "Painting, electrical work, and skirting excluded.",
      "Ground-floor access.",
    ],
    mustNotInvent: [
      "13 mm must not be presented as owner-supplied. Standard plasterboard uses the disclosed product default.",
    ],
    unresolved: [
      "Stopping is asked only when the brief leaves it unresolved.",
    ],
  },
  {
    id: "office-fitout",
    explicit: [
      "24 linear metres of partition at 2.7 m, lined both sides, with acoustic insulation.",
      "Six internal door sets.",
      "120 m² carpet tiles retained as that finish.",
      "45 linear metres of skirting, without an invented edge.",
      "Painting of the new walls and skirting retained, without invented coverage.",
      "Existing flooring removal is not added.",
      "Structural, electrical, plumbing, and fire-system work stay excluded.",
      "Occupied building, goods-lift delivery windows, and unknown duration stay visible.",
    ],
    mustNotInvent: [
      "Carpet tiles stay unsupported and unpriced. Zero sell is not a complete free item.",
      "Preliminaries stay coverage gaps. This slice does not add P&G or carpet-tile recipes.",
    ],
    unresolved: [
      "Duration is not confirmed.",
    ],
  },
  {
    id: "three-room-flooring",
    explicit: [
      "Bedroom 1 carpet 3.6 m by 3.2 m, net 11.52 m².",
      "Bedroom 2 carpet 4.2 m by 3.5 m, net 14.70 m².",
      "Hallway vinyl plank 8 m by 1.2 m, net 9.60 m².",
      "Total net 35.82 m² by length and width.",
      "Removal in all three rooms.",
      "Underlay on carpet only.",
      "Transition strips and 10% waste retained.",
      "Skirting replacement is an explicit exclusion.",
      "Major subfloor repairs excluded.",
    ],
    mustNotInvent: [
      "No bathroom work area.",
      "Priced quantity stays net. The 10% waste stays visible and blocks a complete commercial result.",
    ],
    unresolved: [
      "Purchasing-rule application of the waste allowance is later work.",
    ],
  },
  {
    id: "elevated-replacement-deck",
    explicit: [
      "Replacement of an elevated timber deck about 5.2 m by 3.1 m and about 1.2 m above ground.",
      "Existing hardwood decking and framing removed.",
      "New hardwood decking, framing where required, fascia or face boards, and one step.",
      "No balustrade.",
      "Narrow side access.",
      "Demolition waste carried about 25–30 m.",
    ],
    mustNotInvent: [
      "Pile retention is conditional on inspection. Do not record the piles as retained or replaced.",
      "Do not replace the requested fascia length with an exposed-perimeter fallback.",
    ],
    unresolved: [
      "Which existing piles are sound.",
      "The exact carry distance inside 25–30 m.",
    ],
  },
  {
    id: "laminate-flooring",
    explicit: [
      "30 m² of laminate in a 6 m by 5 m room.",
      "Bare, clean, dry concrete ready for installation.",
      "Underlay and 10% waste requested.",
      "Skirting, floor preparation, demolition, and disposal excluded.",
      "Normal weekday access at ground level.",
    ],
    mustNotInvent: [
      "Laminate stays recognised and unpriced. Do not invent a laminate rate.",
    ],
    unresolved: [
      "A supported laminate recipe is outside this slice.",
    ],
  },
  {
    id: "low-deck",
    explicit: [
      "Rectangular platform 4,800 mm by 3,600 mm.",
      "Finished height 450 mm.",
      "90 mm boards with a 5 mm gap.",
      "Substructure, fixings, and 10% waste on the boards requested.",
      "Stairs, balustrades, demolition, and painting excluded.",
    ],
    mustNotInvent: [
      "Do not invent the board material or other specifications the brief does not state.",
    ],
    unresolved: [
      "Missing specifications that materially affect the estimate must be asked.",
    ],
  },
  {
    id: "conflicting-flooring-area",
    explicit: [
      "Vinyl flooring.",
      "Room dimensions 5 m by 4 m, which measure 20 m².",
      "A separately stated area of 32 m².",
      "10% material waste requested.",
    ],
    mustNotInvent: [
      "Do not silently choose 20 m² or 32 m².",
    ],
    unresolved: [
      "The measured area and the stated area must stay a visible conflict until the builder resolves it.",
    ],
  },
  {
    id: "bathroom-renovation",
    explicit: [
      "Floor 2.4 by 2.1 and height 2.4.",
      "Remove the existing vanity, shower, toilet, and vinyl.",
      "New shower and toilet in the same positions. Vanity width 900.",
      "Tile the floor. Paint the walls and ceiling.",
      "Plumber and electrician charges excluded.",
      "Customer supplies the vanity, toilet, shower, and tiles. The builder supplies the other materials.",
      "Upstairs occupied house, with stair protection and daily clean-up.",
    ],
    mustNotInvent: [
      "Do not invent the area of damaged wall lining.",
    ],
    unresolved: [
      "How much wall lining is damaged is unknown and must be asked.",
    ],
  },
];
