import { Color, DynamicDrawUsage, Euler, InstancedMesh, Matrix4, Quaternion, Vector3, type MeshBasicMaterial, type Texture } from "three";
import type { Mood } from "./bus";
import { createGlowSprites, type GlowSprites } from "./glow";
import { createBodyMaterial, createCoreGeometry, createCoreMaterial, createLanternGeometry, type GlowUniform } from "./lantern-assets";
import { emptyPose, placeLights, poseFor, type FrameInput, type Light } from "./lantern-layout";
import { damp, smoothstep } from "./math";
import type { Tier } from "./tier";

/** Instance counts per tier: lanterns (body + core + glow) and glow-only bokeh orbs. */
export const LANTERN_COUNTS = { high: { lanterns: 120, orbs: 22 }, low: { lanterns: 50, orbs: 8 } } as const;

/** Speed, light level and rise rate per mood (docs/DESIGN.md §5). */
const MOODS: Record<Mood, { speed: number; glow: number; rise: number }> = {
  hero: { speed: 1, glow: 1, rise: 0.05 },
  focus: { speed: 0.3, glow: 0.42, rise: 0.02 },
  plan: { speed: 1.1, glow: 1.08, rise: 0.85 },
};

/** Warm defaults (sRGB): glass tint, core, glow — four tones each. */
const TONES = {
  body: ["#ffe9cf", "#ffdcb3", "#ffd2a4", "#fff3e3"],
  core: ["#fff3da", "#ffe3ad", "#ffd58f", "#fff8ea"],
  glow: ["#ffa24a", "#ffb862", "#ff8c3e", "#ffc874"],
} as const;

/** The lantern field: three instanced systems, one draw call each. */
export type LanternField = {
  meshes: InstancedMesh[];
  update(dt: number, frame: Omit<FrameInput, "time" | "lift">): void;
  setPalette(hexes: readonly string[] | null): void;
  setMood(mood: Mood): void;
  dispose(): void;
};

type Tints = { body: Float32Array; core: Float32Array; glow: Float32Array };

function toneTargets(lights: Light[], palette: readonly string[] | null, out: Tints): void {
  const c = new Color();
  const p = new Color();
  lights.forEach((light, i) => {
    const pick = palette ? p.set(palette[i % palette.length]) : null;
    const set = (key: keyof Tints, hex: string, mix: number) => {
      c.set(hex);
      if (pick) c.lerp(pick, mix);
      c.toArray(out[key], i * 3);
    };
    set("body", TONES.body[light.tone], 0.6);
    set("core", TONES.core[light.tone], 0.22);
    set("glow", TONES.glow[light.tone], 0.55);
  });
}

function makeTints(n: number): Tints {
  return { body: new Float32Array(n * 3), core: new Float32Array(n * 3), glow: new Float32Array(n * 3) };
}

type Systems = { bodies: InstancedMesh; cores: InstancedMesh; glow: GlowSprites; coreMaterial: MeshBasicMaterial; owned: { dispose(): void }[] };

function buildSystems(tier: Exclude<Tier, "off">, envMap: Texture, lights: number, lanterns: number, glowUniform: GlowUniform): Systems {
  const bodyGeometry = createLanternGeometry(tier);
  const coreGeometry = createCoreGeometry();
  const bodyMaterial = createBodyMaterial(tier, envMap, glowUniform);
  const coreMaterial = createCoreMaterial();
  const bodies = new InstancedMesh(bodyGeometry, bodyMaterial, lanterns);
  const cores = new InstancedMesh(coreGeometry, coreMaterial, lanterns);
  for (const mesh of [bodies, cores]) {
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
  }
  const glow = createGlowSprites(lights);
  return { bodies, cores, glow, coreMaterial, owned: [bodyGeometry, coreGeometry, bodyMaterial, coreMaterial, bodies, cores, glow] };
}

type Pace = { mood: (typeof MOODS)[Mood]; speed: number; glow: number; rise: number; time: number; lift: number };

/** Ease speed, light level and rise toward the mood, then advance time and lift. */
function advancePace(p: Pace, dt: number): void {
  p.speed = damp(p.speed, p.mood.speed, 1.6, dt);
  p.glow = damp(p.glow, p.mood.glow, 1.8, dt);
  p.rise = damp(p.rise, p.mood.rise, 1.2, dt);
  p.time += dt * p.speed;
  p.lift += dt * p.rise;
}

function easeTints(current: Tints, target: Tints, dt: number): void {
  const k = 1 - Math.exp(-2.4 * dt);
  for (const key of ["body", "core", "glow"] as const) {
    const cur = current[key];
    const tgt = target[key];
    for (let i = 0; i < cur.length; i++) cur[i] += (tgt[i] - cur[i]) * k;
  }
}

/** Build the field for `tier`, lit by `envMap`. */
export function createLanternField(tier: Exclude<Tier, "off">, envMap: Texture): LanternField {
  const { lanterns, orbs } = LANTERN_COUNTS[tier];
  const lights = placeLights(lanterns, orbs);
  const glowUniform: GlowUniform = { value: 1 };
  const sys = buildSystems(tier, envMap, lights.length, lanterns, glowUniform);
  const target = makeTints(lights.length);
  toneTargets(lights, null, target);
  const current: Tints = { body: target.body.slice(), core: target.core.slice(), glow: target.glow.slice() };
  const pace: Pace = { mood: MOODS.hero, speed: 1, glow: 1, rise: MOODS.hero.rise, time: 0, lift: 0 };
  return {
    meshes: [sys.cores, sys.bodies, sys.glow.mesh],
    update(dt, frame) {
      advancePace(pace, dt);
      easeTints(current, target, dt);
      glowUniform.value = pace.glow;
      sys.coreMaterial.color.setScalar(0.35 + 0.65 * pace.glow);
      const full: FrameInput = { ...frame, time: pace.time, lift: pace.lift };
      lights.forEach((light, i) => drawLight(light, i, full, pace.glow, sys, current));
      for (const mesh of [sys.bodies, sys.cores]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      sys.glow.commit();
    },
    setPalette: (hexes) => toneTargets(lights, hexes, target),
    setMood: (mood) => void (pace.mood = MOODS[mood]),
    dispose: () => sys.owned.forEach((o) => o.dispose()),
  };
}

const tmp = { pose: emptyPose(), m: new Matrix4(), pos: new Vector3(), quat: new Quaternion(), euler: new Euler(), scale: new Vector3(), color: new Color() };

/** Pose one light: body + core instances (lanterns only) and its glow sprite. */
function drawLight(light: Light, i: number, frame: FrameInput, level: number, s: Systems, tints: Tints): void {
  const { pose, m, pos, quat, euler, scale, color } = tmp;
  poseFor(light, frame, pose);
  pos.set(pose.x, pose.y, pose.z);
  const flicker = 1 + 0.07 * Math.sin(frame.time * 7.3 + light.phase * 5) + 0.04 * Math.sin(frame.time * 12.9 + light.phase);
  // Glow diameter in screen space: the light's own halo plus its circle of
  // confusion; the wider the disc, the dimmer (energy spreads out), and once
  // the disc outgrows the lantern the sharp body fades — bokeh, not a target.
  const halfH = -pose.z * frame.tanHalf;
  const own = ((light.body ? 2.3 : 2) * light.size) / halfH;
  const coc = 2 * pose.blur;
  const spread = coc / (own + 1e-4);
  if (light.body) {
    const solid = pose.scale * (1 - smoothstep(0.45, 1.05, spread));
    quat.setFromEuler(euler.set(pose.rx, pose.ry, pose.rz));
    s.bodies.setMatrixAt(i, m.compose(pos, quat, scale.setScalar(solid)));
    s.bodies.setColorAt(i, color.fromArray(tints.body, i * 3));
    s.cores.setMatrixAt(i, m.compose(pos, quat, scale.setScalar(solid * flicker)));
    s.cores.setColorAt(i, color.fromArray(tints.core, i * 3));
  }
  const haze = 1 / (1 + Math.max(-pose.z - 14, 0) * 0.045);
  const strength = (light.body ? 0.6 * haze : 0.34) * level * pose.fade * flicker;
  color.fromArray(tints.glow, i * 3).multiplyScalar(strength / (1 + spread * spread * 0.6));
  s.glow.set(i, pos, (own + coc) * halfH, color, 1 - Math.min(spread, 1));
}
