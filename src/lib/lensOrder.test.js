import { describe, it, expect } from "vitest";
import { orderLensTopics } from "./lensOrder";

const MAX = 8;

describe("orderLensTopics", () => {
  it("uses the lens's own order when nothing is saved", () => {
    expect(orderLensTopics(["a", "b", "c"], null, MAX)).toEqual(["a", "b", "c"]);
    expect(orderLensTopics(["a", "b", "c"], [], MAX)).toEqual(["a", "b", "c"]);
  });

  it("re-sorts to the saved order", () => {
    expect(orderLensTopics(["a", "b", "c"], ["c", "a", "b"], MAX)).toEqual(["c", "a", "b"]);
  });

  it("APPENDS lens topics the saved order never mentioned", () => {
    // The regression. CC_0086 swapped two topics in the Federal Lens; a saved order
    // from before it knows six of the eight. It must re-sort those six and still
    // show the two it has never seen.
    const lens = ["climate", "fossil", "health", "deport", "taxes", "abortion", "voting", "civil"];
    const savedFromBefore = ["health", "taxes", "immigration", "abortion", "climate", "deport", "medicare", "fossil"];
    const out = orderLensTopics(lens, savedFromBefore, MAX);

    expect(out).toHaveLength(8);
    expect(out).toEqual(["health", "taxes", "abortion", "climate", "deport", "fossil", "voting", "civil"]);
    // The whole point: nothing in the lens is missing.
    for (const id of lens) expect(out).toContain(id);
    // And the topics the lens no longer holds are gone.
    expect(out).not.toContain("immigration");
    expect(out).not.toContain("medicare");
  });

  it("drops saved ids the lens no longer holds", () => {
    expect(orderLensTopics(["a", "b"], ["b", "zzz", "a"], MAX)).toEqual(["b", "a"]);
  });

  it("falls back to the lens order when the saved list overlaps it not at all", () => {
    expect(orderLensTopics(["a", "b"], ["x", "y"], MAX)).toEqual(["a", "b"]);
  });

  it("tolerates duplicates in the saved list", () => {
    expect(orderLensTopics(["a", "b", "c"], ["b", "b", "a"], MAX)).toEqual(["b", "a", "c"]);
  });

  it("honours the cap, and caps the appended tail too", () => {
    const lens = ["a", "b", "c", "d", "e"];
    expect(orderLensTopics(lens, ["e", "d"], 3)).toEqual(["e", "d", "a"]);
    expect(orderLensTopics(lens, null, 3)).toEqual(["a", "b", "c"]);
  });

  it("trusts the saved value for nothing", () => {
    // localStorage can hold anything, including what a previous version wrote.
    expect(orderLensTopics(["a"], "not-an-array", MAX)).toEqual(["a"]);
    expect(orderLensTopics(["a"], { 0: "a" }, MAX)).toEqual(["a"]);
    expect(orderLensTopics(["a"], 42, MAX)).toEqual(["a"]);
  });

  it("survives a missing lens payload", () => {
    expect(orderLensTopics(null, ["a"], MAX)).toEqual([]);
    expect(orderLensTopics(undefined, null, MAX)).toEqual([]);
  });
});
