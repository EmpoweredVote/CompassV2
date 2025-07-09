function ContextEditor({
  userID,
  topicID,
  existingContext,
  editedContextFields,
  setEditedContextFields,
  cancelEdit,
  saveEdit,
}) {
  const contextDraft = editedContextFields[userID]?.[topicID] || {
    reasoning: existingContext?.reasoning || "",
    sources: existingContext?.sources?.join("\n") || "",
  };

  const updateField = (field, value) => {
    setEditedContextFields((prev) => ({
      ...prev,
      [userID]: {
        ...prev[userID],
        [topicID]: {
          ...prev[userID]?.[topicID],
          [field]: value,
        },
      },
    }));
  };

  return (
    <div className="flex flex-col gap-4 mt-2">
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

      <div className="flex gap-3 mt-2">
        <button
          className="border px-4 py-2 rounded hover:bg-gray-100"
          onClick={cancelEdit}
        >
          Cancel
        </button>
        <button
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          onClick={saveEdit}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default ContextEditor;
