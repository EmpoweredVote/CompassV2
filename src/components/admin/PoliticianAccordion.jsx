import PoliticianTopicContext from "./PoliticianTopicContext";

function PoliticianAccordion({
  politician,
  answers,
  isOpen,
  toggleOpen,
  topics,
  context,
  openTopics,
  toggleTopicOpen,
  editingContext,
  setEditingContext,
  editedContextFields,
  setEditedContextFields,
  // saveContextEdit expects (topic_id, draft)
  saveContextEdit,
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="bg-gray-100 p-4 cursor-pointer flex justify-start items-center gap-12"
        onClick={() => {
          console.log("[Accordion] header clicked for", politician.id);
          toggleOpen();
        }}
      >
        <div className="w-32 h-32 flex-shrink-0">
          <img
            src={politician.photo_origin_url}
            className="w-full h-full rounded-lg object-cover"
          />
        </div>
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold">
            {politician.full_name ||
              `${politician.first_name} ${politician.last_name}`}
          </h2>
          <span className="text-sm text-gray-600">
            {politician.office_title}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 bg-white">
          {topics.map((topic) => (
            <PoliticianTopicContext
              key={topic.id}
              politician_id={politician.id}
              answers={answers}
              topic={topic}
              context={context}
              openTopics={openTopics}
              toggleTopicOpen={toggleTopicOpen}
              editingContext={editingContext}
              setEditingContext={setEditingContext}
              editedContextFields={editedContextFields}
              setEditedContextFields={setEditedContextFields}
              // pass 2-arg saver down
              saveContextEdit={saveContextEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
export default PoliticianAccordion;
