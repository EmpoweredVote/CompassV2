import { useState } from "react";
import PoliticianTopicContext from "./PoliticianTopicContext";
import { getPolName, getOfficeSubtitle } from "../../util/name";

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
  saveContextEdit,
  savePhotoUrl,
}) {
  const fullName = getPolName(politician);
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [photoDraft, setPhotoDraft] = useState("");
  const [photoSaving, setPhotoSaving] = useState(false);

  const handlePhotoSave = async () => {
    setPhotoSaving(true);
    try {
      await savePhotoUrl(politician.id, photoDraft.trim());
      setEditingPhoto(false);
    } finally {
      setPhotoSaving(false);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="bg-gray-100 p-4 cursor-pointer flex justify-start items-center gap-12"
        onClick={() => {
          console.log("[Accordion] header clicked for", politician.id);
          toggleOpen();
        }}
      >
        <div className="w-32 h-32 flex-shrink-0 relative group">
          <img
            src={politician.photo_origin_url}
            loading="lazy"
            className="w-full h-full rounded-lg object-cover"
            alt={fullName}
          />
          {savePhotoUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPhotoDraft(politician.photo_origin_url || "");
                setEditingPhoto(true);
              }}
              className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium"
            >
              Edit photo
            </button>
          )}
        </div>
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold">{fullName}</h2>
          <span className="text-sm text-gray-600">
            {getOfficeSubtitle(politician)}
          </span>
        </div>
      </div>

      {editingPhoto && (
        <div
          className="bg-yellow-50 border-t border-yellow-200 p-4 flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="url"
            className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm font-mono"
            placeholder="Direct image URL (https://…)"
            value={photoDraft}
            onChange={(e) => setPhotoDraft(e.target.value)}
            autoFocus
          />
          <button
            onClick={handlePhotoSave}
            disabled={photoSaving}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {photoSaving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setEditingPhoto(false)}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      )}

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
              saveContextEdit={saveContextEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
export default PoliticianAccordion;
