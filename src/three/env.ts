import {
  BackSide,
  BufferAttribute,
  Color,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  type Texture,
  type WebGLRenderer,
} from "three";

/** A prefiltered environment map and the means to free it. */
export type Environment = { texture: Texture; dispose(): void };

/** Sky dome colours by elevation (-1 = nadir, 1 = zenith), linear HDR after setHex. */
const DOME: readonly [number, string, number][] = [
  [-1, "#0c0603", 0.6],
  [-0.15, "#2a1208", 1],
  [0.02, "#ff9a3c", 2.4],
  [0.16, "#e9500e", 1.4],
  [0.38, "#cd197d", 0.9],
  [0.7, "#4b0f7a", 0.7],
  [1, "#1a0846", 0.6],
];

function domeColor(y: number, out: Color): Color {
  for (let i = 1; i < DOME.length; i++) {
    const [y1, hex1, k1] = DOME[i];
    if (y > y1 && i < DOME.length - 1) continue;
    const [y0, hex0, k0] = DOME[i - 1];
    const t = Math.min(Math.max((y - y0) / (y1 - y0), 0), 1);
    const a = new Color(hex0).multiplyScalar(k0);
    return out.copy(a).lerp(new Color(hex1).multiplyScalar(k1), t);
  }
  return out;
}

function buildDome(): Mesh {
  const geometry = new SphereGeometry(10, 48, 24);
  const pos = geometry.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    domeColor(pos.getY(i) / 10, c).toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, side: BackSide }));
}

/** Soft "lantern light" panels: they become the long highlights on the glass. */
function buildPanels(): Mesh[] {
  const spec: [number, number, number, number, number, string, number][] = [
    [-6, 3.5, 4, 5, 1.2, "#ffd29a", 5],
    [6.5, 1.5, -3, 3, 3, "#ffb36b", 3],
    [0, 7, 0, 6, 6, "#ff8fc0", 1.2],
  ];
  return spec.map(([x, y, z, w, h, hex, k]) => {
    const mesh = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({ color: new Color(hex).multiplyScalar(k), side: BackSide }),
    );
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    return mesh;
  });
}

/**
 * Procedural dusk environment, prefiltered with PMREM: a vertex-coloured sky dome
 * (warm horizon, magenta, indigo zenith) plus three warm light panels. No image
 * files; the build scene is freed as soon as the map exists.
 */
export function createDuskEnvironment(renderer: WebGLRenderer): Environment {
  const pmrem = new PMREMGenerator(renderer);
  const scene = new Scene();
  const meshes = [buildDome(), ...buildPanels()];
  scene.add(...meshes);
  const target = pmrem.fromScene(scene, 0.035);
  for (const mesh of meshes) {
    mesh.geometry.dispose();
    (mesh.material as MeshBasicMaterial).dispose();
  }
  pmrem.dispose();
  return { texture: target.texture, dispose: () => target.dispose() };
}
