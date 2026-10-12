/**
 * Scroll a heading inside the project workspace.
 * Does not scroll the document or the app shell.
 */
export function nextWorkspaceScrollTop(input: {
  containerScrollTop: number;
  containerTop: number;
  containerHeight: number;
  targetTop: number;
  viewportHeight: number;
  bottomOverlay: number;
  topPadding?: number;
}): number | null {
  const padding = input.topPadding ?? 8;
  const visibleBottom = Math.min(
    input.containerTop + input.containerHeight,
    input.viewportHeight - input.bottomOverlay
  );
  const visibleTop = input.containerTop + padding;
  if (input.targetTop >= visibleTop && input.targetTop <= visibleBottom - 24) {
    return null;
  }
  const delta = input.targetTop - visibleTop;
  return Math.max(0, input.containerScrollTop + delta);
}

export function scrollHeadingWithinWorkspace(node: HTMLElement): void {
  const container = node.closest("[data-workspace-scroll]");
  if (!(container instanceof HTMLElement)) return;
  const nav = document.querySelector("[data-mobile-nav]");
  const navHeight =
    nav instanceof HTMLElement && getComputedStyle(nav).display !== "none"
      ? nav.getBoundingClientRect().height
      : 0;
  const next = nextWorkspaceScrollTop({
    containerScrollTop: container.scrollTop,
    containerTop: container.getBoundingClientRect().top,
    containerHeight: container.clientHeight,
    targetTop: node.getBoundingClientRect().top,
    viewportHeight: window.innerHeight,
    bottomOverlay: navHeight,
  });
  if (next == null || next === container.scrollTop) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  container.scrollTo({ top: next, behavior: reduce ? "auto" : "smooth" });
}
