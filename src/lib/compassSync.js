// The two rules that decide what counts as "the user's compass".
//
// Both used to be inline in CompassContext, and both used to answer the question
// by INFERENCE — testing whether the current topic set happened to match a lens
// definition. That inference is only safe while lenses are curated sets of
// topics the user did not choose. A user-authored lens is built from the user's
// own topics, so "save my compass as a lens" makes the compass match a lens by
// construction, and the inference then reports a lens while the user is looking
// at their own compass. The compass stops being saved. Silently. For good.
//
// They live here as pure functions so the rules can be tested directly. Driving
// them end-to-end would need a real compass edit in the browser, and
// CombinedPage carries no test hooks to drive one — see the smoke commit.

/**
 * May the current selected topics be written to the server as the user's
 * compass?
 *
 * 🔴 `selectedTopics` IS DELIBERATELY NOT AN INPUT. Nothing about the *contents*
 * of the compass can tell you whether it is a compass. Only `activeLensKey` —
 * the record of what the user actually chose to view — can.
 */
export function shouldSyncCompass({ serverLoaded, isLoggedIn, activeLensKey }) {
  // Reading the server's copy first is what stops a stale localStorage compass
  // from overwriting the account's real one on load.
  if (!serverLoaded) return false;
  // Guests have no server compass to write to.
  if (!isLoggedIn) return false;
  // A lens is a view, not the compass.
  if (activeLensKey) return false;
  return true;
}

/**
 * Which topic list represents the user's compass for the shared ev-context
 * payload — the `s` field other apps read as "my compass".
 *
 * While a lens is active `selectedTopics` holds the lens, so the real compass is
 * the stash. The fallback to `selectedTopics` when nothing is stashed is
 * deliberate: publishing an empty compass would tell every other app the user
 * has none, which is worse than briefly publishing the lens.
 */
export function compassToPublish({ activeLensKey, selectedTopics, preLensTopics }) {
  if (!activeLensKey) return selectedTopics;
  return Array.isArray(preLensTopics) && preLensTopics.length > 0
    ? preLensTopics
    : selectedTopics;
}
