import ContextEditor from "./ContextEditor";
import ContextSummary from "./ContextSummary";

function UserTopicContext({
  user,
  answer,
  topic,
  context,
  openTopics,
  toggleTopicOpen,
  editingContext,
  setEditingContext,
  editedContextFields,
  setEditedContextFields,
  saveContextEdit,
}) {
  const isOpen = openTopics.includes(topic.ID);
  const isEditing =
    editingContext?.user_id === user.user_id &&
    editingContext?.topic_id === topic.ID;

  const ctx = context.find((c) => c.topic_id === topic.ID);

  const handleToggle = () => {
    toggleTopicOpen(topic.ID);
  };

  const handleStartEdit = () => {
    setEditingContext({ user_id: user.user_id, topic_id: topic.ID });
    if (!isOpen) toggleTopicOpen(topic.ID);
  };

  return (
    <div className="border rounded mt-2 overflow-hidden">
      <div className="flex justify-between cursor-pointer bg-gray-100 p-4">
        <h3 onClick={handleToggle} className="font-semibold w-full h-full">
          {topic.ShortTitle}
        </h3>
        <button onClick={handleStartEdit}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-600 hover:text-black cursor-pointer"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931ZM19.5 7.125 16.862 4.487ZM18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
            />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="mt-2">
          {isEditing ? (
            <ContextEditor
              userID={user.user_id}
              topicID={topic.ID}
              topic={topic}
              existingContext={ctx}
              editedContextFields={editedContextFields}
              setEditedContextFields={setEditedContextFields}
              cancelEdit={() => setEditingContext(null)}
              saveEdit={() => saveContextEdit(user.user_id, topic.ID)}
            />
          ) : (
            <div>
              {answer && (
                <div className="m-2 bg-gray-100 p-4 rounded">
                  <p className="font-semibold">Answer Value: {answer.value}</p>
                  <p className="text-gray-700">
                    {topic.stances.find((s) => s.Value === answer.value)
                      ?.Text || (
                      <span className="italic text-gray-400">
                        Unknown stance
                      </span>
                    )}
                  </p>
                </div>
              )}
              <ContextSummary context={ctx} />
            </div>
          )}

          {!ctx && !isEditing && (
            <p className="italic text-gray-400 mt-2 ml-1 p-2">
              No context written for this topic.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default UserTopicContext;
