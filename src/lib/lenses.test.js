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
  normalizeApiLens,
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
    // A server that has not deployed sortOrder yet returns ORDER BY key, which
    // would lead with Education and shuffle the three chips users already know.
    expect(orderLenses(api).map((l) => l.key)).toEqual([
      "federal",
      "local",
      "judicial",
      "education",
    ]);
  });

  it("prefers the server's sortOrder over the bundled list", () => {
    // The DB is the source (CC_0043). Deliberately inverted against
    // LENS_DISPLAY_ORDER so a pass cannot come from the fallback by accident.
    const served = [
      { key: "federal", sortOrder: 40 },
      { key: "local", sortOrder: 30 },
      { key: "judicial", sortOrder: 20 },
      { key: "education", sortOrder: 10 },
    ];
    expect(orderLenses(served).map((l) => l.key)).toEqual([
      "education",
      "judicial",
      "local",
      "federal",
    ]);
  });

  it("sorts a served lens with no sortOrder last, not first", () => {
    // Number.MAX_SAFE_INTEGER, not 0 — mirrors the column's DEFAULT 100, which
    // puts a new lens after the curated set rather than at the front of the row.
    const served = [
      { key: "mystery" },
      { key: "federal", sortOrder: 10 },
      { key: "local", sortOrder: 20 },
    ];
    expect(orderLenses(served).map((l) => l.key)).toEqual([
      "federal",
      "local",
      "mystery",
    ]);
  });

  it("breaks sortOrder ties on the order the server sent", () => {
    // sort_order is not unique and defaults to 100, so ties are the normal case
    // for lenses added without an explicit value.
    const served = [
      { key: "beta", sortOrder: 100 },
      { key: "alpha", sortOrder: 100 },
      { key: "federal", sortOrder: 10 },
    ];
    expect(orderLenses(served).map((l) => l.key)).toEqual([
      "federal",
      "beta",
      "alpha",
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

describe("normalizeApiLens", () => {
  // It whitelists fields, so a new one is DROPPED unless named. sortOrder
  // reaching orderLenses depends entirely on this.
  it("carries sortOrder through", () => {
    expect(normalizeApiLens({ key: "federal", sortOrder: 10 }).sortOrder).toBe(10);
    expect(normalizeApiLens({ key: "federal", sortOrder: 0 }).sortOrder).toBe(0);
  });

  it("omits sortOrder entirely when the server did not send one", () => {
    // Not a default. A number here would make every lens look server-ordered
    // and permanently disable the LENS_DISPLAY_ORDER fallback.
    expect("sortOrder" in normalizeApiLens({ key: "federal" })).toBe(false);
    expect("sortOrder" in normalizeApiLens({ key: "f", sortOrder: null })).toBe(false);
    expect("sortOrder" in normalizeApiLens({ key: "f", sortOrder: "10" })).toBe(false);
  });

  it("round-trips into orderLenses", () => {
    const served = [
      { key: "education", sortOrder: 40 },
      { key: "federal", sortOrder: 10 },
    ].map(normalizeApiLens);
    expect(orderLenses(served).map((l) => l.key)).toEqual(["federal", "education"]);
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
