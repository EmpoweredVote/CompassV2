// calibrationTheme.js
// EV semantic token palettes shared by the calibration flow and by any surface
// that needs to match it — notably the CoachMark tours on the compass screen,
// which must look like the same product as the calibration tutorial.

import { contrastRatio } from './lensColors.js';

// ────────────────────────────────────────────────
// Muted ink
// ────────────────────────────────────────────────
// One value per theme, shared by both palettes below, because the same token
// under two names is how the worst instance of the bug hid: the calibration
// page's copy of this palette used the DARK grey in its LIGHT theme, where it
// measured 1.76:1 — grey on a grey rule — and nothing pointed at it.
//
// These clear WCAG AA (4.5:1) against every opaque surface in BOTH palettes:
// worst case 4.71:1 for dark (on cardElev/border) and 4.73:1 for light (on
// progressBg/border). What they replaced did not: #9CA3AF managed 3.78:1 on
// the dark cardElev, #6d7a9a managed 2.97:1 on the light progressBg, and
// #9CA3AF in the light theme failed all nine surfaces.
//
// ⚠ THEY ARE BARELY LIGHTER THAN `textBody`, AND THAT IS THE PRICE. On this
// palette, a light-theme ink that clears 4.5:1 on a #D3D7DE rule has to be
// about as dark as body text — #555B66 sits 1.20:1 from #535964, which is to
// say it reads as the same colour. The muted TIER is therefore mostly gone in
// light mode; what separates secondary text now is size and weight, not
// colour. Getting the tier back is a change to the SURFACES (the rules and
// tracks are too light), not to this value — lightening these again just
// reinstates the failure.
//
// Pinned by calibrationTheme.test.js, against every palette in this file.
const MUTED_DARK = '#B0B6C0';
const MUTED_LIGHT = '#555B66';

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
  // See MUTED_DARK.
  textMuted:      MUTED_DARK,
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
  // Clears WCAG AA (4.5:1) on every opaque surface in this theme; the worst
  // case is cardElev at 4.76:1. The old #6B7280 managed only 1.99:1 there.
  // Pinned by calibrationTheme.test.js.
  writeOwnColor:  '#B0B7C3',
};

export const LIGHT_THEME = {
  bg:             '#F7F7F8',
  card:           '#FFFFFF',
  cardElev:       '#EBEDEF',
  border:         '#D3D7DE',
  borderAccent:   '#00657C',
  textHead:       '#2F3237',
  textBody:       '#535964',
  // See MUTED_LIGHT.
  textMuted:      MUTED_LIGHT,
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
  // Clears WCAG AA (4.5:1) on every opaque surface in this theme; the worst
  // case is progressBg at 4.70:1. The old #8F9EBC managed only 1.87:1 there.
  // Pinned by calibrationTheme.test.js.
  writeOwnColor:  '#4F5B77',
};

// ────────────────────────────────────────────────
// The calibration page's own chrome
// ────────────────────────────────────────────────
// FullCalibration.jsx wraps the stance list in a sidebar, a progress rail and
// a flip button, and those need tokens the palettes above do not carry
// (`sidebar`, `flipBtn`, `activeItem`). It used to hold this palette inline,
// which is how its light theme ended up painting the DARK muted grey onto
// white — a copy drifts, and a copy nothing imports drifts unobserved.
//
// It lives here, beside the palettes it is a sibling of, so one contrast test
// can measure all four. It is deliberately NOT merged into the two above: the
// stance list serves itself from those, and a `sidebar` key on the overlay's
// palette would invite exactly the wrong reuse.
export const FULL_DARK_THEME = {
  bg:           '#131416',
  sidebar:      '#1A1C1F',
  sidebarBdr:   '#2A2D33',
  card:         '#2F3237',
  border:       '#41454E',
  textHead:     '#EBEDEF',
  textBody:     '#D3D7DE',
  textMuted:    MUTED_DARK,
  textAccent:   '#59B0C4',
  selBg:        'rgba(89,176,196,0.12)',
  selBorder:    '#59B0C4',
  yellow:       '#FED12E',
  progressBg:   '#41454E',
  // No stance tokens here: the stance list is StanceChooser's, and it serves
  // its own palette from the DARK_THEME/LIGHT_THEME above. Keeping a dead copy
  // would point the next reader at the wrong tokens when a stance button looks
  // wrong.
  activeItem:   'rgba(89,176,196,0.09)',
  checkColor:   '#59B0C4',
  flipBtn:      '#41454E',
};

export const FULL_LIGHT_THEME = {
  bg:           '#F7F7F8',
  sidebar:      '#FFFFFF',
  sidebarBdr:   '#E5E7EB',
  card:         '#FFFFFF',
  border:       '#D3D7DE',
  textHead:     '#2F3237',
  textBody:     '#535964',
  // 🔴 WAS #9CA3AF — the DARK theme's grey, in the LIGHT theme. 2.54:1 on the
  // white card, 1.76:1 on a #D3D7DE rule. The single worst contrast failure in
  // the calibration flow, and it survived because this palette was a private
  // copy no test could see.
  textMuted:    MUTED_LIGHT,
  textAccent:   '#00657C',
  selBg:        '#E4F3F6',
  selBorder:    '#00657C',
  yellow:       '#FED12E',
  progressBg:   '#D3D7DE',
  // See FULL_DARK_THEME.
  activeItem:   '#EAF5F8',
  checkColor:   '#00657C',
  flipBtn:      '#E5E7EB',
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
