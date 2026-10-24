import { Color, Mesh, PlaneGeometry, ShaderMaterial, type WebGLRenderer } from "three";
import { DUSK_STOPS, ESPRESSO } from "./dusk";

/*
 * Glass needs something to refract. The visible sky is CSS, so the canvas is
 * empty behind the lanterns, and three's transmission pass would sample a
 * half-transparent white clear colour (milky glass). This full-screen quad paints
 * the same dusk ramp as the DOM — but only into the transmission render target:
 * in the main pass its draw range is zero, so it costs nothing on screen.
 */

const STOPS = DUSK_STOPS.length;

const vertexShader = /* glsl */ `
varying float vY;
void main() {
  vY = 1.0 - (position.y * 0.5 + 0.5);
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColors[${STOPS}];
uniform float uStops[${STOPS}];
uniform vec3 uEspresso;
uniform float uFade;
varying float vY;
void main() {
  vec3 c = uColors[0];
  for (int i = 1; i < ${STOPS}; i++) {
    float t = clamp((vY - uStops[i - 1]) / (uStops[i] - uStops[i - 1]), 0.0, 1.0);
    c = vY >= uStops[i - 1] ? mix(uColors[i - 1], uColors[i], t) : c;
  }
  gl_FragColor = vec4(mix(uEspresso, c, uFade), 1.0);
}`;

/** The quad plus a setter for the scroll fade (same curve as the CSS layer). */
export type RefractionSky = { mesh: Mesh; setFade(f: number): void; dispose(): void };

/** Build the transmission-only sky quad. */
export function createRefractionSky(): RefractionSky {
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uColors: { value: DUSK_STOPS.map((s) => new Color(s.color)) },
      uStops: { value: DUSK_STOPS.map((s) => s.at) },
      uEspresso: { value: new Color(ESPRESSO) },
      uFade: { value: 1 },
    },
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  mesh.onBeforeRender = (renderer: WebGLRenderer) => {
    geometry.setDrawRange(0, renderer.getRenderTarget() === null ? 0 : Infinity);
  };
  return {
    mesh,
    setFade(f) {
      material.uniforms.uFade.value = f;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
