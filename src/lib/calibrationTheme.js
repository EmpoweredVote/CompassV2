// calibrationTheme.js
// EV semantic token palettes shared by the calibration flow and by any surface
// that needs to match it — notably the CoachMark tours on the compass screen,
// which must look like the same product as the calibration tutorial.

import { contrastRatio } from './lensColors.js';

// ────────────────────────────────────────────────
// Theme palettes (EV semantic tokens)
// ────────────────────────────────────────────────
export const DARK_THEME = {
  bg:             '#131416',
  card:           '#2F3237',
  cardElev:       '#41454E',
  border:         '#41454E',
  borderAccent:   '#59B0C4',
  textHead:       '#EBEDEF',
  textBody:       '#D3D7DE',
  textMuted:      '#9CA3AF',
  textAccent:     '#59B0C4',
  btnBg:          '#FED12E',
  btnText:        '#1C1C1C',
  selBg:          'rgba(89,176,196,0.12)',
  selBorder:      '#59B0C4',
  yellow:         '#FED12E',
  yellowDark:     '#D0A301',
  yellowBg:       'rgba(254,209,46,0.12)',
  progressBg:     '#41454E',
  divider:        '#41454E',
  stickyBg:       'rgba(19,20,22,0.97)',
  stanceBg:       '#2F3237',
  stanceText:     '#D3D7DE',
  stanceBorder:   '#41454E',
  writeOwnColor:  '#6B7280',
};

export const LIGHT_THEME = {
  bg:             '#F7F7F8',
  card:           '#FFFFFF',
  cardElev:       '#EBEDEF',
  border:         '#D3D7DE',
  borderAccent:   '#00657C',
  textHead:       '#2F3237',
  textBody:       '#535964',
  textMuted:      '#6d7a9a',
  textAccent:     '#00657C',
  btnBg:          '#FED12E',
  btnText:        '#1C1C1C',
  selBg:          '#E4F3F6',
  selBorder:      '#00657C',
  yellow:         '#FED12E',
  yellowDark:     '#D0A301',
  yellowBg:       '#FEF3C7',
  progressBg:     '#D3D7DE',
  divider:        '#D3D7DE',
  stickyBg:       'rgba(247,247,248,0.97)',
  stanceBg:       '#FFFFFF',
  stanceText:     '#2F3237',
  stanceBorder:   '#D3D7DE',
  writeOwnColor:  '#8F9EBC',
};

// ────────────────────────────────────────────────
// Ink on a filled swatch
// ────────────────────────────────────────────────
// Picks the dark or light ink that actually reads on a solid background,
// instead of assuming white always does. The dark theme's accent (#59B0C4) is
// a light blue: white on it is ~2.5:1, while the dark ink is ~7.5:1.
//
// Chooses by WCAG contrast ratio rather than a lightness threshold, so there is
// no magic cut point to tune — whichever ink has more contrast wins.
export const INK_DARK = '#131416';
export const INK_LIGHT = '#FFFFFF';

export function inkOn(hex) {
  // Non-hex (rgba(), a gradient, undefined) can't be measured: keep the old
  // default rather than guess.
  if (!/^#?[0-9a-f]{6}$/i.test(String(hex).trim())) return INK_LIGHT;
  return contrastRatio(hex, INK_DARK) > contrastRatio(hex, INK_LIGHT)
    ? INK_DARK
    : INK_LIGHT;
}
