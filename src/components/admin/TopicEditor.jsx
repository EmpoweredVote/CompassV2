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
    stances.map((s, i) => ({ ...s, Value: i + 1 }));

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
      stances: [...prev.stances, { Text: newStance.text, tempId: uuid() }],
    }));
    setNewStance({ text: "" });
  };

  const handleRemoveStance = (indexToRemove) =>
    setEditedFields((prev) => ({
      ...prev,
      stances: prev.stances.filter((_, i) => i !== indexToRemove),
    }));

  const stanceIds = editedFields.stances.map((s) => s.ID ?? s.tempId);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = stanceIds.indexOf(active.id);
    const newIndex = stanceIds.indexOf(over.id);
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

    const oldByID = Object.fromEntries(topic.stances.map((s) => [s.ID, s]));

    seq.forEach((s, i) => {
      if (!s.ID) {
        added.push({ text: s.Text, value: i + 1 });
      } else {
        const orig = oldByID[s.ID];
        if (!orig || orig.Text !== s.Text || orig.Value !== i + 1) {
          updated.push({ id: s.ID, text: s.Text, value: i + 1 });
        }
      }
    });

    const newIDs = new Set(seq.map((s) => s.ID).filter(Boolean));
    topic.stances.forEach((s) => {
      if (!newIDs.has(s.ID)) removed.push({ id: s.ID });
    });

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/compass/topics/update`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ID: topic.ID,
          Title: editedFields.title,
          ShortTitle: editedFields.shortTitle,
        }),
      });

      await fetch(`${import.meta.env.VITE_API_URL}/compass/stances/update`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_id: topic.ID,
          updated,
          added,
          removed,
        }),
      });

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
                stances: seq,
                Categories: allCategories.filter((c) =>
                  editedFields.categories.includes(c.ID)
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
            value={editedFields.shortTitle}
            onChange={(e) => handleFieldChange("shortTitle", e.target.value)}
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Stances</label>
          <SortableContext items={stanceIds}>
            <div className="flex flex-col gap-4">
              {editedFields.stances.map((stance, index) => (
                // Make the div below drag & droppable/sorted 1-10.
                <SortableStance
                  key={stance.ID ?? stance.tempId}
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
    </DndContext>
  );
}

export default TopicEditor;
