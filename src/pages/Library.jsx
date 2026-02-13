import { useState, useEffect, useMemo, useRef } from "react";
import { useCompass } from "../components/CompassContext";
import { useNavigate } from "react-router";
import RadarChart from "../components/RadarChart";

const CATEGORY_COLORS = [
  { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-700", accent: "bg-blue-400" },
  { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-700", accent: "bg-emerald-400" },
  { bg: "bg-purple-50", border: "border-purple-400", text: "text-purple-700", accent: "bg-purple-400" },
  { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-700", accent: "bg-amber-400" },
  { bg: "bg-rose-50", border: "border-rose-400", text: "text-rose-700", accent: "bg-rose-400" },
  { bg: "bg-cyan-50", border: "border-cyan-400", text: "text-cyan-700", accent: "bg-cyan-400" },
];

function Library() {
  const {
    topics,
    selectedTopics,
    setSelectedTopics,
    categories,
    answers,
    setAnswers,
    writeIns,
    setWriteIns,
    showPrevAnswers,
    setShowPrevAnswers,
  } = useCompass();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [answeredTopicIDs, setAnsweredTopicIDs] = useState([]);
  const [answeredLoaded, setAnsweredLoaded] = useState(false);
  const [hideAnswered, setHideAnswered] = useState(true);

  // Fetch answered topic IDs
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        const ids = data.map((a) => a.topic_id);
        setAnsweredTopicIDs(ids);
        setAnsweredLoaded(true);
      });
  }, []);

  // Keep a ref to topics so the answer-fetch effect can use the latest
  // without re-firing every time topic metadata is edited in admin
  const topicsRef = useRef(topics);
  topicsRef.current = topics;

  // Snapshot of the compass topics (topics with answers) — used by "Clear"
  const compassTopicsRef = useRef(selectedTopics);

  // Fetch answers for selected topics (to power the compass preview)
  useEffect(() => {
    if (!selectedTopics.length || !topicsRef.current.length) return;

    fetch(`${import.meta.env.VITE_API_URL}/compass/answers/batch`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedTopics }),
    })
      .then((res) => res.json())
      .then((data) => {
        const currentTopics = topicsRef.current;
        const mapped = selectedTopics
          .map((id) => {
            const answer = data.find((a) => a.topic_id === id);
            const topic = currentTopics.find((t) => t.id === id);
            if (!answer || !topic) return null;
            return [topic.short_title, answer.value];
          })
          .filter(Boolean);
        setAnswers(Object.fromEntries(mapped));

        // Save the confirmed compass topics (only those with answers)
        compassTopicsRef.current = selectedTopics.filter((id) =>
          data.some((a) => a.topic_id === id)
        );

        const writeInEntries = selectedTopics
          .map((id) => {
            const answer = data.find((a) => a.topic_id === id);
            const topic = currentTopics.find((t) => t.id === id);
            if (!answer || !topic || !answer.write_in_text) return null;
            return [topic.short_title, answer.write_in_text];
          })
          .filter(Boolean);
        if (writeInEntries.length) {
          setWriteIns((prev) => ({ ...prev, ...Object.fromEntries(writeInEntries) }));
        }
      });
  }, [selectedTopics]);

  // Does the user have a populated compass?
  const hasCompass =
    selectedTopics.length > 0 &&
    Object.keys(answers).length > 0 &&
    Object.values(answers).some((v) => v > 0);

  const chartData = useMemo(() => {
    if (!hasCompass) return {};
    return Object.fromEntries(
      selectedTopics
        .map((id) => {
          const topic = topics.find((t) => t.id === id);
          if (!topic) return null;
          const value = answers[topic.short_title] ?? 0;
          return [topic.short_title, value];
        })
        .filter(Boolean)
    );
  }, [hasCompass, selectedTopics, topics, answers]);

  const getCategoryColor = (index) =>
    CATEGORY_COLORS[index % CATEGORY_COLORS.length];

  const getVisibleTopics = (category) => {
    return category.topics
      .filter((t) => !hideAnswered || !answeredTopicIDs.includes(t.id))
      .filter((t) =>
        t.short_title.toLowerCase().includes(search.toLowerCase())
      );
  };

  const MAX_TOPICS = 8;

  const toggleTopic = (topic_id) => {
    if (selectedTopics.includes(topic_id)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== topic_id));
    } else if (selectedTopics.length < MAX_TOPICS) {
      setSelectedTopics((prev) => [...prev, topic_id]);
    }
  };

  const clearSelections = () => {
    setSelectedTopics(compassTopicsRef.current);
  };

  const activeTopicIDs = useMemo(() => new Set(topics.map((t) => t.id)), [topics]);
  const totalTopics = topics.length;
  const answeredCount = answeredTopicIDs.filter((id) => activeTopicIDs.has(id)).length;
  const unansweredCount = totalTopics - answeredCount;

  return (
    <>
      {/* ── Compass Preview Section ── */}
      <div className="mt-4 px-4 md:px-6 max-w-5xl mx-auto">
        {hasCompass ? (
          /* ── Active compass ── */
          <div className="flex flex-col md:flex-row gap-0 md:gap-8 items-center">
            {/* Compass chart — clickable */}
            <div
              onClick={() => navigate("/results")}
              className="w-60 md:w-72 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              title="View your compass"
            >
              <RadarChart data={chartData} invertedSpokes={{}} labelFontSize={44} padding={160} labelOffset={35} />
            </div>

            {/* Right side: heading + stat cards + actions */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-4">
                <h1 className="text-xl md:text-2xl font-semibold">
                  Your Compass
                </h1>
                <button
                  onClick={() => navigate("/help")}
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                  title="How it works"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                </button>
              </div>

              {/* Stat cards */}
              {answeredLoaded && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                    <p className="text-2xl font-bold text-green-700">{answeredCount}</p>
                    <p className="text-xs text-green-600 font-medium">Answered</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-2xl font-bold text-gray-700">{unansweredCount}</p>
                    <p className="text-xs text-gray-500 font-medium">Remaining</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate("/results")}
                className="px-5 py-2 bg-black text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
              >
                View Full Compass
              </button>
            </div>
          </div>
        ) : (
          /* ── Empty / uncalibrated compass ── */
          <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-start">
            {/* Placeholder compass */}
            <div className="w-40 md:w-48 shrink-0 self-center md:self-start">
              <svg viewBox="0 0 200 200" className="w-full h-full opacity-15">
                {[1, 2, 3, 4, 5].map((level) => {
                  const r = (level / 5) * 80;
                  return <circle key={level} cx="100" cy="100" r={r} fill="none" stroke="#9ca3af" strokeWidth="1" />;
                })}
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const angle = (2 * Math.PI * i) / 6;
                  return <line key={i} x1="100" y1="100" x2={100 + 80 * Math.sin(angle)} y2={100 - 80 * Math.cos(angle)} stroke="#9ca3af" strokeWidth="1" />;
                })}
              </svg>
            </div>

            {/* Right side: heading + stat cards + help */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl md:text-2xl font-semibold">
                  Calibrate Your Compass
                </h1>
                <button
                  onClick={() => navigate("/help")}
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                  title="How it works"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-500 text-sm mb-4">
                Answer questions on the topics that matter to you and see where you stand
              </p>

              {/* Stat cards */}
              {answeredLoaded && (
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-xl border px-4 py-3 ${
                    answeredCount > 0
                      ? "border-green-200 bg-green-50"
                      : "border-gray-200 bg-gray-50"
                  }`}>
                    <p className={`text-2xl font-bold ${
                      answeredCount > 0 ? "text-green-700" : "text-gray-400"
                    }`}>{answeredCount}</p>
                    <p className={`text-xs font-medium ${
                      answeredCount > 0 ? "text-green-600" : "text-gray-400"
                    }`}>Answered</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-2xl font-bold text-gray-700">{unansweredCount}</p>
                    <p className="text-xs text-gray-500 font-medium">Remaining</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-gray-200 mx-6 my-4" />

      {/* ── Full Quiz CTA ── */}
      <div className="mx-4 md:mx-auto max-w-3xl mb-6">
        <button
          onClick={() => navigate("/quiz?mode=full")}
          className="w-full flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-ev-yellow hover:bg-ev-yellow-dark transition-colors cursor-pointer group"
        >
          <div className="text-left">
            <p className="font-semibold text-base md:text-lg text-black">
              Take the Full Quiz
            </p>
            <p className="text-sm text-black/60">
              Answer every question, then choose which topics appear on your compass
            </p>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5 shrink-0 text-black/40 group-hover:text-black transition-colors"
          >
            <path
              fillRule="evenodd"
              d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* ── Topic Selection Section ── */}
      <div className="px-4 md:px-6 max-w-5xl mx-auto">
        <div className="mb-4">
          <h2 className="text-xl md:text-2xl font-semibold mb-1">
            Or, pick your own topics
          </h2>
          <p className="text-gray-500 text-sm md:text-base">
            Choose the issues you care about most, then answer a question on each one to plot your position on the compass.
          </p>
        </div>

        {/* Search + filter row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 flex items-center bg-gray-100 rounded-xl px-4 py-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-5 h-5 text-gray-400 mr-2 shrink-0"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              type="text"
              onChange={(e) => setSearch(e.target.value)}
              value={search}
              placeholder="Search topics..."
              className="w-full bg-transparent outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideAnswered}
                onChange={() => setHideAnswered(!hideAnswered)}
                className="accent-green-600 w-4 h-4 cursor-pointer"
              />
              Unanswered only
            </label>
            {selectedTopics.length > 0 && (
              <button
                onClick={clearSelections}
                className="text-sm text-gray-400 hover:text-gray-600 underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Topic Cards by Category */}
        {answeredLoaded &&
          categories.map((category, catIdx) => {
            const visible = getVisibleTopics(category);
            if (visible.length === 0) return null;

            const color = getCategoryColor(catIdx);

            return (
              <div key={category.id} className="mb-8">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${color.accent}`}
                  />
                  {category.title}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {visible.map((topic) => {
                    const isSelected = selectedTopics.includes(topic.id);
                    const isAnswered = answeredTopicIDs.includes(topic.id);

                    return (
                      <button
                        key={topic.id}
                        onClick={() => toggleTopic(topic.id)}
                        className={`relative text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? `${color.bg} ${color.border} shadow-sm`
                            : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                        }`}
                      >
                        <div
                          className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${color.accent}`}
                        />
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-sm md:text-base font-medium leading-snug">
                            {topic.short_title}
                          </span>
                          {isAnswered && (
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
                        <span
                          className={`text-xs mt-1 block ${color.text} opacity-80`}
                        >
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

      {/* Bottom spacer for fixed button */}
      <div className="h-24" />

      {/* Start Quiz button (curated flow) */}
      <div className="fixed bottom-20 md:bottom-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <button
          onClick={() => navigate("/quiz")}
          disabled={selectedTopics.length === 0}
          className={`pointer-events-auto px-6 py-3 rounded-full text-sm font-semibold shadow-lg transition-all duration-200 ${
            selectedTopics.length > 0
              ? "bg-black text-white hover:opacity-90 cursor-pointer"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          Start Quiz
          {selectedTopics.length > 0 && ` (${selectedTopics.length})`}
        </button>
      </div>
    </>
  );
}

export default Library;
