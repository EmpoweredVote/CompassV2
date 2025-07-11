import { useState } from "react";

function TopicEditor({
  topic,
  editedFields,
  setEditedFields,
  newStance,
  setNewStance,
  allCategories,
  setTopics,
  setEditedTopic,
}) {
  const [isSaving, setIsSaving] = useState(false);

  const handleFieldChange = (field, value) => {
    setEditedFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleStanceChange = (index, value) => {
    const updated = [...editedFields.stances];
    updated[index].Text = value;
    setEditedFields((prev) => ({ ...prev, stances: updated }));
  };

  const handleCategoryToggle = (categoryID) => {
    const updated = editedFields.categories.includes(categoryID)
      ? editedFields.categories.filter((id) => id !== categoryID)
      : [...editedFields.categories, categoryID];

    setEditedFields((prev) => ({ ...prev, categories: updated }));
  };

  const handleAddStance = () => {
    if (!newStance.text.trim()) return;
    setEditedFields((prev) => ({
      ...prev,
      stances: [...prev.stances, { Text: newStance.text }],
    }));
    setNewStance({ text: "" });
  };

  const handleSave = async () => {
    setIsSaving(true);

    const payload = {
      ID: topic.ID,
      Title: editedFields.title,
      ShortTitle: editedFields.shortTitle,
      Stances: editedFields.stances,
      Categories: editedFields.categories,
    };

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/compass/topics/update`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ID: topic.ID,
            Title: editedFields.title,
            ShortTitle: editedFields.shortTitle,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to save changes");

      const message = await res.text();

      const updated = [];
      const added = [];
      const removed = [];

      const originalStances = topic.stances;
      const newStances = editedFields.stances;

      const oldStanceMap = Object.fromEntries(
        originalStances.map((s) => [s.ID, s])
      );

      newStances.forEach((stance, index) => {
        if (!stance.ID) {
          added.push({ text: stance.Text, value: index + 1 });
        } else {
          const original = oldStanceMap[stance.ID];
          if (stance.Text !== original.Text || index + 1 !== original.Value) {
            updated.push({
              id: stance.ID,
              text: stance.Text,
              value: index + 1,
            });
          }
        }
      });

      const newStanceIDs = new Set(newStances.map((s) => s.ID).filter(Boolean));
      originalStances.forEach((stance) => {
        if (!newStanceIDs.has(stance.ID)) {
          removed.push({ id: stance.ID, value: stance.Value });
        }
      });

      const stanceRes = await fetch(
        `${import.meta.env.VITE_API_URL}/compass/stances/update`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic_id: topic.ID,
            updated,
            added,
            removed,
          }),
        }
      );

      if (!stanceRes.ok) throw new Error("Failed to update stances");

      const oldCategoryIDs = topic.Categories.map((c) => c.ID);
      const newCategoryIDs = editedFields.categories;

      const add = newCategoryIDs.filter((id) => !oldCategoryIDs.includes(id));
      const remove = oldCategoryIDs.filter(
        (id) => !newCategoryIDs.includes(id)
      );

      if (add.length || remove.length) {
        const catRes = await fetch(
          `${import.meta.env.VITE_API_URL}/compass/topics/categories/update`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic_id: topic.ID,
              add,
              remove,
            }),
          }
        );
        if (!catRes.ok) throw new Error("Failed to update categories");
      }

      setTopics((prev) =>
        prev.map((t) =>
          t.ID === topic.ID
            ? {
                ...t,
                Title: editedFields.title,
                ShortTitle: editedFields.shortTitle,
                stances: editedFields.stances,
                Categories: allCategories.filter((c) =>
                  editedFields.categories.includes(c.ID)
                ),
              }
            : t
        )
      );

      setEditedTopic(null);
    } catch (err) {
      console.error(err);
      alert("Error saving changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveStance = (indexToRemove) => {
    setEditedFields((prev) => ({
      ...prev,
      stances: prev.stances.filter((_, index) => index !== indexToRemove),
    }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block font-semibold">Title</label>
        <input
          className="border rounded p-1 w-full"
          value={editedFields.title}
          onChange={(e) => handleFieldChange("title", e.target.value)}
        />
      </div>

      <div>
        <label className="block font-semibold">Short Title</label>
        <input
          className="border rounded p-1 w-full"
          value={editedFields.shortTitle}
          onChange={(e) => handleFieldChange("shortTitle", e.target.value)}
        />
      </div>

      <div>
        <label className="block font-semibold mb-1">Stances</label>
        <div className="flex flex-col gap-4">
          {editedFields.stances.map((stance, index) => (
            // Make this div draggable.
            <div
              key={stance.ID ?? `new-${index}`}
              className="flex items-start gap-2"
            >
              <span className="mt-2 font-semibold w-6 text-right">
                {index + 1}.
              </span>
              <textarea
                className="border rounded p-2 w-full"
                value={stance.Text}
                onChange={(e) => handleStanceChange(index, e.target.value)}
              />
              <button
                type="button"
                onClick={() => handleRemoveStance(index)}
                className="hover:text-red-500 mt-4 cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 mt-4 justify-items-center">
          <span className="mt-2 font-semibold w-6 text-right">
            {editedFields.stances.length + 1}.
          </span>
          <textarea
            className="border rounded p-2 w-full"
            placeholder="Add new stance..."
            value={newStance.text}
            onChange={(e) => setNewStance({ text: e.target.value })}
          />
          <button
            onClick={handleAddStance}
            className="hover:text-green-600 cursor-pointer mt-4"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </button>
        </div>
      </div>

      <div>
        <label className="block font-semibold mb-1">Categories</label>
        <div className="grid grid-cols-2 gap-2">
          {allCategories.map((category) => (
            <label key={category.ID} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editedFields.categories.includes(category.ID)}
                onChange={() => handleCategoryToggle(category.ID)}
              />
              {category.Title}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-4 mt-4 justify-end">
        <button
          onClick={() => setEditedTopic(null)}
          className="bg-gray-300 px-4 py-2 rounded cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-green-600 text-white px-4 py-2 rounded cursor-pointer"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export default TopicEditor;
