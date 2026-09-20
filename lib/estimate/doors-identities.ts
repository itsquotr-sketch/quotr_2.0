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
 * Future productivity identities. Referenced as operation keys only.
 * DOORS-03 does not register hour values or calculate hours.
 */
export const DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY =
  "doors.prehung.install.hours_per_door" as const;
export const DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY =
  "doors.replacement_leaf.install.hours_per_door" as const;
export const DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY =
  "doors.hardware.install.hours_per_set" as const;

/** Unpriced labour rate identity — not registered as a COST. */
export const DOORS_CARPENTER_LABOUR_RATE_KEY = "doors.carpenter.hour" as const;

export const DOORS_ORDINARY_MATERIAL_KEYS = [
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
  DOORS_PREHUNG_SOLID_CORE_SET_KEY,
  DOORS_LEAF_HOLLOW_CORE_KEY,
  DOORS_LEAF_SOLID_CORE_KEY,
  DOORS_HARDWARE_STANDARD_KEY,
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
