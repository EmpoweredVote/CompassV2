import UserTopicContext from "./UserTopicContext";

function UserAccordion({
  user,
  answers,
  isOpen,
  toggleOpen,
  context,
  setContext,
  topics,
  openTopics,
  toggleTopicOpen,
  editingContext,
  setEditingContext,
  editedContextFields,
  setEditedContextFields,
  saveContextEdit,
  visibleOnlyWithContext,
  toggleVisibleOnlyWithContext,
  searchQuery,
  setSearchQuery,
}) {
  const userContexts = context[user.user_id] || [];
  const hasContent = (ctx) =>
    ctx && (ctx.reasoning?.trim() || ctx.sources?.length > 0);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="bg-gray-100 p-4 cursor-pointer flex justify-between items-center"
        onClick={toggleOpen}
      >
        <h2 className="text-xl font-semibold">{user.username}</h2>
        <span>{isOpen ? "▲" : "▼"}</span>
      </div>

      {isOpen && (
        <div className="p-4 bg-white">
          <input
            type="text"
            placeholder="Search topics..."
            className="border px-2 py-1 mb-2 rounded w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <label className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={visibleOnlyWithContext[user.user_id] || false}
              onChange={() => toggleVisibleOnlyWithContext(user.user_id)}
            />
            <span className="text-sm">Show only topics with context</span>
          </label>

          {topics
            .filter((topic) => {
              const ctx = userContexts.find((c) => c.topic_id === topic.ID);
              const matchesSearch = topic.ShortTitle.toLowerCase().includes(
                searchQuery.toLowerCase()
              );
              const shouldShow = visibleOnlyWithContext[user.user_id]
                ? hasContent(ctx)
                : true;
              return matchesSearch && shouldShow;
            })
            .map((topic) => (
              <UserTopicContext
                key={topic.ID}
                user={user}
                answer={answers.find((a) => a.topic_id === topic.ID)}
                topic={topic}
                context={userContexts}
                openTopics={openTopics}
                toggleTopicOpen={toggleTopicOpen}
                editingContext={editingContext}
                setEditingContext={setEditingContext}
                editedContextFields={editedContextFields}
                setEditedContextFields={setEditedContextFields}
                saveContextEdit={saveContextEdit}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default UserAccordion;
