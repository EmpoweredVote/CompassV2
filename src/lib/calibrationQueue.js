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

/**
 * Whether a topic still needs an answer from the user.
 *
 * Having a value is not enough. A question the season reworded keeps whatever
 * the user said against the OLD wording, so treating it as answered is how the
 * re-ask flow came to offer "Finish" on its first screen and re-answer nothing.
 * `mustReanswer` holds the topics the user arrived to revisit; they owe an
 * answer until they give one, at which point the caller drops them from the set.
 */
export function needsAnswer(topic, answers, mustReanswer) {
  if (!topic) return false;
  if (mustReanswer?.has(topic.id)) return true;
  return !(answers?.[topic.short_title] > 0);
}

/** True when nothing in `allTopics` still needs an answer. */
export function isFullyAnswered(allTopics, answers, mustReanswer) {
  if (!allTopics || allTopics.length === 0) return false;
  return allTopics.every((tp) => !needsAnswer(tp, answers, mustReanswer));
}

/**
 * The topic to show after `currentId`.
 *
 * Prefers the next unanswered topic after the current one, then wraps to any
 * remaining gap. With no gaps left it returns the following topic in list order
 * when reviewing, or null when filling gaps — null is what ends the session and
 * shows the completion screen, so it must stay reachable for a genuine finish.
 */
export function nextTopicFrom(
  allTopics,
  currentId,
  answers,
  reviewMode = false,
  mustReanswer = null
) {
  if (!allTopics || allTopics.length === 0) return null;
  const curIdx = allTopics.findIndex((tp) => tp.id === currentId);

  // A genuine gap outranks a revision: the compass cannot draw a spoke that was
  // never answered at all, whereas a reworded one still has a value to show.
  const open = (tp, must) => needsAnswer(tp, answers, must);
  const scan = (must) =>
    (curIdx >= 0 ? allTopics.slice(curIdx + 1).find((tp) => open(tp, must)) : null) ||
    allTopics.find((tp) => tp.id !== currentId && open(tp, must));

  const nextGap = scan(null) || (mustReanswer ? scan(mustReanswer) : null);
  if (nextGap) return nextGap;

  // No gaps. Reviewing walks forward; the last topic stays put rather than
  // wrapping, so a revision pass ends somewhere predictable and the sidebar
  // remains the way to jump anywhere else.
  if (reviewMode && curIdx >= 0) return allTopics[curIdx + 1] ?? null;
  return null;
}
