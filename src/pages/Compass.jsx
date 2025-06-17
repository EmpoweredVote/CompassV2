import { useCompass } from "../components/CompassContext";
import RadarChart from "../components/RadarChart";
import AddTopicModal from "../components/AddTopicModal";
import ReplaceTopicModal from "../components/ReplaceTopicModal";
import { useState, useEffect } from "react";

function Compass() {
  const { topics, selectedTopics, setSelectedTopics } = useCompass();
  const [answers, setAnswers] = useState({});
  const [invertedSpokes, setInvertedSpokes] = useState({});
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replacingTopic, setReplacingTopic] = useState(null);

  // Load localStorage on first mount
  useEffect(() => {
    const savedTopics = localStorage.getItem("selectedTopics");
    const savedInversions = localStorage.getItem("invertedSpokes");

    if (savedTopics) setSelectedTopics(JSON.parse(savedTopics));
    if (savedInversions) setInvertedSpokes(JSON.parse(savedInversions));

    setHasLoadedFromStorage(true);
  }, []);

  // Sync selectedTopics -> localStorage
  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    localStorage.setItem("selectedTopics", JSON.stringify(selectedTopics));
  }, [selectedTopics, hasLoadedFromStorage]);

  // Sync invertedSpokes -> localStorage
  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    localStorage.setItem("invertedSpokes", JSON.stringify(invertedSpokes));
  }, [invertedSpokes, hasLoadedFromStorage]);

  // Keep answers up to date when selectedTopics change
  useEffect(() => {
    if (!hasLoadedFromStorage || !topics.length || !selectedTopics.length)
      return;

    fetch("http://localhost:5050/compass/answers/batch", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: selectedTopics }),
    })
      .then((res) => res.json())
      .then((data) => {
        const mapped = selectedTopics
          .map((id) => {
            const answer = data.find((a) => a.topic_id === id);
            const topic = topics.find((t) => t.ID === id);
            if (!answer || !topic) return null;
            return [topic.ShortTitle, answer.value];
          })
          .filter(Boolean);

        setAnswers(Object.fromEntries(mapped));
      });
  }, [selectedTopics, topics, hasLoadedFromStorage]);

  // Remove inversion if a topic is deleted
  const handleRemoveTopic = (idToRemove) => {
    setSelectedTopics((prev) => prev.filter((id) => id !== idToRemove));

    const topic = topics.find((t) => t.ID === idToRemove);
    if (topic) {
      const shortTitle = topic.ShortTitle;
      setInvertedSpokes((prev) => {
        const updated = { ...prev };
        delete updated[shortTitle];
        return updated;
      });
    }
  };

  const handleReplace = (newID) => {
    const oldTopic = topics.find((t) => t.ShortTitle === replacingTopic);
    if (!oldTopic) return;

    setSelectedTopics((prev) =>
      prev.map((id) => (id === oldTopic.ID ? newID : id))
    );

    setInvertedSpokes((prev) => {
      const updated = { ...prev };
      delete updated[replacingTopic];
      return updated;
    });

    setShowReplaceModal(false);
    setReplacingTopic(null);
  };

  const shouldRenderChart = topics.length && Object.keys(answers).length;

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      {shouldRenderChart ? (
        <RadarChart
          data={answers}
          invertedSpokes={invertedSpokes}
          onToggleInversion={(topic) =>
            setInvertedSpokes((prev) => ({
              ...prev,
              [topic]: !prev[topic],
            }))
          }
          onReplaceTopic={(topic) => {
            setReplacingTopic(topic);
            setShowReplaceModal(true);
          }}
        />
      ) : (
        <div className="text-center text-gray-500">No data to display</div>
      )}

      <button
        onClick={() => setIsModalOpen(true)}
        className="mt-4 px-6 py-2 bg-black text-white rounded-full hover:bg-opacity-80 transition-all cursor-pointer"
      >
        Add Topics
      </button>

      {isModalOpen && (
        <AddTopicModal
          selectedTopics={selectedTopics}
          onAddTopics={(newIDs) => {
            setSelectedTopics([...selectedTopics, ...newIDs]);
          }}
          onRemoveTopic={handleRemoveTopic}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {showReplaceModal && replacingTopic && (
        <ReplaceTopicModal
          replacingTopic={replacingTopic}
          selectedTopics={selectedTopics}
          onReplace={handleReplace}
          onClose={() => setShowReplaceModal(false)}
        />
      )}
    </div>
  );
}

export default Compass;
