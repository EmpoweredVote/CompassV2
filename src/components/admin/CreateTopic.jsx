// Create new topic
// Format:
// Input for Title, Short Title
// Stance creation (min 4 stances) - Drag & drop, value based on order - Text box for stance text
//    Check how TopicEditor handles drag & drop stances. Reuse SortableStance.jsx. Modify both to be more flexible if needed.
// Checkboxes for categories
// Submit button sends fetch to POST topics/create endpoint
// Backend expects:
//   {
//   "title": "Testing Topic",
//   "shortTitle": "Test",
//   "stances": [
//     { "value": 1, "text": "Strongly Disagree" },
//     { "value": 2, "text": "Disagree" },
//     { "value": 3, "text": "Agree" },
//     { "value": 4, "text": "Strongly Agree" }
//   ],
//   "categories": [
//     { "id": "2c9a4a91-e762-46e3-a9ae-b7d6d3224b7c" },
//     { "id": "adc974c0-cbc1-49e7-8f3d-c00583765ee6" },
//     { "id": "ec56d3a2-7600-4bf7-92c1-fb238e9aef9b" }
//   ]
// }
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import SortableStance from "./SortableStance";
import { arrayMove } from "@dnd-kit/sortable";
import { useEffect, useState } from "react";
import { useCompass } from "../CompassContext";
import { v4 as uuid } from "uuid";

function CreateTopic({
  onClose,
  onSuccess,
  allCategories,
  newStance,
  setNewStance,
}) {
  const { refreshData } = useCompass();
  const [topicSaved, setTopicSaved] = useState();
  const [initialStances, setInitialStances] = useState([
    { Text: "" },
    { Text: "" },
    { Text: "" },
    { Text: "" },
  ]);
  const [editedFields, setEditedFields] = useState({
    title: "",
    shortTitle: "",
    categories: [],
    stances: initialStances.map((s) => ({
      Text: s.Text,
      tempId: uuid(),
    })),
  });
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
    const seq = withValues(editedFields.stances);
    const formattedStances = [];

    seq.forEach((stance, i) => {
      formattedStances.push({ value: i + 1, text: stance.Text });
    });

    const formattedCategories = [];

    editedFields.categories.forEach((category) => {
      formattedCategories.push({ id: category });
    });

    const payload = {
      title: editedFields.title,
      shortTitle: editedFields.shortTitle,
      stances: formattedStances,
      categories: formattedCategories,
    };

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/compass/topics/create`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        setTopicSaved(true);
        await refreshData();
        onSuccess();
        onClose();
      }

      if (!res.ok) {
        setTopicSaved(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-3/4 overflow-y-auto">
        <div className="flex flex-col gap-6">
          <div className="text-center text-3xl font-bold">
            <h1>New Topic</h1>
          </div>

          {/* {topicSaved && (
            <div className="flex flex-col items-center">
              <div className="w-1/2 px-4 py-2 border border-black/75 rounded-lg bg-gray-50">
                <h1 className="font-semibold text-center text-lg text-green-600">
                  Topic Successfully Saved
                </h1>
              </div>
            </div>
          )}
          {topicSaved == false && (
            <div className="flex flex-col items-center">
              <div className="w-1/2 px-4 py-2 border border-black/75 rounded-lg bg-gray-50">
                <h1 className="font-semibold text-center text-lg text-red-600">
                  Topic Failed to Save
                </h1>
              </div>
            </div>
          )} */}

          <DndContext onDragEnd={handleDragEnd}>
            <div className="flex flex-col gap-2">
              <label className="block font-semibold text-lg">Title</label>
              <input
                className="border rounded p-1 mx-4"
                value={editedFields.title}
                onChange={(e) => handleFieldChange("title", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="block font-semibold text-lg">Short Title</label>
              <input
                className="border rounded p-1 mx-4"
                value={editedFields.shortTitle}
                onChange={(e) =>
                  handleFieldChange("shortTitle", e.target.value)
                }
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-lg">
                Stances
              </label>
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

              <div className="flex items-start gap-2 mt-4 justify-items-center ml-7">
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

            <div className="flex flex-col items-center gap-4">
              <label className="block font-semibold mb-1 text-xl">
                Categories
              </label>
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
            {topicSaved == false && (
              <div className="flex flex-col items-center">
                <div className="w-1/2 px-4 py-2 border border-black/75 rounded-lg bg-gray-50">
                  <h1 className="font-semibold text-center text-lg text-red-600">
                    Topic Failed to Save
                  </h1>
                </div>
              </div>
            )}
            <div className="flex justify-center gap-4">
              <button
                onClick={onClose}
                className="bg-gray-300 text-black px-4 py-2 rounded cursor-pointer hover:bg-gray-400"
              >
                Close
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-green-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-green-700"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
export default CreateTopic;
