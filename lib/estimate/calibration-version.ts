/** Bump when outdoor/scope calibration changes affect questions or calculations. */
export const CURRENT_CALIBRATION_VERSION = "internal-1.0";

export function isCalibrationVersionCurrent(
  version: string | null | undefined
): boolean {
  return version === CURRENT_CALIBRATION_VERSION;
}

export function needsCalibrationRefresh(
  version: string | null | undefined
): boolean {
  return !isCalibrationVersionCurrent(version);
}
