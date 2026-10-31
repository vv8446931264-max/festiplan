/**
 * Small DOM helpers shared by the WebGL islands. No three.js, no React — they
 * only decide *when* a scene loads, runs, pauses and resizes.
 */

/** Observer constructors live on the window but are not declared on the Window type. */
type ObserverWindow = Window & {
  IntersectionObserver?: typeof IntersectionObserver;
  ResizeObserver?: typeof ResizeObserver;
};

/** Upper bound before an idle callback runs anyway. */
const IDLE_TIMEOUT_MS = 2500;
/** Stand-in delays where requestIdleCallback / requestAnimationFrame are missing. */
const IDLE_FALLBACK_MS = 200;
const FRAME_FALLBACK_MS = 16;

/** Run `callback` once the main thread is idle (after first paint); returns a cancel function. */
export function whenIdle(win: Window, callback: () => void, timeout = IDLE_TIMEOUT_MS): () => void {
  if (typeof win.requestIdleCallback === "function") {
    const handle = win.requestIdleCallback(() => callback(), { timeout });
    return () => win.cancelIdleCallback(handle);
  }
  const handle = win.setTimeout(callback, IDLE_FALLBACK_MS);
  return () => win.clearTimeout(handle);
}

/** Schedule `callback` for the next animation frame (setTimeout where rAF is missing). */
export function nextFrame(win: Window, callback: () => void): () => void {
  if (typeof win.requestAnimationFrame === "function") {
    const handle = win.requestAnimationFrame(() => callback());
    return () => win.cancelAnimationFrame(handle);
  }
  const handle = win.setTimeout(callback, FRAME_FALLBACK_MS);
  return () => win.clearTimeout(handle);
}

/** Document scroll progress 0..1 (0 when the page does not scroll). */
export function scrollProgress(win: Window): number {
  const scrollable = win.document.documentElement.scrollHeight - win.innerHeight;
  return scrollable > 0 ? Math.min(Math.max(win.scrollY / scrollable, 0), 1) : 0;
}

/**
 * Report whether `element` should be animating: the tab is visible and the element
 * intersects the viewport. Calls `onChange` on every flip; returns a cleanup.
 * Without IntersectionObserver the element counts as visible.
 */
export function observeActivity(
  element: Element,
  win: Window,
  onChange: (active: boolean) => void,
  rootMargin = "0px",
): () => void {
  const doc = win.document;
  const Observer = (win as ObserverWindow).IntersectionObserver;
  let intersecting = typeof Observer !== "function";
  let active: boolean | null = null;
  const emit = () => {
    const next = intersecting && doc.visibilityState !== "hidden";
    if (next === active) return;
    active = next;
    onChange(next);
  };
  const onEntries = (entries: IntersectionObserverEntry[]) => {
    intersecting = entries.some((entry) => entry.isIntersecting);
    emit();
  };
  const observer = typeof Observer === "function" ? new Observer(onEntries, { rootMargin }) : null;
  observer?.observe(element);
  doc.addEventListener("visibilitychange", emit);
  if (!observer) emit();
  return () => {
    observer?.disconnect();
    doc.removeEventListener("visibilitychange", emit);
  };
}

/** Call `onSize(width, height)` now and whenever `element` resizes; returns a cleanup. */
export function observeSize(
  element: HTMLElement,
  win: Window,
  onSize: (width: number, height: number) => void,
): () => void {
  const report = () => onSize(element.clientWidth, element.clientHeight);
  report();
  const Observer = (win as ObserverWindow).ResizeObserver;
  if (typeof Observer === "function") {
    const observer = new Observer(report);
    observer.observe(element);
    return () => observer.disconnect();
  }
  win.addEventListener("resize", report);
  return () => win.removeEventListener("resize", report);
}

/**
 * Append a fresh scene canvas to `host` and build a scene on it. If building throws (no WebGL
 * context, say), the canvas is removed again and the error rethrown.
 */
export function attachSceneCanvas<Scene>(
  host: HTMLElement,
  build: (canvas: HTMLCanvasElement) => Scene,
): { canvas: HTMLCanvasElement; scene: Scene } {
  const canvas = createSceneCanvas(host.ownerDocument);
  host.appendChild(canvas);
  try {
    return { canvas, scene: build(canvas) };
  } catch (error) {
    canvas.remove();
    throw error;
  }
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
