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
  it("sorts shuffled input ascending when inverted", () => {
    expect(orderStances(SHUFFLED_5, true).map(s => s.value)).toEqual([1, 2, 3, 4, 5]);
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

describe("display order agrees with placement values", () => {
  it.each([3, 5, 7])("interior slot value sits between its displayed neighbours for %i stances", (count) => {
    const shuffled = Array.from({ length: count }, (_, k) => mk(((k * 2 + 1) % count) + 1));
    for (const inverted of [false, true]) {
      const shown = orderStances(shuffled, inverted);
      for (let i = 1; i < count; i++) {
        const v = valueFromPlacement(i, count, inverted);
        const above = shown[i - 1].value;
        const below = shown[i].value;
        expect(v).toBeGreaterThan(Math.min(above, below));
        expect(v).toBeLessThan(Math.max(above, below));
      }
    }
  });
});

describe("isWriteIn", () => {
  it.each([[2.5, true], [0.5, true], [5.5, true], [3, false], [0, false], [null, false], [undefined, false]])(
    "%s -> %s", (value, expected) => expect(isWriteIn(value)).toBe(expected)
  );
});

// Regression, kept for the record rather than for new coverage: the round-trip
// case below already exercises count=5 / inverted / i=4. The quiz used to
// rebuild a restored write-in card's list from the UNREVERSED stance ids while
// a freshly opened card used the reversed display order, so an inverted spoke
// redrew upside-down after a restore and the next drag saved the mirrored
// value. Its own index math (Math.floor) was right — it is exactly
// placementFromValue(v, n, true) for a half-step. Placement and display order
// now come from one place, and this pins the half the quiz never had.
describe("inverted restore", () => {
  it("restores an inverted write-in to the side the user placed it on", () => {
    // placed just below the strong end on an inverted spoke
    const v = valueFromPlacement(4, 5, true);          // 4.5
    expect(placementFromValue(v, 5, true)).toBe(4);
    // and the list it indexes into is the one the user saw: slot 4 of the
    // inverted display sits between the stances valued 4 and 5.
    const shown = orderStances([1, 2, 3, 4, 5].map(mk), true);
    expect([shown[3].value, shown[4].value]).toEqual([4, 5]);
  });
});
