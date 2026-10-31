/**
 * Small DOM helpers shared by the WebGL islands. No three.js, no React — they
 * only decide *when* a scene loads, runs, pauses and resizes.
 */

/** Observer constructors live on the window but are not declared on the Window type. */
type ObserverWindow = Window & {
  IntersectionObserver?: typeof IntersectionObserver;
  ResizeObserver?: typeof ResizeObserver;
};

/** Run `fn` once the main thread is idle (after first paint); returns a cancel function. */
export function whenIdle(win: Window, fn: () => void, timeout = 2500): () => void {
  if (typeof win.requestIdleCallback === "function") {
    const id = win.requestIdleCallback(() => fn(), { timeout });
    return () => win.cancelIdleCallback(id);
  }
  const id = win.setTimeout(fn, 200);
  return () => win.clearTimeout(id);
}

/** Schedule `fn` for the next animation frame (setTimeout where rAF is missing). */
export function nextFrame(win: Window, fn: () => void): () => void {
  if (typeof win.requestAnimationFrame === "function") {
    const id = win.requestAnimationFrame(() => fn());
    return () => win.cancelAnimationFrame(id);
  }
  const id = win.setTimeout(fn, 16);
  return () => win.clearTimeout(id);
}

/** Document scroll progress 0..1 (0 when the page does not scroll). */
export function scrollProgress(win: Window): number {
  const max = win.document.documentElement.scrollHeight - win.innerHeight;
  return max > 0 ? Math.min(Math.max(win.scrollY / max, 0), 1) : 0;
}

/**
 * Report whether `el` should be animating: the tab is visible and the element
 * intersects the viewport. Calls `onChange` on every flip; returns a cleanup.
 * Without IntersectionObserver the element counts as visible.
 */
export function observeActivity(
  el: Element,
  win: Window,
  onChange: (active: boolean) => void,
  rootMargin = "0px",
): () => void {
  const doc = win.document;
  const IO = (win as ObserverWindow).IntersectionObserver;
  let intersecting = typeof IO !== "function";
  let active: boolean | null = null;
  const emit = () => {
    const next = intersecting && doc.visibilityState !== "hidden";
    if (next !== active) {
      active = next;
      onChange(next);
    }
  };
  const onEntries = (entries: IntersectionObserverEntry[]) => {
    intersecting = entries.some((e) => e.isIntersecting);
    emit();
  };
  const io = typeof IO === "function" ? new IO(onEntries, { rootMargin }) : null;
  io?.observe(el);
  doc.addEventListener("visibilitychange", emit);
  if (!io) emit();
  return () => {
    io?.disconnect();
    doc.removeEventListener("visibilitychange", emit);
  };
}

/** Call `onSize(width, height)` now and whenever `el` resizes; returns a cleanup. */
export function observeSize(
  el: HTMLElement,
  win: Window,
  onSize: (w: number, h: number) => void,
): () => void {
  const report = () => onSize(el.clientWidth, el.clientHeight);
  report();
  const RO = (win as ObserverWindow).ResizeObserver;
  if (typeof RO === "function") {
    const ro = new RO(report);
    ro.observe(el);
    return () => ro.disconnect();
  }
  win.addEventListener("resize", report);
  return () => win.removeEventListener("resize", report);
}

/** A canvas for a scene: decorative, absolutely filling its parent, fading in on first frame. */
export function createSceneCanvas(doc: Document): HTMLCanvasElement {
  const canvas = doc.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("role", "presentation");
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    display: "block",
    // Fades in on the first frame (--lantern-on) and dims with scroll (--lantern-dim).
    opacity: "calc(var(--lantern-on, 0) * var(--lantern-dim, 1))",
    transition: "opacity 1.2s cubic-bezier(.2,.7,.2,1)",
  });
  return canvas;
}
