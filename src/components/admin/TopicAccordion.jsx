import TopicSummary from "./TopicSummary";
import TopicEditor from "./TopicEditor";
import { useState } from "react";
import { useCompass } from "../CompassContext";

function TopicAccordion({
  topic,
  isOpen,
  onToggle,
  isEditing,
  setEditedTopic,
  editedFields,
  setEditedFields,
  newStance,
  setNewStance,
  allCategories,
  setTopics,
  isDeleting,
}) {
  const { refreshData } = useCompass();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const handleEditClick = () => {
    setEditedTopic(topic.ID);
    setEditedFields({
      title: topic.Title,
      shortTitle: topic.ShortTitle,
      stances: topic.stances.map((s) => ({ ...s })),
      categories: [...topic.Categories.map((c) => c.ID)],
    });
    setNewStance({ text: "" });
  };

  const handleCancel = () => {
    setEditedTopic(null);
    setEditedFields({});
    setNewStance({});
  };

  const handleDeleteTopic = async () => {
    console.log("Starting Delete...");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/compass/topics/delete/${topic.ID}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (res.ok) {
        console.log("Deleted successfully!");
        await refreshData();
        setShowConfirmDelete(false);
      } else {
        console.log("Failed to Delete...", await res.text());
      }
    } catch (err) {
      console.error("Error during fetch:", err);
      alert("Delete failed");
    }
  };

  return (
    <div>
      {showConfirmDelete && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-1/3 max-w-2xl overflow-y-auto flex flex-col items-center gap-6">
            <h1 className="text-xl text-center">
              Are you sure you want to delete {topic.ShortTitle}?
            </h1>
            <div className="flex gap-4">
              <button
                className="bg-gray-300 text-black px-4 py-2 rounded cursor-pointer hover:bg-gray-400"
                onClick={() => setShowConfirmDelete(false)}
              >
                Cancel
              </button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-red-700"
                onClick={() => handleDeleteTopic()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="border rounded-lg overflow-hidden">
        <div
          onClick={onToggle}
          className="bg-gray-100 p-4 cursor-pointer flex justify-between items-center"
        >
          <h2 className="font-semibold text-lg">{topic.ShortTitle}</h2>
          {isDeleting ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirmDelete(true);
              }}
              className="text-md text-white px-3 py-1 bg-red-600 hover:bg-red-700 cursor-pointer"
            >
              Delete
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                isEditing ? handleCancel() : handleEditClick();
                isOpen ? "" : onToggle();
              }}
              className="cursor-pointer"
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
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                />
              </svg>
            </button>
          )}
        </div>

        {isOpen && (
          <div className="p-4 bg-white">
            {isEditing ? (
              <TopicEditor
                topic={topic}
                editedFields={editedFields}
                setEditedFields={setEditedFields}
                newStance={newStance}
                setNewStance={setNewStance}
                allCategories={allCategories}
                setTopics={setTopics}
                setEditedTopic={setEditedTopic}
                isDeleting={isDeleting}
              />
            ) : (
              <TopicSummary topic={topic} allCategories={allCategories} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TopicAccordion;
