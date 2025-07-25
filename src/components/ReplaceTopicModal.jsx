import { useCompass } from "./CompassContext";
import { useEffect, useState } from "react";

function ReplaceTopicModal({
  replacingTopic, // short title of the topic being replaced
  selectedTopics,
  onReplace,
  onClose,
}) {
  const { topics } = useCompass();
  const [answeredTopicIDs, setAnsweredTopicIDs] = useState([]);
  const [replacementID, setReplacementID] = useState(null);

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
    (t) =>
      answeredTopicIDs.includes(t.id) &&
      !selectedTopics.includes(t.id) &&
      t.short_title !== replacingTopic
  );

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">
          Replace "{replacingTopic}" with:
        </h2>

        <div className="max-h-72 overflow-y-auto space-y-2">
          {availableTopics.length ? (
            availableTopics.map((topic) => (
              <div
                key={topic.id}
                className={`flex items-center justify-between border rounded px-3 py-2 cursor-pointer ${
                  replacementID === topic.id
                    ? "bg-gray-100 border-black"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => setReplacementID(topic.id)}
              >
                <span>{topic.short_title}</span>
                <span className="text-sm text-gray-500 text-right">
                  {topic.title}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No available replacements.</p>
          )}
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
              if (replacementID) onReplace(replacementID);
              onClose();
            }}
            disabled={!replacementID}
            className="px-4 py-2 bg-black text-white rounded hover:bg-opacity-80 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            Replace
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReplaceTopicModal;
