// User-authored lenses: key generation, guest storage, and the shapes the
// /compass/my-lenses API expects.
//
// Pure functions only — no React, no fetch. Everything here is unit-tested; the
// wiring that uses it is covered by the smoke suite.

export const GUEST_LENS_STORAGE_KEY = "customLenses";

/**
 * A globally unique, client-generated lens key.
 *
 * Globally unique rather than per-user because lenses are meant to become
 * shareable: a per-user id would have to be rewritten at the moment of sharing,
 * invalidating any link already handed out. The `u_` prefix keeps user keys out
 * of the curated namespace ('local', 'federal', 'judicial') — both are read by
 * the same switcher row, so a user lens named 'federal' would otherwise shadow
 * the editorial one.
 *
 * Must satisfy the server's /^u_[a-z0-9]{4,32}$/.
 */
export function generateLensKey() {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `u_${hex}`;
}

/** Guest lenses, or [] for anything unreadable. Never throws. */
export function readGuestLenses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_LENS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeGuestLenses(lenses) {
  localStorage.setItem(GUEST_LENS_STORAGE_KEY, JSON.stringify(lenses));
}

export function clearGuestLenses() {
  localStorage.removeItem(GUEST_LENS_STORAGE_KEY);
}

/**
 * Merge a guest's local lenses into the account's on sign-in.
 *
 * The server copy wins on a shared key: it is the account's own canonical copy,
 * and a stale guest copy left in a browser must not overwrite it. Local-only
 * lenses are appended — they are work the user did that has no server copy yet.
 */
export function mergeLensSets(serverLenses, localLenses) {
  const server = Array.isArray(serverLenses) ? serverLenses : [];
  const local = Array.isArray(localLenses) ? localLenses : [];
  const seen = new Set(server.map((l) => l.key));
  return [...server, ...local.filter((l) => !seen.has(l.key))];
}

/**
 * Give a fresh key to any lens whose key the server reported as taken.
 *
 * Keys are globally unique, so a guest's randomly generated key can collide with
 * a different account's. The server answers 409 LENS_KEY_TAKEN with the offending
 * keys rather than silently dropping them — a no-op upsert was the original bug.
 */
export function regenerateConflictingKeys(lenses, conflictingKeys) {
  const taken = new Set(conflictingKeys || []);
  if (taken.size === 0) return lenses;
  return lenses.map((l) => (taken.has(l.key) ? { ...l, key: generateLensKey() } : l));
}

/**
 * The PUT body. Note `topicIds` -> `topic_ids`: the API is snake_case on the way
 * in and camelCase on the way out, matching the rest of /compass.
 *
 * Server-owned fields (needsRecalibration, createdAt, updatedAt) are dropped —
 * sending them back is harmless but meaningless, and it invites treating the
 * client's copy of a server computation as authoritative.
 */
export function toPutPayload(lenses) {
  return {
    lenses: lenses.map((l) => ({
      key: l.key,
      name: l.name,
      topic_ids: Array.isArray(l.topicIds) ? l.topicIds : [],
      visibility: l.visibility ?? "private",
    })),
  };
}
