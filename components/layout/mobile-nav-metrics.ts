/**
 * Mobile workflow geometry.
 *
 * The opaque navigation bar is 4.5rem and applies the safe-area inset once.
 * The raised New control extends 18px above that bar. 1.25rem of inner padding
 * clears it. 5.75rem is that bar plus the raised-control clearance, and is the
 * page padding used when no workflow surface is docked to the navigation.
 *
 * A fixed workflow surface uses mobileActionDockClass so its bottom edge meets
 * the navigation. Putting 5.75rem on that edge leaves a transparent strip.
 * Sticky actions inside an overflow-hidden stage card use mobileActionFlowClass.
 * A non-zero sticky bottom in that card covers the last card by the same offset.
 *
 * Stacking, low to high:
 * 1. page content
 * 2. workflow action surface (z-30)
 * 3. bottom navigation and raised New control (z-40)
 * 4. dialogs, sheets, and menus
 */
export const MOBILE_NAV_CLEARANCE = "5.75rem";

export const mobileNavPaddingClass =
  "pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0";

export const mobileNavBottomClass =
  "max-md:bottom-[calc(5.75rem+env(safe-area-inset-bottom))]";

/** Fixed workflow surfaces sit on the visual top of the mobile navigation. */
export const mobileActionDockClass =
  "max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]";

/** Clears the raised New control. Safe area stays on the dock offset and the nav. */
export const mobileActionInnerClass = "pt-3 pb-[1.25rem]";

/** Keeps a sticky action after its card instead of covering that card. */
export const mobileActionFlowClass = "max-md:bottom-0";

export const mobileActionSurfaceClass =
  "fixed inset-x-0 z-30 border-t border-border bg-background print:hidden";

/**
 * Extra padding for the tallest fixed pricing bar (total plus two actions),
 * above the shell's nav clearance. The shell already includes the safe area.
 */
export const mobileWorkflowContentPadClass = "pb-[11rem] md:pb-0";

/**
 * Quote and Variation keep a one-row bar until xl.
 * Below md the shell already clears the navigation and its safe area, so the
 * page only adds the rest of the 77px bar. From md the shell padding is gone
 * and the bar sits on the viewport bottom, including the safe area once.
 */
export const mobileQuoteContentPadClass =
  "pb-16 md:pb-[calc(4.75rem+env(safe-area-inset-bottom))] xl:pb-4";

export function isDashboardRoute(pathname: string | null): boolean {
  return pathname === "/app/dashboard";
}

/** Reserved for a dedicated New project screen. No such page exists today. */
export function isNewProjectRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.split("?")[0] ?? pathname;
  return path === "/app/projects/new" || path.startsWith("/app/projects/new/");
}

export function isProjectsRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.split("?")[0] ?? pathname;
  if (isNewProjectRoute(path)) return false;
  return path === "/app/projects" || path.startsWith("/app/projects/");
}

export function isRatesRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.split("?")[0] ?? pathname;
  return path === "/app/rates" || path.startsWith("/app/rates/");
}
