import {
  Color,
  CustomBlending,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  OneFactor,
  PlaneGeometry,
  ShaderMaterial,
  ZeroFactor,
  type Vector3,
} from "three";

/*
 * Why sprites instead of UnrealBloomPass: the canvas is transparent over a CSS
 * sky, and a bloom composer works in opaque render targets — its glow either
 * loses the alpha channel (black sky) or vanishes where alpha is 0. It would
 * also add ~20 KB gzip (EffectComposer, passes, shaders) and a full-screen mip
 * blur chain every frame at 1.75 DPR. Camera-facing additive quads give the
 * same warm halo, plus depth-of-field bokeh discs, in one draw call and a few
 * hundred fragments per light.
 */

const vertexShader = /* glsl */ `
attribute float aSharp;
varying vec2 vUv;
varying vec3 vTint;
varying float vSharp;
void main() {
  vUv = uv;
  vTint = instanceColor;
  vSharp = aSharp;
  vec4 mv = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
  mv.xy += position.xy * length(instanceMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;
varying float vSharp;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 >= 1.0) discard;
  float r = sqrt(r2);
  float halo = exp(-r2 * 5.5) * 0.55 + exp(-r2 * 30.0) * 0.3;
  float disc = smoothstep(1.0, 0.8, r) * (0.6 + 0.4 * smoothstep(0.45, 0.9, r));
  float a = mix(disc * 0.38, halo, vSharp) * (1.0 - r2);
  gl_FragColor = vec4(vTint * a, 0.0);
  #include <colorspace_fragment>
}`;

/** One instanced system of soft additive lights. */
export type GlowSprites = {
  mesh: InstancedMesh;
  /** Place light `i`: world centre, world diameter, linear colour × intensity, sharpness 0 (bokeh) … 1 (halo). */
  set(i: number, centre: Vector3, size: number, color: Color, sharpness: number): void;
  /** Upload this frame's changes. */
  commit(): void;
  dispose(): void;
};

/** Premultiplied additive blending that leaves destination alpha untouched. */
function glowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  });
}

/**
 * `count` camera-facing quads with a radial falloff shader and premultiplied
 * additive blending (alpha untouched, so the CSS sky shows through). Never
 * depth-tested: they are light, not matter, and draw after the glass.
 */
export function createGlowSprites(count: number): GlowSprites {
  const geometry = new PlaneGeometry(1, 1);
  const sharp = new InstancedBufferAttribute(new Float32Array(count), 1);
  sharp.setUsage(DynamicDrawUsage);
  geometry.setAttribute("aSharp", sharp);
  const material = glowMaterial();
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  const black = new Color(0, 0, 0);
  for (let i = 0; i < count; i++) mesh.setColorAt(i, black);
  mesh.instanceColor?.setUsage(DynamicDrawUsage);
  const m = new Matrix4();
  return {
    mesh,
    set(i, centre, size, color, sharpness) {
      mesh.setMatrixAt(i, m.makeScale(size, size, size).setPosition(centre));
      mesh.setColorAt(i, color);
      sharp.setX(i, sharpness);
    },
    commit() {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      sharp.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}
