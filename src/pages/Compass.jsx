import { useCompass } from "../components/CompassContext";
import RadarChart from "../components/RadarChart";
import AddTopicModal from "../components/AddTopicModal";
import ReplaceTopicModal from "../components/ReplaceTopicModal";
import CompareModal from "../components/CompareModal";
import CompareDetail from "../components/CompareDetail";
import { useState, useEffect } from "react";

function Compass() {
  const {
    topics,
    selectedTopics,
    setSelectedTopics,
    answers,
    setAnswers,
    compareAnswers,
    setCompareAnswers,
  } = useCompass();
  const [invertedSpokes, setInvertedSpokes] = useState({});
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replacingTopic, setReplacingTopic] = useState(null);
  const [isCompareModal, setIsCompareModal] = useState(false);
  const [compareUser, setCompareUser] = useState(null); // {user_id, username}

  // Load localStorage on first mount
  useEffect(() => {
    const savedInversions = localStorage.getItem("invertedSpokes");
    const savedUser = localStorage.getItem("compareUser");

    if (savedInversions) setInvertedSpokes(JSON.parse(savedInversions));
    if (savedUser) setCompareUser(JSON.parse(savedUser));

    setHasLoadedFromStorage(true);
  }, []);

  // Sync invertedSpokes -> localStorage
  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    localStorage.setItem("invertedSpokes", JSON.stringify(invertedSpokes));
  }, [invertedSpokes, hasLoadedFromStorage]);

  // Sync compare user -> localStorage
  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    if (compareUser) {
      localStorage.setItem("compareUser", JSON.stringify(compareUser));
    } else {
      localStorage.removeItem("compareUser");
    }
  }, [compareUser, hasLoadedFromStorage]);

  // Keep answers up to date when selectedTopics change
  useEffect(() => {
    if (!hasLoadedFromStorage || !topics.length || !selectedTopics.length)
      return;

    fetch(`${import.meta.env.VITE_API_URL}/compass/answers/batch`, {
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

  useEffect(() => {
    if (!compareUser || !selectedTopics.length) {
      setCompareAnswers({});
      return;
    }

    fetch(`${import.meta.env.VITE_API_URL}/compass/compare`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: compareUser.user_id,
        ids: selectedTopics,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const mapped = selectedTopics
          .map((id) => {
            const a = data.find((d) => d.topic_id === id);
            const topic = topics.find((t) => t.ID === id);
            if (!topic) return null; // skip if topic missing
            return [topic.ShortTitle, a ? a.value : 0];
          })
          .filter(Boolean);
        setCompareAnswers(Object.fromEntries(mapped));
      });
  }, [compareUser, selectedTopics, topics]);

  const shouldRenderChart = topics.length && Object.keys(answers).length;

  return (
    <div className="flex flex-row gap-4">
      {/* <div> */}
      {compareUser && (
        <div className="m-6">
          <CompareDetail user={compareUser} />
        </div>
      )}
      <div className="flex flex-col items-center gap-6 py-6">
        {compareUser && (
          <div>
            <div>
              <div className="flex gap-4 items-center">
                <span className="inline-block w-4 h-4 bg-pink-500/40 border border-pink-500 rounded-sm" />
                You
                <span
                  className="inline-block w-4 h-4 bg-blue-500/20 border border-blue-500 rounded-sm"
                  onClick={() => {
                    setCompareUser(null);
                    setCompareAnswers({});
                  }}
                />
                {compareUser.username}
              </div>
            </div>
          </div>
        )}
        {shouldRenderChart ? (
          <RadarChart
            data={answers}
            compareData={compareAnswers}
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
          Edit Topics
        </button>

        <button
          onClick={() => setIsCompareModal(true)}
          className="mt-4 px-6 py-2 bg-black text-white rounded-full hover:bg-opacity-80 transition-all cursor-pointer"
        >
          Compare
        </button>

        {isCompareModal && (
          <CompareModal
            selectedTopics={selectedTopics}
            onCompare={(u) => {
              setCompareUser(u);
            }}
            onClose={() => setIsCompareModal(false)}
          />
        )}

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
    </div>
  );
}

export default Compass;
