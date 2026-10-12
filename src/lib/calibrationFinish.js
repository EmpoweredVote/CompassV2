// calibrationFinish.js
// What a finished calibration run does to the user's compass selection.
//
// Two different things end at the same handler:
//
//   A normal run — a lens, or topics the user picked — IS the compass. Whatever
//   they answered becomes their selection, replacing what was there.
//
//   A re-ask run (the "questions were updated … Review" prompt) is not. It
//   re-asks questions whose wording changed, including ones that are not on the
//   compass at all; the prompt literally promises "your answers still stand".
//   It must leave the selection alone.
//
// Both paths used to replace the selection with every reviewed question, with
// no cap. After a season published a batch of revisions, reviewing them
// replaced an 8-topic compass with all 17 reviewed questions — the user's own
// compass silently discarded and the chart rendered unreadably wide.

export const MAX_COMPASS_TOPICS = 8;

/** A re-ask run is one opened with an explicit list of questions to revisit. */
export function isRecalibrationRun(startWithTopicIds) {
  return Array.isArray(startWithTopicIds) && startWithTopicIds.length > 0;
}

/**
 * The selection to write when a run finishes, or null to leave it untouched.
 *
 * The cap is defence in depth: no normal run should produce more than
 * MAX_COMPASS_TOPICS, but nothing downstream enforces it, and an uncapped write
 * is exactly what made the compass unusable.
 */
export function nextCompassSelection({
  answeredIds,
  isRecalibration = false,
  maxTopics = MAX_COMPASS_TOPICS,
} = {}) {
  if (isRecalibration) return null;
  if (!Array.isArray(answeredIds)) return null;
  return answeredIds.slice(0, maxTopics);
}
