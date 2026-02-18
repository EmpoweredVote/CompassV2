import { useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import SortableStance from "./SortableStance";
import { arrayMove } from "@dnd-kit/sortable";
import { v4 as uuid } from "uuid";
import { useCompass } from "../CompassContext";

function TopicEditor({
  topic,
  editedFields,
  setEditedFields,
  newStance,
  setNewStance,
  allCategories,
  setTopics,
  setEditedTopic,
  isDeleting,
}) {
  const { refreshData } = useCompass();
  const [isSaving, setIsSaving] = useState(false);

  const withValues = (stances) =>
    stances.map((s, i) => ({ ...s, value: i + 1 }));

  const handleFieldChange = (field, value) => {
    setEditedFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleStanceChange = (index, value) => {
    const updated = [...editedFields.stances];
    updated[index].text = value;
    setEditedFields((prev) => ({ ...prev, stances: updated }));
  };

  const handleCategoryToggle = (category_id) => {
    const updated = editedFields.categories.includes(category_id)
      ? editedFields.categories.filter((id) => id !== category_id)
      : [...editedFields.categories, category_id];

    setEditedFields((prev) => ({ ...prev, categories: updated }));
  };

  const handleAddStance = () => {
    if (!newStance.text.trim()) return;

    setEditedFields((prev) => ({
      ...prev,
      stances: [...prev.stances, { text: newStance.text, tempId: uuid() }],
    }));
    setNewStance({ text: "" });
  };

  const handleRemoveStance = (indexToRemove) =>
    setEditedFields((prev) => ({
      ...prev,
      stances: prev.stances.filter((_, i) => i !== indexToRemove),
    }));

  const stance_ids = editedFields.stances.map((s) => s.id ?? s.tempId);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = stance_ids.indexOf(active.id);
    const newIndex = stance_ids.indexOf(over.id);
    setEditedFields((p) => ({
      ...p,
      stances: arrayMove(p.stances, oldIndex, newIndex),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    const seq = withValues(editedFields.stances);

    const updated = [];
    const added = [];
    const removed = [];

    const oldByID = Object.fromEntries(topic.stances.map((s) => [s.id, s]));

    seq.forEach((s, i) => {
      if (!s.id) {
        added.push({ text: s.text, value: i + 1 });
      } else {
        const orig = oldByID[s.id];
        if (!orig || orig.text !== s.text || orig.value !== i + 1) {
          updated.push({ id: s.id, text: s.text, value: i + 1 });
        }
      }
    });

    const newIDs = new Set(seq.map((s) => s.id).filter(Boolean));
    topic.stances.forEach((s) => {
      if (!newIDs.has(s.id)) removed.push({ id: s.id });
    });

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/compass/topics/update`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: topic.id,
          title: editedFields.title,
          short_title: editedFields.short_title,
          question_text: editedFields.question_text || "",
          level: editedFields.level || "",
        }),
      });

      await fetch(`${import.meta.env.VITE_API_URL}/compass/stances/update`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_id: topic.id,
          updated,
          added,
          removed,
        }),
      });

      const oldCategoryIDs = topic.categories.map((c) => c.id);
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
              topic_id: topic.id,
              add,
              remove,
            }),
          }
        );
        if (!catRes.ok) throw new Error("Failed to update categories");
      }

      setTopics((prev) =>
        prev.map((t) =>
          t.id === topic.id
            ? {
                ...t,
                stances: seq,
                categories: allCategories.filter((c) =>
                  editedFields.categories.includes(c.id)
                ),
              }
            : t
        )
      );

      await refreshData();
      setEditedTopic(null);
    } catch (err) {
      console.error(err);
      alert("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
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
            value={editedFields.short_title}
            onChange={(e) => handleFieldChange("short_title", e.target.value)}
          />
        </div>

        <div>
          <label className="block font-semibold">Question</label>
          <textarea
            className="border rounded p-2 w-full"
            rows={2}
            placeholder="What should the government do about…?"
            value={editedFields.question_text || ""}
            onChange={(e) => handleFieldChange("question_text", e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            Replaces the title on issue cards. Leave blank for auto-generated.
          </p>
        </div>

        <div>
          <label className="block font-semibold">Level</label>
          <select
            className="border rounded p-1 w-full"
            value={editedFields.level || ""}
            onChange={(e) => handleFieldChange("level", e.target.value)}
          >
            <option value="">Not set</option>
            <option value="federal">Federal</option>
            <option value="state">State</option>
            <option value="local">Local</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1">Stances</label>
          <SortableContext items={stance_ids}>
            <div className="flex flex-col gap-4">
              {editedFields.stances.map((stance, index) => (
                // Make the div below drag & droppable/sorted 1-10.
                <SortableStance
                  key={stance.id ?? stance.tempId}
                  stance={stance}
                  index={index}
                  onRemove={handleRemoveStance}
                  onChange={handleStanceChange}
                />
              ))}
            </div>
          </SortableContext>

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
                strokeWidth="1.5"
                stroke="currentColor"
                className="size-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
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
              <label key={category.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editedFields.categories.includes(category.id)}
                  onChange={() => handleCategoryToggle(category.id)}
                />
                {category.title}
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
    </DndContext>
  );
}

export default TopicEditor;
