// The "Best Match" comparison mode.
//
// Picks the spokes for a politician comparison from the topics BOTH sides have
// answered: the user's own compass topics first, then the biggest disagreements.
// It is the honest home for behaviour Compass used to do invisibly — before
// #78, any spoke the politician had not answered was silently swapped for some
// other topic the user had answered, in whatever order the pool happened to be
// in. Under a lens that produced axes nobody asked for; with no lens it was
// useful but unnamed and unordered. Now it is opt-in, named, and ordered.
//
// 🔴 THIS IS NOT A LENS. `activeLensKey` decides whether the user's compass may
// be written to the server (see compassSync.js — a lens is a view, not the
// compass). Best Match is default-ON while comparing, so routing it through
// activeLensKey would stop every comparing user's compass from being saved.
// It is a display mode that merely renders as a chip.
//
// Ported from essentials `computeDisplaySpokes` (src/lib/compass.js), which is
// the source of truth for the ordering rules. Compass has no district scoping,
// so the "in scope" test there is simply "is a known topic" here.

export const MAX_SPOKES = 8;
/** Below this, the caller draws nothing: two axes is a line, not a compass. */
export const MIN_SPOKES = 3;

const answered = (values, id) => {
  const v = values?.[id];
  return v != null && v > 0;
};

/**
 * @param {object}   params
 * @param {string[]} params.selectedTopics - the user's compass, in their order
 * @param {Array}    params.topics         - all known topics, in display order
 * @param {object}   params.userValues     - topic id -> the user's answer
 * @param {object}   params.polValues      - topic id -> the politician's answer
 * @param {number}   [params.maxSpokes]
 * @returns {{ displayTopicIds: string[], hasEnoughSpokes: boolean }}
 */
export function bestMatchSpokes({
  selectedTopics = [],
  topics = [],
  userValues = {},
  polValues = {},
  maxSpokes = MAX_SPOKES,
} = {}) {
  const known = new Set(topics.map((t) => t.id));
  const isCandidate = (id) =>
    known.has(id) && answered(userValues, id) && answered(polValues, id);

  const chosen = new Set();
  const displayTopicIds = [];

  // 1. The user's own compass, in their order. Their choices outrank ours.
  for (const id of (selectedTopics || []).slice(0, maxSpokes)) {
    if (displayTopicIds.length >= maxSpokes) break;
    if (chosen.has(id) || !isCandidate(id)) continue;
    chosen.add(id);
    displayTopicIds.push(id);
  }

  // 2. Fill the rest with the biggest disagreements — the spokes where seeing
  //    the difference is worth an axis. Ties go to display order so the result
  //    is stable rather than dependent on object key order.
  if (displayTopicIds.length < maxSpokes) {
    const remaining = [];
    topics.forEach((t, idx) => {
      if (chosen.has(t.id) || !isCandidate(t.id)) return;
      remaining.push({
        id: t.id,
        diff: Math.abs(userValues[t.id] - polValues[t.id]),
        idx,
      });
    });
    remaining.sort((a, b) => (b.diff !== a.diff ? b.diff - a.diff : a.idx - b.idx));

    for (const c of remaining) {
      if (displayTopicIds.length >= maxSpokes) break;
      chosen.add(c.id);
      displayTopicIds.push(c.id);
    }
  }

  return {
    displayTopicIds,
    hasEnoughSpokes: displayTopicIds.length >= MIN_SPOKES,
  };
}
