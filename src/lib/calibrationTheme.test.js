// src/lib/calibrationTheme.test.js — pure-logic only, no jsdom/React import.

import { describe, it, expect } from 'vitest';
import {
  inkOn,
  INK_DARK,
  INK_LIGHT,
  DARK_THEME,
  LIGHT_THEME,
  FULL_DARK_THEME,
  FULL_LIGHT_THEME,
} from './calibrationTheme';
import { contrastRatio, MIN_CONTRAST } from './lensColors.js';

describe('inkOn', () => {
  it('🔴 the dark theme accent needs dark ink, not white', () => {
    // The bug: CoachMark's primary button hardcoded white on `tint`, and in dark
    // mode tint is the theme accent — a light blue. That is the "Next →" button
    // on every themed coach mark, so the tour's only control was the least
    // readable thing on screen.
    expect(contrastRatio(DARK_THEME.textAccent, INK_LIGHT)).toBeLessThan(MIN_CONTRAST);
    expect(inkOn(DARK_THEME.textAccent)).toBe(INK_DARK);
  });

  it('leaves the light theme accent on white ink', () => {
    // The deep teal already passes with white; fixing dark must not flip light.
    expect(inkOn(LIGHT_THEME.textAccent)).toBe(INK_LIGHT);
  });

  it('clears the contrast floor for every colour it is used with', () => {
    const used = [
      DARK_THEME.textAccent,
      LIGHT_THEME.textAccent,
      DARK_THEME.yellow,
      LIGHT_THEME.yellow,
      '#FFD426', // learn-slide accent
      '#59B0C4', // learn-slide accent
    ];
    for (const color of used) {
      expect(contrastRatio(color, inkOn(color))).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it('picks dark ink on yellow, which white would fail badly', () => {
    expect(inkOn('#FED12E')).toBe(INK_DARK);
  });

  it('accepts a hex with or without the leading #', () => {
    expect(inkOn('FED12E')).toBe(inkOn('#FED12E'));
  });

  it('falls back to light ink on an unmeasurable colour instead of throwing', () => {
    // Callers may pass a gradient, an rgba() or nothing at all; a tour button
    // losing its label colour must not take the page down.
    for (const bad of [undefined, null, '', 'rgba(1,2,3,0.5)', 'nonsense', 'transparent']) {
      expect(() => inkOn(bad)).not.toThrow();
      expect(inkOn(bad)).toBe(INK_LIGHT);
    }
  });
});

// The "Write your own..." control is the only way into a write-in answer. It
// renders as transparent-background text with a dashed border, so whatever
// surface the StanceChooser happens to sit on IS its background — and the
// chooser has four call sites (CalibrationOverlay, LibraryDrawer, Quiz,
// FullCalibration) on different surfaces.
//
// Rather than track which surface each call site uses, writeOwnColor clears
// the floor against every opaque surface in its own theme. That invariant is
// cheap to hold and removes the question entirely.
const SURFACE_KEYS = [
  'bg',
  'card',
  'cardElev',
  'stanceBg',
  'selBg',
  'yellowBg',
  'progressBg',
  'divider',
  'border',
];

/** Opaque surfaces only — an rgba() can't be measured without a backdrop. */
const opaqueSurfaces = (theme) =>
  SURFACE_KEYS.map((key) => [key, theme[key]]).filter(([, hex]) =>
    /^#[0-9a-f]{6}$/i.test(String(hex))
  );

describe('writeOwnColor', () => {
  for (const [themeName, theme] of [
    ['LIGHT_THEME', LIGHT_THEME],
    ['DARK_THEME', DARK_THEME],
  ]) {
    it(`${themeName} clears the contrast floor on every opaque surface`, () => {
      const failures = opaqueSurfaces(theme)
        .map(([surface, hex]) => ({
          surface,
          hex,
          ratio: Number(contrastRatio(theme.writeOwnColor, hex).toFixed(2)),
        }))
        .filter((r) => r.ratio < MIN_CONTRAST);

      expect(failures).toEqual([]);
    });
  }

  it('🔴 the colours this replaced failed that floor badly', () => {
    // #8F9EBC on white was 2.70:1; #6B7280 on the dark cardElev was 1.99:1.
    // Kept so the assertion above is known to be capable of failing.
    expect(contrastRatio('#8F9EBC', LIGHT_THEME.card)).toBeLessThan(MIN_CONTRAST);
    expect(contrastRatio('#6B7280', DARK_THEME.cardElev)).toBeLessThan(MIN_CONTRAST);
  });
});

// textMuted is the same invariant as writeOwnColor and for the same reason —
// it is painted straight onto whatever surface its call site sits on, and
// there are 55 of those across five files. Two of them put it on an ELEVATED
// surface explicitly (`{ background: t.cardElev, color: t.textMuted }` in the
// overlay, `{ background: th.flipBtn, color: th.textMuted }` on the
// calibration page), so the worst case is not hypothetical.
//
// All four palettes, because the fourth is where the real damage was: the
// calibration page's light theme used the DARK grey, 1.76:1 on a rule and
// 2.54:1 on its own white card. It survived every previous pass because the
// palette was private to the page and no test could reach it.
describe('textMuted', () => {
  for (const [themeName, theme] of [
    ['LIGHT_THEME', LIGHT_THEME],
    ['DARK_THEME', DARK_THEME],
    ['FULL_LIGHT_THEME', FULL_LIGHT_THEME],
    ['FULL_DARK_THEME', FULL_DARK_THEME],
  ]) {
    it(`${themeName} clears the contrast floor on every opaque surface`, () => {
      const failures = opaqueSurfaces(theme)
        .map(([surface, hex]) => ({
          surface,
          hex,
          ratio: Number(contrastRatio(theme.textMuted, hex).toFixed(2)),
        }))
        .filter((r) => r.ratio < MIN_CONTRAST);

      expect(failures).toEqual([]);
    });
  }

  it('🔴 every colour this replaced failed that floor', () => {
    // Kept so the four assertions above are known to be capable of failing.
    // The last of these is the one that mattered most: the dark theme's grey,
    // used in a light theme, on white.
    expect(contrastRatio('#9CA3AF', DARK_THEME.cardElev)).toBeLessThan(MIN_CONTRAST); // 3.78
    expect(contrastRatio('#6d7a9a', LIGHT_THEME.progressBg)).toBeLessThan(MIN_CONTRAST); // 2.97
    expect(contrastRatio('#9CA3AF', FULL_DARK_THEME.border)).toBeLessThan(MIN_CONTRAST); // 3.78
    expect(contrastRatio('#9CA3AF', FULL_LIGHT_THEME.card)).toBeLessThan(MIN_CONTRAST); // 2.54
  });

  // The muted tier is now a hair from the body tier in light mode, and that is
  // a deliberate, documented consequence rather than a slip — see the note on
  // MUTED_LIGHT. Pinned so nobody "restores the hierarchy" by lightening the
  // ink, which is precisely the failure that was just fixed. The way back is
  // to darken the surfaces.
  it('is barely distinguishable from textBody in light mode, on purpose', () => {
    expect(contrastRatio(LIGHT_THEME.textMuted, LIGHT_THEME.textBody)).toBeLessThan(1.5);
    expect(contrastRatio(FULL_LIGHT_THEME.textMuted, FULL_LIGHT_THEME.textBody))
      .toBeLessThan(1.5);
  });

  it('is one shared value per theme, not a copy per palette', () => {
    // The copy IS the bug: FULL_LIGHT_THEME drifted onto the dark grey.
    expect(FULL_DARK_THEME.textMuted).toBe(DARK_THEME.textMuted);
    expect(FULL_LIGHT_THEME.textMuted).toBe(LIGHT_THEME.textMuted);
  });
});
