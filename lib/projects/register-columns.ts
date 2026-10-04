/**
 * One desktop column definition for the Projects register.
 * The header row and every project row must use this class so the columns
 * cannot drift. Project is the only flexible column. Stage fits "Estimate
 * ready". Updated stays on one line. Next fits "Prepare final pricing"
 * without truncation. The last column is the overflow control.
 */
export const PROJECT_REGISTER_GRID =
  "grid grid-cols-[minmax(0,1fr)_8.5rem_6.75rem_minmax(13rem,15rem)_2.75rem] items-center gap-x-3";
