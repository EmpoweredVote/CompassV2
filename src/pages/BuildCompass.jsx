import { useState, useEffect, useRef } from "react";
import { useCompass } from "../components/CompassContext";
import { useNavigate } from "react-router";
import { apiFetch } from "../lib/auth";

const CATEGORY_COLORS = [
  { bg: "bg-blue-50 dark:bg-[#1a2830]", border: "border-blue-400 dark:border-[#59B0C4]", text: "text-blue-700 dark:text-[#59B0C4]", accent: "bg-blue-400 dark:bg-[#59B0C4]" },
  { bg: "bg-emerald-50 dark:bg-[#182618]", border: "border-emerald-400 dark:border-[#5A9A6E]", text: "text-emerald-700 dark:text-[#5A9A6E]", accent: "bg-emerald-400 dark:bg-[#5A9A6E]" },
  { bg: "bg-purple-50 dark:bg-[#22182a]", border: "border-purple-400 dark:border-[#7C6B9E]", text: "text-purple-700 dark:text-[#7C6B9E]", accent: "bg-purple-400 dark:bg-[#7C6B9E]" },
  { bg: "bg-amber-50 dark:bg-[#2a2010]", border: "border-amber-400 dark:border-[#D4940B]", text: "text-amber-700 dark:text-[#D4940B]", accent: "bg-amber-400 dark:bg-[#D4940B]" },
  { bg: "bg-rose-50 dark:bg-[#2a1818]", border: "border-rose-400 dark:border-[#FF5740]", text: "text-rose-700 dark:text-[#FF5740]", accent: "bg-rose-400 dark:bg-[#FF5740]" },
  { bg: "bg-cyan-50 dark:bg-[#182428]", border: "border-cyan-400 dark:border-[#59B0C4]", text: "text-cyan-700 dark:text-[#59B0C4]", accent: "bg-cyan-400 dark:bg-[#59B0C4]" },
];

const MAX_TOPICS = 8;
const MIN_TOPICS = 3;

function BuildCompass() {
  const { topics, categories, selectedTopics, setSelectedTopics, answers, isLoggedIn } = useCompass();
  const navigate = useNavigate();

  const [answeredTopicIDs, setAnsweredTopicIDs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState([]);

  // Keep ref so the effect can read latest answers without adding to dependency array
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Resolve answered topic IDs — prefer selectedTopics (set by Quiz finish
  // flow) so we don't race with in-flight answer saves. Fall back to the
  // API or localStorage if selectedTopics is empty.
  useEffect(() => {
    if (selectedTopics.length > 0) {
      setAnsweredTopicIDs(selectedTopics);
      setLoaded(true);
      return;
    }

    if (!isLoggedIn) {
      const cur = answersRef.current;
      const ids = topics
        .filter(t => cur[t.short_title] != null && cur[t.short_title] > 0)
        .map(t => t.id);
      setAnsweredTopicIDs(ids);
      setLoaded(true);
      return;
    }

    apiFetch('/compass/answers')
      .then((res) => {
        if (!res || !res.ok) throw new Error("Failed to fetch answers");
        return res.json();
      })
      .then((data) => {
        const ids = data.map((a) => a.topic_id);
        setAnsweredTopicIDs(ids);
        setLoaded(true);
      })
      .catch(() => {
        const cur = answersRef.current;
        const ids = topics
          .filter(t => cur[t.short_title] != null && cur[t.short_title] > 0)
          .map(t => t.id);
        setAnsweredTopicIDs(ids);
        setLoaded(true);
      });
  }, [isLoggedIn, topics, selectedTopics]);

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
        <h1 className="text-3xl md:text-4xl font-semibold mb-2 text-center text-[#2F3237] dark:text-[#EBEDEF]">
          Build Your Compass
        </h1>
        <p className="text-[#535964] dark:text-[#9CA3AF] text-center text-sm md:text-base mb-2">
          Choose up to {MAX_TOPICS} topics to display on your compass
        </p>
        <p className="text-center text-sm font-medium mb-6">
          <span className={picked.length >= MIN_TOPICS ? "text-green-600 dark:text-[#5A9A6E]" : "text-[#535964] dark:text-[#9CA3AF]"}>
            {picked.length} of {MAX_TOPICS} selected
          </span>
          {picked.length < MIN_TOPICS && (
            <span className="text-[#9CA3AF] ml-2">(minimum {MIN_TOPICS})</span>
          )}
        </p>
      </div>

      {/* Topic Cards by Category (only answered topics) */}
      <div className="px-4 md:px-6 max-w-5xl mx-auto">
        {(() => {
          const seen = new Set();
          return categories.map((category, catIdx) => {
          const answeredInCategory = category.topics.filter((t) => {
            if (!answeredTopicIDs.includes(t.id)) return false;
            if (seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
          });

          if (answeredInCategory.length === 0) return null;

          const color = getCategoryColor(catIdx);

          return (
            <div key={category.id} className="mb-8">
              <h2 className="text-lg md:text-xl font-semibold mb-3 flex items-center gap-2 text-[#2F3237] dark:text-[#EBEDEF]">
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
                          ? "bg-gray-50 dark:bg-[#1E2124] border-gray-100 dark:border-[#2F3237] text-gray-400 dark:text-[#535964] cursor-not-allowed"
                          : "cursor-pointer"
                      } ${
                        isPicked
                          ? `${color.bg} ${color.border} shadow-sm`
                          : !isAtMax
                          ? "bg-white dark:bg-[#2F3237] border-gray-200 dark:border-[#41454E] hover:border-gray-300 dark:hover:border-[#59B0C4] hover:shadow-sm"
                          : ""
                      }`}
                    >
                      <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${color.accent}`} />
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-sm md:text-base font-medium leading-snug text-[#2F3237] dark:text-[#EBEDEF]">
                          {topic.short_title}
                        </span>
                        {isPicked && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-4 h-4 shrink-0 mt-0.5 text-green-500 dark:text-[#5A9A6E]"
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
        });
        })()}
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
              ? "bg-ev-muted-blue text-white hover:opacity-90 cursor-pointer"
              : "bg-[#D3D7DE] dark:bg-[#41454E] text-[#9CA3AF] cursor-not-allowed"
          }`}
        >
          View My Compass{picked.length >= MIN_TOPICS && ` (${picked.length})`}
        </button>
      </div>
    </>
  );
}

export default BuildCompass;
