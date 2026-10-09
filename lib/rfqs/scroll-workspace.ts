/** Scroll inside the project workspace, not the document. */
export function scrollWorkspaceTarget(node: HTMLElement, options?: { focus?: boolean }) {
  const scroller = node.closest("[data-workspace-scroll]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
  if (scroller instanceof HTMLElement) {
    const scrollerRect = scroller.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const nav = document.querySelector("[data-mobile-nav]");
    const navHidden = !(nav instanceof HTMLElement) || getComputedStyle(nav).display === "none";
    const navTop = navHidden || !(nav instanceof HTMLElement) ? scrollerRect.bottom : nav.getBoundingClientRect().top;
    const visibleTop = scrollerRect.top;
    const visibleBottom = Math.min(scrollerRect.bottom, navTop);
    const margin = 8;
    const visible = nodeRect.top >= visibleTop + margin && nodeRect.bottom <= visibleBottom - margin;
    if (!visible) {
      const delta = nodeRect.top - visibleTop - margin;
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const next = Math.min(Math.max(0, scroller.scrollTop + delta), max);
      scroller.scrollTo({ top: next, behavior });
    }
  }
  const root = document.scrollingElement;
  if (root && (root.scrollTop !== 0 || root.scrollLeft !== 0)) {
    root.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }
  if (options?.focus) node.focus({ preventScroll: true });
}
