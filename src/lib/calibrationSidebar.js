// calibrationSidebar.js
// How the full calibration page's sidebar is grouped.
//
// Normally it is the topic categories, in order. With a lens selected, that
// lens's questions are PINNED in a group above them — answering "what does this
// lens actually ask?" at a glance — and the whole library stays below, so
// nothing becomes unreachable just because you were curious about a lens.
//
// Pinned rather than filtered on purpose: the reason to calibrate here instead
// of in the overlay is that everything is in front of you.

export const PINNED_GROUP_ID = '__lens__';

/**
 * Sidebar groups for the current view.
 *
 * `lens` is a view choice local to this page. It deliberately has nothing to do
 * with the compass's activeLensKey, which decides whether the user's selection
 * gets written to the server — browsing by lens while calibrating must not
 * change anyone's compass.
 */
export function buildSidebarGroups({ categories, lens } = {}) {
  const groups = Array.isArray(categories) ? categories : [];
  if (!lens || !Array.isArray(lens.topicIds) || lens.topicIds.length === 0) {
    return groups;
  }

  // Resolve against the topics actually on screen. A lens can name a question
  // the current season does not serve, and a row with nothing behind it cannot
  // be answered.
  const byId = new Map();
  for (const cat of groups) {
    for (const tp of cat.topics ?? []) byId.set(tp.id, tp);
  }

  // Lens order, not category order: a lens is an editorial sequence.
  const pinned = lens.topicIds.map((id) => byId.get(id)).filter(Boolean);
  if (pinned.length === 0) return groups;

  return [
    { id: PINNED_GROUP_ID, title: lens.name, topics: pinned, pinned: true, lensKey: lens.key },
    ...groups,
  ];
}
