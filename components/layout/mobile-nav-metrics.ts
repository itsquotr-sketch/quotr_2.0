/**
 * Viewport space taken by the 4.5rem mobile bar and the 56px New control,
 * which rises 1rem above that bar.
 */
export const MOBILE_NAV_CLEARANCE = "5.75rem";

export const mobileNavPaddingClass =
  "pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0";

export const mobileNavBottomClass =
  "max-md:bottom-[calc(5.75rem+env(safe-area-inset-bottom))]";

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
