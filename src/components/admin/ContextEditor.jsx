function ContextEditor({
  user_id,
  topic_id,
  existingContext,
  existingAnswer,
  topic,
  editedContextFields,
  setEditedContextFields,
  cancelEdit,
  saveEdit,
}) {
  const contextDraft = editedContextFields[user_id]?.[topic_id] || {
    reasoning: existingContext?.reasoning || "",
    sources: existingContext?.sources?.join("\n") || "",
    value: existingAnswer?.value ?? null,
  };

  const updateField = (field, value) => {
    setEditedContextFields((prev) => ({
      ...prev,
      [user_id]: {
        ...prev[user_id],
        [topic_id]: {
          ...prev[user_id]?.[topic_id],
          [field]: value,
        },
      },
    }));
  };

  return (
    <div className="flex flex-col gap-4 mt-2 mx-2">
      <div>
        <label className="font-semibold">Stance Selection:</label>
        <select
          className="border px-2 py-1 rounded w-full"
          value={contextDraft.value ?? ""}
          onChange={(e) => updateField("value", parseInt(e.target.value))}
        >
          <option value="" disabled>
            Select a stance
          </option>
          {(topic.stances || []).map((s) => (
            <option key={s.value} value={s.value}>
              {s.value}. {s.text}
            </option>
          ))}
        </select>
      </div>

      {/* Reasoning + Sources */}
      <div>
        <label className="font-semibold">Reasoning:</label>
        <textarea
          className="border rounded px-2 py-1 w-full"
          rows={4}
          value={contextDraft.reasoning}
          onChange={(e) => updateField("reasoning", e.target.value)}
        />
      </div>

      <div>
        <label className="font-semibold">Sources (one per line):</label>
        <textarea
          className="border rounded px-2 py-1 w-full"
          rows={4}
          value={contextDraft.sources}
          onChange={(e) => updateField("sources", e.target.value)}
        />
      </div>

      <div className="flex justify-center gap-3 my-2">
        <button
          className="border px-4 py-2 rounded hover:bg-gray-100"
          onClick={cancelEdit}
        >
          Cancel
        </button>
        <button
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          onClick={() => saveEdit(contextDraft.value)}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default ContextEditor;
