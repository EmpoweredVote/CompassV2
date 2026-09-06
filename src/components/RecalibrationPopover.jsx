import { copyFor, flagWeight } from "../lib/recalibration";

/**
 * Why a question is asking to be recalibrated.
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
 */
export default function RecalibrationPopover({ flag, topicTitle, onRecalibrate, onClose }) {
  const copy = copyFor(flag);
  // A suppressed answer is the one whose spoke is already blank, so its heading
  // carries the same amber the marker does. A reworded one has not lost
  // anything and is deliberately calmer.
  const loud = flagWeight(flag) === "loud";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl"
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
        <h2 className="mt-1 text-base font-semibold dark:text-white">{copy.title}</h2>
        {flag.publicNote && (
          <blockquote
            className={
              "mt-3 border-l-2 pl-3 text-sm italic text-gray-700 dark:text-zinc-300 " +
              (loud ? "border-amber-400" : "border-violet-400")
            }
          >
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
