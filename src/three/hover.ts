import { Raycaster, Vector2, type Camera, type InstancedMesh } from "three";

/** Hover picking over one InstancedMesh; listeners hear the hovered item on change. */
export type HoverPicker<T> = { listen(cb: (item: T | null) => void): () => void; dispose(): void };

/**
 * Raycast pointer moves on `canvas` against `mesh` and map the hit instance to an
 * item with `itemAt` (null for misses and pointer-leave). Only changes are
 * reported, so a highlight is set once per column, not once per mouse move.
 */
export function createHoverPicker<T>(
  canvas: HTMLCanvasElement,
  camera: Camera,
  mesh: InstancedMesh,
  itemAt: (instance: number) => T | null,
): HoverPicker<T> {
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const listeners = new Set<(item: T | null) => void>();
  let current: T | null = null;
  const emit = (next: T | null) => {
    if (next === current) return;
    current = next;
    for (const cb of listeners) cb(next);
  };
  const onMove = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((e.clientY - rect.top) / rect.height) * 2,
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(mesh, false)[0];
    emit(hit?.instanceId === undefined ? null : itemAt(hit.instanceId));
  };
  const onLeave = () => emit(null);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  return {
    listen(cb) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    dispose() {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      listeners.clear();
    },
  };
}
