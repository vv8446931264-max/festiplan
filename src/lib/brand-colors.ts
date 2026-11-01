/**
 * Brand colours for places CSS cannot reach (image routes, manifest, the WebGL sky); each one
 * mirrors a token in `globals.css`. This file imports nothing and reads no environment, so the
 * browser-only `src/three` code and the poster harness can use it as freely as the server.
 */
export const BRAND_COLORS = {
  espresso: "#100904",
  night: "#1a0f08",
  cream: "#ffedd7",
  muted: "#bbac97",
  gold: "#ffbf02",
  ember: "#dc5000",
  emberDeep: "#b54200",
  magenta: "#cd197d",
  plum: "#8c019c",
} as const;
