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
// Both clear WCAG AA (4.5:1) on every surface TEXT is painted on, in both
// palettes. What they replaced did not: #9CA3AF managed 3.78:1 on the dark
// cardElev, #6d7a9a managed 2.97:1 in light, and #9CA3AF in the light theme
// failed every surface it touched, down to 2.54:1 on its own white card.
//
// ── Dark: the surfaces moved, not the ink ───────────────────────────────
// #B0B6C0 cleared the floor by brightening the ink until it almost matched
// `textBody`, leaving a muted tier 1.41:1 from body — the same colour, to the
// eye. The ink is back to #9CA3AF (1.76:1 from body, the tier as designed) and
// the two surfaces that carry muted text moved down to meet it instead:
// `card` #2F3237 -> #282B30 and `cardElev` #41454E -> #34383E, giving 5.59:1
// and 4.64:1.
//
// `card` had to move with `cardElev`. Darkening only the elevated surface
// clears the floor at 4.64:1 too, but collapses the card -> chip step from
// 2.77 to 0.75 and the raised chip merges into the card behind it. Moving both
// keeps a step of 1.52, pinned below.
//
// ⚠ RULES AND TRACKS KEPT #41454E DELIBERATELY. `border`, `divider` and
// `progressBg` carry no text, so the 4.5:1 floor for text has nothing to say
// about them; darkening them to match would make every hairline and the
// progress bar fainter for no legibility gain. That is why the textMuted test
// measures TEXT_SURFACE_KEYS and not every opaque token — see the note there.
//
// ── Light: the surfaces could not move, so `textBody` did ───────────────
// 🔴 LIGHT CANNOT COPY THE DARK FIX, AND IT IS WORTH KNOWING WHY. In dark, a
// dimmer ink needs a darker surface and there was room below `card` to find
// one. In light, a lighter ink needs a LIGHTER surface — and `card` is already
// #FFFFFF. That is a ceiling, not a preference: even with every surface at
// pure white, the lightest ink still clearing 4.5:1 is #727780, a tier of only
// 1.57:1. Lightening the chip surfaces toward white buys a little of that and
// costs their visibility, since a grey chip already sits only 1.17:1 from the
// white card it is drawn on.
//
// So the muted ink goes as light as the surfaces already allow — #60656F,
// 4.73:1 on `flipBtn`, the darkest surface either light palette paints text on
// — and the tier is widened from the OTHER end instead, by darkening
// `textBody` from #535964 to #3F444D.
//
// What that buys is the two themes finally agreeing on what their three text
// tiers mean. They used to spend their separation in opposite directions:
//
//        head/body   body/muted
//   dark   1.23          1.76      muted is clearly a tier, head barely is
//   light  1.83          1.03      the exact inverse
//
// and now both read 1.2-1.3 between head and body and 1.7-ish between body and
// muted. Pinned by calibrationTheme.test.js, which compares the two.
//
// ⚠ Body text in light mode is genuinely darker than it was. That is the cost,
// and it is paid in the right place: #3F444D reads 9.79:1 on white where
// #535964 read 7.05:1, so the tier is bought with MORE legibility rather than
// less. The squeeze lands on head/body (1.83 -> 1.31), which is where dark has
// always sat.
const MUTED_DARK = '#9CA3AF';
const MUTED_LIGHT = '#60656F';

// Light's body ink. It is a token of this change, not a constant that happened
// to be here: see the note above for why it moved and what it is holding.
const BODY_LIGHT = '#3F444D';

// ────────────────────────────────────────────────
// Theme palettes (EV semantic tokens)
// ────────────────────────────────────────────────
export const DARK_THEME = {
  bg:             '#131416',
  // card and cardElev carry muted text; they sit where they do so #9CA3AF
  // clears 4.5:1 on both. See MUTED_DARK — and keep cardElev lighter than
  // card, which is what makes a raised chip read as raised.
  card:           '#282B30',
  cardElev:       '#34383E',
  // A 1px rule, not a text background. Deliberately NOT darkened with the
  // surfaces above: see MUTED_DARK.
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
  // A progress track and a hairline. Neither is a text background, so both
  // keep #41454E while the surfaces above move — see MUTED_DARK.
  progressBg:     '#41454E',
  divider:        '#41454E',
  stickyBg:       'rgba(19,20,22,0.97)',
  // Tracks `card`: a stance button is a card-coloured surface carrying body
  // text, and the two were one value before this.
  stanceBg:       '#282B30',
  stanceText:     '#D3D7DE',
  // The button's outline, not its fill. Left at #41454E, which now reads a
  // little stronger against the darker stanceBg rather than weaker.
  stanceBorder:   '#41454E',
  // Clears WCAG AA (4.5:1) on every opaque surface in this theme — the broad
  // invariant, because this one is drawn on a TRANSPARENT background and the
  // chooser mounts on four different surfaces. Worst case is now the rule
  // tokens at #41454E (4.76:1); the old #6B7280 managed only 1.99:1 there.
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
  // See BODY_LIGHT — darkened to widen the muted tier from this end,
  // because light's surfaces had no room left to give.
  textBody:       BODY_LIGHT,
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
  // A rule on the sidebar, not a text background. Unmoved — which does leave
  // it a shade lighter than `card` now; that is fine, it is drawn on
  // `sidebar`, never on a card.
  sidebarBdr:   '#2A2D33',
  // Tracks DARK_THEME.card, which it has always equalled. See MUTED_DARK.
  card:         '#282B30',
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
  // This one DOES carry muted text — `{ background: th.flipBtn, color:
  // th.textMuted }` on the flip control — so it moves with cardElev, which is
  // the role it plays here. 4.64:1.
  flipBtn:      '#34383E',
};

export const FULL_LIGHT_THEME = {
  bg:           '#F7F7F8',
  sidebar:      '#FFFFFF',
  sidebarBdr:   '#E5E7EB',
  card:         '#FFFFFF',
  border:       '#D3D7DE',
  textHead:     '#2F3237',
  // See BODY_LIGHT.
  textBody:     BODY_LIGHT,
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
