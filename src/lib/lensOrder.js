/**
 * A saved lens order is an ORDERING, never a MEMBERSHIP.
 *
 * 🔴 THE BUG THIS REPLACES. Entering a lens used to read the saved order, filter it
 * to ids still in the lens, and — if anything at all survived — use that INSTEAD of
 * the lens. So a saved order that predated a change to the lens silently truncated
 * it: every topic the saved list did not mention disappeared.
 *
 * It went live on 2026-09-09. `CC_0086` re-derived the Federal Lens (immigration
 * and medicare/aid out, voting-rights and civil-rights in), and every user who had
 * ever reordered that lens would have opened it to find SIX spokes instead of
 * eight, with no error and nothing to click. The two new topics were not in their
 * saved order, so they were not shown.
 *
 * The fix is to treat the saved list as what it is. Ids it knows are placed in the
 * order it remembers; ids it does not know are appended in the lens's own order. A
 * stale order can then re-sort what it recognises and can never hide anything.
 *
 * @param {string[]} lensTopicIds  the lens's topics, in the lens's own order,
 *                                 already filtered to topics that actually loaded
 * @param {unknown}  saved         whatever came out of localStorage, trusted for
 *                                 nothing
 * @param {number}   max           spoke cap
 * @returns {string[]}             topic ids to display
 */
export function orderLensTopics(lensTopicIds, saved, max) {
  const canonical = Array.isArray(lensTopicIds) ? lensTopicIds : [];
  const capped = canonical.slice(0, max);
  if (!Array.isArray(saved) || saved.length === 0) return capped;

  // Validate against the topics that LOADED, not against the raw lens payload. An
  // id for a topic the client does not have would otherwise survive and render a
  // spoke with nothing behind it.
  const known = new Set(canonical);
  const seen = new Set();
  const ordered = [];
  for (const id of saved) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  if (ordered.length === 0) return capped;

  // Everything the saved order never mentioned, in the lens's order. This is the
  // half that was missing.
  const appended = canonical.filter((id) => !seen.has(id));
  return [...ordered, ...appended].slice(0, max);
}
