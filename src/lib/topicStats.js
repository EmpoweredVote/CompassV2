/**
 * What the officials said, turned into the one line a voter reads after they
 * answer.
 *
 * 🔴 AFTER THEY ANSWER. NEVER BEFORE. This is the whole safety rule of the
 * feature and it is a product rule, not a layout preference. The compass's
 * claim is that it does not push; a crowd figure shown above five unanswered
 * options is an anchor, and the bigger and truer the number the harder it
 * pulls. Nothing here is reachable without a `value`, so a caller cannot render
 * it early by accident — the only way to get a line is to have chosen.
 *
 * 🔴 THE SERVER DECIDES WHAT MAY BE CLAIMED. A topic whose ladder has ever been
 * remapped arrives with NO `byValue`, because the rungs in those buckets do not
 * all mean the same position and there is no honest share to state. This file
 * does not route around that: no `byValue` means the count line, full stop.
 */

/**
 * Below this many officials, a share is a fact about the sample rather than
 * about politics. Matches MIN_STATS_SAMPLE in the backend, where it was
 * measured: at 25, 43 of the 60 promoted topics can show a line at all.
 */
export const MIN_STATS_SAMPLE = 25;

/** The stats array from /compass/topic-stats, keyed by topic id. */
export function indexStats(rows) {
  const out = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r?.topicId) out.set(r.topicId, r);
  }
  return out;
}

const n = (x) => Number(x).toLocaleString();

/**
 * The line for one answer, or null when there is nothing honest to say.
 *
 * Returns { kind, total, agree, pct, text }:
 *   'share' — we can say how many officials picked the same option
 *   'count' — we can only say how many have taken a position at all
 *
 * ⚠ `agree: 0` IS A RESULT, NOT A MISSING ONE. "None of the 1,743 officials who
 * answered this picked that one" is true, interesting, and the single most
 * likely thing to be mistaken for a bug and silently dropped. It is kept.
 */
export function answerReveal({ stats, value, topicName } = {}) {
  if (!stats) return null;

  const total = Number(stats.total);
  if (!Number.isFinite(total) || total < MIN_STATS_SAMPLE) return null;

  const where = topicName ? ` on ${topicName}` : "";

  // A write-in sits BETWEEN rungs and is nobody's option, so there is no bucket
  // it could be compared against. The count is still true, so the count is what
  // it gets — the same line a non-comparable topic gets.
  const rung = Number(value);
  const onARung = Number.isInteger(rung) && rung >= 1 && rung <= 5;

  if (!onARung || !stats.byValue) {
    return {
      kind: "count",
      total,
      agree: null,
      pct: null,
      text: `${n(total)} officials have taken a position${where}.`,
    };
  }

  const agree = Number(stats.byValue[String(rung)] ?? 0);
  const pct = Math.round((agree / total) * 100);

  const text =
    agree === 0
      ? `Of the ${n(total)} officials who answered${where}, none picked this one.`
      : `You're with ${n(agree)} of the ${n(total)} officials who answered${where}.`;

  return { kind: "share", total, agree, pct, text };
}
