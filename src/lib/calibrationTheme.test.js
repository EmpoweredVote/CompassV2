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

// 🔴 THE SURFACES TEXT IS ACTUALLY PAINTED ON — a narrower list, on purpose.
//
// `border`, `divider`, `sidebarBdr` are 1px rules and `progressBg` is a
// progress track. Nothing is painted ON any of them, so AA's 4.5:1 for text
// has nothing to say about them. They are absent here because darkening them
// to satisfy a text rule they take no part in would make every hairline and
// the progress bar fainter for no legibility gain — so the dark theme leaves
// them at #41454E while `card` and `cardElev` move down to meet the ink.
//
// writeOwnColor still measures the WIDE list above: it is drawn on a
// transparent background at four call sites, so any opaque token really can
// end up behind it. textMuted is always a `color` paired with a `background`
// in the same style object, and those pairings are enumerable.
const TEXT_SURFACE_KEYS = [
  'bg',
  'sidebar',
  'card',
  'cardElev',
  'stanceBg',
  'flipBtn',
  'selBg',
  'yellowBg',
];

const pickOpaque = (theme, keys) =>
  keys.map((key) => [key, theme[key]]).filter(([, hex]) =>
    /^#[0-9a-f]{6}$/i.test(String(hex))
  );

/** Surfaces text sits on, for an ink used as `color` beside a `background`. */
const textSurfaces = (theme) => pickOpaque(theme, TEXT_SURFACE_KEYS);

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
    it(`${themeName} clears the contrast floor on every surface text sits on`, () => {
      const failures = textSurfaces(theme)
        .map(([surface, hex]) => ({
          surface,
          hex,
          ratio: Number(contrastRatio(theme.textMuted, hex).toFixed(2)),
        }))
        .filter((r) => r.ratio < MIN_CONTRAST);

      expect(failures).toEqual([]);
    });
  }

  it('🔴 every colour this replaced failed that floor, on the surface of its day', () => {
    // Kept so the four assertions above are known to be capable of failing.
    // ⚠ The surfaces are LITERALS, not `DARK_THEME.cardElev` and friends. Two
    // of those tokens have since moved precisely so the ink could come back,
    // so reading them live would measure #9CA3AF against #34383E, find 4.64:1,
    // and quietly stop testing anything.
    expect(contrastRatio('#9CA3AF', '#41454E')).toBeLessThan(MIN_CONTRAST); // 3.78, old cardElev
    expect(contrastRatio('#6d7a9a', '#D3D7DE')).toBeLessThan(MIN_CONTRAST); // 2.97, light progressBg
    expect(contrastRatio('#9CA3AF', '#FFFFFF')).toBeLessThan(MIN_CONTRAST); // 2.54, the worst one
  });

  // 🔴 THE TIER THE DARK RE-RAMP EXISTS TO RESTORE. #B0B6C0 cleared the floor
  // by brightening the ink until it sat 1.41:1 from body — the same colour, to
  // the eye. Pinned so a future contrast fix cannot quietly pay for itself out
  // of the hierarchy again; the surfaces are what move.
  it('reads as a separate tier from textBody in dark mode', () => {
    expect(contrastRatio(DARK_THEME.textMuted, DARK_THEME.textBody)).toBeGreaterThan(1.7);
    expect(contrastRatio(FULL_DARK_THEME.textMuted, FULL_DARK_THEME.textBody))
      .toBeGreaterThan(1.7);
  });

  // Light has NOT had that treatment, and the asymmetry is the honest state of
  // things rather than an oversight: there the ink moved and the tier went
  // with it. Pinned so nobody "restores the hierarchy" by lightening the ink,
  // which is exactly the failure #146 fixed. The way back is the same re-ramp
  // the dark theme just had — darken cardElev, flipBtn and progressBg.
  it('is barely distinguishable from textBody in light mode, still', () => {
    expect(contrastRatio(LIGHT_THEME.textMuted, LIGHT_THEME.textBody)).toBeLessThan(1.5);
    expect(contrastRatio(FULL_LIGHT_THEME.textMuted, FULL_LIGHT_THEME.textBody))
      .toBeLessThan(1.5);
  });

  // The re-ramp's other half. Darkening only `cardElev` also clears the floor,
  // at 4.64:1 — and collapses this step from 2.77 to 0.75, so a raised chip
  // merges into the card behind it. `card` moved too, keeping a step of 1.52.
  // In dark mode elevation reads as LIGHTER, so the order is the assertion.
  it('keeps a raised surface visibly above the card it sits on', () => {
    const luminance = (hex) => {
      const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const linear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * linear(channels[0]) + 0.7152 * linear(channels[1]) + 0.0722 * linear(channels[2]);
    };
    const step = (a, b) => (luminance(a) - luminance(b)) * 100;

    expect(step(DARK_THEME.cardElev, DARK_THEME.card)).toBeGreaterThan(1);
    expect(step(DARK_THEME.card, DARK_THEME.bg)).toBeGreaterThan(1);
    expect(step(FULL_DARK_THEME.flipBtn, FULL_DARK_THEME.card)).toBeGreaterThan(1);
  });

  // 🔴 WHY THE RULES WERE LEFT BEHIND, STATED AS AN ASSERTION. The tempting
  // tidy-up is to darken `border`, `divider` and `progressBg` along with the
  // surfaces, for consistency. They carry no text, so no contrast rule asks
  // for it — and doing it costs real visibility: at the new elevated value
  // #34383E a rule drops to 1.21:1 against the card and the progress bar
  // starts to disappear.
  //
  // ⚠ These are "do not go backwards" floors taken from the shipped values,
  // not WCAG numbers. A rule is not a UI component under 1.4.11 and has no
  // 3:1 obligation; this exists so the next contrast pass cannot quietly
  // trade a visible hairline for a tidier palette.
  it('keeps rules and tracks visible against the surface they are drawn on', () => {
    for (const [theme, name] of [[DARK_THEME, 'DARK'], [LIGHT_THEME, 'LIGHT']]) {
      for (const token of ['border', 'divider', 'progressBg', 'stanceBorder']) {
        const against = token === 'stanceBorder' ? theme.stanceBg : theme.card;
        expect(
          { token: `${name}.${token}`, ratio: contrastRatio(theme[token], against) >= 1.4 }
        ).toEqual({ token: `${name}.${token}`, ratio: true });
      }
    }
    // Drawn on the sidebar, not on a card, and already the faintest of them.
    expect(contrastRatio(FULL_DARK_THEME.sidebarBdr, FULL_DARK_THEME.sidebar))
      .toBeGreaterThan(1.2);
  });

  it('is one shared value per theme, not a copy per palette', () => {
    // The copy IS the bug: FULL_LIGHT_THEME drifted onto the dark grey.
    expect(FULL_DARK_THEME.textMuted).toBe(DARK_THEME.textMuted);
    expect(FULL_LIGHT_THEME.textMuted).toBe(LIGHT_THEME.textMuted);
  });
});
