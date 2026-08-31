import { describe, it, expect } from "vitest";
import {
  contrastRatio,
  readableOn,
  DARK_PAGE_BG,
  LIGHT_PAGE_BG,
  MIN_CONTRAST,
} from "./lensColors.js";

// The three curated lens colours, as stored in inform.compass_lenses.
const FEDERAL = "#1E3A5F";
const JUDICIAL = "#C2440A";
const LOCAL = "#5A9A6E";
// Custom lenses, matching Essentials.
const CUSTOM_TEAL = "#00657C";

describe("contrastRatio", () => {
  it("is 1 for a colour against itself", () => {
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });

  it("is 21 for black against white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });

  it("is order-independent", () => {
    expect(contrastRatio(FEDERAL, DARK_PAGE_BG)).toBeCloseTo(
      contrastRatio(DARK_PAGE_BG, FEDERAL), 5
    );
  });
});

describe("the bug this module exists for", () => {
  it("🔴 federal navy is illegible on the dark page background", () => {
    // Reported from a screenshot: "in dark mode on the compass, it's really hard
    // to read federal". LensSwitcher paints an inactive chip's colour as its TEXT
    // and border, so a dark navy sits on a near-black page at 1.6:1.
    expect(contrastRatio(FEDERAL, DARK_PAGE_BG)).toBeLessThan(2);
  });

  it("🔴 is not only federal — judicial and the custom teal fail too", () => {
    // Worth knowing before "just fix federal": two of the four are also under
    // the 4.5:1 floor, so a per-colour hardcode would leave the bug half-fixed.
    expect(contrastRatio(JUDICIAL, DARK_PAGE_BG)).toBeLessThan(MIN_CONTRAST);
    expect(contrastRatio(CUSTOM_TEAL, DARK_PAGE_BG)).toBeLessThan(MIN_CONTRAST);
  });

  it("local green already passes, so it must not be touched", () => {
    expect(contrastRatio(LOCAL, DARK_PAGE_BG)).toBeGreaterThan(MIN_CONTRAST);
  });
});

describe("readableOn", () => {
  it("lifts every failing lens colour to the contrast floor on dark", () => {
    for (const color of [FEDERAL, JUDICIAL, CUSTOM_TEAL]) {
      const fixed = readableOn(color, DARK_PAGE_BG);
      expect(contrastRatio(fixed, DARK_PAGE_BG)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it("returns a colour that already passes unchanged", () => {
    // Not merely "still passing" — byte-identical, so a designer's chosen colour
    // is never quietly shifted when it did not need to be.
    expect(readableOn(LOCAL, DARK_PAGE_BG)).toBe(LOCAL);
    expect(readableOn(FEDERAL, LIGHT_PAGE_BG)).toBe(FEDERAL);
  });

  it("lightens on a dark background rather than darkening", () => {
    // Keeping the hue recognisable matters: the chip is the lens's identity.
    const fixed = readableOn(FEDERAL, DARK_PAGE_BG);
    const lum = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return r + g + b;
    };
    expect(lum(fixed)).toBeGreaterThan(lum(FEDERAL));
  });

  it("keeps the blue channel dominant for navy — it must still read as blue", () => {
    const fixed = readableOn(FEDERAL, DARK_PAGE_BG);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(fixed.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it("returns a valid 6-digit hex", () => {
    expect(readableOn(FEDERAL, DARK_PAGE_BG)).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("survives a missing or malformed colour instead of throwing", () => {
    // Lens colours come from the DB (inform.compass_lenses.color), so a bad row
    // must not blank the whole switcher row.
    expect(() => readableOn(undefined, DARK_PAGE_BG)).not.toThrow();
    expect(() => readableOn("nonsense", DARK_PAGE_BG)).not.toThrow();
    expect(readableOn("nonsense", DARK_PAGE_BG)).toBe("nonsense");
  });
});
