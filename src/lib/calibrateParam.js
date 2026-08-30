// The ?calibrate=<lensKey> arrival param.
//
// Essentials links people here to calibrate ONE named lens:
//   compass.empowered.vote/?calibrate=<key>&return=<url>
// It has sent that param since the Federal Lens shipped and this app never read
// it — App.jsx parsed only `return` — so the "Calibrate this lens" CTA has
// always landed on a generic Compass with nothing selected, curated lenses
// included.
//
// Pure functions only — no React, no fetch. The wiring that uses them lives in
// CombinedPage and is covered by the smoke suite.

import { LENSES } from "./lenses.js";

/** Where the key waits out a redirect. Mirrors ReturnBanner's session key. */
export const CALIBRATE_SESSION_KEY = "compass_calibrate_lens";

/** The server's user-lens key shape. Kept in step with userLenses.js. */
const USER_KEY_RE = /^u_[a-z0-9]{4,32}$/;

/**
 * Is this a key some lens could plausibly claim?
 *
 * NOT a security boundary — the value only ever reaches a `.find()` lookup, and
 * is never rendered or interpolated. It exists so a junk value cannot take up
 * residence in sessionStorage, where it would be retried on every navigation
 * for the rest of the session.
 */
export function isCalibrateKeyShape(key) {
  if (typeof key !== "string" || key.length === 0) return false;
  return USER_KEY_RE.test(key) || LENSES.some((l) => l.key === key);
}

/**
 * Stash the key out of a search string, without touching the URL.
 *
 * 🔴 THIS IS WHAT MAKES THE PARAM SURVIVE HelpGuard. An uncalibrated visitor is
 * redirected from `/` to `/results` by a <Navigate>, which unmounts the route
 * before CombinedPage ever renders — so nothing downstream gets the chance to
 * read the URL, and the query string is gone by the time anything can. The
 * redirect must therefore do the stashing itself, exactly as it already does
 * for `return` on ReturnBanner's behalf.
 *
 * No URL rewrite here: the redirect is about to discard the query anyway, and
 * mutating history during render would fight it.
 */
export function stashCalibrateKey(search) {
  try {
    const key = new URLSearchParams(search || "").get("calibrate");
    if (!isCalibrateKeyShape(key)) return "";
    sessionStorage.setItem(CALIBRATE_SESSION_KEY, key);
    return key;
  } catch {
    return "";
  }
}

/**
 * The pending lens key, from the URL if this is a fresh arrival, else from the
 * stash. Safe to call on every render; returns "" when there is nothing pending.
 *
 * Reads the URL on a direct arrival (a visitor who has already calibrated lands
 * on the route without a redirect) and otherwise reads the stash — which is how
 * it picks up what stashCalibrateKey saved on the way through HelpGuard.
 *
 * ⚠ Deletes ONLY the `calibrate` param. `return` belongs to ReturnBanner, which
 * does its own read-and-strip; rewriting the whole query here would consume it
 * before that component mounts and silently kill the way back to Essentials.
 */
export function takeCalibrateKey() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("calibrate");
    if (fromUrl) {
      // Strip it either way — a malformed key should not survive in the URL to
      // be re-read on the next render.
      const url = new URL(window.location.href);
      url.searchParams.delete("calibrate");
      history.replaceState(null, "", url.pathname + url.search + url.hash);

      if (!isCalibrateKeyShape(fromUrl)) return "";
      try {
        sessionStorage.setItem(CALIBRATE_SESSION_KEY, fromUrl);
      } catch { /* private mode — a direct arrival still works, a redirect does not */ }
      return fromUrl;
    }
  } catch { /* malformed URL — fall through to the stash */ }

  try {
    const stored = sessionStorage.getItem(CALIBRATE_SESSION_KEY);
    return isCalibrateKeyShape(stored) ? stored : "";
  } catch {
    return "";
  }
}

/** Consume the pending key. Called once the arrival has been acted on. */
export function clearCalibrateKey() {
  try {
    sessionStorage.removeItem(CALIBRATE_SESSION_KEY);
  } catch { /* nothing to clear */ }
}

/**
 * The lens this key names, plus the subset of its topics that actually exist.
 *
 * Returns null when there is nothing to calibrate, which is a normal outcome and
 * not an error: the key may name someone else's lens or one deleted since
 * Essentials linked to it. The caller falls through to an ordinary arrival —
 * being told "that lens is gone" on landing is worse than simply landing.
 *
 * Topics are filtered against the loaded set for the same reason
 * CalibrationOverlay filters startWithTopicIds: an id the current season does
 * not serve has no stances, and would render an unanswerable question. A lens
 * with nothing answerable left resolves to null rather than opening an empty
 * calibration.
 */
export function resolveCalibrateLens(key, lenses, topics) {
  if (!key) return null;

  const lens = (Array.isArray(lenses) ? lenses : []).find((l) => l?.key === key);
  if (!lens) return null;

  const ids = Array.isArray(lens.topicIds) ? lens.topicIds : [];
  const known = new Set((Array.isArray(topics) ? topics : []).map((t) => t?.id));
  const topicIds = ids.filter((id) => known.has(id));
  if (topicIds.length === 0) return null;

  return { lens, topicIds };
}
