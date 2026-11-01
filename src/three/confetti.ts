import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Texture,
} from "three";
import { hash01 } from "@/lib/engine/particles";
import type { Tier } from "./tier";

/** Quads per burst (docs/DESIGN.md §6). */
const CONFETTI_COUNT = { high: 1200, low: 400 } as const;
/** Seconds until the burst has fallen away and frees itself. */
const CONFETTI_LIFETIME = 3.2;

const FESTIVE = ["#ffbf02", "#ff7a2e", "#cd197d", "#a23bc4", "#ffedd7", "#e9500e"];
const GRAVITY = -7.5;
const DRAG = 1.35;

/** One burst. `update` returns false once it is over and everything is disposed. */
export type ConfettiBurst = { mesh: InstancedMesh; update(dt: number): boolean; dispose(): void };

type Sim = {
  pos: Float32Array;
  vel: Float32Array;
  axis: Float32Array;
  spin: Float32Array;
  age: number;
};

function seedSim(n: number, origin: Vector3, salt: number): Sim {
  const sim: Sim = {
    pos: new Float32Array(n * 3),
    vel: new Float32Array(n * 3),
    axis: new Float32Array(n * 3),
    spin: new Float32Array(n),
    age: 0,
  };
  const axis = new Vector3();
  for (let i = 0; i < n; i++) {
    const r = (k: number) => hash01(salt + i * 13 + k);
    const side = i % 2 === 0 ? -1 : 1;
    const o = i * 3;
    sim.pos.set(
      [origin.x + side * (3.4 + r(1) * 0.8), origin.y + r(2) * 0.6, origin.z + (r(3) - 0.5) * 2],
      o,
    );
    const speed = 6 + r(4) * 9;
    const dir = new Vector3(-side * (0.15 + r(5) * 0.85), 1, (r(6) - 0.5) * 1.2).normalize();
    sim.vel.set([dir.x * speed, dir.y * speed, dir.z * speed], o);
    axis
      .set(r(7) - 0.5, r(8) - 0.5, r(9) - 0.5)
      .normalize()
      .toArray(sim.axis, o);
    sim.spin[i] = (r(10) - 0.5) * 22;
  }
  return sim;
}

function paint(mesh: InstancedMesh, palette: readonly string[] | null, salt: number): void {
  const colours = palette && palette.length > 0 ? [...palette, "#ffedd7", "#ffbf02"] : FESTIVE;
  const c = new Color();
  for (let i = 0; i < mesh.count; i++) {
    mesh.setColorAt(i, c.set(colours[Math.floor(hash01(salt + i * 7) * colours.length)]));
  }
}

/** Satin foil: env reflections flash as pieces turn, plus a per-piece self-glow so dark palette colours never go muddy. */
function foilMaterial(envMap: Texture): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    side: DoubleSide,
    metalness: 0.35,
    roughness: 0.4,
    envMap,
    envMapIntensity: 1.4,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * 0.45;",
    );
  };
  material.customProgramCacheKey = () => "festiplan-confetti";
  return material;
}

const tmp = {
  m: new Matrix4(),
  q: new Quaternion(),
  p: new Vector3(),
  a: new Vector3(),
  s: new Vector3(),
};

/** Integrate one step: flutter, gravity, exponential drag, spin; shrink out at the end. */
function advance(sim: Sim, mesh: InstancedMesh, dt: number): void {
  const { m, q, p, a, s } = tmp;
  sim.age += dt;
  const shrink = Math.min(Math.max((CONFETTI_LIFETIME - sim.age) / 0.7, 0), 1);
  const drag = Math.exp(-DRAG * dt);
  for (let i = 0, o = 0; i < mesh.count; i++, o += 3) {
    sim.vel[o] = (sim.vel[o] + Math.sin(sim.age * 6 + i) * 1.4 * dt) * drag;
    sim.vel[o + 1] = (sim.vel[o + 1] + GRAVITY * dt) * drag;
    sim.vel[o + 2] *= drag;
    p.fromArray(sim.pos, o).addScaledVector(a.fromArray(sim.vel, o), dt).toArray(sim.pos, o);
    q.setFromAxisAngle(a.fromArray(sim.axis, o), sim.spin[i] * sim.age);
    mesh.setMatrixAt(i, m.compose(p, q, s.setScalar(shrink)));
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Fire ~1,200 (≤ 400 on the low tier) paper quads from two cannons left and
 * right of `origin`: gravity, exponential air drag, a flutter sway and per-piece
 * spin. Shrinks out over the last 0.7 s and disposes its GPU resources itself.
 */
export function createConfetti(
  tier: Exclude<Tier, "off">,
  origin: Vector3,
  palette: readonly string[] | null,
  envMap: Texture,
): ConfettiBurst {
  const n = CONFETTI_COUNT[tier];
  const salt = Math.floor(origin.x * 1000) ^ 0x5bd1;
  const geometry = new PlaneGeometry(0.11, 0.19);
  const material =
    tier === "high" ? foilMaterial(envMap) : new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new InstancedMesh(geometry, material, n);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  paint(mesh, palette, salt);
  const sim = seedSim(n, origin, salt);
  let alive = true;
  const dispose = () => {
    if (!alive) return;
    alive = false;
    mesh.removeFromParent();
    geometry.dispose();
    material.dispose();
    mesh.dispose();
  };
  return {
    mesh,
    update(dt) {
      if (!alive) return false;
      advance(sim, mesh, Math.min(dt, 1 / 30));
      if (sim.age < CONFETTI_LIFETIME) return true;
      dispose();
      return false;
    },
    dispose,
  };
}
