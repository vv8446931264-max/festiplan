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

// Fresnel rim (glass edges catch light), a bright lip at the top, and a faint body;
// `vGlow` brightens a highlighted column and darkens the others (negative).
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
  configure(xPositions: readonly number[], radius: number, colors: readonly string[]): void;
  /** Target height of column `index` (world units). */
  setHeight(index: number, height: number): void;
  /** 1 = highlighted, 0 = normal, negative dims. */
  setGlow(index: number, glow: number): void;
  /** Damp heights and glows; returns true while anything is still moving. */
  update(dt: number): boolean;
  dispose(): void;
};

const MAX_COLUMNS = 16;
/** An empty category still shows a thin glass disc. */
const MIN_HEIGHT = 0.12;
const RADIAL_SEGMENTS = 48;
/** Drawn after the particles so the glass sits in front of the rupees inside it. */
const RENDER_ORDER = 5;
/** Damping rates (1/s): heights ease in calmly, highlights respond quickly. */
const HEIGHT_EASE_RATE = 6;
const GLOW_EASE_RATE = 9;
/** Below this distance from its target a column counts as settled. */
const SETTLE_EPSILON = 1e-3;

type ColumnMesh = {
  mesh: InstancedMesh;
  material: ShaderMaterial;
  glowAttribute: InstancedBufferAttribute;
};

function createColumnMesh(): ColumnMesh {
  const geometry = new CylinderGeometry(1, 1, 1, RADIAL_SEGMENTS, 1, false).translate(0, 0.5, 0);
  const glowAttribute = new InstancedBufferAttribute(new Float32Array(MAX_COLUMNS), 1);
  glowAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("aGlow", glowAttribute);
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
  mesh.renderOrder = RENDER_ORDER;
  const white = new Color(1, 1, 1);
  for (let index = 0; index < MAX_COLUMNS; index++) mesh.setColorAt(index, white);
  mesh.count = 0;
  return { mesh, material, glowAttribute };
}

type ColumnValues = { height: Float32Array; glow: Float32Array };
type ColumnState = ColumnValues & { xPositions: number[]; radius: number };

function createColumnValues(): ColumnValues {
  return { height: new Float32Array(MAX_COLUMNS), glow: new Float32Array(MAX_COLUMNS) };
}

const scratchMatrix = new Matrix4();

function writeColumns({ mesh, glowAttribute }: ColumnMesh, state: ColumnState): void {
  state.xPositions.forEach((x, index) => {
    const height = Math.max(state.height[index], MIN_HEIGHT);
    scratchMatrix.makeScale(state.radius, height, state.radius).setPosition(x, 0, 0);
    mesh.setMatrixAt(index, scratchMatrix);
    glowAttribute.setX(index, state.glow[index]);
  });
  mesh.instanceMatrix.needsUpdate = true;
  glowAttribute.needsUpdate = true;
  mesh.boundingSphere = null;
}

/** Ease column `index` toward its targets; true while it is still moving. */
function settleColumn(state: ColumnValues, target: ColumnValues, dt: number, index: number) {
  state.height[index] = damp(state.height[index], target.height[index], HEIGHT_EASE_RATE, dt);
  state.glow[index] = damp(state.glow[index], target.glow[index], GLOW_EASE_RATE, dt);
  return (
    Math.abs(state.height[index] - target.height[index]) > SETTLE_EPSILON ||
    Math.abs(state.glow[index] - target.glow[index]) > SETTLE_EPSILON
  );
}

/**
 * Fresnel-rim glass cylinders as a single InstancedMesh with a tiny custom
 * shader (premultiplied alpha, double-sided so the back wall shows through the
 * front one). Heights and highlight glow ease toward their targets.
 */
export function createGlassColumns(): GlassColumns {
  const columnMesh = createColumnMesh();
  const { mesh, material } = columnMesh;
  const state: ColumnState = { ...createColumnValues(), xPositions: [], radius: 0.5 };
  const target = createColumnValues();
  const color = new Color();
  return {
    mesh,
    configure(xPositions, radius, colors) {
      state.xPositions = xPositions.slice(0, MAX_COLUMNS);
      state.radius = radius;
      mesh.count = state.xPositions.length;
      colors.slice(0, MAX_COLUMNS).forEach((hex, index) => mesh.setColorAt(index, color.set(hex)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      writeColumns(columnMesh, state);
    },
    setHeight(index, height) {
      target.height[index] = height;
    },
    setGlow(index, glow) {
      target.glow[index] = glow;
    },
    update(dt) {
      const moving = state.xPositions.map((_, index) => settleColumn(state, target, dt, index));
      writeColumns(columnMesh, state);
      return moving.some(Boolean);
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}
