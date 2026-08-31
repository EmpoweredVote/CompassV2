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

/**
 * The capped projection of answers published to shared context, plus the count
 * of what was in scope before the cap.
 *
 * `n` is what lets a consumer distinguish a payload that is merely SCOPED from
 * one the cap TRUNCATED. Publishing fewer answers than the user has is normal —
 * the scope is the compass plus any active lens, not the user's whole history —
 * so "fewer than they have" carries no signal. `n > Object.keys(a).length` does:
 * it means topics that were supposed to be sent were dropped.
 *
 * `n` counts only scoped topics that actually HAVE an answer. An unanswered
 * scoped topic was never going to be sent, and counting it would report a drop
 * that never happened.
 *
 * With nothing in scope, or before topics have loaded, there is no
 * id -> short_title map to scope with, so the complete answer set is published
 * and `n` equals its size — no drop, nothing to report.
 */
export function buildSharedAnswers({ answerScope, topics, answers, cap }) {
  const all = answers && typeof answers === "object" ? answers : {};
  // Dedupe before the cap, not after: the cap is a budget of distinct topics,
  // and slicing first would spend it on repeats.
  const scope = Array.isArray(answerScope) ? [...new Set(answerScope)] : [];
  if (scope.length === 0 || !Array.isArray(topics) || topics.length === 0) {
    return { a: all, n: Object.keys(all).length };
  }
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const inScope = scope
    .map((id) => {
      const t = topicById.get(id);
      return t && all[t.short_title] != null ? [t.short_title, all[t.short_title]] : null;
    })
    .filter(Boolean);
  return { a: Object.fromEntries(inScope.slice(0, cap)), n: inScope.length };
}
