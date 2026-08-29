/**
 * Why a question is asking to be recalibrated.
 *
 * The three reasons come from the server (compassUserLensService) and mean
 * genuinely different things, so each gets its own copy. `publicNote` is
 * editorial's own wording and is rendered verbatim — never paraphrased,
 * summarised or truncated here.
 *
 * What raises a flag at all is decided server-side, and the rule is narrow on
 * purpose: an editorial or clarifying revision can never raise one, and a
 * substantive one only does when the rungs at or beside the user's own answer
 * actually moved. This component renders that decision; it does not second-guess
 * it.
 */
const COPY = {
  question_revised: {
    title: "This question was updated",
    body: "Your answer was given against the earlier wording.",
    action: "Recalibrate",
  },
  answer_invalidated: {
    title: "The option you chose no longer exists",
    body: "This question was rewritten and the stance you picked is not one of the choices any more.",
    action: "Recalibrate",
  },
  not_asked_this_season: {
    title: "This question isn't part of the current season",
    body: "Your answer is kept. It just isn't one of the questions being asked right now.",
    action: null,
  },
};

export default function RecalibrationPopover({ flag, topicTitle, onRecalibrate, onClose }) {
  const copy = COPY[flag.reason] || COPY.question_revised;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="recalibration-popover"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          {topicTitle}
        </p>
        <h2 className="mt-1 text-base font-semibold dark:text-white">{copy.title}</h2>
        {flag.publicNote && (
          <blockquote className="mt-3 border-l-2 border-amber-400 pl-3 text-sm italic text-gray-700 dark:text-zinc-300">
            {flag.publicNote}
          </blockquote>
        )}
        <p className="mt-3 text-sm text-gray-600 dark:text-zinc-400">{copy.body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            data-testid="recalibrate-later"
            className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-zinc-300 cursor-pointer"
          >
            {copy.action ? "Later" : "Close"}
          </button>
          {copy.action && (
            <button
              onClick={onRecalibrate}
              data-testid="recalibrate-confirm"
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-amber-600 text-white cursor-pointer"
            >
              {copy.action}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
