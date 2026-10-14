import { copyFor, flagWeight, optionChange } from "../lib/recalibration";
import TopicThread from "./TopicThread";

/**
 * The option they picked, and — when it is the one that was rewritten — the
 * sentence that replaced it.
 *
 * 🔴 THIS IS THE ANSWER TO "WHICH ONE IS OPTION 4?". Editorial's note names what
 * changed by position, so without this the reader has to go count the options,
 * and is still never told what the old one said. Showing the words makes the
 * note's prose a gloss on something concrete rather than the only account.
 */
function WhatChanged({ change, loud }) {
  if (change.kind === "none") return null;

  const label = {
    changed: "You chose",
    unchanged: "You chose — and it still reads",
    gone: "You chose",
  }[change.kind];

  const rule = loud ? "border-amber-400" : "border-violet-400";

  return (
    <div className="mt-3 space-y-2" data-testid="what-changed">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
          {label}
        </p>
        <p
          data-testid="option-before"
          className={
            "mt-0.5 border-l-2 pl-3 text-sm text-gray-700 dark:text-zinc-300 " + rule
          }
        >
          {change.before}
        </p>
      </div>
      {change.after && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            It now reads
          </p>
          <p
            data-testid="option-after"
            className={
              "mt-0.5 border-l-2 pl-3 text-sm font-medium text-gray-900 dark:text-white " + rule
            }
          >
            {change.after}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Everything there is to read about one question: why it changed under this
 * reader, and the team's own diary of why it is the way it is.
 *
 * 🔴 THE FLAG IS OPTIONAL AND THAT IS THE POINT OF PHASE 2. This opened only
 * while a recalibration flag was outstanding, because a flag's `publicNote` was
 * the only note there was — so answering the question cleared the flag and made
 * the note permanently unreachable. Measured 2026-10-13: Chris answered 20
 * questions one morning and lost access to every note in the process. A journal
 * entry hangs off the QUESTION, so it survives being answered.
 *
 * 🔴 THE COPY IS KEYED ON `disposition`, NOT `reason`, and lib/recalibration
 * owns it. `moved` and `reworded` share reason `question_revised`, so copy keyed
 * on reason told a user whose answer had been WITHHELD that it "was given
 * against the earlier wording" — while it was missing from the chart. Three
 * states now: still stands, set aside because the scale moved, set aside because
 * the option is gone.
 *
 * `publicNote` is editorial's own wording and is rendered verbatim — never
 * paraphrased, summarised or truncated here.
 *
 * What raises a flag at all is decided server-side by CC_0061. This component
 * renders that decision; it does not second-guess it.
 *
 * ⚠ THE TESTID STILL SAYS `recalibration-popover`. It is load-bearing in the
 * smoke suite and in the compass page's own assertions, and renaming it would
 * cost a passing check to buy a tidier string.
 */
export default function QuestionNotes({
  flag,
  topicTitle,
  entries,
  loadingEntries,
  onRecalibrate,
  onClose,
}) {
  // No flag means nothing changed under this reader — they came to read the
  // diary. Everything flag-shaped below is skipped rather than defaulted:
  // copyFor() falls back to the `reworded` wording, which would tell someone
  // with no flag at all that their answer "was given against the earlier
  // wording".
  const copy = flag ? copyFor(flag) : null;
  const change = flag ? optionChange(flag) : null;
  // A suppressed answer is the one whose spoke is already blank, so its heading
  // carries the same amber the marker does. A reworded one has not lost
  // anything and is deliberately calmer.
  const loud = flagWeight(flag) === "loud";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="recalibration-popover"
      >
        <p
          className={
            "text-xs font-semibold uppercase tracking-wide " +
            (loud
              ? "text-amber-600 dark:text-amber-400"
              : "text-violet-600 dark:text-violet-400")
          }
        >
          {topicTitle}
        </p>
        {copy && <h2 className="mt-1 text-base font-semibold dark:text-white">{copy.title}</h2>}
        {/* The words first, then editorial's account of them. Reading the note
            before knowing which option it means is the problem being fixed. */}
        {change && <WhatChanged change={change} loud={loud} />}
        {flag?.publicNote && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              Why we changed it
            </p>
            <blockquote
              data-testid="public-note"
              className={
                "mt-0.5 border-l-2 pl-3 text-sm italic text-gray-700 dark:text-zinc-300 " +
                (loud ? "border-amber-400" : "border-violet-400")
              }
            >
              {flag.publicNote}
            </blockquote>
          </div>
        )}
        {copy && <p className="mt-3 text-sm text-gray-600 dark:text-zinc-400">{copy.body}</p>}

        {/* The diary, under the reader's own business. Both or either — a
            question can have changed under someone with nothing written about
            it, and a question nobody has flagged can have a thread years long. */}
        <TopicThread entries={entries} loading={loadingEntries} />

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            data-testid="recalibrate-later"
            className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-zinc-300 cursor-pointer"
          >
            {copy?.action ? "Later" : "Close"}
          </button>
          {copy?.action && (
            <button
              onClick={onRecalibrate}
              data-testid="recalibrate-confirm"
              className={
                "px-3 py-1.5 text-sm font-semibold rounded-lg text-white cursor-pointer " +
                (loud ? "bg-amber-600" : "bg-violet-600")
              }
            >
              {copy.action}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
