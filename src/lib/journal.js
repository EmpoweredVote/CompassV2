/**
 * The topic journal — the compass's design diary, as the client reads it.
 *
 * An entry hangs off a QUESTION, not off the reader. That is the whole
 * difference from a recalibration flag, and it is what fixes the defect this
 * feature was built for: a flag's note becomes unreachable the moment the
 * reader answers, so the account of why a question changed disappeared exactly
 * when someone acted on it. A journal entry stays where it was published.
 *
 * 🔴 AND THAT IS WHY SUPPRESSION HAS TO BE DELIBERATE HERE. While the only note
 * was a flag's, a first-time voter could never see one — a flag requires a
 * prior answer, so the initial-build exclusion held by accident. Entries exist
 * independently of the reader, so the rule has to be written down. It is
 * `showsThread`, and it is the one function in this file that is a product
 * decision rather than a convenience.
 *
 * Nothing here fetches. The page owns the requests; this owns the meaning.
 */

/**
 * `/compass/journal/index` rows, keyed by topic.
 *
 * Failing to an empty Map is correct: no index means no ⓘ, which is where the
 * page was before this shipped. A thrown error on the calibration page would
 * cost a voter their session over a decorative affordance.
 */
export function indexJournal(rows) {
  const out = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r?.topicId) out.set(r.topicId, r);
  }
  return out;
}

/**
 * May this reader open this topic's thread?
 *
 * 🔴 THE INITIAL-BUILD EXCLUSION, AND IT IS CHRIS'S RULING, NOT A LAYOUT
 * PREFERENCE: change history must not reach a first-time voter building their
 * compass — "it'd overwhelm them and they'll see it when they go to
 * recalibrate." So: entries exist, AND the reader has already answered.
 *
 * ⚠ `answered` IS DECIDED FROM THE ANSWERS THE PAGE ALREADY HOLDS, which is
 * why it is an argument rather than something fetched. A guest's answers live
 * in localStorage and never reach the server, so a server-side check would hide
 * the thread from every guest forever — and a guest who has answered is exactly
 * the reader this is for.
 */
export function showsThread({ index, topicId, answered } = {}) {
  if (!answered || !index || !topicId) return false;
  return Number(index.get(topicId)?.entryCount) > 0;
}

/**
 * Tag the entry that explains the flag this reader is holding.
 *
 * 🔴 AN ID AGAINST AN ID, AND NULL MATCHES NOTHING. Every `watching` entry has
 * a null `revisionId` by definition, and a topic the open season does not ask
 * has a null `effectiveRevisionId` — so a loose equality would tell that reader
 * that every prediction the team ever wrote is the change that moved their
 * answer. The guard is the point of the function, not a precaution.
 */
export function markAffected(entries, flag) {
  const cause = flag?.effectiveRevisionId ?? null;
  return (Array.isArray(entries) ? entries : []).map((e) => ({
    ...e,
    affectsYou: cause !== null && e?.revisionId === cause,
  }));
}

/** An entry body is plain text (spec §9) — blank lines, and nothing else. */
export function paragraphs(body) {
  if (typeof body !== "string") return [];
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The day an entry was published, in the reader's own timezone.
 *
 * Unlike `formatSourceDate` this is a real instant rather than a bare day, so
 * local is right: the diary is dated by when the team posted, and a reader west
 * of Greenwich should not see tomorrow's date on it. An unparseable value
 * renders nothing rather than "Invalid Date".
 */
export function entryDate(publishedAt) {
  if (!publishedAt) return "";
  const d = new Date(publishedAt);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
