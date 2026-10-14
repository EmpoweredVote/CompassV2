import { paragraphs, entryDate } from "../lib/journal";

/**
 * The design diary for one question, newest first.
 *
 * 🔴 THIS IS ADDRESSED TO EVERYBODY, AND THE FLAG NOTE ABOVE IT IS NOT. The
 * `publicNote` in the block above says why *your* answer needs another look; an
 * entry here says why the question is the way it is, to any reader. They sit in
 * one panel because a reader wants both, not because they are the same thing —
 * and a `watching` entry has no flag it could ever belong to.
 *
 * Read-only. There is no composer here and there is never going to be one: the
 * Compass publishes, Focused Communities will host the conversation.
 *
 * Plain text by design (spec §9) — no markdown, no links, no embedded HTML. The
 * body is split on blank lines and rendered as paragraphs, and that is the
 * whole of it.
 */

const KIND = {
  watching: {
    label: "Watching",
    // Written BEFORE anything changed, so it describes an intention, not an
    // event. Deliberately the quieter of the two.
    chip: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  changed: {
    label: "Changed",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
};

function Entry({ entry }) {
  const kind = KIND[entry.kind] ?? KIND.changed;
  const when = entryDate(entry.publishedAt);

  return (
    <li
      data-testid={`journal-entry-${entry.id}`}
      className="border-l-2 border-gray-200 dark:border-zinc-700 pl-3"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${kind.chip}`}>
          {kind.label}
        </span>
        <span className="text-[11px] text-gray-500 dark:text-zinc-400">
          {entry.season?.name}
          {when && ` · ${when}`}
        </span>
      </div>

      {/* The one personal line in an impersonal list: which of these entries is
          the edit that moved THIS reader's answer. Said in words rather than by
          a colour, because a colour would have to be learned. */}
      {entry.affectsYou && (
        <p
          data-testid="journal-affects-you"
          className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
        >
          This is the change that affected your answer.
        </p>
      )}

      {entry.title && (
        <h4 className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{entry.title}</h4>
      )}

      {paragraphs(entry.body).map((p, i) => (
        <p
          key={i}
          className="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-zinc-300"
        >
          {p}
        </p>
      ))}

      {/* Resolved server-side, always. A handle or a real name is a property of
          the author's undertaking, not of this page, and a client that received
          the preference could get the clamp wrong. */}
      <p className="mt-1 text-[11px] text-gray-500 dark:text-zinc-400">— {entry.author?.label}</p>
    </li>
  );
}

export default function TopicThread({ entries, loading }) {
  const list = Array.isArray(entries) ? entries : [];

  // Nothing to say and nothing on the way: render nothing at all rather than an
  // empty heading. The ⓘ is only offered where the index said there were
  // entries, so this is a slow network or a failed fetch, not the normal case.
  if (!loading && list.length === 0) return null;

  return (
    <div className="mt-4 border-t border-gray-200 dark:border-zinc-700 pt-3" data-testid="topic-thread">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
        What we&rsquo;ve said about this question
      </p>
      {loading && list.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">Loading&hellip;</p>
      ) : (
        <ol className="mt-2 space-y-3">
          {list.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </div>
  );
}
