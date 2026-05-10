import { useState, useEffect, useMemo, useRef } from "react";
import { useCompass } from "../components/CompassContext";
import { useNavigate } from "react-router";
import { apiFetch } from "../lib/auth";
import RadarChart from "../components/RadarChart";
import LibraryDrawer from "../components/LibraryDrawer";
import CoachMark from "../components/CoachMark";
import { getQuestionText, parseTensionTitle } from "../util/topic";
import { TopicTierBadge } from "@empoweredvote/ev-ui";
import { LOCAL_LENS, JUDICIAL_LENS } from "../lib/lenses";
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
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";

const CATEGORY_COLORS = [
  { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-700", accent: "bg-blue-400" },
  { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-700", accent: "bg-emerald-400" },
  { bg: "bg-purple-50", border: "border-purple-400", text: "text-purple-700", accent: "bg-purple-400" },
  { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-700", accent: "bg-amber-400" },
  { bg: "bg-rose-50", border: "border-rose-400", text: "text-rose-700", accent: "bg-rose-400" },
  { bg: "bg-cyan-50", border: "border-cyan-400", text: "text-cyan-700", accent: "bg-cyan-400" },
];

const UNCALIBRATED_PURPLE = "#7C3AED";
const CALIBRATED_TEAL = "#00657C";

function SortableTopicPill({ id, label, isCalibrated, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: { duration: 200, easing: "ease" },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.5 : 1,
        background: isCalibrated ? CALIBRATED_TEAL : UNCALIBRATED_PURPLE,
        touchAction: "none",
      }}
      className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-white cursor-grab active:cursor-grabbing select-none"
    >
      {label}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="ml-0.5 text-white/60 hover:text-white transition-colors leading-none text-sm"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </div>
  );
}

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
    invertedSpokes,
    isLoggedIn,
  } = useCompass();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [answeredTopicIDs, setAnsweredTopicIDs] = useState([]);
  const [answeredLoaded, setAnsweredLoaded] = useState(false);
  const [drawerTopic, setDrawerTopic] = useState(null);

  // -------- Library coach mark tour --------
  const [libTourStep, setLibTourStep] = useState(-1);
  const libTourDismissed = useRef(!!localStorage.getItem("onboarding_libraryTour"));
  const firstTileRef = useRef(null);
  const fullCalRef = useRef(null);

  // -------- DnD sensors for pill strip --------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // Fetch answered topic IDs
  useEffect(() => {
    if (!isLoggedIn) {
      const cur = answersRef.current;
      const localAnswerIds = topics
        .filter(t => cur[t.short_title] != null && cur[t.short_title] > 0)
        .map(t => t.id);
      setAnsweredTopicIDs(localAnswerIds);
      setAnsweredLoaded(true);
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

        const answerEntries = data
          .map((a) => {
            const topic = topicsRef.current.find((t) => t.id === a.topic_id);
            if (!topic) return null;
            return [topic.short_title, a.value];
          })
          .filter(Boolean);
        if (answerEntries.length) {
          setAnswers((prev) => ({ ...prev, ...Object.fromEntries(answerEntries) }));
        }

        const writeInEntries = data
          .map((a) => {
            const topic = topicsRef.current.find((t) => t.id === a.topic_id);
            if (!topic || !a.write_in_text) return null;
            return [topic.short_title, a.write_in_text];
          })
          .filter(Boolean);
        if (writeInEntries.length) {
          setWriteIns((prev) => ({ ...prev, ...Object.fromEntries(writeInEntries) }));
        }

        setAnsweredLoaded(true);
      })
      .catch(() => {
        const cur = answersRef.current;
        const localAnswerIds = topics
          .filter(t => cur[t.short_title] != null && cur[t.short_title] > 0)
          .map(t => t.id);
        setAnsweredTopicIDs(localAnswerIds);
        setAnsweredLoaded(true);
      });
  }, [isLoggedIn, topics]);

  const topicsRef = useRef(topics);
  topicsRef.current = topics;
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Library tour trigger
  useEffect(() => {
    if (!answeredLoaded || libTourDismissed.current) return;
    const timer = setTimeout(() => {
      if (firstTileRef.current) setLibTourStep(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [answeredLoaded]);

  const advanceLibTour = () => {
    if (libTourStep < 1) {
      setLibTourStep(libTourStep + 1);
    } else {
      localStorage.setItem("onboarding_libraryTour", "1");
      setLibTourStep(-1);
    }
  };

  const skipLibTour = () => {
    localStorage.setItem("onboarding_libraryTour", "1");
    setLibTourStep(-1);
  };

  // Fetch answers for selected topics (powers compass preview)
  useEffect(() => {
    if (!selectedTopics.length || !topicsRef.current.length) return;
    if (!isLoggedIn) return;

    apiFetch('/compass/answers/batch', {
      method: "POST",
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
        setAnswers(prev => {
          const next = { ...prev };
          for (const [key, val] of mapped) {
            if (next[key] == null) next[key] = val;
          }
          return next;
        });

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
  }, [selectedTopics, isLoggedIn]);

  // -------- Derived state --------
  const hasCompass =
    selectedTopics.length > 0 &&
    Object.keys(answers).length > 0 &&
    Object.values(answers).some((v) => v > 0);

  const chartData = useMemo(() => {
    if (!hasCompass) return {};
    return Object.fromEntries(
      selectedTopics.slice(0, 8)
        .map((id) => {
          const topic = topics.find((t) => t.id === id);
          if (!topic) return null;
          const value = answers[topic.short_title] ?? 0;
          return [topic.short_title, value];
        })
        .filter(Boolean)
    );
  }, [hasCompass, selectedTopics, topics, answers]);

  const getCategoryColor = (index) => CATEGORY_COLORS[index % CATEGORY_COLORS.length];

  const getVisibleTopics = (category) => {
    return (category.topics || [])
      .filter((t) =>
        (t.short_title || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.question_text && t.question_text.toLowerCase().includes(search.toLowerCase())) ||
        (t.title && t.title.toLowerCase().includes(search.toLowerCase()))
      );
  };

  const MAX_TOPICS = 8;

  const getAnswer = (topic) => {
    if (!topic) return undefined;
    const answerValue = answers[topic.short_title];
    return typeof answerValue === "number" ? answerValue : undefined;
  };

  const isTopicCalibrated = (topicId) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return false;
    const val = answers[topic.short_title];
    return val != null && val > 0;
  };

  // Handle tile click → toggle topic on/off compass
  const handleTileClick = (topicId) => {
    if (selectedTopics.includes(topicId)) {
      setSelectedTopics(prev => prev.filter(id => id !== topicId));
    } else if (selectedTopics.length < MAX_TOPICS) {
      setSelectedTopics(prev => [...prev, topicId]);
    }
  };

  // Handle calibrate button → add to compass if needed, then open drawer
  const handleCalibrateClick = (e, topic) => {
    e.stopPropagation();
    if (!selectedTopics.includes(topic.id) && selectedTopics.length < MAX_TOPICS) {
      setSelectedTopics(prev => [...prev, topic.id]);
    }
    setDrawerTopic(topic);
  };

  // Pill drag end → reorder selectedTopics
  const handlePillDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSelectedTopics(prev => {
      const oldIdx = prev.indexOf(active.id);
      const newIdx = prev.indexOf(over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const handleDrawerSelect = async (topic, stanceValue) => {
    setAnswers((prev) => ({ ...prev, [topic.short_title]: stanceValue }));
    setWriteIns((prev) => {
      const updated = { ...prev };
      delete updated[topic.short_title];
      return updated;
    });
    if (!answeredTopicIDs.includes(topic.id)) {
      setAnsweredTopicIDs((prev) => [...prev, topic.id]);
    }
    if (isLoggedIn) {
      try {
        await apiFetch('/compass/answers', {
          method: "POST",
          body: JSON.stringify({ topic_id: topic.id, value: stanceValue }),
        });
      } catch {}
    }
  };

  const handleDrawerWriteIn = async (topic, writeInValue, writeInText) => {
    setAnswers((prev) => ({ ...prev, [topic.short_title]: writeInValue }));
    setWriteIns((prev) => ({ ...prev, [topic.short_title]: writeInText }));
    if (!answeredTopicIDs.includes(topic.id)) {
      setAnsweredTopicIDs((prev) => [...prev, topic.id]);
    }
    if (isLoggedIn) {
      try {
        await apiFetch('/compass/answers', {
          method: "POST",
          body: JSON.stringify({ topic_id: topic.id, value: writeInValue, write_in_text: writeInText }),
        });
      } catch {}
    }
  };

  const handleDrawerCancelWriteIn = (topic) => {
    setAnswers((prev) => { const u = { ...prev }; delete u[topic.short_title]; return u; });
    setWriteIns((prev) => { const u = { ...prev }; delete u[topic.short_title]; return u; });
  };

  const activeTopicIDs = useMemo(() => new Set(topics.map((t) => t.id)), [topics]);
  const totalTopics = topics.length;
  const answeredCount = answeredTopicIDs.filter((id) => activeTopicIDs.has(id)).length;
  const unansweredCount = totalTopics - answeredCount;

  const answeredSet = useMemo(() => new Set(answeredTopicIDs), [answeredTopicIDs]);

  const localLensTopicIds = useMemo(
    () => LOCAL_LENS.topicIds.filter(id => topics.some(t => t.id === id)),
    [topics]
  );
  const localLensRemaining = useMemo(
    () => localLensTopicIds.filter(id => !answeredSet.has(id)).length,
    [localLensTopicIds, answeredSet]
  );
  const localLensNotStarted = localLensRemaining === localLensTopicIds.length && localLensTopicIds.length > 0;

  const judicialLensTopicIds = useMemo(
    () => JUDICIAL_LENS.topicIds.filter(id => topics.some(t => t.id === id)),
    [topics]
  );
  const judicialLensRemaining = useMemo(
    () => judicialLensTopicIds.filter(id => !answeredSet.has(id)).length,
    [judicialLensTopicIds, answeredSet]
  );

  const handleStartLocalLens = () => {
    sessionStorage.setItem("start_local_lens", "1");
    navigate("/results");
  };

  const handleStartJudicialLens = () => {
    sessionStorage.setItem("start_judicial_lens", "1");
    navigate("/results");
  };

  const MIN_TOPICS = 3;
  const answeredCompassCount = selectedTopics.filter((id) => {
    const topic = topics.find((t) => t.id === id);
    if (!topic) return false;
    const val = answers[topic.short_title];
    return val != null && val > 0;
  }).length;
  const belowThreshold = hasCompass && answeredCompassCount < MIN_TOPICS;
  const needsMore = MIN_TOPICS - answeredCompassCount;

  const uncalibratedCount = selectedTopics.filter(id => !isTopicCalibrated(id)).length;

  return (
    <>
      {/* ── Compass Preview ── */}
      <div className="mt-4 px-4 md:px-6 max-w-5xl mx-auto">
        {hasCompass ? (
          <div className="flex flex-col items-center">
            <div
              onClick={() => navigate("/results", { state: { clearCompare: true } })}
              className={`w-full max-w-2xl md:max-w-3xl cursor-pointer transition-opacity relative ${belowThreshold ? "" : "hover:opacity-80"}`}
              title={belowThreshold ? "Add more topics to see your compass" : "View your compass"}
            >
              <div className={belowThreshold ? "opacity-25 pointer-events-none select-none" : ""}>
                <RadarChart data={chartData} invertedSpokes={invertedSpokes} labelFontSize={18} padding={100} labelOffset={70} />
              </div>
              {belowThreshold && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 text-center px-4">
                    Add {needsMore} more topic{needsMore !== 1 ? "s" : ""} to see your compass
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-xl md:text-2xl font-semibold dark:text-white">Your Compass</h1>
              <button
                onClick={() => navigate("/help")}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                title="How it works"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-56 md:w-80">
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
            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-xl md:text-2xl font-semibold dark:text-white">Calibrate Your Compass</h1>
              <button
                onClick={() => navigate("/help")}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                title="How it works"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
              </button>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Answer questions on the topics that matter to you and see where you stand
            </p>
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-gray-200 dark:border-zinc-700 mx-6 my-4" />

      {/* ── Calibration CTAs — 3 equal buttons ── */}
      <div className="mx-4 md:mx-auto max-w-3xl mb-6 flex flex-col sm:flex-row gap-2">

        {/* Local Lens */}
        <div className="group relative flex-1">
          <button
            onClick={handleStartLocalLens}
            style={{ background: LOCAL_LENS.color, color: "#ffffff" }}
            className="w-full h-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl cursor-pointer hover:opacity-90 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0 opacity-90">
                <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
                <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
              </svg>
              <div className="text-left">
                <p className="font-semibold text-sm leading-tight">Local Lens</p>
                {localLensRemaining > 0 ? (
                  <p className="text-xs opacity-80">{localLensRemaining} left</p>
                ) : (
                  <p className="text-xs opacity-80">Complete</p>
                )}
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 opacity-70">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 dark:bg-zinc-700 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 text-center">
            The most commonly answered local election topics — compare with your city and county leaders
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-zinc-700" />
          </div>
        </div>

        {/* Judicial Lens */}
        <div className="group relative flex-1">
          <button
            onClick={handleStartJudicialLens}
            style={{ background: JUDICIAL_LENS.color, color: "#ffffff" }}
            className="w-full h-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl cursor-pointer hover:opacity-90 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0 opacity-90">
                <path fillRule="evenodd" d="M10.5 3.75a6 6 0 0 0-5.98 6.496A5.25 5.25 0 0 0 6.75 20.25H18a4.5 4.5 0 0 0 .964-8.912 6 6 0 0 0-8.464-7.588ZM12 7.5a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0v-1.5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5A.75.75 0 0 1 12 7.5Z" clipRule="evenodd" />
              </svg>
              <div className="text-left">
                <p className="font-semibold text-sm leading-tight">Judicial Lens</p>
                {judicialLensRemaining > 0 ? (
                  <p className="text-xs opacity-80">{judicialLensRemaining} left</p>
                ) : (
                  <p className="text-xs opacity-80">Complete</p>
                )}
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 opacity-70">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 dark:bg-zinc-700 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 text-center">
            Questions for judicial races, DAs, and public defenders — courts, bail, and criminal justice
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-zinc-700" />
          </div>
        </div>

        {/* Full Calibration */}
        <button
          ref={fullCalRef}
          onClick={() => navigate("/quiz?mode=full")}
          className="flex-1 flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl bg-ev-yellow hover:bg-ev-yellow-dark transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0 opacity-80 text-black">
              <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
            </svg>
            <div className="text-left">
              <p className="font-semibold text-sm text-black leading-tight">Full Calibration</p>
              {unansweredCount > 0 ? (
                <p className="text-xs text-black/60">{unansweredCount} left</p>
              ) : (
                <p className="text-xs text-black/60">All answered</p>
              )}
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-black/40 group-hover:text-black transition-colors">
            <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* ── Topic Selection Section ── */}
      <div className="px-4 md:px-6 max-w-5xl mx-auto">

        {/* ── Compass spoke pill strip ── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold dark:text-white">
              Your Compass Topics
              <span className="ml-2 text-sm font-normal text-gray-400 dark:text-zinc-500">{selectedTopics.length}/8</span>
            </h2>
            {uncalibratedCount > 0 && (
              <button
                onClick={() => {
                  const firstUncal = selectedTopics.find(id => !isTopicCalibrated(id));
                  if (firstUncal) {
                    const t = topics.find(t => t.id === firstUncal);
                    if (t) setDrawerTopic(t);
                  }
                }}
                style={{ background: UNCALIBRATED_PURPLE }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0016.75 8h-6.572l1.305-6.093z" clipRule="evenodd" />
                </svg>
                Calibrate ({uncalibratedCount})
              </button>
            )}
          </div>

          {selectedTopics.length === 0 ? (
            /* Empty state — nudge toward Local Lens if not started */
            <div className={`rounded-xl border-2 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 ${
              localLensNotStarted
                ? "border-[#5A9A6E] bg-[#5A9A6E]/5 dark:bg-[#5A9A6E]/10"
                : "border-dashed border-gray-300 dark:border-zinc-600"
            }`}>
              {localLensNotStarted ? (
                <>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#3d7a53] dark:text-[#7dbf94]">Start with the Local Lens</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">8 questions covering the most-answered local election topics — the fastest way to build your compass</p>
                  </div>
                  <button
                    onClick={handleStartLocalLens}
                    style={{ background: LOCAL_LENS.color }}
                    className="shrink-0 px-4 py-2 rounded-full text-xs font-bold text-white hover:opacity-90 cursor-pointer"
                  >
                    Start Local Lens →
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-400 dark:text-zinc-500">
                  Click any topic below to add it to your compass
                </p>
              )}
            </div>
          ) : (
            /* Draggable pill strip */
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handlePillDragEnd}
              modifiers={[restrictToHorizontalAxis]}
            >
              <SortableContext items={selectedTopics} strategy={horizontalListSortingStrategy}>
                <div className="flex flex-wrap gap-2">
                  {selectedTopics.map((id) => {
                    const topic = topics.find(t => t.id === id);
                    if (!topic) return null;
                    return (
                      <SortableTopicPill
                        key={id}
                        id={id}
                        label={topic.short_title}
                        isCalibrated={isTopicCalibrated(id)}
                        onRemove={() => setSelectedTopics(prev => prev.filter(tid => tid !== id))}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Search row */}
        <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-xl px-4 py-2 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-gray-400 mr-2 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            onChange={(e) => setSearch(e.target.value)}
            value={search}
            placeholder="Search topics..."
            className="w-full bg-transparent outline-none text-sm dark:text-white dark:placeholder-gray-500"
          />
        </div>

        {/* Topic Cards by Category */}
        {answeredLoaded &&
          (() => {
            let firstTileFound = false;
            const seenTopicIds = new Set();
            return categories.map((category, catIdx) => {
              const visible = getVisibleTopics(category).filter(t => {
                if (seenTopicIds.has(t.id)) return false;
                seenTopicIds.add(t.id);
                return true;
              });
              if (visible.length === 0) return null;

              const color = getCategoryColor(catIdx);

              return (
                <div key={category.id} className="mb-8">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className={`inline-block w-3 h-3 rounded-full ${color.accent}`} />
                    {category.title}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {visible.map((topic) => {
                      const isOnCompass = selectedTopics.includes(topic.id);
                      const isAnswered = answeredTopicIDs.includes(topic.id);
                      const isCalibrated = isTopicCalibrated(topic.id);
                      const atCap = selectedTopics.length >= MAX_TOPICS && !isOnCompass;
                      const isFirstTile = !firstTileFound;
                      if (isFirstTile) firstTileFound = true;

                      return (
                        <div key={topic.id} className="relative" ref={isFirstTile ? firstTileRef : undefined}>
                          {/* Main tile — click to toggle on/off compass */}
                          <button
                            onClick={() => {
                              if (!atCap) handleTileClick(topic.id);
                            }}
                            disabled={atCap}
                            className={`w-full relative text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                              atCap
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer"
                            } ${
                              isOnCompass
                                ? "bg-sky-50/50 dark:bg-[#0e2b36] border-[#59b0c4] shadow-sm"
                                : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-500 hover:shadow-sm"
                            }`}
                            title={atCap ? "Compass is full (max 8 topics)" : isOnCompass ? "Click to remove from compass" : "Click to add to compass"}
                          >
                            <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${color.accent}`} />
                            <div className="flex items-start justify-between gap-1">
                              <div className="text-left pr-6">
                                <p className="text-sm md:text-base font-medium leading-snug dark:text-white">{getQuestionText(topic) || parseTensionTitle(topic).name}</p>
                                {getQuestionText(topic) && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5">{parseTensionTitle(topic).name}</p>
                                )}
                              </div>
                              {isAnswered && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5 text-green-500">
                                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div className="mt-2">
                              <TopicTierBadge topic={topic} size="xs" variant="muted" />
                            </div>
                          </button>

                          {/* Calibrate button — always purple/teal, opens drawer */}
                          <button
                            onClick={(e) => handleCalibrateClick(e, topics.find(t => t.id === topic.id) ?? topic)}
                            style={{
                              background: isCalibrated ? '#59b0c4' : UNCALIBRATED_PURPLE,
                            }}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white transition-colors cursor-pointer hover:opacity-80"
                            title={isCalibrated ? "Edit your stance" : "Answer this question"}
                            aria-label={isCalibrated ? "Edit stance" : "Calibrate"}
                          >
                            {isCalibrated ? (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path fillRule="evenodd" d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0016.75 8h-6.572l1.305-6.093z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
      </div>

      <LibraryDrawer
        topic={drawerTopic}
        currentAnswer={getAnswer(drawerTopic)}
        onSelectStance={handleDrawerSelect}
        onClose={() => setDrawerTopic(null)}
        invertedSpokes={invertedSpokes}
        writeIns={writeIns}
        onSelectWriteIn={handleDrawerWriteIn}
        onCancelWriteIn={handleDrawerCancelWriteIn}
        isOnCompass={drawerTopic ? selectedTopics.includes(drawerTopic.id) : false}
        onRemoveFromCompass={(topic) => {
          setSelectedTopics((prev) => prev.filter((id) => id !== topic.id));
        }}
        compassTopicCount={selectedTopics.length}
      />

      {/* Library coach mark tour */}
      {libTourStep >= 0 && (
        <CoachMark
          targetRef={libTourStep === 0 ? firstTileRef : fullCalRef}
          message={libTourStep === 0
            ? "Click any topic to add it to your compass — up to 8. Drag the pills above to reorder your spokes."
            : "Or use a lens to answer the most relevant questions for a specific type of election"}
          stepLabel={`${libTourStep + 1} of 2`}
          onNext={advanceLibTour}
          onSkipAll={skipLibTour}
          onDismiss={advanceLibTour}
          show={true}
        />
      )}
    </>
  );
}

export default Library;
