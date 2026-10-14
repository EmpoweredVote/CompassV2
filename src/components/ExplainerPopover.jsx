/**
 * A plain "here is why this works the way it does" panel.
 *
 * Deliberately NOT QuestionNotes. That one is keyed on a flag's
 * disposition, carries editorial's note verbatim and offers an action that
 * changes the user's answer. This one explains a control and offers nothing but
 * Close. Sharing a component would have meant a flag-shaped prop bag with every
 * field nulled, and the next person to add a field to either would have had to
 * reason about both.
 */
export default function ExplainerPopover({ title, children, onClose, testId = "explainer" }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid={testId}
        role="dialog"
        aria-label={title}
      >
        <h2 className="text-base font-semibold dark:text-white">{title}</h2>
        <div className="mt-2 space-y-2 text-sm text-gray-600 dark:text-zinc-400">{children}</div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            data-testid={`${testId}-close`}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg text-gray-600 dark:text-zinc-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
