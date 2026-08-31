// Keeping lens chip colours legible on both themes.
//
// 🔴 THE BUG. `LensSwitcher` paints an INACTIVE chip's lens colour as its text
// and border (only the active chip uses it as a background). The curated lens
// colours are stored for a light background — federal is `#1E3A5F`, a dark navy
// — so on the dark page (`#131416`) an inactive federal chip sits at **1.6:1**.
// Reported as "in dark mode on the compass, it's really hard to read federal".
//
// It is not only federal, which is why this is a function and not a second
// hardcoded hex: judicial (`#C2440A`) is 3.6:1 and the custom-lens teal
// (`#00657C`) is 2.8:1 — both under the floor. Only local green passes.
//
// Colours come from the DB (`inform.compass_lenses.color`), so this has to cope
// with whatever a future row contains rather than assuming the current three.

/** The dark page background — Layout and CombinedPage both use it. */
export const DARK_PAGE_BG = "#131416";
export const LIGHT_PAGE_BG = "#FFFFFF";
/** WCAG AA for normal-size text. Chips are 12px bold, which is not "large". */
export const MIN_CONTRAST = 4.5;

function parseHex(hex) {
  if (typeof hex !== "string") return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = ([r, g, b]) =>
  "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

// WCAG relative luminance.
function relativeLuminance([r, g, b]) {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio, 1..21. Returns 1 for anything unparseable. */
export function contrastRatio(a, b) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return 1;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB -> HSL, each 0..1 except h in degrees. */
function rgbToHsl([r, g, b]) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = ((h % 360) + 360) % 360 / 360;
  const channel = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(hk + 1 / 3) * 255, channel(hk) * 255, channel(hk - 1 / 3) * 255];
}

/**
 * `color`, adjusted just enough to clear {@link MIN_CONTRAST} against `bg`.
 *
 * Moves LIGHTNESS in HSL and leaves hue and saturation alone, stopping at the
 * first 1% step that clears the floor. Mixing toward white would also work and
 * is simpler, but it desaturates: federal navy comes out `#6d7f97`, a washed
 * grey-blue. A lens chip is the lens's identity, so the hue has to survive being
 * made legible.
 *
 * A colour that already passes is returned byte-identical, never re-derived.
 * An unparseable colour is returned unchanged: a bad DB row should look wrong,
 * not blank the switcher.
 */
export function readableOn(color, bg) {
  const rgb = parseHex(color);
  const bgRgb = parseHex(bg);
  if (!rgb || !bgRgb) return color;
  if (contrastRatio(color, bg) >= MIN_CONTRAST) return color;

  const hsl = rgbToHsl(rgb);
  // Lighten on a dark background, darken on a light one.
  const up = relativeLuminance(bgRgb) < 0.5;

  for (let step = 1; step <= 100; step++) {
    const l = up
      ? Math.min(1, hsl.l + step / 100)
      : Math.max(0, hsl.l - step / 100);
    const hex = toHex(hslToRgb({ ...hsl, l }));
    if (contrastRatio(hex, bg) >= MIN_CONTRAST) return hex;
    if (l === 1 || l === 0) break;
  }
  // Unreachable against any legible page background; kept honest anyway.
  return toHex(up ? [255, 255, 255] : [0, 0, 0]);
}
