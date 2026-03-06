// CalibrationOverlay.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useCompass } from "./CompassContext";
import RadarChart from "./RadarChart";
import { getQuestionText, parseTensionTitle } from "../util/topic";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

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

const SMOOTH_TRANSITION = {
  duration: 300,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
};

function SortableStanceLabel({ id, text }) {
  const { setNodeRef, transform, transition } = useSortable({
    id,
    disabled: { draggable: true },
    transition: SMOOTH_TRANSITION,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="px-4 py-2.5 rounded-lg text-sm sm:text-base font-medium bg-gray-50 text-gray-600 border border-gray-200"
    >
      {text}
    </div>
  );
}

function SortableWriteInCard({ id, text, onChange, onCancel, showHint }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: SMOOTH_TRANSITION });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex items-start gap-2 px-3 py-2.5 rounded-lg
        ${
          text.trim()
            ? "border-2 border-ev-yellow bg-ev-yellow-light"
            : "border-2 border-dashed border-gray-400"
        }`}
    >
      <div
        {...listeners}
        className={`cursor-grab active:cursor-grabbing pt-1.5 shrink-0 rounded p-1 ${
          showHint
            ? "animate-pulse bg-ev-yellow/30 text-ev-coral"
            : ""
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5"
          fill="currentColor"
        >
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your stance here..."
          rows={2}
          className="text-sm sm:text-base font-medium resize-none bg-transparent focus:outline-none"
        />
        {showHint && (
          <p className="text-xs font-medium text-ev-coral">
            Drag your own view to where it fits among these stances
          </p>
        )}
      </div>
      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-black shrink-0 pt-1 cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}

export default function CalibrationOverlay({ onComplete, onSkip, resumeMode = false, startAtPick = false }) {
  const {
    topics,
    categories,
    selectedTopics,
    setSelectedTopics,
    answers,
    setAnswers,
    writeIns,
    setWriteIns,
    invertedSpokes,
    setInvertedSpokes,
    initRandomInversions,
    isLoggedIn,
  } = useCompass();

  // Load persisted progress on mount, honouring resumeMode and startAtPick
  const getInitialState = () => {
    // Always check localStorage first — this handles refresh during any step,
    // including resume-mode sessions (which now persist their progress).
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

    // startAtPick: enter at pick step with existing selectedTopics pre-selected
    // (used from below-3 overlay — does NOT reset calibration_completed/skipped)
    if (startAtPick) {
      return {
        step: "pick",
        pickedTopics: [...selectedTopics],
        currentIndex: 0,
      };
    }

    // In resume mode: skip welcome/pick, go straight to answer from selectedTopics
    if (resumeMode) {
      // Find first unanswered topic index to start at
      const firstUnanswered = selectedTopics.findIndex((id) => {
        const topic = topics.find((t) => t.id === id);
        if (!topic) return false;
        const val = answers[topic.short_title];
        return !(val != null && val > 0);
      });
      return {
        step: "answer",
        pickedTopics: [...selectedTopics],
        currentIndex: firstUnanswered !== -1 ? firstUnanswered : 0,
      };
    }

    return { step: "welcome", pickedTopics: [], currentIndex: 0 };
  };

  // We use a ref to track whether initial state has been computed so it only
  // runs once even though selectedTopics/topics/answers may not be loaded yet.
  const initializedRef = useRef(false);
  const [step, setStep] = useState("welcome");
  const [pickedTopics, setPickedTopics] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showWriteIn, setShowWriteIn] = useState(false);
  const [writeInText, setWriteInText] = useState("");
  const [orderedItems, setOrderedItems] = useState([]);
  const [hasRepositioned, setHasRepositioned] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  // Initialize state once topics are loaded (needed because resumeMode/startAtPick reads selectedTopics + answers)
  useEffect(() => {
    if (initializedRef.current) return;
    // Always wait for topics to be available — prevents initializing with stale/empty data.
    // Since Compass.jsx now gates on topicsLoaded, topics will be non-empty when we mount,
    // but the defensive check is good practice for any edge cases.
    if (topics.length === 0) return;
    const initial = getInitialState();
    setStep(initial.step);
    setPickedTopics(initial.pickedTopics);
    setCurrentIndex(initial.currentIndex);
    initializedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, resumeMode, startAtPick]);

  // Persist progress on every state change (skip welcome and complete steps)
  // Resume-mode sessions now persist too so refresh during resume-mode restores position.
  useEffect(() => {
    if (step === "welcome" || step === "complete") return;
    const progress = { step, pickedTopics, currentIndex, resumeMode: resumeMode || false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [step, pickedTopics, currentIndex, resumeMode]);

  // Load current answer when index changes in answer step (also restores write-in state)
  useEffect(() => {
    if (step !== "answer") return;
    const topicId = pickedTopics[currentIndex];
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    const val = answers[topic.short_title];
    setSelectedAnswer(typeof val === "number" && val > 0 ? val : null);

    // Derive stances inside effect to avoid stale closure
    const isFlippedInEffect = invertedSpokes[topic.short_title];
    const effectStances = topic.stances
      ? isFlippedInEffect ? [...topic.stances].reverse() : topic.stances
      : [];

    // Restore or reset write-in state
    const savedWriteIn = writeIns?.[topic.short_title];
    if (savedWriteIn && val != null && !Number.isInteger(val)) {
      setShowWriteIn(true);
      setWriteInText(savedWriteIn);
      setHasRepositioned(true);
      const items = [...effectStances.map((s) => s.id)];
      const displayIndex = isFlippedInEffect
        ? Math.floor(effectStances.length + 1 - val)
        : Math.floor(val);
      items.splice(displayIndex, 0, "write-in");
      setOrderedItems(items);
    } else {
      setShowWriteIn(false);
      setWriteInText("");
      setOrderedItems([]);
      setHasRepositioned(false);
    }
  }, [currentIndex, step, pickedTopics, topics, answers, writeIns, invertedSpokes]);

  // Write-in awareness hint — shown only on the first question (currentIndex === 0)
  // Dismissed permanently after advancing past first question or clicking "Write your own..."
  const [writeInHintShown, setWriteInHintShown] = useState(
    () => !!localStorage.getItem("onboarding_writeInHint")
  );

  // Dismiss write-in hint when user advances past first question
  useEffect(() => {
    if (currentIndex > 0 && !writeInHintShown) {
      localStorage.setItem("onboarding_writeInHint", "1");
      setWriteInHintShown(true);
    }
  }, [currentIndex, writeInHintShown]);

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

  // Count unanswered topics among picked
  const unansweredCount = useMemo(() => {
    return pickedTopics.filter((id) => {
      const topic = topics.find((t) => t.id === id);
      if (!topic) return true;
      const val = answers[topic.short_title];
      return !(val != null && val > 0);
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
    // Clear any active write-in when selecting a predefined stance
    if (writeIns?.[currentTopic?.short_title]) {
      setWriteIns((prev) => {
        const updated = { ...prev };
        delete updated[currentTopic.short_title];
        return updated;
      });
    }
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
    // No auto-advance — user clicks Next manually
  };

  // handleNext: find the next UNANSWERED topic, not just next index
  const handleNext = () => {
    const nextUnanswered = pickedTopics.findIndex((id, idx) => {
      if (idx <= currentIndex) return false;
      const topic = topics.find((t) => t.id === id);
      if (!topic) return false;
      const val = answers[topic.short_title];
      return !(val != null && val > 0);
    });
    if (nextUnanswered !== -1) {
      setCurrentIndex(nextUnanswered);
      setSelectedAnswer(null);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else if (!resumeMode) {
      setStep("pick");
    }
    // In resumeMode, back at index 0 does nothing (no pick step to return to)
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

    // Count how many topics will be answered after removing unanswered ones
    const finalAnsweredCount = pickedTopics.length - unansweredIds.length;
    if (finalAnsweredCount < MIN_TOPICS) {
      // Skip the "Your compass is ready" celebration — it's misleading when chart won't render.
      // Dismiss overlay directly; user will see grayed chart with below-3 overlay.
      onComplete();
      return;
    }

    setStep("complete");
  };

  // Exit during answer step — gated on answeredCount >= MIN_TOPICS
  // Only shows "View Compass" button when enough topics answered; otherwise hidden
  const handleExitDuringAnswer = () => {
    if (answeredCount < MIN_TOPICS) return; // Button should not be visible, but guard anyway
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
  };

  const selectWriteInPlacement = (midpointValue) => {
    if (!currentTopic) return;
    setAnswers((prev) => ({ ...prev, [currentTopic.short_title]: midpointValue }));
    setWriteIns((prev) => ({ ...prev, [currentTopic.short_title]: writeInText }));
    setSelectedAnswer(midpointValue);
    if (isLoggedIn) {
      fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_id: currentTopic.id,
          value: midpointValue,
          write_in_text: writeInText,
        }),
      }).catch(() => {});
    }
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = orderedItems.indexOf(active.id);
    const newIndex = orderedItems.indexOf(over.id);
    const reordered = arrayMove(orderedItems, oldIndex, newIndex);
    setOrderedItems(reordered);
    setHasRepositioned(true);
    const writeInIndex = reordered.indexOf("write-in");
    const displayMidpoint = writeInIndex + 0.5;
    const flipped = currentTopic && invertedSpokes[currentTopic.short_title];
    const stanceCount = currentTopic?.stances?.length || 0;
    const midpointValue = flipped ? (stanceCount + 1 - displayMidpoint) : displayMidpoint;
    selectWriteInPlacement(midpointValue);
  };

  const handleWriteInTextChange = (newText) => {
    setWriteInText(newText);
    if (selectedAnswer && !Number.isInteger(selectedAnswer)) {
      if (newText.trim()) {
        setWriteIns((prev) => ({ ...prev, [currentTopic.short_title]: newText }));
      } else {
        setSelectedAnswer(null);
        setAnswers((prev) => {
          const updated = { ...prev };
          delete updated[currentTopic.short_title];
          return updated;
        });
        setWriteIns((prev) => {
          const updated = { ...prev };
          delete updated[currentTopic.short_title];
          return updated;
        });
      }
    }
  };

  const handleCancelWriteIn = () => {
    setShowWriteIn(false);
    setWriteInText("");
    setOrderedItems([]);
    if (selectedAnswer && !Number.isInteger(selectedAnswer)) {
      setSelectedAnswer(null);
      setAnswers((prev) => {
        const updated = { ...prev };
        delete updated[currentTopic.short_title];
        return updated;
      });
      setWriteIns((prev) => {
        const updated = { ...prev };
        delete updated[currentTopic.short_title];
        return updated;
      });
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

  // Whether all remaining topics after current are answered (used for footer button label)
  const allRemainingAnswered = pickedTopics.every((id, idx) => {
    if (idx <= currentIndex) return true;
    const topic = topics.find((t) => t.id === id);
    if (!topic) return false;
    const val = answers[topic.short_title];
    return val != null && val > 0;
  });
  const isLastUnanswered = allRemainingAnswered;

  // ============================
  // STEP: WELCOME
  // ============================
  if (step === "welcome") {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto flex flex-col items-center justify-center px-6 py-12">
        {/* Static SVG compass illustration — replaces calibration-demo.gif */}
        <div className="w-full max-w-sm mx-auto mb-8">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Grid rings */}
            {[1, 2, 3, 4, 5].map((level) => {
              const r = (level / 5) * 80;
              return (
                <circle
                  key={level}
                  cx="100"
                  cy="100"
                  r={r}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="1.5"
                />
              );
            })}
            {/* Spoke lines */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const angle = (2 * Math.PI * i) / 8;
              return (
                <line
                  key={i}
                  x1="100"
                  y1="100"
                  x2={100 + 80 * Math.sin(angle)}
                  y2={100 - 80 * Math.cos(angle)}
                  stroke="#e5e7eb"
                  strokeWidth="1.5"
                />
              );
            })}
            {/* User compass polygon — ev-coral fill */}
            <polygon
              points={[0, 1, 2, 3, 4, 5, 6, 7]
                .map((i) => {
                  const angle = (2 * Math.PI * i) / 8;
                  const values = [0.7, 0.9, 0.5, 0.8, 0.6, 0.85, 0.4, 0.75];
                  const r = values[i] * 80;
                  return `${100 + r * Math.sin(angle)},${100 - r * Math.cos(angle)}`;
                })
                .join(" ")}
              fill="#ff5740"
              fillOpacity="0.25"
              stroke="#ff5740"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Comparison polygon — ev-light-blue fill */}
            <polygon
              points={[0, 1, 2, 3, 4, 5, 6, 7]
                .map((i) => {
                  const angle = (2 * Math.PI * i) / 8;
                  const values = [0.5, 0.6, 0.8, 0.4, 0.9, 0.55, 0.7, 0.45];
                  const r = values[i] * 80;
                  return `${100 + r * Math.sin(angle)},${100 - r * Math.cos(angle)}`;
                })
                .join(" ")}
              fill="#59b0c4"
              fillOpacity="0.2"
              stroke="#59b0c4"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Accent dots on user polygon vertices */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const angle = (2 * Math.PI * i) / 8;
              const values = [0.7, 0.9, 0.5, 0.8, 0.6, 0.85, 0.4, 0.75];
              const r = values[i] * 80;
              return (
                <circle
                  key={i}
                  cx={100 + r * Math.sin(angle)}
                  cy={100 - r * Math.cos(angle)}
                  r="4"
                  fill="#fed12e"
                  stroke="white"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold text-center mb-4">
          Build Your Political Compass
        </h1>
        <p className="text-gray-600 text-base md:text-lg text-center max-w-sm mb-8">
          Pick topics that matter to you, answer where you stand, and see your political compass take shape.
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
              onClick={() => startAtPick ? onSkip() : setStep("welcome")}
              className="p-1.5 rounded-full text-gray-400 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
              aria-label={startAtPick ? "Close" : "Back to welcome"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">Choose Your Topics</h1>
              <p className="text-gray-500 text-sm">Pick the issues that matter most to you when you vote</p>
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
          {categories.map((category) => {
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
                        <div className="text-left">
                          <p className="text-sm font-medium leading-snug">{parseTensionTitle(fullTopic).name}</p>
                          {getQuestionText(fullTopic) && (
                            <p className="text-xs text-gray-500 font-normal mt-0.5">{getQuestionText(fullTopic)}</p>
                          )}
                        </div>
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
                style={{ width: `${(answeredCount / pickedTopics.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {answeredCount} of {pickedTopics.length} answered
            </p>
          </div>

          {/* Exit button: hidden until 3+ answered, then shows "View Compass" */}
          {answeredCount >= MIN_TOPICS ? (
            <button
              onClick={handleExitDuringAnswer}
              className="text-sm font-medium text-[#59b0c4] hover:text-[#00657c] transition-colors cursor-pointer px-2 py-1"
            >
              View Compass
            </button>
          ) : (
            <div className="w-9" aria-hidden="true" />
          )}
        </div>

        {/* Topic pill list — scrollable horizontal strip showing all topics */}
        <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0">
          {pickedTopics.map((id, idx) => {
            const topic = topics.find((t) => t.id === id);
            const isAnswered = topic && answers[topic.short_title] != null && answers[topic.short_title] > 0;
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={id}
                onClick={() => { setCurrentIndex(idx); setSelectedAnswer(null); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  isCurrent
                    ? "border-2 border-[#59b0c4] bg-sky-50 text-[#00657c]"
                    : isAnswered
                    ? "bg-gray-100 text-gray-400"
                    : "bg-white border border-gray-200 text-gray-700"
                }`}
              >
                {isAnswered && !isCurrent && <span className="mr-1 text-green-500">&#10003;</span>}
                {topic ? parseTensionTitle(topic).name : "..."}
              </button>
            );
          })}
        </div>

        {/* Main content: compass + stances */}
        <div className="flex-1 flex flex-col md:flex-row md:pb-4">
          {/* Compass (live updating) — left 50%, vertically centered */}
          <div className="md:basis-1/2 flex items-start justify-center px-2 md:pt-6">
            <div className="w-full max-w-[340px] md:max-w-xl aspect-[1/0.75] md:aspect-square">
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

          {/* Question + Stance buttons — right 50%, stacked from top */}
          <div className="md:basis-1/2 flex flex-col gap-1.5 px-3 pb-4 md:pb-0 md:pt-6 md:pr-6 max-w-md mx-auto md:mx-0">
            {/* Question text anchored above stances */}
            <div className="mb-2">
              <p className="text-base md:text-lg font-semibold leading-snug">
                {getQuestionText(currentTopic) || parseTensionTitle(currentTopic).name}
              </p>
              {getQuestionText(currentTopic) && (
                <p className="text-sm text-gray-500 font-normal mt-0.5">
                  {parseTensionTitle(currentTopic).name}
                </p>
              )}
            </div>
            {!showWriteIn ? (
              <>
                {orderedStances.map((stance, i) => {
                  const stanceValue = stance.value;
                  return (
                    <button
                      key={stance.id}
                      onClick={() => {
                        setShowWriteIn(false);
                        setWriteInText("");
                        handleSelectStance(stanceValue);
                      }}
                      className={`text-left px-3 py-2.5 rounded-lg transition-all duration-200 text-sm leading-snug font-medium cursor-pointer ${
                        selectedAnswer === stanceValue
                          ? "border-ev-yellow border-2 bg-ev-yellow-light"
                          : "bg-white text-black border-2 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {stance.text}
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    setShowWriteIn(true);
                    setHasRepositioned(false);
                    setOrderedItems([...orderedStances.map((s) => s.id), "write-in"]);
                    // Dismiss write-in hint when user clicks "Write your own..."
                    if (!writeInHintShown) {
                      localStorage.setItem("onboarding_writeInHint", "1");
                      setWriteInHintShown(true);
                    }
                  }}
                  className="text-left px-3 py-2.5 rounded-lg transition-all duration-200 text-sm leading-snug font-medium cursor-pointer border-2 border-dashed border-gray-400 text-gray-500 hover:border-ev-yellow hover:text-black"
                >
                  Write your own...
                </button>
                {currentIndex === 0 && !writeInHintShown && !showWriteIn && (
                  <p className="text-xs text-gray-400 text-center mt-1">
                    You can always write your own stance if none of these fit
                  </p>
                )}
              </>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={orderedItems} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-1.5">
                    {orderedItems.map((itemId) =>
                      itemId === "write-in" ? (
                        <SortableWriteInCard
                          key="write-in"
                          id="write-in"
                          text={writeInText}
                          onChange={handleWriteInTextChange}
                          onCancel={handleCancelWriteIn}
                          showHint={!!writeInText.trim() && !hasRepositioned}
                        />
                      ) : (
                        <SortableStanceLabel
                          key={itemId}
                          id={itemId}
                          text={orderedStances.find((s) => s.id === itemId)?.text ?? ""}
                        />
                      )
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            )}
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
              onClick={isLastUnanswered ? handleFinish : handleNext}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedAnswer
                  ? "bg-black text-white cursor-pointer hover:opacity-90"
                  : "bg-gray-100 text-gray-500 cursor-pointer hover:bg-gray-200"
              }`}
            >
              {isLastUnanswered
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

  // Fallback (loading / initializing)
  return (
    <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  );
}
