import { describe, it, expect } from "vitest";
import { orderStances, valueFromPlacement, placementFromValue, isWriteIn } from "./writeIn";

const mk = (v) => ({ id: `s${v}`, value: v, text: `stance ${v}` });
const ASC_5 = [1, 2, 3, 4, 5].map(mk);
const SHUFFLED_5 = [3, 5, 1, 4, 2].map(mk);

describe("orderStances", () => {
  it("sorts descending when not inverted", () => {
    expect(orderStances(ASC_5, false).map(s => s.value)).toEqual([5, 4, 3, 2, 1]);
  });
  it("sorts ascending when inverted", () => {
    expect(orderStances(ASC_5, true).map(s => s.value)).toEqual([1, 2, 3, 4, 5]);
  });
  it("sorts by value, not by array order", () => {
    expect(orderStances(SHUFFLED_5, false).map(s => s.value)).toEqual([5, 4, 3, 2, 1]);
  });
  it("does not mutate its input", () => {
    const input = [...SHUFFLED_5];
    orderStances(input, false);
    expect(input).toEqual(SHUFFLED_5);
  });
  it("returns [] for missing or empty stances", () => {
    expect(orderStances(undefined, false)).toEqual([]);
    expect(orderStances([], false)).toEqual([]);
  });
});

describe("valueFromPlacement", () => {
  it("places above the top stance at the high edge", () => {
    expect(valueFromPlacement(0, 5, false)).toBe(5.5);
    expect(valueFromPlacement(0, 5, true)).toBe(0.5);
  });
  it("places below the bottom stance at the low edge", () => {
    expect(valueFromPlacement(5, 5, false)).toBe(0.5);
    expect(valueFromPlacement(5, 5, true)).toBe(5.5);
  });
  it("places between neighbours", () => {
    expect(valueFromPlacement(1, 5, false)).toBe(4.5);
    expect(valueFromPlacement(1, 5, true)).toBe(1.5);
  });
});

describe("round trip", () => {
  it.each([3, 5, 7])("survives every placement for %i stances", (count) => {
    for (const inverted of [false, true]) {
      for (let i = 0; i <= count; i++) {
        const v = valueFromPlacement(i, count, inverted);
        expect(placementFromValue(v, count, inverted)).toBe(i);
      }
    }
  });
});

describe("isWriteIn", () => {
  it.each([[2.5, true], [0.5, true], [5.5, true], [3, false], [0, false], [null, false], [undefined, false]])(
    "%s -> %s", (value, expected) => expect(isWriteIn(value)).toBe(expected)
  );
});
