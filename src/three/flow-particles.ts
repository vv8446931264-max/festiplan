import { Color, DynamicDrawUsage, IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, type Texture } from "three";
import {
  assignParticles,
  createParticleState,
  emptyAssignment,
  hash01,
  isSettled,
  stepParticles,
  targetsFor,
  type ColumnLayout,
  type ParticleAssignment,
  type ParticleState,
} from "@/lib/engine/particles";

/** Spring feel: soft enough to read as a flow, `lift` makes movers arc over the glass. */
const SPRING = { stiffness: 24, lift: 7 } as const;

/** The rupee particles: one InstancedMesh driven by the pure engine in particles.ts. */
export type FlowParticles = {
  mesh: InstancedMesh;
  /** New counts per column (same column order as `colors`); only the delta moves. */
  assign(counts: readonly number[], layout: ColumnLayout, colors: readonly string[]): void;
  /** Re-key the current assignment when the category list changes. */
  remap(from: readonly string[], to: readonly string[]): void;
  /** Brightness per column: 1 normal, > 1 highlighted, < 1 dimmed. */
  setLevels(levels: readonly number[]): void;
  /** Integrate one frame; returns true while anything still moves. */
  update(dt: number, size: number): boolean;
  dispose(): void;
};

/** Translate column indices when the category list changes order or length. */
export function remapColumns(prev: ParticleAssignment, from: readonly string[], to: readonly string[]): ParticleAssignment {
  const index = from.map((key) => to.indexOf(key));
  const column = prev.column.map((c) => (c >= 0 && c < index.length ? index[c] : -1));
  return { column: Int16Array.from(column), slot: prev.slot, counts: to.map(() => 0) };
}

function particleMaterial(envMap: Texture): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ roughness: 0.32, metalness: 0.2, envMap, envMapIntensity: 1.2 });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * 0.38;",
    );
  };
  material.customProgramCacheKey = () => "festiplan-rupee";
  return material;
}

type Rig = {
  n: number;
  mesh: InstancedMesh;
  assignment: ParticleAssignment;
  targets: Float32Array;
  state: ParticleState;
  tint: { current: Float32Array; target: Float32Array };
  palette: Color[];
  levels: readonly number[];
};

const tmp = new Color();

/** Particle colour targets: its column's category colour times that column's level. */
function retint(rig: Rig): void {
  for (let i = 0; i < rig.n; i++) {
    const col = rig.assignment.column[i];
    tmp.copy(rig.palette[col] ?? tmp.setRGB(0, 0, 0)).multiplyScalar(rig.levels[col] ?? 1).toArray(rig.tint.target, i * 3);
  }
}

/** Write instance matrices (scale + translation only) and eased colours; true while colours move. */
function writeInstances(rig: Rig, dt: number, size: number): boolean {
  const { mesh, state, tint } = rig;
  const k = 1 - Math.exp(-8 * dt);
  const arr = mesh.instanceMatrix.array;
  let tinting = false;
  for (let i = 0, o = 0, b = 0; i < rig.n; i++, o += 3, b += 16) {
    arr[b] = arr[b + 5] = arr[b + 10] = rig.assignment.column[i] < 0 ? 0 : size;
    arr[b + 12] = state.pos[o];
    arr[b + 13] = state.pos[o + 1];
    arr[b + 14] = state.pos[o + 2];
    for (let j = o; j < o + 3; j++) {
      const d = tint.target[j] - tint.current[j];
      tint.current[j] += d * k;
      tinting ||= Math.abs(d) > 1e-3;
    }
    mesh.setColorAt(i, tmp.fromArray(tint.current, o));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return tinting;
}

function createRig(n: number, envMap: Texture): Rig {
  const mesh = new InstancedMesh(new IcosahedronGeometry(1, 1), particleMaterial(envMap), n);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  const state = createParticleState(n);
  for (let i = 0; i < n; i++) {
    state.pos.set([(hash01(i) - 0.5) * 9, 7 + hash01(i + 5e4) * 4, (hash01(i + 9e4) - 0.5) * 2], i * 3);
  }
  const tint = { current: new Float32Array(n * 3), target: new Float32Array(n * 3) };
  return { n, mesh, assignment: emptyAssignment(n), targets: new Float32Array(n * 3), state, tint, palette: [], levels: [] };
}

/** Build `n` particles that start high above the columns and pour in. */
export function createFlowParticles(n: number, envMap: Texture): FlowParticles {
  const rig = createRig(n, envMap);
  return {
    mesh: rig.mesh,
    assign(counts, layout, colors) {
      rig.palette = colors.map((hex) => new Color(hex));
      rig.assignment = assignParticles(rig.assignment, counts);
      rig.targets = targetsFor(rig.assignment, layout, rig.targets);
      retint(rig);
    },
    remap(from, to) {
      rig.assignment = remapColumns(rig.assignment, from, to);
    },
    setLevels(next) {
      rig.levels = next;
      retint(rig);
    },
    update(dt, size) {
      stepParticles(rig.state, rig.targets, dt, SPRING);
      const tinting = writeInstances(rig, dt, size);
      return tinting || !isSettled(rig.state, rig.targets, 2e-3);
    },
    dispose() {
      rig.mesh.geometry.dispose();
      (rig.mesh.material as MeshStandardMaterial).dispose();
      rig.mesh.dispose();
    },
  };
}
