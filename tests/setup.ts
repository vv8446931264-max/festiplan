import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(async () => {
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
});

// jsdom does not implement scrollIntoView; components call it when tabs and focus change.
if (typeof Element !== "undefined" && !Reflect.has(Element.prototype, "scrollIntoView")) {
  Element.prototype.scrollIntoView = () => undefined;
}
