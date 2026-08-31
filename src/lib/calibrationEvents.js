// What the calibration overlay reports to analytics, and when.
//
// These rules live here as pure functions because the overlay component is ~2000
// lines and cannot be driven from a unit test, while the rules themselves are
// exactly the part that is easy to get quietly wrong: an event that fires from
// the wrong moment produces a funnel that looks healthy and means nothing.
// Same reasoning as compassSync.js.
//
// 🔴 THE BUG THAT MOTIVATED THIS. The overlay fired `compass_quiz_started` from
// a bare `useEffect(…, [])` — i.e. on mount. But the overlay MOUNTS ITSELF for
// anyone uncalibrated (CombinedPage auto-routes: "don't show a partial/broken
// compass"). So the funnel's "started" step counted *the overlay appearing*, and
// a welcome screen nobody pressed was indistinguishable from a calibration
// somebody chose to begin. Opening and starting are separated here.
//
// Every event name below already exists in the @empoweredvote/analytics catalog.
// The `surface`, `entry_step`, `entry_reason`, `from_step`, `exit_from`,
// `exit_via` and `answer_type` props do NOT yet — a follow-up PR to that repo
// codifies them. track() does not validate at runtime, so they flow through
// today; the catalog is a contract for humans, and it is currently behind.

/** Every step the overlay can deposit a user on, or exit from. */
export const STEPS = {
  WELCOME: "welcome",
  LENS_INTRO: "lens_intro",
  PICK: "pick",
  ANSWER: "answer",
  COMPLETE: "complete",
};

/** Why the overlay is on screen. Answers "did we show this, or did they ask?" */
export const ENTRY_REASONS = {
  /** Auto-routed: no compass at all yet. */
  AUTO_UNCALIBRATED: "auto_uncalibrated",
  /** Auto-routed: has a compass, but some selected topics are unanswered. */
  AUTO_UNANSWERED: "auto_unanswered_topics",
  /** Arrived on a ?calibrate= link, from Essentials or a shared lens. */
  LENS_LINK: "lens_link",
  /** Pressed something that opens calibration deliberately. */
  USER_REQUESTED: "user_requested",
};

// How the user left. A mis-tap and a decision are not the same signal.
//
// Leaving mid-answers with enough answered to keep a compass is deliberately
// NOT here: that path ends on the complete step, so it reports a completion.
// Recording it as an abandonment too would count one session as both, and
// `answered_count < total_topics` on the completion already says they left
// questions on the table.
export const EXIT_VIA = {
  /** "Skip for now" / the dismiss control. */
  DISMISS: "dismiss",
  /** The Back arrow, reversing out of the first question. */
  BACK: "back",
};

const SURFACE = "overlay";

/**
 * The overlay is on screen. Returns the events to fire, in order.
 *
 * Two events rather than one when the overlay opens PAST the welcome screen: a
 * resumed or lens-scoped overlay never shows a welcome, so there is no press to
 * wait for and opening is starting. Firing only the open event there would show
 * sessions answering questions they had never started.
 */
export function eventsForOpen({ entryStep, entryReason, lens, resume, totalTopics }) {
  const open = {
    event: "compass_quiz_started",
    props: {
      quiz_type: "calibration",
      lens,
      surface: SURFACE,
      entry_step: entryStep,
      entry_reason: entryReason,
      resume: Boolean(resume),
    },
  };
  // topic_count is optional in the catalog; 0 would read as "a calibration of
  // no topics" rather than "not chosen yet".
  if (totalTopics > 0) open.props.topic_count = totalTopics;

  if (entryStep === STEPS.WELCOME) return [open];
  return [open, eventForGetStarted({ fromStep: entryStep, totalTopics, lens })];
}

/**
 * Calibration has actually begun — either the user pressed through the welcome
 * screen, or the overlay opened somewhere that implies a start.
 *
 * ⚠ Shares `compass_calibration_started` with the /calibrate page, whose volume
 * is ~nil. `surface` separates them going forward; its absence means the old
 * page.
 */
export function eventForGetStarted({ fromStep, totalTopics, lens }) {
  return {
    event: "compass_calibration_started",
    props: {
      total_topics: totalTopics,
      surface: SURFACE,
      from_step: fromStep,
      lens,
    },
  };
}

/**
 * One question answered. `answered_count` on every event is what makes the
 * interior of the flow legible — it gives the drop curve by question number,
 * which is finer than by step.
 */
export function eventForAnswer({ topicSlug, answeredCount, totalTopics, answerType }) {
  return {
    event: "compass_calibration_question_answered",
    props: {
      topic_slug: topicSlug,
      answered_count: answeredCount,
      total_topics: totalTopics,
      surface: SURFACE,
      answer_type: answerType,
    },
  };
}

/** One question skipped past. Same counts as an answer, so the two compare. */
export function eventForQuestionSkip({ topicSlug, answeredCount, totalTopics }) {
  return {
    event: "compass_calibration_question_skipped",
    props: {
      topic_slug: topicSlug,
      answered_count: answeredCount,
      total_topics: totalTopics,
      surface: SURFACE,
    },
  };
}

/** Reached the end. The counts are new: completions carried only a lens before. */
export function eventForComplete({ answeredCount, totalTopics, lens }) {
  return {
    event: "compass_calibration_completed",
    props: {
      answered_count: answeredCount,
      total_topics: totalTopics,
      lens,
      surface: SURFACE,
    },
  };
}

/** Left before completing. */
export function eventForAbandon({ exitFrom, exitVia, answeredCount, totalTopics }) {
  return {
    event: "compass_calibration_abandoned",
    props: {
      answered_count: answeredCount,
      total_topics: totalTopics,
      // The welcome-screen exit is the most common one and has nothing picked,
      // so this divides by zero. NaN ingests as null and drops the row out of
      // any numeric filter on progress_pct.
      progress_pct: totalTopics > 0 ? Math.round((answeredCount / totalTopics) * 100) : 0,
      exit_from: exitFrom,
      exit_via: exitVia,
      surface: SURFACE,
    },
  };
}
