// calibrationQueue.js
// Which topic Full Calibration shows next.
//
// The page was built as a fill-the-gaps queue: it opens on the first unanswered
// topic and, after each answer, jumps to the next gap. That has no answer for a
// compass with no gaps left, so opening the page fully calibrated dropped the
// user straight onto the "Fully Calibrated" screen with nowhere to go but out —
// even though the sidebar can already target any topic for revision.
//
// Review mode is that second case: the compass was already complete when the
// page opened. There are no gaps to chase, so the queue simply walks the list
// in order and the session never auto-ends.

/** True when nothing in `allTopics` is still unanswered. */
export function isFullyAnswered(allTopics, answers) {
  if (!allTopics || allTopics.length === 0) return false;
  return allTopics.every((tp) => answers?.[tp.short_title] > 0);
}

/**
 * The topic to show after `currentId`.
 *
 * Prefers the next unanswered topic after the current one, then wraps to any
 * remaining gap. With no gaps left it returns the following topic in list order
 * when reviewing, or null when filling gaps — null is what ends the session and
 * shows the completion screen, so it must stay reachable for a genuine finish.
 */
export function nextTopicFrom(allTopics, currentId, answers, reviewMode = false) {
  if (!allTopics || allTopics.length === 0) return null;
  const curIdx = allTopics.findIndex((tp) => tp.id === currentId);

  const answered = (tp) => answers?.[tp.short_title] > 0;
  const nextGap =
    (curIdx >= 0 ? allTopics.slice(curIdx + 1).find((tp) => !answered(tp)) : null) ||
    allTopics.find((tp) => tp.id !== currentId && !answered(tp));
  if (nextGap) return nextGap;

  // No gaps. Reviewing walks forward; the last topic stays put rather than
  // wrapping, so a revision pass ends somewhere predictable and the sidebar
  // remains the way to jump anywhere else.
  if (reviewMode && curIdx >= 0) return allTopics[curIdx + 1] ?? null;
  return null;
}
