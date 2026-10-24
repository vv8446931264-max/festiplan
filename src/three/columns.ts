import {
  Color,
  CustomBlending,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
} from "three";
import { damp } from "./math";

const vertexShader = /* glsl */ `
attribute float aGlow;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vTint;
varying float vGlow;
varying float vY;
void main() {
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vView = cameraPosition - world.xyz;
  vTint = instanceColor;
  vGlow = aGlow;
  vY = position.y;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const fragmentShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vTint;
varying float vGlow;
varying float vY;
void main() {
  float facing = abs(dot(normalize(vNormal), normalize(vView)));
  float rim = pow(1.0 - facing, 2.2);
  float lip = smoothstep(0.92, 1.0, vY);
  float glow = max(vGlow, 0.0);
  float a = clamp(0.045 + 0.02 * vGlow + rim * (0.42 + 0.3 * vGlow) + lip * (0.22 + 0.2 * glow), 0.0, 1.0);
  vec3 col = vTint * (0.5 + 1.0 * rim + 0.5 * glow) + lip * 0.15;
  gl_FragColor = vec4(col * a, a);
  #include <colorspace_fragment>
}`;

/** Translucent glass columns, one instance per category. */
export type GlassColumns = {
  mesh: InstancedMesh;
  /** Set column count, x positions, radius and colours (sRGB hex). */
  configure(xs: readonly number[], radius: number, colors: readonly string[]): void;
  /** Target height of column `i` (world units). */
  setHeight(i: number, height: number): void;
  /** 1 = highlighted, 0 = normal, negative dims. */
  setGlow(i: number, glow: number): void;
  /** Damp heights and glows; returns true while anything is still moving. */
  update(dt: number): boolean;
  dispose(): void;
};

const MAX_COLUMNS = 16;
const MIN_HEIGHT = 0.12;

function columnMesh(): { mesh: InstancedMesh; glowAttr: InstancedBufferAttribute } {
  const geometry = new CylinderGeometry(1, 1, 1, 48, 1, false).translate(0, 0.5, 0);
  const glowAttr = new InstancedBufferAttribute(new Float32Array(MAX_COLUMNS), 1);
  glowAttr.setUsage(DynamicDrawUsage);
  geometry.setAttribute("aGlow", glowAttr);
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
  });
  const mesh = new InstancedMesh(geometry, material, MAX_COLUMNS);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.renderOrder = 5;
  const white = new Color(1, 1, 1);
  for (let i = 0; i < MAX_COLUMNS; i++) mesh.setColorAt(i, white);
  mesh.count = 0;
  return { mesh, glowAttr };
}

type ColumnState = { xs: number[]; radius: number; height: Float32Array; glow: Float32Array };

const scratch = new Matrix4();

function writeColumns(mesh: InstancedMesh, glowAttr: InstancedBufferAttribute, state: ColumnState): void {
  state.xs.forEach((x, i) => {
    mesh.setMatrixAt(i, scratch.makeScale(state.radius, Math.max(state.height[i], MIN_HEIGHT), state.radius).setPosition(x, 0, 0));
    glowAttr.setX(i, state.glow[i]);
  });
  mesh.instanceMatrix.needsUpdate = true;
  glowAttr.needsUpdate = true;
  mesh.boundingSphere = null;
}

/**
 * Fresnel-rim glass cylinders as a single InstancedMesh with a tiny custom
 * shader (premultiplied alpha, double-sided so the back wall shows through the
 * front one). Heights and highlight glow ease toward their targets.
 */
export function createGlassColumns(): GlassColumns {
  const { mesh, glowAttr } = columnMesh();
  const state: ColumnState = { xs: [], radius: 0.5, height: new Float32Array(MAX_COLUMNS), glow: new Float32Array(MAX_COLUMNS) };
  const target = { height: new Float32Array(MAX_COLUMNS), glow: new Float32Array(MAX_COLUMNS) };
  const c = new Color();
  const write = () => writeColumns(mesh, glowAttr, state);
  const settle = (dt: number, i: number) => {
    state.height[i] = damp(state.height[i], target.height[i], 6, dt);
    state.glow[i] = damp(state.glow[i], target.glow[i], 9, dt);
    return Math.abs(state.height[i] - target.height[i]) > 1e-3 || Math.abs(state.glow[i] - target.glow[i]) > 1e-3;
  };
  return {
    mesh,
    configure(xs, radius, colors) {
      state.xs = xs.slice(0, MAX_COLUMNS);
      state.radius = radius;
      mesh.count = state.xs.length;
      colors.slice(0, MAX_COLUMNS).forEach((hex, i) => mesh.setColorAt(i, c.set(hex)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      write();
    },
    setHeight: (i, h) => void (target.height[i] = h),
    setGlow: (i, g) => void (target.glow[i] = g),
    update(dt) {
      const moving = state.xs.map((_, i) => settle(dt, i)).some(Boolean);
      write();
      return moving;
    },
    dispose() {
      mesh.geometry.dispose();
      (mesh.material as ShaderMaterial).dispose();
      mesh.dispose();
    },
  };
}
