/**
 * How far through a lens's own questions you are.
 *
 * 🔴 WHY THIS EXISTS. The calibration header counts the whole library — "14 /
 * 60", "23%" — which is a number about our question set, not about anything a
 * person wants. Sixty undifferentiated questions have no shape and no finish
 * line short of all of them.
 *
 * A lens does. Federal is eight questions and they are the eight that decide a
 * federal seat. Showing each lens's own fraction turns one long list into three
 * or four finishable things, and it costs nothing new: the chips are already on
 * screen wearing their own icon and colour, and `topicIds` is already in hand.
 *
 * ⚠ COUNTED AGAINST THE SERVED TOPICS, NOT AGAINST `topicIds`. A lens may name
 * a topic this season does not ask — `displayLenses` already filters curated
 * lenses on exactly that, and a USER lens is whatever the user saved, which can
 * outlive a season. Dividing by the raw list gives a lens that can never reach
 * full and a voter with no way to find the missing one.
 */

/**
 * { answered, total, pct, complete } for one lens.
 *
 * `answers` is keyed by `short_title` (the shape the calibration page holds),
 * so the topic rows are needed to get from a lens's topic ids to those keys.
 */
export function lensProgress({ lens, topics, answers } = {}) {
  const ids = Array.isArray(lens?.topicIds) ? lens.topicIds : [];
  const served = Array.isArray(topics) ? topics : [];
  const given = answers ?? {};

  const byId = new Map(served.map((t) => [t?.id, t]));

  let answered = 0;
  let total = 0;
  for (const id of ids) {
    const topic = byId.get(id);
    if (!topic) continue; // named by the lens, not asked this season
    total += 1;
    if (given[topic.short_title] > 0) answered += 1;
  }

  return {
    answered,
    total,
    // A lens with nothing served is 0%, not NaN% and not 100%: there is nothing
    // to have finished, and rounding an empty set up to complete would put a
    // tick on a lens the voter has never been asked a question from.
    pct: total > 0 ? Math.round((answered / total) * 100) : 0,
    complete: total > 0 && answered === total,
  };
}
