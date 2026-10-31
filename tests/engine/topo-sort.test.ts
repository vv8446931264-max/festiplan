// @vitest-environment node
import { describe, expect, it } from "vitest";
import { topoSort } from "@/lib/engine/timeline";
import { aiTask as task } from "./builders";

const ids = (tasks: { id: string }[] | null): string[] | null =>
  tasks === null ? null : tasks.map((entry) => entry.id);

describe("topoSort", () => {
  it("returns [] for no tasks and keeps independent tasks in order", () => {
    expect(topoSort([])).toEqual([]);
    expect(ids(topoSort([task("a", 1), task("b", 1), task("c", 1)]))).toEqual(["a", "b", "c"]);
  });

  it("puts prerequisites first even when they appear later", () => {
    const tasks = [task("c", 1, 1, ["b"]), task("b", 1, 1, ["a"]), task("a", 1)];
    expect(ids(topoSort(tasks))).toEqual(["a", "b", "c"]);
  });

  it("is stable: the lowest original index goes first among ready tasks", () => {
    const tasks = [task("a", 1, 1, ["d"]), task("b", 1), task("c", 1), task("d", 1)];
    expect(ids(topoSort(tasks))).toEqual(["b", "c", "d", "a"]);
    const diamond = [
      task("d", 1, 1, ["b", "c"]),
      task("c", 1, 1, ["a"]),
      task("b", 1, 1, ["a"]),
      task("a", 1),
    ];
    expect(ids(topoSort(diamond))).toEqual(["a", "c", "b", "d"]);
  });

  it("ignores unknown ids and repeated dependencies", () => {
    expect(
      ids(topoSort([task("a", 1, 1, ["ghost"]), task("b", 1, 1, ["a", "a", "ghost"])])),
    ).toEqual(["a", "b"]);
  });

  it("treats a duplicate id as the first one", () => {
    expect(ids(topoSort([task("a", 1), task("a", 1, 1, ["a"])]))).toEqual(["a", "a"]);
  });

  it("returns null for self-dependencies and cycles", () => {
    expect(topoSort([task("a", 1, 1, ["a"])])).toBeNull();
    expect(topoSort([task("a", 1, 1, ["b"]), task("b", 1, 1, ["a"])])).toBeNull();
    expect(
      topoSort([
        task("ok", 1),
        task("a", 1, 1, ["c"]),
        task("b", 1, 1, ["a"]),
        task("c", 1, 1, ["b"]),
      ]),
    ).toBeNull();
  });
});
