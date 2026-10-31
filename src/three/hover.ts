import { Raycaster, Vector2, type Camera, type InstancedMesh } from "three";

/** Hover picking over one InstancedMesh; listeners hear the hovered item on change. */
export type HoverPicker<Item> = {
  listen(listener: (item: Item | null) => void): () => void;
  dispose(): void;
};

/** Writes the pointer position over `canvas` into `out` (-1..1, y up); false if it has no size. */
function toDeviceCoordinates(event: PointerEvent, canvas: HTMLCanvasElement, out: Vector2) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  out.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    1 - ((event.clientY - rect.top) / rect.height) * 2,
  );
  return true;
}

/**
 * Raycast pointer moves on `canvas` against `mesh` and map the hit instance to an
 * item with `itemAt` (null for misses and pointer-leave). Only changes are
 * reported, so a highlight is set once per column, not once per mouse move.
 */
export function createHoverPicker<Item>(
  canvas: HTMLCanvasElement,
  camera: Camera,
  mesh: InstancedMesh,
  itemAt: (instance: number) => Item | null,
): HoverPicker<Item> {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const listeners = new Set<(item: Item | null) => void>();
  let hovered: Item | null = null;
  const emit = (next: Item | null) => {
    if (next === hovered) return;
    hovered = next;
    for (const listener of listeners) listener(next);
  };
  const onMove = (event: PointerEvent) => {
    if (!toDeviceCoordinates(event, canvas, pointer)) return;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(mesh, false).at(0);
    emit(hit?.instanceId === undefined ? null : itemAt(hit.instanceId));
  };
  const onLeave = () => emit(null);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  return {
    listen(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    dispose() {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      listeners.clear();
    },
  };
}
