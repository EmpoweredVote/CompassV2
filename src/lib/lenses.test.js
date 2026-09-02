import { describe, it, expect } from "vitest";
import {
  LENSES,
  LOCAL_LENS,
  JUDICIAL_LENS,
  FEDERAL_LENS,
  EDUCATION_LENS,
  LENS_DISPLAY_ORDER,
  orderLenses,
  lensShortLabel,
} from "./lenses.js";

/**
 * The switcher used to be three constants written out by name, so a lens that
 * existed in inform.compass_lenses and was served by /compass/lenses could not
 * appear at all. These cover the two derived values that replaced the hardcoding
 * — order and label — plus the fallback constants staying in step with the DB.
 */

describe("EDUCATION_LENS", () => {
  it("carries the eight school-board topics in lens order", () => {
    expect(EDUCATION_LENS.topicIds).toHaveLength(8);
    expect(new Set(EDUCATION_LENS.topicIds).size).toBe(8);
  });

  it("is in the LENSES fallback so an offline client still resolves it", () => {
    expect(LENSES.map((l) => l.key)).toContain("education");
  });

  it("uses the pink that passes AA against white", () => {
    // The active chip paints the lens colour as a background under white text.
    expect(EDUCATION_LENS.color).toBe("#C2185B");
  });
});

describe("orderLenses", () => {
  const api = [
    { key: "education" },
    { key: "federal" },
    { key: "judicial" },
    { key: "local" },
  ];

  it("puts the known chips in display order, not the API's alphabetical one", () => {
    // /compass/lenses returns ORDER BY key, which would lead with Education and
    // shuffle the three chips users already know.
    expect(orderLenses(api).map((l) => l.key)).toEqual([
      "federal",
      "local",
      "judicial",
      "education",
    ]);
  });

  it("SHOWS a lens it has no display rank for, sorted last", () => {
    // The whole point: this list gates order, never existence. A lens added to
    // the DB must appear with no frontend change.
    const withNew = [...api, { key: "tribal" }, { key: "county" }];
    const keys = orderLenses(withNew).map((l) => l.key);
    expect(keys).toHaveLength(6);
    expect(keys.slice(-2)).toEqual(["tribal", "county"]);
  });

  it("keeps unknown lenses in the order the API gave them", () => {
    const keys = orderLenses([{ key: "zebra" }, { key: "alpha" }]).map((l) => l.key);
    expect(keys).toEqual(["zebra", "alpha"]);
  });

  it("survives junk without throwing", () => {
    expect(orderLenses(null)).toEqual([]);
    expect(orderLenses(undefined)).toEqual([]);
    expect(orderLenses([{}]).length).toBe(1);
  });

  it("does not mutate its argument", () => {
    const input = [{ key: "education" }, { key: "federal" }];
    orderLenses(input);
    expect(input.map((l) => l.key)).toEqual(["education", "federal"]);
  });

  it("ranks every bundled lens", () => {
    for (const l of LENSES) expect(LENS_DISPLAY_ORDER).toContain(l.key);
  });
});

describe("lensShortLabel", () => {
  it("reproduces the labels that used to be hardcoded", () => {
    expect(lensShortLabel(FEDERAL_LENS)).toBe("Federal");
    expect(lensShortLabel(LOCAL_LENS)).toBe("Local");
    expect(lensShortLabel(JUDICIAL_LENS)).toBe("Judicial");
  });

  it("labels the new lens", () => {
    expect(lensShortLabel(EDUCATION_LENS)).toBe("Education");
  });

  it("falls back rather than rendering an empty chip", () => {
    expect(lensShortLabel({ key: "tribal", name: "" })).toBe("tribal");
    expect(lensShortLabel({ name: "Lens" })).toBe("Lens");
    expect(lensShortLabel(null)).toBe("");
  });

  it("leaves a name that does not end in Lens alone", () => {
    expect(lensShortLabel({ name: "Best Match" })).toBe("Best Match");
  });
});
