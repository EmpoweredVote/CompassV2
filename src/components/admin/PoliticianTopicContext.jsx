import ContextSummary from "./ContextSummary";
import ContextEditor from "./ContextEditor";

function PoliticianTopicContext({
  politician_id,
  answers, // array
  topic,
  context,
  openTopics,
  toggleTopicOpen,
  editingContext,
  setEditingContext,
  editedContextFields,
  setEditedContextFields,
  // saveContextEdit(topic_id, draft)
  saveContextEdit,
}) {
  const isOpen = Array.isArray(openTopics) && openTopics.includes(topic.id);
  const isEditing =
    editingContext?.politician_id === politician_id &&
    editingContext?.topic_id === topic.id;

  const ctx = (context || []).find((c) => c.topic_id === topic.id);
  const currentAnswer = (Array.isArray(answers) ? answers : []).find(
    (a) => a.topic_id === topic.id
  );

  const handleToggle = () => {
    console.log("[PTC] toggle topic", { politician_id, topic_id: topic.id });
    toggleTopicOpen(topic.id);
  };

  const handleStartEdit = () => {
    console.log("[PTC] start edit", { politician_id, topic_id: topic.id });
    setEditingContext({ politician_id, topic_id: topic.id });
    if (!isOpen) toggleTopicOpen(topic.id);
  };

  return (
    <div className="border rounded mt-2 overflow-hidden">
      <div className="flex justify-between cursor-pointer bg-gray-100 p-4">
        <h3 onClick={handleToggle} className="font-semibold w-full h-full">
          {topic.short_title}
        </h3>
        <button onClick={handleStartEdit}>…</button>
      </div>

      {isOpen && (
        <div className="mt-2">
          {isEditing ? (
            <ContextEditor
              politician_id={politician_id}
              topic_id={topic.id}
              topic={topic}
              existingContext={ctx}
              existingAnswer={currentAnswer}
              editedContextFields={editedContextFields}
              setEditedContextFields={setEditedContextFields}
              cancelEdit={() => {
                console.log("[PTC] cancel edit");
                setEditingContext(null);
              }}
              // IMPORTANT: call with (topic_id, draft)
              saveEdit={(draft) => {
                console.log("[PTC] saveEdit clicked", {
                  politician_id,
                  topic_id: topic.id,
                  draft,
                });
                return saveContextEdit(topic.id, draft);
              }}
            />
          ) : (
            <div>
              {currentAnswer && (
                <div className="m-2 bg-gray-100 p-4 rounded">
                  <p className="font-semibold">
                    Answer Value: {currentAnswer.value}
                  </p>
                  <p className="text-gray-700">
                    {topic.stances.find((s) => s.value === currentAnswer.value)
                      ?.text || (
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

export default PoliticianTopicContext;
