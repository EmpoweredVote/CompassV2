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

/** Where the key waits out a redirect. Mirrors ReturnBanner's session key. */
export const CALIBRATE_SESSION_KEY = "compass_calibrate_lens";

/** The server's user-lens key shape. Kept in step with userLenses.js. */
const USER_KEY_RE = /^u_[a-z0-9]{4,32}$/;

/**
 * The shape of a curated lens key (inform.compass_lenses.key): lowercase, short.
 *
 * 🔴 THIS USED TO BE `LENSES.some(l => l.key === key)` — AN ALLOWLIST OF THE
 * THREE BUNDLED CONSTANTS, AND IT SILENTLY BROKE EVERY NEW LENS. The Education
 * Lens existed in the DB and was served by /compass/lenses for weeks, but
 * `?calibrate=education` — the link Essentials emits from a school-board race —
 * was rejected here, never stashed, and the visitor landed on a generic empty
 * Compass. That is the exact failure #74 fixed for the other three, reintroduced
 * for the fourth by an allowlist that only the client knew about.
 *
 * Matching on shape instead means a lens added to the DB works the day it is
 * added. Safe to loosen, because this was never a security boundary: an
 * unrecognised key reaches `resolveCalibrateLens`, fails a `.find()`, returns
 * null, and the visitor gets an ordinary arrival. The check exists only so junk
 * cannot take up residence in sessionStorage and be retried on every navigation
 * for the rest of the session — which shape-matching still prevents.
 */
const CURATED_KEY_RE = /^[a-z][a-z0-9_-]{1,31}$/;

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
  // `u_` is a RESERVED PREFIX, so a key claiming it must satisfy the stricter
  // user-lens pattern and never fall through to the looser curated one. Without
  // this branch the malformed `u_` passes as a plausible curated key — caught by
  // the existing "rejects anything else" test, which is why that test is there.
  if (key.startsWith("u_")) return USER_KEY_RE.test(key);
  return CURATED_KEY_RE.test(key);
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
