import TopicSummary from "./TopicSummary";
import TopicEditor from "./TopicEditor";

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
}) {
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

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        onClick={onToggle}
        className="bg-gray-100 p-4 cursor-pointer flex justify-between items-center"
      >
        <h2 className="font-semibold text-lg">{topic.ShortTitle}</h2>
        <button
          onClick={(e) => {
            e.stopPropagation();
            isEditing ? handleCancel() : handleEditClick();
          }}
          className="text-sm underline text-blue-600"
        >
          {isEditing ? "Cancel" : "Edit"}
        </button>
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
            />
          ) : (
            <TopicSummary topic={topic} allCategories={allCategories} />
          )}
        </div>
      )}
    </div>
  );
}

export default TopicAccordion;
