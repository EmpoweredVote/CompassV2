import { useState, useEffect } from "react";
import { useCompass } from "../components/CompassContext";
import { useNavigate } from "react-router";

const CATEGORY_COLORS = [
  { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-700", accent: "bg-blue-400" },
  { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-700", accent: "bg-emerald-400" },
  { bg: "bg-purple-50", border: "border-purple-400", text: "text-purple-700", accent: "bg-purple-400" },
  { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-700", accent: "bg-amber-400" },
  { bg: "bg-rose-50", border: "border-rose-400", text: "text-rose-700", accent: "bg-rose-400" },
  { bg: "bg-cyan-50", border: "border-cyan-400", text: "text-cyan-700", accent: "bg-cyan-400" },
];

const MAX_TOPICS = 8;
const MIN_TOPICS = 3;

function BuildCompass() {
  const { topics, categories, selectedTopics, setSelectedTopics } = useCompass();
  const navigate = useNavigate();

  const [answeredTopicIDs, setAnsweredTopicIDs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState([]);

  // Fetch which topics have been answered
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        const ids = data.map((a) => a.topic_id);
        setAnsweredTopicIDs(ids);
        setLoaded(true);
      });
  }, []);

  const getCategoryColor = (index) =>
    CATEGORY_COLORS[index % CATEGORY_COLORS.length];

  const togglePick = (topicId) => {
    if (picked.includes(topicId)) {
      setPicked(picked.filter((id) => id !== topicId));
    } else if (picked.length < MAX_TOPICS) {
      setPicked([...picked, topicId]);
    }
  };

  const handleViewCompass = () => {
    setSelectedTopics(picked);
    localStorage.setItem("selectedTopics", JSON.stringify(picked));
    navigate("/results");
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-gray-500">
        Loading your answers...
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 px-4 md:px-0">
        <h1 className="text-3xl md:text-4xl font-semibold mb-2 text-center">
          Build Your Compass
        </h1>
        <p className="text-gray-500 text-center text-sm md:text-base mb-2">
          Choose up to {MAX_TOPICS} topics to display on your compass
        </p>
        <p className="text-center text-sm font-medium mb-6">
          <span className={picked.length >= MIN_TOPICS ? "text-green-600" : "text-gray-500"}>
            {picked.length} of {MAX_TOPICS} selected
          </span>
          {picked.length < MIN_TOPICS && (
            <span className="text-gray-400 ml-2">(minimum {MIN_TOPICS})</span>
          )}
        </p>
      </div>

      {/* Topic Cards by Category (only answered topics) */}
      <div className="px-4 md:px-6 max-w-5xl mx-auto">
        {categories.map((category, catIdx) => {
          const answeredInCategory = category.topics.filter((t) =>
            answeredTopicIDs.includes(t.id)
          );

          if (answeredInCategory.length === 0) return null;

          const color = getCategoryColor(catIdx);

          return (
            <div key={category.id} className="mb-8">
              <h2 className="text-lg md:text-xl font-semibold mb-3 flex items-center gap-2">
                <span className={`inline-block w-3 h-3 rounded-full ${color.accent}`} />
                {category.title}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {answeredInCategory.map((topic) => {
                  const isPicked = picked.includes(topic.id);
                  const isAtMax = picked.length >= MAX_TOPICS && !isPicked;

                  return (
                    <button
                      key={topic.id}
                      onClick={() => togglePick(topic.id)}
                      disabled={isAtMax}
                      className={`relative text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                        isAtMax
                          ? "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
                          : "cursor-pointer"
                      } ${
                        isPicked
                          ? `${color.bg} ${color.border} shadow-sm`
                          : !isAtMax
                          ? "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                          : ""
                      }`}
                    >
                      <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${color.accent}`} />
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-sm md:text-base font-medium leading-snug">
                          {topic.short_title}
                        </span>
                        {isPicked && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-4 h-4 shrink-0 mt-0.5 text-green-500"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <span className={`text-xs mt-1 block ${color.text} opacity-80`}>
                        {category.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom spacer */}
      <div className="h-24" />

      {/* View Compass button */}
      <div className="fixed bottom-20 md:bottom-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <button
          onClick={handleViewCompass}
          disabled={picked.length < MIN_TOPICS}
          className={`pointer-events-auto px-6 py-3 rounded-full text-sm font-semibold shadow-lg transition-all duration-200 ${
            picked.length >= MIN_TOPICS
              ? "bg-black text-white hover:opacity-90 cursor-pointer"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          View My Compass{picked.length >= MIN_TOPICS && ` (${picked.length})`}
        </button>
      </div>
    </>
  );
}

export default BuildCompass;
