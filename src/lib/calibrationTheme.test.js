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
