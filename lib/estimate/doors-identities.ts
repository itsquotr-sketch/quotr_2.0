/**
 * DOORS-03 — canonical Door Set component identities.
 *
 * Physical material keys and labour-operation identities only.
 * No COST rates, productivity hour values, or legacy lump aliases.
 */

/** Prehung hollow-core internal door set (leaf + jamb + stops + hinges). */
export const DOORS_PREHUNG_HOLLOW_CORE_SET_KEY =
  "door.set.internal.prehung.hollow_core.each" as const;
/** Prehung solid-core internal door set (leaf + jamb + stops + hinges). */
export const DOORS_PREHUNG_SOLID_CORE_SET_KEY =
  "door.set.internal.prehung.solid_core.each" as const;
/** Replacement hollow-core internal door leaf (frame retained). */
export const DOORS_LEAF_HOLLOW_CORE_KEY =
  "door.leaf.internal.hollow_core.each" as const;
/** Replacement solid-core internal door leaf (frame retained). */
export const DOORS_LEAF_SOLID_CORE_KEY =
  "door.leaf.internal.solid_core.each" as const;
/** Standard internal latch/lever hardware set. */
export const DOORS_HARDWARE_STANDARD_KEY =
  "door.hardware.internal.standard.set" as const;

/** Quotr V1 benchmark direct COST, ex GST. Not sell, not installed package. */
export const DOORS_LEAF_HOLLOW_CORE_COST_EX_GST = 80 as const;
export const DOORS_LEAF_SOLID_CORE_COST_EX_GST = 220 as const;
export const DOORS_PREHUNG_HOLLOW_CORE_SET_COST_EX_GST = 240 as const;
export const DOORS_PREHUNG_SOLID_CORE_SET_COST_EX_GST = 380 as const;
export const DOORS_HARDWARE_STANDARD_COST_EX_GST = 55 as const;

export const DOORS_LEAF_HOLLOW_CORE_LABEL =
  "Hollow-core replacement internal door leaf" as const;
export const DOORS_LEAF_SOLID_CORE_LABEL =
  "Solid-core replacement internal door leaf" as const;
export const DOORS_PREHUNG_HOLLOW_CORE_SET_LABEL =
  "Hollow-core prehung internal door set" as const;
export const DOORS_PREHUNG_SOLID_CORE_SET_LABEL =
  "Solid-core prehung internal door set" as const;
export const DOORS_HARDWARE_STANDARD_LABEL =
  "Standard internal door latch/lever allowance" as const;

export const DOORS_LEAF_HOLLOW_CORE_DESCRIPTION =
  "Quotr benchmark COST $80.00 ex GST / each. Includes one ordinary hollow-core internal door leaf. Excludes frame/jamb, stops, hinges, latch/lever hardware, installation, trimming/making good, painting, and removal/disposal. Same COST for all supported sizes." as const;
export const DOORS_LEAF_SOLID_CORE_DESCRIPTION =
  "Quotr benchmark COST $220.00 ex GST / each. Includes one ordinary solid-core internal door leaf. Excludes frame/jamb, stops, hinges, latch/lever hardware, installation, trimming/making good, painting, and removal/disposal. Same COST for all supported sizes." as const;
export const DOORS_PREHUNG_HOLLOW_CORE_SET_DESCRIPTION =
  "Quotr benchmark COST $240.00 ex GST / each. Includes one ordinary hollow-core internal door leaf, standard timber jamb/frame, door stops, and standard hinges. Excludes latch/lever hardware, architraves, opening formation, structural work, installation labour, stopping/making good, painting, and removal/disposal. Same COST for all supported sizes." as const;
export const DOORS_PREHUNG_SOLID_CORE_SET_DESCRIPTION =
  "Quotr benchmark COST $380.00 ex GST / each. Includes one ordinary solid-core internal door leaf, standard timber jamb/frame, door stops, and standard hinges. Excludes latch/lever hardware, architraves, opening formation, structural work, installation labour, stopping/making good, painting, and removal/disposal. Same COST for all supported sizes." as const;
export const DOORS_HARDWARE_STANDARD_DESCRIPTION =
  "Quotr benchmark COST $55.00 ex GST / set. Ordinary internal-door latch/lever hardware material allowance — not a guaranteed named product. Excludes installation labour, premium/designer hardware, access control, electronic/security hardware, specialist locks, fire/acoustic hardware, door closers, and panic hardware." as const;

export const DOORS_PREHUNG_SET_COMPONENT = "doors.prehung.set" as const;
export const DOORS_REPLACEMENT_LEAF_COMPONENT =
  "doors.replacement.leaf" as const;
export const DOORS_HARDWARE_STANDARD_COMPONENT =
  "doors.hardware.standard" as const;
/** Other/custom leaf — quantity-visible, no ordinary material key. */
export const DOORS_CUSTOM_LEAF_COMPONENT =
  "doors.leaf.custom.unresolved" as const;
export const DOORS_SPECIALIST_COMPONENT =
  "doors.specialist.unsupported" as const;

export const DOORS_PREHUNG_INSTALL_LABOUR = "doors.prehung.install" as const;
export const DOORS_REPLACEMENT_LEAF_INSTALL_LABOUR =
  "doors.replacement_leaf.install" as const;
export const DOORS_HARDWARE_INSTALL_LABOUR = "doors.hardware.install" as const;

/**
 * DOORS-04B — owner-approved Quotr V1 productivity (person-hours).
 * Not labour COST, not sell, not dimension-specific, not material rates.
 */
export const DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY =
  "doors.prehung.install.hours_per_door" as const;
export const DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY =
  "doors.replacement_leaf.install.hours_per_door" as const;
export const DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY =
  "doors.hardware.install.hours_per_set" as const;

export const DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR = 2 as const;
export const DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR = 1.5 as const;
export const DOORS_HARDWARE_INSTALL_HOURS_PER_SET = 0.5 as const;

export const DOORS_PREHUNG_INSTALL_LABEL =
  "Prehung internal door-set installation" as const;
export const DOORS_REPLACEMENT_LEAF_INSTALL_LABEL =
  "Replacement internal door-leaf installation" as const;
export const DOORS_HARDWARE_INSTALL_LABEL =
  "Standard internal door hardware installation" as const;

export const DOORS_PREHUNG_INSTALL_DESCRIPTION =
  "Quotr V1 2.00 person-hours/door. Ordinary labour to position and fix a standard prehung internal door set into a prepared opening, plumb/level/adjust the standard jamb/frame, and complete ordinary final door-set adjustment. Standard hinges are in the prehung material. Excludes forming or resizing the opening, structural framing, architraves, stopping/making good, painting, removal/disposal, difficult access, specialist hardware, fire/acoustic certification, access control, and unusual remedial work. Same hours for all supported sizes and hollow/solid construction. Hours, not dollars." as const;
export const DOORS_REPLACEMENT_LEAF_INSTALL_DESCRIPTION =
  "Quotr V1 1.50 person-hours/door. Ordinary labour to fit one replacement internal door leaf into a retained existing frame/jamb, including normal fitting, hanging, and ordinary adjustment. Excludes frame/jamb replacement, opening alteration, substantial frame repair, architraves, stopping, painting, removal/disposal, and specialist door systems. Same hours for all supported sizes and hollow/solid construction. Hours, not dollars." as const;
export const DOORS_HARDWARE_INSTALL_DESCRIPTION =
  "Quotr V1 0.50 person-hours/set. Ordinary installation of one standard internal latch/lever hardware set. Excludes premium hardware, mortice locks beyond ordinary V1 scope, closers, panic hardware, electronic/security hardware, access control, fire/acoustic hardware, and remedial door/frame work. Not included inside prehung or replacement-leaf hours. Hours, not dollars." as const;

/** Existing carpenter/builder labour COST path — not a Doors-specific $/hour. */
export const DOORS_CARPENTER_LABOUR_RATE_KEY = "labour.carpenter.hour" as const;

export const DOORS_ORDINARY_MATERIAL_KEYS = [
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
  DOORS_PREHUNG_SOLID_CORE_SET_KEY,
  DOORS_LEAF_HOLLOW_CORE_KEY,
  DOORS_LEAF_SOLID_CORE_KEY,
  DOORS_HARDWARE_STANDARD_KEY,
] as const;

export const DOORS_ORDINARY_PRODUCTIVITY_KEYS = [
  DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY,
] as const;

export const DOORS_ORDINARY_LABOUR_COMPONENTS = [
  DOORS_PREHUNG_INSTALL_LABOUR,
  DOORS_REPLACEMENT_LEAF_INSTALL_LABOUR,
  DOORS_HARDWARE_INSTALL_LABOUR,
] as const;

export const DOORS_ORDINARY_MATERIAL_COMPONENTS = [
  DOORS_PREHUNG_SET_COMPONENT,
  DOORS_REPLACEMENT_LEAF_COMPONENT,
  DOORS_HARDWARE_STANDARD_COMPONENT,
] as const;

export function isOrdinaryDoorsMaterialKey(
  key: string | null | undefined
): boolean {
  if (!key) return false;
  return (DOORS_ORDINARY_MATERIAL_KEYS as readonly string[]).includes(key);
}

export function isOrdinaryDoorsLabourComponent(key: string): boolean {
  return (DOORS_ORDINARY_LABOUR_COMPONENTS as readonly string[]).includes(key);
}

export function isHollowOrSolidDoorsMaterialKey(
  key: string | null | undefined
): boolean {
  return (
    key === DOORS_PREHUNG_HOLLOW_CORE_SET_KEY ||
    key === DOORS_PREHUNG_SOLID_CORE_SET_KEY ||
    key === DOORS_LEAF_HOLLOW_CORE_KEY ||
    key === DOORS_LEAF_SOLID_CORE_KEY
  );
}

/**
 * DOORS-07 — ordinary nested V1 is human-QA frozen.
 * Custom/specialist remain intentional Pricing Required.
 * Does not claim every door system.
 */
export const DOORS_V1_HUMAN_QA_FROZEN = true as const;
export const DOORS_V1_COVERAGE_QUOTE_NOTES =
  "Ordinary supported nested Door Sets. Custom/specialist stay Pricing Required with client-safe pending wording. Human-QA frozen — DOORS-07. Future Doors changes require explicit regression updates." as const;
export const DOORS_V1_SUPPORT_NOTES =
  "Ordinary nested Doors V1 is human-QA frozen. Custom/specialist stay Pricing Required. Future Doors changes require explicit regression updates." as const;
