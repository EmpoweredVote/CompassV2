/**
 * How a recalibration flag reads on the compass.
 *
 * 🔴 THE SERVER DECIDES WHAT IS FLAGGED. THIS FILE DECIDES ONLY HOW IT READS.
 * CC_0061 owns the rule and hands each flag a `disposition` — one of `fresh`,
 * `reworded`, `moved`, `invalidated` — via /compass/recalibration-flags and
 * /compass/my-lenses. Nothing here re-derives it.
 *
 * ⚠ READ `disposition`, NOT `reason`. `moved` and `reworded` both arrive as
 * reason `question_revised`, because that is what the user is told either way —
 * but only `moved` means the value was WITHHELD and the spoke is blank. Copy
 * keyed on `reason` tells those six users their answer "was given against the
 * earlier wording" while it is missing from the chart entirely.
 *
 * The one exception is `not_asked_this_season`, which is decided from the
 * effective revision rather than the disposition and so arrives carrying
 * `fresh`. Reason wins for that case, and only that case.
 */

/** The two dispositions whose value was withheld. */
const SUPPRESSED = new Set(["moved", "invalidated"]);

/**
 * Was this answer's value withheld?
 *
 * Fails open on anything unrecognised: a disposition this client has not heard
 * of must not be treated as a reason to blank somebody's answer.
 */
export function isSuppressed(disposition) {
  return SUPPRESSED.has(disposition);
}

const COPY = {
  reworded: {
    title: "This question was updated",
    body: "Your answer still stands — it was given against the earlier wording. Worth a look?",
    action: "Review",
  },
  moved: {
    title: "The scale for this question changed",
    body:
      "The option you picked sits in a different place now, so we've set your answer aside " +
      "rather than move it for you.",
    action: "Recalibrate",
  },
  invalidated: {
    title: "The option you chose no longer exists",
    body:
      "This question was rewritten and the stance you picked isn't one of the choices any " +
      "more, so your answer has been set aside.",
    action: "Recalibrate",
  },
  not_asked_this_season: {
    title: "This question isn't part of the current season",
    body: "Your answer is kept. It just isn't one of the questions being asked right now.",
    action: null,
  },
};

/**
 * The words for one flag: { title, body, action }.
 *
 * `action: null` means there is nothing for the user to do — the popover shows
 * "Close" alone.
 */
export function copyFor(flag) {
  if (!flag) return COPY.reworded;

  // The one case reason wins: it carries disposition 'fresh' but is not silent.
  if (flag.reason === "not_asked_this_season") return COPY.not_asked_this_season;

  return COPY[flag.disposition] ?? COPY.reworded;
}

/**
 * How loudly to mark the spoke: 'loud' | 'quiet'.
 *
 * 🔴 WHY TWO WEIGHTS. At the changeover there are 89 reworded answers against 7
 * suppressed — roughly half of every affected compass. One amber warning on half
 * a compass is a warning nobody reads, and the seven that actually lost a value
 * are the ones that need acting on. Both weights stay clickable and both open
 * the same popover; nothing is hidden, only the loudness differs.
 */
export function flagWeight(flag) {
  return isSuppressed(flag?.disposition) ? "loud" : "quiet";
}

/**
 * One flag per topic, from both sources the client has.
 *
 * The compass flags cover the user's SELECTED topics — the spokes they are
 * looking at — and the lens flags cover the active custom lens. They overlap
 * whenever a selected topic also sits in the active lens, and they agree,
 * because both come from the same server rule.
 *
 * ⚠ WHERE THEY DISAGREE, THE SUPPRESSED RECORD WINS. Only a suppressed answer
 * has a blank spoke to explain, so losing it to a merge-order accident is the
 * one outcome that leaves a user with no explanation at all.
 */
export function mergeFlags({ compassFlags, lensFlags, dismissed } = {}) {
  const skip = dismissed ?? new Set();
  const out = new Map();

  for (const flag of [...(lensFlags ?? []), ...(compassFlags ?? [])]) {
    if (!flag?.topicId || skip.has(flag.topicId)) continue;

    const existing = out.get(flag.topicId);
    if (existing && isSuppressed(existing.disposition) && !isSuppressed(flag.disposition)) {
      continue;
    }
    out.set(flag.topicId, flag);
  }

  return out;
}

/**
 * The off-compass flags, split by whether a value was actually lost.
 *
 * 🔴 WHY THIS IS A SEPARATE SET. /compass/recalibration-flags covers EVERY
 * answered topic, not just the selected ones, because scoping it to the
 * selection reached only 12 of the 96 non-fresh answers at the changeover —
 * `invalidated` 0 of 1, `moved` 2 of 6. Most answers are not on the user's
 * current spokes, so most flags have no pill to hang on, and an answer set aside
 * off-screen is still set aside: it is already missing from
 * compass_responses_effective for scoring and every other reader.
 *
 * ⚠ TWO GROUPS, NOT ONE COUNT, AND THE RATIO IS WHY. At the changeover the
 * off-compass flags are 5 `setAside` against 79 `updated`. Summing them would
 * announce "84 answers need attention" when 79 of them are intact and only the
 * wording moved — collapsing the exact distinction the three copy states and the
 * two-weight marker both exist to preserve. So the caller gets both counts and
 * can give each its own weight.
 *
 * `not_asked_this_season` is in neither group: no value was withheld, and the
 * question is not on the board to re-answer.
 */
export function offCompassFlags(flagsByTopic, selectedTopics) {
  const setAside = [];
  const updated = [];
  if (!flagsByTopic) return { setAside, updated };

  const onCompass = new Set(selectedTopics ?? []);

  for (const flag of flagsByTopic.values()) {
    if (!flag?.topicId || onCompass.has(flag.topicId)) continue;
    if (flag.reason === "not_asked_this_season") continue;

    if (isSuppressed(flag.disposition)) setAside.push(flag);
    else if (flag.disposition === "reworded") updated.push(flag);
  }

  return { setAside, updated };
}
