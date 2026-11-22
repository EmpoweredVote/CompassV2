import { describe, it, expect } from "vitest";
import {
  orderStances,
  valueFromPlacement,
  placementFromValue,
  isWriteIn,
  clearsServerCopy,
} from "./writeIn";

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

// A stored value can outlive the range it was placed in: a topic revised from
// five stances to four leaves a 5.5 pointing past the end. The slot has to stay
// inside the list either way — a negative index makes `splice` count from the
// END, which drops the card next to last instead of at the top.
describe("a value outside the current range", () => {
  it("clamps to the slots that exist", () => {
    // 5.5 against a 4-stance topic: off the strong end of each display order.
    expect(placementFromValue(5.5, 4, false)).toBe(0);
    expect(placementFromValue(5.5, 4, true)).toBe(4);
    // and off the other end.
    expect(placementFromValue(-0.5, 4, false)).toBe(4);
    expect(placementFromValue(-0.5, 4, true)).toBe(0);
  });

  it("keeps the card inside the list when spliced at that slot", () => {
    for (const inverted of [false, true]) {
      const items = ["s1", "s2", "s3", "s4"];
      items.splice(placementFromValue(5.5, 4, inverted), 0, "write-in");
      expect(items.indexOf("write-in")).toBe(inverted ? 4 : 0);
      expect(items).toHaveLength(5);
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

// These exist because the guard they pin was, briefly, not there. Firing the
// server DELETE on every reported cancel passed all 343 tests in the suite —
// nothing described the one case where it loses data, so nothing objected.
describe('clearsServerCopy', () => {
  it('clears when the user is left with no answer', () => {
    // The card's × and an emptied textarea both end with the question
    // unanswered. The stored row has to go, or the next hydration hands the
    // abandoned write-in straight back — the bug this whole path fixes.
    expect(clearsServerCopy('abandoned')).toBe(true);
    expect(clearsServerCopy('emptied')).toBe(true);
  });

  it('🔴 does NOT clear when a pre-written stance is replacing the write-in', () => {
    // The stance POST goes out in the same tick. Both calls are
    // fire-and-forget with no ordering between them, so a DELETE sent here can
    // land AFTER that POST and soft-delete the answer the user just picked —
    // gone server-side, and only visible on a reload.
    expect(clearsServerCopy('replaced')).toBe(false);
  });

  it('does not clear on a reason it does not recognise', () => {
    // ⚠ The costs are not symmetric. Failing to clear leaves a stale row the
    // user can clear again; clearing wrongly destroys an answer they gave. So
    // this allows rather than excludes, and a future gesture that forgets to
    // say why fails safe instead of silently deleting.
    expect(clearsServerCopy(undefined)).toBe(false);
    expect(clearsServerCopy(null)).toBe(false);
    expect(clearsServerCopy('')).toBe(false);
    expect(clearsServerCopy('cancelled')).toBe(false);
    expect(clearsServerCopy('ABANDONED')).toBe(false);
  });
});
