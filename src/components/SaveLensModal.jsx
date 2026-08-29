import { useState } from "react";

/**
 * Names a lens.
 *
 * Creation reuses the compass the user has already arranged, so this is the
 * whole of "build a lens" — there is no second topic picker to keep in step with
 * the first. Also serves rename, via initialName.
 */
export default function SaveLensModal({ topicCount, initialName = "", onSave, onClose }) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const trimmed = name.trim();

  const submit = async () => {
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      onClose();
    } catch {
      // The lens is still in local state — saveUserLenses is optimistic and does
      // not roll back — so say that rather than implying the work was lost.
      setError("Could not save this lens. It is still here — try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="save-lens-modal"
      >
        <h2 className="text-base font-semibold dark:text-white mb-3">
          {initialName ? "Rename lens" : "Name this lens"}
        </h2>
        <input
          autoFocus
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          data-testid="lens-name-input"
          placeholder="Farm bill"
          className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm dark:text-white"
        />
        <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
          {topicCount} {topicCount === 1 ? "topic" : "topics"} from your compass
        </p>
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!trimmed || saving}
            data-testid="lens-save-confirm"
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-blue-600 text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
