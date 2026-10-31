import {
  Color,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type MeshBasicMaterial,
  type Texture,
} from "three";
import { createGlowSprites, type GlowSprites } from "./glow";
import {
  createBodyMaterial,
  createCoreGeometry,
  createCoreMaterial,
  createLanternGeometry,
  type GlowUniform,
} from "./lantern-assets";
import { emptyPose, poseFor, type FrameInput, type Light } from "./lantern-layout";
import type { Tints } from "./lantern-tints";
import { smoothstep } from "./math";
import type { Tier } from "./tier";

/** Candle flicker: two incommensurate sines on top of full brightness. */
const FLICKER = {
  slow: { amplitude: 0.07, speed: 7.3, phaseScale: 5 },
  fast: { amplitude: 0.04, speed: 12.9, phaseScale: 1 },
} as const;
/** Halo diameter relative to the light's size: lanterns throw a slightly bigger halo than orbs. */
const HALO_SCALE = { lantern: 2.3, orb: 2 } as const;
/** The sharp lantern body fades out while the bokeh spread grows across this range. */
const BODY_FADE_SPREAD = { start: 0.45, end: 1.05 } as const;
/** Atmospheric haze: lantern glow beyond `start` units away loses `rate` per unit. */
const HAZE = { start: 14, rate: 0.045 } as const;
/** Glow strength of a lantern's halo and of a bodiless orb. */
const GLOW_STRENGTH = { lantern: 0.6, orb: 0.34 } as const;
/** How fast glow dims as its disc spreads (energy spreading out, softened). */
const SPREAD_DIMMING = 0.6;

/** The three instanced systems (glass bodies, cores, glow sprites) and what they own. */
export type LanternSystems = {
  bodies: InstancedMesh;
  cores: InstancedMesh;
  glow: GlowSprites;
  coreMaterial: MeshBasicMaterial;
  owned: { dispose(): void }[];
};

/** Instanced meshes for `lanterns` bodies and cores plus `lights` glow sprites. */
export function buildSystems(
  tier: Exclude<Tier, "off">,
  envMap: Texture,
  lights: number,
  lanterns: number,
  glowUniform: GlowUniform,
): LanternSystems {
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
  return {
    bodies,
    cores,
    glow,
    coreMaterial,
    owned: [bodyGeometry, coreGeometry, bodyMaterial, coreMaterial, bodies, cores, glow],
  };
}

/** Flag this frame's instance data for upload. */
export function commitInstances(systems: LanternSystems): void {
  for (const mesh of [systems.bodies, systems.cores]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  systems.glow.commit();
}

const scratch = {
  pose: emptyPose(),
  matrix: new Matrix4(),
  position: new Vector3(),
  quaternion: new Quaternion(),
  euler: new Euler(),
  scale: new Vector3(),
  color: new Color(),
};

function flickerAt(time: number, phase: number): number {
  const { slow, fast } = FLICKER;
  return (
    1 +
    slow.amplitude * Math.sin(time * slow.speed + phase * slow.phaseScale) +
    fast.amplitude * Math.sin(time * fast.speed + phase * fast.phaseScale)
  );
}

/** Pose one light: body + core instances (lanterns only) and its glow sprite. */
export function drawLight(
  light: Light,
  index: number,
  frame: FrameInput,
  level: number,
  systems: LanternSystems,
  tints: Tints,
): void {
  const { pose, matrix, position, quaternion, euler, scale, color } = scratch;
  poseFor(light, frame, pose);
  position.set(pose.x, pose.y, pose.z);
  const flicker = flickerAt(frame.time, light.phase);
  // Glow diameter in screen space: the light's own halo plus its circle of
  // confusion; the wider the disc, the dimmer (energy spreads out), and once
  // the disc outgrows the lantern the sharp body fades — bokeh, not a target.
  const halfHeight = -pose.z * frame.tanHalf;
  const ownSize = ((light.body ? HALO_SCALE.lantern : HALO_SCALE.orb) * light.size) / halfHeight;
  const blurSize = 2 * pose.blur;
  const spread = blurSize / (ownSize + 1e-4);
  if (light.body) {
    const fade = 1 - smoothstep(BODY_FADE_SPREAD.start, BODY_FADE_SPREAD.end, spread);
    const solid = pose.scale * fade;
    quaternion.setFromEuler(euler.set(pose.rx, pose.ry, pose.rz));
    systems.bodies.setMatrixAt(index, matrix.compose(position, quaternion, scale.setScalar(solid)));
    systems.bodies.setColorAt(index, color.fromArray(tints.body, index * 3));
    const coreScale = scale.setScalar(solid * flicker);
    systems.cores.setMatrixAt(index, matrix.compose(position, quaternion, coreScale));
    systems.cores.setColorAt(index, color.fromArray(tints.core, index * 3));
  }
  const haze = 1 / (1 + Math.max(-pose.z - HAZE.start, 0) * HAZE.rate);
  const baseStrength = light.body ? GLOW_STRENGTH.lantern * haze : GLOW_STRENGTH.orb;
  const strength = baseStrength * level * pose.fade * flicker;
  const dimming = 1 + spread * spread * SPREAD_DIMMING;
  color.fromArray(tints.glow, index * 3).multiplyScalar(strength / dimming);
  const diameter = (ownSize + blurSize) * halfHeight;
  systems.glow.set(index, position, diameter, color, 1 - Math.min(spread, 1));
}
