// src/lib/calibrationTheme.test.js — pure-logic only, no jsdom/React import.

import { describe, it, expect } from 'vitest';
import { inkOn, INK_DARK, INK_LIGHT, DARK_THEME, LIGHT_THEME } from './calibrationTheme';
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
