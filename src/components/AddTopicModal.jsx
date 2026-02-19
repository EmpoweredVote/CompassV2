import { useCompass } from "./CompassContext";
import { useState, useEffect } from "react";

function AddTopicModal({
  selectedTopics,
  onAddTopics,
  onRemoveTopic,
  onClose,
}) {
  const { topics } = useCompass();
  const [answeredTopicIDs, setAnsweredTopicIDs] = useState([]);
  const [selected, setSelected] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        const ids = data.map((a) => a.topic_id);
        setAnsweredTopicIDs(ids);
      });
  }, []);

  const availableTopics = topics.filter(
    (t) => answeredTopicIDs.includes(t.id) && !selectedTopics.includes(t.id)
  );

  const selectedTopicObjects = topics.filter((t) =>
    selectedTopics.includes(t.id)
  );

  const isAtCap = selectedTopics.length + selected.length >= 8;

  const toggleSelect = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      // Cap check: selectedTopics already on compass + newly selected must not exceed 8
      if (selectedTopics.length + prev.length >= 8) return prev;
      return [...prev, id];
    });
    setHasChanges(true);
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">
          Manage Topics{" "}
          <span className="text-sm font-normal text-gray-500">
            ({selectedTopics.length}/8 on compass)
          </span>
        </h2>

        <div className="space-y-4 max-h-80 overflow-y-auto">
          {selectedTopicObjects.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-1 text-gray-700">
                Currently Selected
              </h3>
              {selectedTopicObjects.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between border rounded px-3 py-2 mb-1 cursor-pointer"
                >
                  <span>{topic.short_title}</span>
                  <button
                    onClick={() => {
                      onRemoveTopic(topic.id);
                      setHasChanges(true);
                    }}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium mb-1 text-gray-700">
              Available to Add
            </h3>
            {availableTopics.length > 0 ? (
              availableTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between border rounded px-3 py-2 mb-1"
                >
                  <span>{topic.short_title}</span>
                  <button
                    onClick={() => toggleSelect(topic.id)}
                    disabled={isAtCap && !selected.includes(topic.id)}
                    className={`px-3 py-1 rounded cursor-pointer ${
                      selected.includes(topic.id)
                        ? "bg-black text-white"
                        : isAtCap
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gray-200"
                    }`}
                  >
                    {selected.includes(topic.id) ? "Remove" : "Add"}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">
                No additional topics available.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onAddTopics(selected);
              onClose();
            }}
            className="px-4 py-2 bg-black text-white rounded hover:bg-opacity-80 cursor-pointer disabled:cursor-not-allowed"
            disabled={!hasChanges}
          >
            Done {selected.length ? `(+${selected.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddTopicModal;
