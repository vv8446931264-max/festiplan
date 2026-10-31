import {
  Color,
  IcosahedronGeometry,
  LatheGeometry,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector2,
  type BufferGeometry,
  type Material,
  type Texture,
} from "three";
import type { Tier } from "./tier";

/** Shared uniform: scene-wide lantern light level (mood dims it). */
export type GlowUniform = { value: number };

const RIBS = 10;

/**
 * Procedural lantern: a lathed barrel (superellipse profile, small flat caps top
 * and bottom, like a kandil or a paper festival lantern) with ten soft lobes
 * pressed into the surface, so env highlights break into vertical ribs.
 * Height 1, waist radius ≈ 0.48.
 */
export function createLanternGeometry(tier: Exclude<Tier, "off">): BufferGeometry {
  const rows = tier === "high" ? 22 : 12;
  const cap = 0.15;
  const profile: Vector2[] = [new Vector2(0, -0.5), new Vector2(cap * 0.8, -0.5)];
  for (let i = 0; i <= rows; i++) {
    const y = -0.5 + i / rows;
    const bulge = Math.pow(1 - Math.pow(Math.abs(y / 0.5), 2.4), 1 / 2.4);
    profile.push(new Vector2(cap + (0.48 - cap) * bulge, y * 0.98));
  }
  profile.push(new Vector2(cap * 0.8, 0.5), new Vector2(0, 0.5));
  const geometry = new LatheGeometry(profile, tier === "high" ? 60 : 30);
  const pos = geometry.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const k = 1 - 0.045 * Math.pow(Math.cos((Math.atan2(z, x) * RIBS) / 2), 2);
    pos.setXYZ(i, x * k, pos.getY(i), z * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** The emissive heart of a lantern; a small low-poly sphere is enough at this size. */
export function createCoreGeometry(): BufferGeometry {
  return new IcosahedronGeometry(0.11, 2);
}

/**
 * Patch a lit material so its emission reads as light scattered inside frosted
 * glass: strongest where the surface faces the camera, falling to a dim rim,
 * tinted per instance and scaled by the shared mood uniform.
 */
function addInnerGlow(material: MeshStandardMaterial, glow: GlowUniform): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glow;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uGlow;")
      .replace(
        "#include <emissivemap_fragment>",
        [
          "#include <emissivemap_fragment>",
          "float facing = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);",
          "totalEmissiveRadiance *= uGlow * vColor.rgb * (0.05 + 0.95 * pow(facing, 3.0));",
        ].join("\n"),
      );
  };
  material.customProgramCacheKey = () => "festiplan-lantern-glow";
}

/**
 * Lantern body material. High tier: physically based glass (transmission, IOR,
 * thin-wall thickness, warm attenuation) that refracts the sky and the cores.
 * Low tier: a cheaper translucent standard material with the same inner glow.
 */
export function createBodyMaterial(
  tier: Exclude<Tier, "off">,
  envMap: Texture,
  glow: GlowUniform,
): MeshStandardMaterial {
  const shared = {
    color: 0xffffff,
    envMap,
    emissive: new Color("#ff9a3a"),
    emissiveIntensity: 0.3,
    metalness: 0,
  };
  const material =
    tier === "high"
      ? new MeshPhysicalMaterial({
          ...shared,
          roughness: 0.1,
          transmission: 1,
          thickness: 0.45,
          ior: 1.45,
          envMapIntensity: 2.2,
          attenuationColor: new Color("#ffc890"),
          attenuationDistance: 2.2,
          specularIntensity: 1,
        })
      : new MeshStandardMaterial({
          ...shared,
          roughness: 0.24,
          envMapIntensity: 0.9,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        });
  addInnerGlow(material, glow);
  return material;
}

/** Unlit, untone-mapped core material; per-instance colour, brightness via `color`. */
export function createCoreMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
}

/** Free a material list (geometries are freed by their owners). */
export function disposeMaterials(materials: readonly Material[]): void {
  for (const m of materials) m.dispose();
}
