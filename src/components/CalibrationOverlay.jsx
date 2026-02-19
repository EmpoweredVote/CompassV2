// CalibrationOverlay.jsx
import { useState, useEffect, useMemo } from "react";
import { useCompass } from "./CompassContext";
import RadarChart from "./RadarChart";
import { getQuestionText } from "../util/topic";

const STORAGE_KEY = "calibration_progress";
const MAX_TOPICS = 8;
const MIN_TOPICS = 3;

function GhostRadar({ size = "w-64 md:w-80" }) {
  return (
    <div className={`${size} mx-auto`}>
      <svg viewBox="0 0 200 200" className="w-full h-full opacity-10">
        {[1, 2, 3, 4, 5].map((level) => {
          const r = (level / 5) * 80;
          return (
            <circle
              key={level}
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1.5"
            />
          );
        })}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const angle = (2 * Math.PI * i) / 8;
          return (
            <line
              key={i}
              x1="100"
              y1="100"
              x2={100 + 80 * Math.sin(angle)}
              y2={100 - 80 * Math.cos(angle)}
              stroke="#9ca3af"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function CalibrationOverlay({ onComplete, onSkip }) {
  const {
    topics,
    categories,
    selectedTopics,
    setSelectedTopics,
    answers,
    setAnswers,
    invertedSpokes,
    setInvertedSpokes,
    initRandomInversions,
    isLoggedIn,
  } = useCompass();

  // Load persisted progress on mount
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.step === "pick" || parsed.step === "answer") {
          return {
            step: parsed.step,
            pickedTopics: parsed.pickedTopics || [],
            currentIndex: parsed.currentIndex || 0,
          };
        }
      }
    } catch {}
    return { step: "welcome", pickedTopics: [], currentIndex: 0 };
  };

  const initial = getInitialState();
  const [step, setStep] = useState(initial.step);
  const [pickedTopics, setPickedTopics] = useState(initial.pickedTopics);
  const [currentIndex, setCurrentIndex] = useState(initial.currentIndex);
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  // Persist progress on every state change
  useEffect(() => {
    if (step === "welcome" || step === "complete") return;
    const progress = { step, pickedTopics, currentIndex };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [step, pickedTopics, currentIndex]);

  // Load current answer when index changes in answer step
  useEffect(() => {
    if (step !== "answer") return;
    const topicId = pickedTopics[currentIndex];
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    const val = answers[topic.short_title];
    setSelectedAnswer(typeof val === "number" && val > 0 ? val : null);
  }, [currentIndex, step, pickedTopics, topics, answers]);

  // Auto-transition from complete screen after 3 seconds
  useEffect(() => {
    if (step !== "complete") return;
    const timer = setTimeout(() => {
      localStorage.removeItem(STORAGE_KEY);
      onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [step, onComplete]);

  // Build chart data from answered picked topics
  const chartData = useMemo(() => {
    if (!pickedTopics.length) return {};
    return Object.fromEntries(
      pickedTopics
        .map((id) => {
          const topic = topics.find((t) => t.id === id);
          if (!topic) return null;
          const value = answers[topic.short_title] ?? 0;
          return [topic.short_title, value];
        })
        .filter(Boolean)
    );
  }, [pickedTopics, topics, answers]);

  // Current topic for answer step
  const currentTopic = useMemo(() => {
    if (step !== "answer") return null;
    const id = pickedTopics[currentIndex];
    return topics.find((t) => t.id === id) || null;
  }, [step, pickedTopics, currentIndex, topics]);

  // Count answered topics among picked
  const answeredCount = useMemo(() => {
    return pickedTopics.filter((id) => {
      const topic = topics.find((t) => t.id === id);
      if (!topic) return false;
      const val = answers[topic.short_title];
      return val != null && val > 0;
    }).length;
  }, [pickedTopics, topics, answers]);

  // --- Handlers ---

  const handleGetStarted = () => {
    setStep("pick");
  };

  const handleSkip = () => {
    localStorage.removeItem(STORAGE_KEY);
    onSkip();
  };

  const togglePick = (topicId) => {
    setPickedTopics((prev) => {
      if (prev.includes(topicId)) {
        return prev.filter((id) => id !== topicId);
      }
      if (prev.length >= MAX_TOPICS) return prev;
      return [...prev, topicId];
    });
  };

  const handleContinueToAnswer = () => {
    if (pickedTopics.length < MIN_TOPICS) return;
    // Add picked topics to context selectedTopics (union)
    setSelectedTopics((prev) => {
      const existing = new Set(prev);
      const newIds = pickedTopics.filter((id) => !existing.has(id));
      return [...prev, ...newIds];
    });
    // Init random inversions for picked topics
    const pickedTopicObjects = pickedTopics
      .map((id) => topics.find((t) => t.id === id))
      .filter(Boolean);
    initRandomInversions(pickedTopicObjects);
    setCurrentIndex(0);
    setStep("answer");
  };

  const handleSelectStance = async (value) => {
    if (!currentTopic) return;
    setSelectedAnswer(value);
    setAnswers((prev) => ({ ...prev, [currentTopic.short_title]: value }));
    if (isLoggedIn) {
      try {
        await fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic_id: currentTopic.id, value }),
        });
      } catch {}
    }
  };

  const handleNext = () => {
    if (currentIndex < pickedTopics.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // Last topic — go to complete if enough answered, else finish anyway
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else {
      setStep("pick");
    }
  };

  const handleFinish = () => {
    // Remove unanswered picked topics from selectedTopics
    const unansweredIds = pickedTopics.filter((id) => {
      const topic = topics.find((t) => t.id === id);
      if (!topic) return true;
      const val = answers[topic.short_title];
      return !(val != null && val > 0);
    });
    if (unansweredIds.length > 0) {
      setSelectedTopics((prev) => prev.filter((id) => !unansweredIds.includes(id)));
      // Also clear inversions for removed topics
      setInvertedSpokes((prev) => {
        const updated = { ...prev };
        for (const id of unansweredIds) {
          const topic = topics.find((t) => t.id === id);
          if (topic) delete updated[topic.short_title];
        }
        return updated;
      });
    }
    localStorage.removeItem(STORAGE_KEY);
    setStep("complete");
  };

  const handleExitDuringAnswer = () => {
    if (answeredCount >= MIN_TOPICS) {
      const unansweredIds = pickedTopics.filter((id) => {
        const topic = topics.find((t) => t.id === id);
        if (!topic) return true;
        const val = answers[topic.short_title];
        return !(val != null && val > 0);
      });
      if (unansweredIds.length > 0) {
        if (!window.confirm("You have unanswered topics. They'll be removed from your compass. Continue?")) return;
        setSelectedTopics((prev) => prev.filter((id) => !unansweredIds.includes(id)));
        setInvertedSpokes((prev) => {
          const updated = { ...prev };
          for (const id of unansweredIds) {
            const topic = topics.find((t) => t.id === id);
            if (topic) delete updated[topic.short_title];
          }
          return updated;
        });
      }
      localStorage.removeItem(STORAGE_KEY);
      setStep("complete");
    } else {
      if (!window.confirm("You need at least 3 answered topics for the compass. Exit anyway?")) return;
      localStorage.removeItem(STORAGE_KEY);
      onSkip();
    }
  };

  // --- Render helpers ---

  const isFlipped = currentTopic ? invertedSpokes[currentTopic.short_title] : false;
  const orderedStances =
    currentTopic && currentTopic.stances
      ? isFlipped
        ? [...currentTopic.stances].reverse()
        : currentTopic.stances
      : [];

  const isLastTopic = currentIndex === pickedTopics.length - 1;

  // ============================
  // STEP: WELCOME
  // ============================
  if (step === "welcome") {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto flex flex-col items-center justify-center px-6 py-12">
        <GhostRadar />
        <h1 className="text-3xl md:text-4xl font-semibold text-center mt-6 mb-3">
          Calibrate Your Compass
        </h1>
        <p className="text-gray-500 text-center max-w-md mb-8 text-base md:text-lg leading-relaxed">
          Answer a few questions to build your political compass. Pick the topics
          that matter to you, then tell us where you stand on each one.
        </p>
        <button
          onClick={handleGetStarted}
          className="px-8 py-3 bg-ev-yellow text-black font-semibold rounded-full text-base md:text-lg shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
        >
          Get Started
        </button>
        <button
          onClick={handleSkip}
          className="mt-4 text-gray-400 underline text-sm cursor-pointer hover:text-gray-600 transition-colors"
        >
          Skip for now
        </button>
      </div>
    );
  }

  // ============================
  // STEP: PICK TOPICS
  // ============================
  if (step === "pick") {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 z-10 px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 max-w-2xl mx-auto">
            <button
              onClick={() => setStep("welcome")}
              className="p-1.5 rounded-full text-gray-400 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
              aria-label="Back to welcome"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">Choose Your Topics</h1>
              <p className="text-gray-500 text-sm">Pick 3 to 8 topics for your compass</p>
            </div>
            <span className={`shrink-0 text-sm font-medium px-3 py-1 rounded-full ${
              pickedTopics.length >= MIN_TOPICS
                ? "bg-ev-yellow text-black"
                : "bg-gray-100 text-gray-600"
            }`}>
              {pickedTopics.length}/8 selected
            </span>
          </div>
        </div>

        {/* Topic list */}
        <div className="px-4 py-4 max-w-2xl mx-auto pb-32">
          {categories.map((category, catIdx) => {
            if (!category.topics || category.topics.length === 0) return null;
            return (
              <div key={category.id} className="mb-6">
                <h3 className="text-base font-semibold text-gray-700 mb-3">
                  {category.title}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {category.topics.map((topic) => {
                    const fullTopic = topics.find((t) => t.id === topic.id) || topic;
                    const isSelected = pickedTopics.includes(topic.id);
                    const atCap = pickedTopics.length >= MAX_TOPICS && !isSelected;
                    return (
                      <button
                        key={topic.id}
                        onClick={() => !atCap && togglePick(topic.id)}
                        disabled={atCap}
                        className={`text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? "border-[#59b0c4] bg-sky-50/50 shadow-sm"
                            : atCap
                            ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                        }`}
                      >
                        <span className="text-sm font-medium leading-snug">
                          {getQuestionText(fullTopic)}
                        </span>
                        {isSelected && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0 text-[#59b0c4]">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-10">
          <div className="max-w-2xl mx-auto">
            {pickedTopics.length < MIN_TOPICS && (
              <p className="text-center text-sm text-gray-400 mb-2">
                Pick at least {MIN_TOPICS} topics to continue
              </p>
            )}
            <button
              onClick={handleContinueToAnswer}
              disabled={pickedTopics.length < MIN_TOPICS}
              className={`w-full py-3 rounded-full font-semibold text-base transition-all duration-200 ${
                pickedTopics.length >= MIN_TOPICS
                  ? "bg-black text-white cursor-pointer hover:opacity-90"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================
  // STEP: ANSWER TOPICS
  // ============================
  if (step === "answer" && currentTopic) {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <button
            onClick={handleBack}
            className="p-1.5 rounded-full text-gray-400 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Progress indicator */}
          <div className="flex flex-col items-center">
            <div className="w-32 md:w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-ev-yellow rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / pickedTopics.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {currentIndex + 1} of {pickedTopics.length}
            </p>
          </div>

          <button
            onClick={handleExitDuringAnswer}
            className="p-1.5 rounded-full text-gray-400 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Exit calibration"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Question title */}
        <h1 className="text-xl md:text-2xl font-semibold text-center px-4 mt-2 mb-3 shrink-0">
          {getQuestionText(currentTopic)}
        </h1>

        {/* Main content: compass + stances */}
        <div className="flex-1 flex flex-col md:flex-row md:pb-4">
          {/* Compass (live updating) */}
          <div className="md:basis-3/5 flex justify-center px-2">
            <div className="w-full max-w-[500px] aspect-square">
              <RadarChart
                data={chartData}
                invertedSpokes={invertedSpokes}
                onToggleInversion={(topic) =>
                  setInvertedSpokes((prev) => ({
                    ...prev,
                    [topic]: !prev[topic],
                  }))
                }
              />
            </div>
          </div>

          {/* Stance buttons */}
          <div className="md:basis-2/5 flex flex-col gap-3 px-4 pb-4 md:pb-0 md:justify-center md:mr-4">
            <h2 className="text-lg md:text-xl font-semibold mb-1">
              {currentTopic.start_phrase}...
            </h2>
            {orderedStances.map((stance, i) => {
              const stanceValue = i + 1;
              return (
                <button
                  key={stance.id}
                  onClick={() => handleSelectStance(stanceValue)}
                  className={`text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm md:text-base font-medium cursor-pointer ${
                    selectedAnswer === stanceValue
                      ? "border-ev-yellow border-2 bg-ev-yellow-light"
                      : "bg-white text-black border-2 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {stance.text}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer nav */}
        <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-100 px-4 py-3 shrink-0">
          <div className="flex justify-between items-center max-w-2xl mx-auto">
            <button
              onClick={handleBack}
              className="px-5 py-2 rounded-full border border-black text-sm font-medium text-black bg-white hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={isLastTopic ? handleFinish : handleNext}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedAnswer
                  ? "bg-black text-white cursor-pointer hover:opacity-90"
                  : "bg-gray-100 text-gray-500 cursor-pointer hover:bg-gray-200"
              }`}
            >
              {isLastTopic
                ? "Finish"
                : selectedAnswer
                ? "Next"
                : "Skip"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================
  // STEP: COMPLETE
  // ============================
  if (step === "complete") {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto flex flex-col items-center justify-center px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-semibold text-center mb-6">
          Your Compass is Ready!
        </h1>
        <div className="w-56 md:w-72 aspect-square">
          <RadarChart
            data={chartData}
            invertedSpokes={invertedSpokes}
            onToggleInversion={(topic) =>
              setInvertedSpokes((prev) => ({ ...prev, [topic]: !prev[topic] }))
            }
          />
        </div>
        <p className="text-gray-500 text-center mt-6 mb-6 max-w-xs">
          You can always refine your compass from the Library
        </p>
        <button
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            onComplete();
          }}
          className="px-8 py-3 bg-black text-white font-semibold rounded-full text-base hover:opacity-90 transition-opacity cursor-pointer"
        >
          View My Compass
        </button>
      </div>
    );
  }

  // Fallback (loading)
  return (
    <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  );
}
