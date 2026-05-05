// CalibrationOverlay.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useTheme } from "../ThemeProvider";
import { useCompass } from "./CompassContext";
import { apiFetch } from "../lib/auth";
import RadarChart from "./RadarChart";
import { getQuestionText, parseTensionTitle } from "../util/topic";
import { TopicTierBadge } from "@empoweredvote/ev-ui";
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
import CoachMark from "./CoachMark";

const STORAGE_KEY = "calibration_progress";
const MAX_TOPICS = 8;
const MIN_TOPICS = 3;

// Category accent colors — cycles through EV data viz palette
const CATEGORY_COLORS = [
  '#00657C', '#FF5740', '#59B0C4', '#5A9A6E', '#7C6B9E', '#D4940B', '#FED12E',
];

// ────────────────────────────────────────────────
// Theme palettes (EV semantic tokens)
// ────────────────────────────────────────────────
const DARK_THEME = {
  bg:             '#131416',
  card:           '#2F3237',
  cardElev:       '#41454E',
  border:         '#41454E',
  borderAccent:   '#59B0C4',
  textHead:       '#EBEDEF',
  textBody:       '#D3D7DE',
  textMuted:      '#9CA3AF',
  textAccent:     '#59B0C4',
  btnBg:          '#005366',
  btnText:        '#FFFFFF',
  selBg:          'rgba(89,176,196,0.12)',
  selBorder:      '#59B0C4',
  yellow:         '#FED12E',
  yellowDark:     '#D0A301',
  yellowBg:       'rgba(254,209,46,0.12)',
  progressBg:     '#41454E',
  divider:        '#41454E',
  stickyBg:       'rgba(19,20,22,0.97)',
  stanceBg:       '#2F3237',
  stanceText:     '#D3D7DE',
  stanceBorder:   '#41454E',
  writeOwnColor:  '#6B7280',
};

const LIGHT_THEME = {
  bg:             '#F7F7F8',
  card:           '#FFFFFF',
  cardElev:       '#EBEDEF',
  border:         '#D3D7DE',
  borderAccent:   '#00657C',
  textHead:       '#2F3237',
  textBody:       '#535964',
  textMuted:      '#8F9EBC',
  textAccent:     '#00657C',
  btnBg:          '#005366',
  btnText:        '#FFFFFF',
  selBg:          '#E4F3F6',
  selBorder:      '#00657C',
  yellow:         '#FED12E',
  yellowDark:     '#D0A301',
  yellowBg:       '#FEF3C7',
  progressBg:     '#D3D7DE',
  divider:        '#D3D7DE',
  stickyBg:       'rgba(247,247,248,0.97)',
  stanceBg:       '#FFFFFF',
  stanceText:     '#2F3237',
  stanceBorder:   '#D3D7DE',
  writeOwnColor:  '#8F9EBC',
};

// ────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────

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

function SortableStanceLabel({ id, text, isDark }) {
  const t = isDark ? DARK_THEME : LIGHT_THEME;
  const { setNodeRef, transform, transition } = useSortable({
    id,
    disabled: { draggable: true },
    transition: SMOOTH_TRANSITION,
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: t.card,
        color: t.textBody,
        border: `1px solid ${t.border}`,
      }}
      className="px-4 py-2.5 rounded-lg text-sm font-medium"
    >
      {text}
    </div>
  );
}

function SortableWriteInCard({ id, text, onChange, onCancel, showHint, isDark }) {
  const t = isDark ? DARK_THEME : LIGHT_THEME;
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
      style={{
        ...style,
        border: `2px solid ${t.yellow}`,
        background: t.yellowBg,
      }}
      className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
      {...attributes}
    >
      <div
        {...listeners}
        className={`cursor-grab active:cursor-grabbing pt-1.5 shrink-0 rounded p-1 ${
          showHint ? "animate-pulse" : ""
        }`}
        style={{ color: showHint ? '#E85D26' : t.textMuted }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
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
          className="text-sm font-medium resize-none bg-transparent focus:outline-none"
          style={{ color: t.textHead }}
        />
        {showHint && (
          <p className="text-xs font-medium" style={{ color: '#E85D26' }}>
            Drag your own view to where it fits among these stances
          </p>
        )}
      </div>
      <button
        onClick={onCancel}
        className="shrink-0 pt-1 cursor-pointer hover:opacity-70 transition-opacity"
        style={{ color: t.textMuted }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────
// Icon helpers
// ────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.061-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.061-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.061zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.061z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────

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

  // Offset overlay when ReturnBanner is visible (fixed z-[60] above us)
  const hasReturnBanner = !!sessionStorage.getItem("essentials_return_url");
  const overlayTop = hasReturnBanner ? "top-9" : "top-0";

  const { isDark, toggle: toggleDark } = useTheme();
  const t = isDark ? DARK_THEME : LIGHT_THEME;

  // Load persisted progress on mount, honouring resumeMode and startAtPick
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

    if (startAtPick) {
      return {
        step: "pick",
        pickedTopics: [...selectedTopics],
        currentIndex: 0,
      };
    }

    if (resumeMode) {
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

  useEffect(() => {
    if (initializedRef.current) return;
    if (topics.length === 0) return;
    const initial = getInitialState();
    setStep(initial.step);
    setPickedTopics(initial.pickedTopics);
    setCurrentIndex(initial.currentIndex);
    initializedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, resumeMode, startAtPick]);

  useEffect(() => {
    if (step === "welcome" || step === "complete") return;
    const progress = { step, pickedTopics, currentIndex, resumeMode: resumeMode || false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [step, pickedTopics, currentIndex, resumeMode]);

  useEffect(() => {
    if (step !== "answer") return;
    const topicId = pickedTopics[currentIndex];
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    const val = answers[topic.short_title];
    setSelectedAnswer(typeof val === "number" && val > 0 ? val : null);

    const isFlippedInEffect = invertedSpokes[topic.short_title];
    const effectStances = topic.stances
      ? isFlippedInEffect ? topic.stances : [...topic.stances].reverse()
      : [];

    const savedWriteIn = writeIns?.[topic.short_title];
    if (savedWriteIn && val != null && !Number.isInteger(val)) {
      setShowWriteIn(true);
      setWriteInText(savedWriteIn);
      setHasRepositioned(true);
      const items = [...effectStances.map((s) => s.id)];
      const displayIndex = isFlippedInEffect
        ? Math.floor(val)
        : Math.floor(effectStances.length + 1 - val);
      items.splice(displayIndex, 0, "write-in");
      setOrderedItems(items);
    } else {
      setShowWriteIn(false);
      setWriteInText("");
      setOrderedItems([]);
      setHasRepositioned(false);
    }
  }, [currentIndex, step, pickedTopics, topics, answers, writeIns, invertedSpokes]);

  const firstTopicRef = useRef(null);
  const [topicPickHintDismissed, setTopicPickHintDismissed] = useState(
    () => !!localStorage.getItem("onboarding_topicPickHint")
  );

  const stancesPanelRef = useRef(null);
  const writeOwnBtnRef = useRef(null);
  const [answerTourStep, setAnswerTourStep] = useState(() =>
    localStorage.getItem("onboarding_answerTour") ? -1 : 0
  );
  const advanceAnswerTour = () => {
    if (answerTourStep < 1) {
      setAnswerTourStep(answerTourStep + 1);
    } else {
      localStorage.setItem("onboarding_answerTour", "1");
      setAnswerTourStep(-1);
    }
  };
  const skipAnswerTour = () => {
    localStorage.setItem("onboarding_answerTour", "1");
    setAnswerTourStep(-1);
  };

  const [writeInHintShown, setWriteInHintShown] = useState(
    () => !!localStorage.getItem("onboarding_writeInHint")
  );

  useEffect(() => {
    if (currentIndex > 0 && !writeInHintShown) {
      localStorage.setItem("onboarding_writeInHint", "1");
      setWriteInHintShown(true);
    }
  }, [currentIndex, writeInHintShown]);

  const dedupedCategories = useMemo(() => {
    const seen = new Set();
    return categories
      .map((cat) => ({
        ...cat,
        topics: cat.topics.filter((t) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        }),
      }))
      .filter((cat) => cat.topics.length > 0);
  }, [categories]);

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

  const currentTopic = useMemo(() => {
    if (step !== "answer") return null;
    const id = pickedTopics[currentIndex];
    return topics.find((t) => t.id === id) || null;
  }, [step, pickedTopics, currentIndex, topics]);

  const answeredCount = useMemo(() => {
    return pickedTopics.filter((id) => {
      const topic = topics.find((t) => t.id === id);
      if (!topic) return false;
      const val = answers[topic.short_title];
      return val != null && val > 0;
    }).length;
  }, [pickedTopics, topics, answers]);

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
    setSelectedTopics((prev) => {
      const existing = new Set(prev);
      const newIds = pickedTopics.filter((id) => !existing.has(id));
      return [...prev, ...newIds];
    });
    const pickedTopicObjects = pickedTopics
      .map((id) => topics.find((t) => t.id === id))
      .filter(Boolean);
    initRandomInversions(pickedTopicObjects);
    setCurrentIndex(0);
    setStep("answer");
  };

  const handleSelectStance = async (value) => {
    if (!currentTopic) return;
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
        await apiFetch('/compass/answers', {
          method: "POST",
          body: JSON.stringify({ topic_id: currentTopic.id, value }),
        });
      } catch {}
    }
  };

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
    } else {
      handleSkip();
    }
  };

  const handleFinish = () => {
    const unansweredIds = pickedTopics.filter((id) => {
      const topic = topics.find((t) => t.id === id);
      if (!topic) return true;
      const val = answers[topic.short_title];
      return !(val != null && val > 0);
    });
    if (unansweredIds.length > 0) {
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

    const finalAnsweredCount = pickedTopics.length - unansweredIds.length;
    if (finalAnsweredCount < MIN_TOPICS) {
      onComplete();
      return;
    }

    setStep("complete");
  };

  const handleExitDuringAnswer = () => {
    if (answeredCount < MIN_TOPICS) return;
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
      apiFetch('/compass/answers', {
        method: "POST",
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
    const midpointValue = flipped ? displayMidpoint : (stanceCount + 1 - displayMidpoint);
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
        ? currentTopic.stances
        : [...currentTopic.stances].reverse()
      : [];

  const allRemainingAnswered = pickedTopics.every((id, idx) => {
    if (idx <= currentIndex) return true;
    const topic = topics.find((t) => t.id === id);
    if (!topic) return false;
    const val = answers[topic.short_title];
    return val != null && val > 0;
  });
  const isLastUnanswered = allRemainingAnswered;

  // Shared dark-mode toggle button rendered inline in each step header
  const DarkToggle = ({ style: extraStyle = {} }) => (
    <button
      onClick={toggleDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-opacity hover:opacity-70 shrink-0"
      style={{ background: t.cardElev, color: t.textMuted, ...extraStyle }}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );

  // Phase progress bar used in pick + answer steps
  const PhaseBar = ({ current }) => (
    <div className="flex items-center justify-center gap-1.5 text-xs font-bold tracking-widest uppercase select-none">
      {[
        { n: 1, label: "Choose Topics" },
        { n: 2, label: "Stances" },
        { n: 3, label: "Discover" },
      ].map(({ n, label }, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && (
            <span style={{ color: t.divider, fontWeight: 400, letterSpacing: 0 }}>—</span>
          )}
          <span style={{ color: current === n ? t.textAccent : t.textMuted }}>
            {n === current ? `① `.replace('1', String(n)) : `○ `.replace('○', `${n}.`)}
            {n === current ? `⬤ ` : ''}
            {label}
          </span>
        </span>
      ))}
    </div>
  );

  // Simpler phase indicator — numbered dots + labels
  const PhaseIndicator = ({ current }) => {
    const phases = ["Choose Topics", "Your Stances", "Compare & Discover"];
    return (
      <div className="flex items-center justify-center gap-0 select-none">
        {phases.map((label, i) => {
          const n = i + 1;
          const active = n === current;
          const done = n < current;
          return (
            <div key={n} className="flex items-center">
              {i > 0 && (
                <div
                  className="w-8 h-px"
                  style={{ background: done ? t.textAccent : t.divider }}
                />
              )}
              <div className="flex flex-col items-center gap-0.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: active ? t.textAccent : done ? t.textAccent : t.cardElev,
                    color: active || done ? '#FFFFFF' : t.textMuted,
                    boxShadow: active ? `0 0 0 3px ${t.textAccent}30` : 'none',
                  }}
                >
                  {done ? '✓' : n}
                </div>
                <span
                  className="text-xs font-medium whitespace-nowrap hidden sm:block"
                  style={{ color: active ? t.textAccent : t.textMuted }}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ============================
  // STEP: WELCOME
  // ============================
  if (step === "welcome") {
    const journeySteps = [
      {
        num: "01",
        title: "Choose Your Wedge Issues",
        desc: "Pick the issues that actually shape how you vote.",
        color: '#59B0C4',
        active: true,
      },
      {
        num: "02",
        title: "Find Your Stances",
        desc: "Tell us where you stand on each one. There are no right answers — only yours.",
        color: '#FED12E',
        active: false,
      },
      {
        num: "03",
        title: "Compare & Discover",
        desc: "Sort your leaders by your priorities.",
        color: '#5A9A6E',
        active: false,
      },
    ];

    return (
      <div
        className={`fixed ${overlayTop} left-0 right-0 bottom-0 z-50 overflow-y-auto flex flex-col`}
        style={{ background: t.bg }}
      >
        {/* Dark mode toggle — top right */}
        <div className="absolute top-4 right-4 z-10">
          <DarkToggle />
        </div>

        <div className="flex flex-col lg:flex-row min-h-full">

          {/* ── Left: hero copy ── */}
          <div className="flex flex-col justify-center px-8 py-16 lg:py-24 lg:w-1/2 lg:pl-16 lg:pr-10">

            <p
              className="text-xs font-bold tracking-widest uppercase mb-5"
              style={{ color: t.textAccent }}
            >
              Your Political Compass
            </p>

            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-5"
              style={{ color: t.textHead, letterSpacing: '-0.03em' }}
            >
              Let&apos;s calibrate your compass{' '}
              <span style={{ color: t.textAccent }}>to you.</span>
            </h1>

            <p
              className="text-base md:text-lg font-semibold max-w-md leading-relaxed mb-3"
              style={{ color: t.textBody }}
            >
              Three steps. Takes about 6 minutes.
            </p>
            <p
              className="text-base max-w-sm leading-relaxed mb-10"
              style={{ color: t.textMuted }}
            >
              Have you ever got down to the bottom of your ballot, and found you didn&apos;t know a thing about any of the candidates, let alone their stances and priorities&hellip;?
              <br /><br />
              We hate that.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <button
                onClick={handleGetStarted}
                className="px-8 py-3.5 rounded-full font-bold text-base transition-all hover:opacity-90 active:scale-95 cursor-pointer shadow-md"
                style={{ background: t.yellow, color: '#1C1C1C' }}
              >
                Start Step 1 →
              </button>
              <button
                onClick={handleSkip}
                className="px-6 py-3.5 rounded-full text-sm font-medium transition-opacity hover:opacity-70 cursor-pointer"
                style={{ color: t.textMuted }}
              >
                Not now
              </button>
            </div>
          </div>

          {/* ── Right: 3-step cards ── */}
          <div className="flex flex-col justify-center px-8 pb-16 lg:py-24 lg:w-1/2 lg:pr-16 lg:pl-8">
            <div className="flex flex-col gap-4 max-w-md w-full mx-auto lg:mx-0">
              {journeySteps.map((s) => (
                <div
                  key={s.num}
                  className="flex items-start gap-4 p-5 rounded-2xl transition-all"
                  style={{
                    background: s.active ? `${s.color}18` : t.card,
                    border: `1.5px solid ${s.active ? s.color : t.border}`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{
                      background: s.active ? s.color : t.cardElev,
                      color: s.active ? '#1C1C1C' : t.textMuted,
                    }}
                  >
                    {s.num}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-base mb-1" style={{ color: t.textHead }}>
                      {s.title}
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: t.textBody }}>
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ============================
  // STEP: PICK TOPICS
  // ============================
  if (step === "pick") {
    return (
      <div
        className={`fixed ${overlayTop} left-0 right-0 bottom-0 z-50 overflow-y-auto`}
        style={{ background: t.bg }}
      >
        {/* ── Sticky header ── */}
        <div
          className="sticky top-0 z-10 px-4 pt-3 pb-3"
          style={{ background: t.stickyBg, borderBottom: `1px solid ${t.border}` }}
        >
          {/* Phase indicator */}
          <div className="max-w-5xl mx-auto mb-3">
            <PhaseIndicator current={1} />
          </div>

          {/* Title row */}
          <div className="flex items-center gap-3 max-w-5xl mx-auto">
            <button
              onClick={handleSkip}
              className="p-1.5 rounded-full transition-colors cursor-pointer shrink-0 hover:opacity-70"
              style={{ color: t.textMuted }}
              aria-label="Close"
            >
              <BackArrow />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold leading-tight" style={{ color: t.textHead }}>
                What matters to you?
              </h1>
              <p className="text-xs" style={{ color: t.textMuted }}>
                Pick 3 to 8 topics — you can always change these later
              </p>
            </div>

            <span
              className="shrink-0 text-sm font-bold px-3 py-1 rounded-full transition-all"
              style={{
                background: pickedTopics.length >= MIN_TOPICS ? t.yellow : t.cardElev,
                color: pickedTopics.length >= MIN_TOPICS ? '#1C1C1C' : t.textMuted,
              }}
            >
              {pickedTopics.length}/{MAX_TOPICS}
            </span>

            <DarkToggle />
          </div>
        </div>

        {/* ── Topic list ── */}
        <div className="px-4 py-4 max-w-5xl mx-auto pb-32">
          {dedupedCategories.map((category, catIdx) => {
            if (!category.topics || category.topics.length === 0) return null;
            const catColor = CATEGORY_COLORS[catIdx % CATEGORY_COLORS.length];
            return (
              <div key={category.id} className="mb-8">
                {/* Category header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-1 h-5 rounded-full shrink-0"
                    style={{ background: catColor }}
                  />
                  <h3
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: catColor }}
                  >
                    {category.title}
                  </h3>
                </div>

                {/* Topic cards — 1 col mobile, 2 col sm, 3 col lg */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {category.topics.map((topic, topicIdx) => {
                    const fullTopic = topics.find((tp) => tp.id === topic.id) || topic;
                    const isSelected = pickedTopics.includes(topic.id);
                    const atCap = pickedTopics.length >= MAX_TOPICS && !isSelected;
                    const isFirstTopic = catIdx === 0 && topicIdx === 0;

                    return (
                      <button
                        key={topic.id}
                        ref={isFirstTopic ? firstTopicRef : undefined}
                        onClick={() => !atCap && togglePick(topic.id)}
                        disabled={atCap}
                        className="text-left px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer flex items-start justify-between gap-2"
                        style={
                          isSelected
                            ? {
                                background: `${catColor}18`,
                                border: `2px solid ${catColor}`,
                              }
                            : atCap
                            ? {
                                background: t.card,
                                border: `1px solid ${t.border}`,
                                borderLeft: `4px solid ${catColor}`,
                                opacity: 0.3,
                                cursor: 'not-allowed',
                              }
                            : {
                                background: t.card,
                                border: `1px solid ${t.border}`,
                                borderLeft: `4px solid ${catColor}`,
                              }
                        }
                      >
                        <div className="text-left min-w-0">
                          <p
                            className="text-sm font-semibold leading-snug"
                            style={{ color: t.textHead }}
                          >
                            {getQuestionText(fullTopic) || parseTensionTitle(fullTopic).name}
                          </p>
                          {getQuestionText(fullTopic) && (
                            <p
                              className="text-xs font-normal mt-0.5"
                              style={{ color: t.textMuted }}
                            >
                              {parseTensionTitle(fullTopic).name}
                            </p>
                          )}
                          <div className="mt-2">
                            <TopicTierBadge topic={fullTopic} size="xs" variant="muted" />
                          </div>
                        </div>
                        {isSelected && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-5 h-5 shrink-0"
                            style={{ color: catColor }}
                          >
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

        {/* ── Footer ── */}
        <div
          className="fixed bottom-0 left-0 right-0 px-4 py-4 z-10"
          style={{ background: t.stickyBg, borderTop: `1px solid ${t.border}` }}
        >
          <div className="max-w-5xl mx-auto flex flex-col gap-2">
            {pickedTopics.length < MIN_TOPICS && pickedTopics.length > 0 && (
              <p className="text-center text-sm" style={{ color: t.textMuted }}>
                {MIN_TOPICS - pickedTopics.length} more to go
              </p>
            )}
            {pickedTopics.length === 0 && (
              <p className="text-center text-sm" style={{ color: t.textMuted }}>
                Pick at least 3 topics to continue
              </p>
            )}
            <button
              onClick={handleContinueToAnswer}
              disabled={pickedTopics.length < MIN_TOPICS}
              className="w-full py-3.5 rounded-full font-bold text-base transition-all duration-200 cursor-pointer"
              style={
                pickedTopics.length >= MIN_TOPICS
                  ? { background: t.btnBg, color: t.btnText }
                  : { background: t.cardElev, color: t.textMuted, cursor: 'not-allowed' }
              }
            >
              {pickedTopics.length >= MIN_TOPICS
                ? `Continue to Step 2 — Find Your Stances →`
                : 'Continue'}
            </button>
          </div>
        </div>

        {/* Coach mark */}
        {!topicPickHintDismissed && !startAtPick && (
          <CoachMark
            targetRef={firstTopicRef}
            message="Tap topics you care about most when voting — these shape your personal compass and help you compare with politicians."
            onDismiss={() => {
              localStorage.setItem("onboarding_topicPickHint", "1");
              setTopicPickHintDismissed(true);
            }}
            show={true}
          />
        )}
      </div>
    );
  }

  // ============================
  // STEP: ANSWER TOPICS
  // ============================
  if (step === "answer" && currentTopic) {
    return (
      <div
        className={`fixed ${overlayTop} left-0 right-0 bottom-0 z-50 overflow-y-auto flex flex-col`}
        style={{ background: t.bg }}
      >
        {/* ── Header ── */}
        <div className="flex flex-col px-4 pt-3 pb-2 shrink-0">
          {/* Phase indicator */}
          <div className="mb-3">
            <PhaseIndicator current={2} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleBack}
              className="p-1.5 rounded-full transition-colors cursor-pointer hover:opacity-70"
              style={{ color: t.textMuted }}
              aria-label="Back"
            >
              <BackArrow />
            </button>

            {/* Progress bar */}
            <div className="flex flex-col items-center flex-1 max-w-xs">
              <div
                className="w-full h-1.5 rounded-full overflow-hidden mb-1"
                style={{ background: t.progressBg }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(answeredCount / pickedTopics.length) * 100}%`,
                    background: t.yellow,
                  }}
                />
              </div>
              <p className="text-xs" style={{ color: t.textMuted }}>
                {answeredCount} of {pickedTopics.length} answered
              </p>
            </div>

            <div className="flex items-center gap-2">
              {answeredCount >= MIN_TOPICS ? (
                <button
                  onClick={handleExitDuringAnswer}
                  className="text-sm font-medium transition-colors cursor-pointer px-2 py-1"
                  style={{ color: t.textAccent }}
                >
                  View Compass
                </button>
              ) : (
                <div className="w-9" aria-hidden="true" />
              )}
              <DarkToggle />
            </div>
          </div>
        </div>

        {/* Topic pill strip */}
        <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0 justify-center">
          {pickedTopics.map((id, idx) => {
            const topic = topics.find((tp) => tp.id === id);
            const isAnswered = topic && answers[topic.short_title] != null && answers[topic.short_title] > 0;
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={id}
                onClick={() => { setCurrentIndex(idx); setSelectedAnswer(null); }}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
                style={
                  isCurrent
                    ? { border: `2px solid ${t.borderAccent}`, background: t.selBg, color: t.textAccent }
                    : isAnswered
                    ? { background: t.cardElev, color: t.textMuted, border: '2px solid transparent' }
                    : { background: t.card, border: `1px solid ${t.border}`, color: t.textBody }
                }
              >
                {isAnswered && !isCurrent && (
                  <span className="mr-1" style={{ color: '#5A9A6E' }}>✓</span>
                )}
                {topic ? parseTensionTitle(topic).name : "..."}
              </button>
            );
          })}
        </div>

        {/* Main content: compass + stances */}
        <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden">
          {/* Compass — left side, sized to viewport height so it grows big on larger screens */}
          <div className="md:basis-1/2 flex items-center justify-center px-2 md:pt-4">
            <div className="w-full max-w-[440px] md:max-w-[min(calc(50vw-2rem),calc(100vh-200px))] aspect-square mx-auto">
              <RadarChart
                data={chartData}
                invertedSpokes={invertedSpokes}
                activeSpoke={currentTopic?.short_title}
                writeIns={writeIns}
                darkMode={isDark}
                onToggleInversion={(topic) =>
                  setInvertedSpokes((prev) => ({
                    ...prev,
                    [topic]: !prev[topic],
                  }))
                }
              />
            </div>
          </div>

          {/* Question + Stance buttons — right 50% */}
          <div ref={stancesPanelRef} className="md:basis-1/2 flex flex-col gap-1.5 px-3 pb-4 md:pb-0 md:pt-6 md:pr-6 max-w-md mx-auto md:mx-0">
            <div className="mb-2">
              <p className="text-base md:text-lg font-semibold leading-snug" style={{ color: t.textHead }}>
                {getQuestionText(currentTopic) || parseTensionTitle(currentTopic).name}
              </p>
              {getQuestionText(currentTopic) && (
                <p className="text-sm font-normal mt-0.5" style={{ color: t.textMuted }}>
                  {parseTensionTitle(currentTopic).name}
                </p>
              )}
            </div>

            {!showWriteIn ? (
              <>
                {orderedStances.map((stance) => {
                  const stanceValue = stance.value;
                  const isSelected = selectedAnswer === stanceValue;
                  return (
                    <button
                      key={stance.id}
                      onClick={() => {
                        setShowWriteIn(false);
                        setWriteInText("");
                        handleSelectStance(stanceValue);
                      }}
                      className="text-left px-3 py-2.5 rounded-lg transition-all duration-200 text-sm leading-snug font-medium cursor-pointer"
                      style={
                        isSelected
                          ? {
                              border: `2px solid ${t.yellow}`,
                              background: t.yellowBg,
                              color: t.textHead,
                            }
                          : {
                              background: t.stanceBg,
                              color: t.stanceText,
                              border: `2px solid ${t.stanceBorder}`,
                            }
                      }
                    >
                      {stance.text}
                    </button>
                  );
                })}
                <button
                  ref={writeOwnBtnRef}
                  onClick={() => {
                    setShowWriteIn(true);
                    setHasRepositioned(false);
                    setOrderedItems([...orderedStances.map((s) => s.id), "write-in"]);
                    if (!writeInHintShown) {
                      localStorage.setItem("onboarding_writeInHint", "1");
                      setWriteInHintShown(true);
                    }
                  }}
                  className="text-left px-3 py-2.5 rounded-lg transition-all duration-200 text-sm leading-snug font-medium cursor-pointer"
                  style={{
                    border: `2px dashed ${t.writeOwnColor}`,
                    color: t.writeOwnColor,
                    background: 'transparent',
                  }}
                >
                  Write your own...
                </button>
                {currentIndex === 0 && !writeInHintShown && !showWriteIn && (
                  <p className="text-xs text-center mt-1" style={{ color: t.textMuted }}>
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
                          isDark={isDark}
                        />
                      ) : (
                        <SortableStanceLabel
                          key={itemId}
                          id={itemId}
                          text={orderedStances.find((s) => s.id === itemId)?.text ?? ""}
                          isDark={isDark}
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
        <div
          className="sticky bottom-0 px-4 py-3 shrink-0"
          style={{
            background: t.stickyBg,
            borderTop: `1px solid ${t.border}`,
          }}
        >
          <div className="flex justify-between items-center max-w-2xl mx-auto">
            <button
              onClick={handleBack}
              className="px-5 py-2 rounded-full border text-sm font-medium transition-colors cursor-pointer"
              style={{
                borderColor: t.border,
                color: t.textBody,
                background: 'transparent',
              }}
            >
              Back
            </button>
            <button
              onClick={isLastUnanswered ? handleFinish : handleNext}
              className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer"
              style={
                selectedAnswer
                  ? { background: t.btnBg, color: t.btnText }
                  : { background: t.cardElev, color: t.textMuted }
              }
            >
              {isLastUnanswered ? "Finish" : selectedAnswer ? "Next" : "Skip"}
            </button>
          </div>
        </div>

        {/* Answer step 2-step tour */}
        {answerTourStep >= 0 && currentIndex === 0 && !showWriteIn && (
          <CoachMark
            targetRef={answerTourStep === 0 ? stancesPanelRef : writeOwnBtnRef}
            message={
              answerTourStep === 0
                ? "Pick the stance that fits you best. Stances run bottom to top — bottom is closest to the center ring, top is the outermost ring. We randomize which political direction maps to each end, so neither side always starts first."
                : "If none of the stances quite match, write your own and drag it to where it fits best on the spectrum"
            }
            stepLabel={`${answerTourStep + 1} of 2`}
            onNext={advanceAnswerTour}
            onSkipAll={skipAnswerTour}
            onDismiss={advanceAnswerTour}
            show={true}
            allowSpotlightInteraction={true}
          />
        )}
      </div>
    );
  }

  // ============================
  // STEP: COMPLETE
  // ============================
  if (step === "complete") {
    return (
      <div
        className={`fixed ${overlayTop} left-0 right-0 bottom-0 z-50 overflow-y-auto flex flex-col`}
        style={{ background: t.bg }}
      >
        {/* Dark toggle */}
        <div className="absolute top-4 right-4 z-10">
          <DarkToggle />
        </div>

        <div className="flex flex-col lg:flex-row min-h-full">

          {/* Left: compass */}
          <div className="flex flex-col items-center justify-center px-8 py-16 lg:py-24 lg:w-1/2 lg:pl-16">
            <div className="w-full max-w-[min(calc(50vw-4rem),calc(100vh-280px))] aspect-square mx-auto">
              <RadarChart
                data={chartData}
                invertedSpokes={invertedSpokes}
                writeIns={writeIns}
                darkMode={isDark}
                onToggleInversion={(topic) =>
                  setInvertedSpokes((prev) => ({ ...prev, [topic]: !prev[topic] }))
                }
              />
            </div>
          </div>

          {/* Right: copy + CTA */}
          <div className="flex flex-col justify-center px-8 pb-16 lg:py-24 lg:w-1/2 lg:pr-16 lg:pl-8">

            <p
              className="text-xs font-bold tracking-widest uppercase mb-4"
              style={{ color: t.textAccent }}
            >
              Step 3 — Compare &amp; Discover
            </p>

            <h1
              className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight mb-4"
              style={{ color: t.textHead, letterSpacing: '-0.025em' }}
            >
              Your compass is ready.
            </h1>

            <p
              className="text-base md:text-lg leading-relaxed mb-3 max-w-md"
              style={{ color: t.textBody }}
            >
              Now comes the interesting part — see how your priorities actually compare to the politicians asking for your vote.
            </p>

            <p
              className="text-sm leading-relaxed mb-8 max-w-sm"
              style={{ color: t.textMuted }}
            >
              You can refine any stance from the Library at any time. Your compass is always yours to adjust.
            </p>

            <button
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                onComplete();
              }}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full font-bold text-base transition-all hover:opacity-90 active:scale-95 cursor-pointer shadow-md"
              style={{ background: t.yellow, color: '#1C1C1C' }}
            >
              Compare &amp; Discover →
            </button>
          </div>

        </div>
      </div>
    );
  }

  // Fallback (loading / initializing)
  return (
    <div
      className={`fixed ${overlayTop} left-0 right-0 bottom-0 z-50 flex items-center justify-center`}
      style={{ background: t.bg }}
    >
      <p style={{ color: t.textMuted }}>Loading...</p>
    </div>
  );
}
