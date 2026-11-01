import type { InstancedMesh, Texture } from "three";
import type { Mood } from "./bus";
import type { GlowUniform } from "./lantern-assets";
import { placeLights, type FrameInput } from "./lantern-layout";
import { buildSystems, commitInstances, drawLight } from "./lantern-systems";
import { copyTints, createTints, easeTints, toneTargets } from "./lantern-tints";
import { damp } from "./math";
import type { Tier } from "./tier";

/** Instance counts per tier: lanterns (body + core + glow) and glow-only bokeh orbs. */
const LANTERN_COUNTS = {
  high: { lanterns: 120, orbs: 22 },
  low: { lanterns: 50, orbs: 8 },
} as const;

type MoodPace = { speed: number; glow: number; rise: number };

/** Speed, light level and rise rate per mood (docs/DESIGN.md §5). */
const MOODS: Record<Mood, MoodPace> = {
  hero: { speed: 1, glow: 1, rise: 0.05 },
  focus: { speed: 0.3, glow: 0.42, rise: 0.02 },
  plan: { speed: 1.1, glow: 1.08, rise: 0.85 },
};
/** Damping rates (1/s) when the mood changes. */
const MOOD_EASE: MoodPace = { speed: 1.6, glow: 1.8, rise: 1.2 };
/** Core brightness = floor + range × light level, so cores never go fully dark. */
const CORE_LEVEL = { floor: 0.35, range: 0.65 } as const;

/** The lantern field: three instanced systems, one draw call each. */
export type LanternField = {
  meshes: InstancedMesh[];
  update(dt: number, frame: Omit<FrameInput, "time" | "lift">): void;
  setPalette(hexes: readonly string[] | null): void;
  setMood(mood: Mood): void;
  dispose(): void;
};

/** The current (damped) pace, the mood it eases toward, and the accumulated time and lift. */
type Pace = MoodPace & { mood: MoodPace; time: number; lift: number };

/** Ease speed, light level and rise toward the mood, then advance time and lift. */
function advancePace(pace: Pace, dt: number): void {
  pace.speed = damp(pace.speed, pace.mood.speed, MOOD_EASE.speed, dt);
  pace.glow = damp(pace.glow, pace.mood.glow, MOOD_EASE.glow, dt);
  pace.rise = damp(pace.rise, pace.mood.rise, MOOD_EASE.rise, dt);
  pace.time += dt * pace.speed;
  pace.lift += dt * pace.rise;
}

/** Build the field for `tier`, lit by `envMap`. */
export function createLanternField(tier: Exclude<Tier, "off">, envMap: Texture): LanternField {
  const { lanterns, orbs } = LANTERN_COUNTS[tier];
  const lights = placeLights(lanterns, orbs);
  const glowUniform: GlowUniform = { value: 1 };
  const systems = buildSystems(tier, envMap, lights.length, lanterns, glowUniform);
  const target = createTints(lights.length);
  toneTargets(lights, null, target);
  const current = copyTints(target);
  const pace: Pace = { mood: MOODS.hero, ...MOODS.hero, time: 0, lift: 0 };
  return {
    meshes: [systems.cores, systems.bodies, systems.glow.mesh],
    update(dt, frame) {
      advancePace(pace, dt);
      easeTints(current, target, dt);
      glowUniform.value = pace.glow;
      systems.coreMaterial.color.setScalar(CORE_LEVEL.floor + CORE_LEVEL.range * pace.glow);
      const fullFrame: FrameInput = { ...frame, time: pace.time, lift: pace.lift };
      lights.forEach((light, index) => {
        drawLight(light, index, fullFrame, pace.glow, systems, current);
      });
      commitInstances(systems);
    },
    setPalette: (hexes) => toneTargets(lights, hexes, target),
    setMood(mood) {
      pace.mood = MOODS[mood];
    },
    dispose: () => systems.owned.forEach((resource) => resource.dispose()),
  };
}
