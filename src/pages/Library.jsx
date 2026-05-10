import { useState, useEffect, useMemo, useRef } from "react";
import { useCompass } from "../components/CompassContext";
import { useNavigate } from "react-router";
import { apiFetch } from "../lib/auth";
import { useTheme } from "../ThemeProvider";
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
  const { isDark } = useTheme();
  const [selectedLens, setSelectedLens] = useState(null); // null | 'local' | 'judicial' | 'all'
  const [search, setSearch] = useState("");
  const [answeredTopicIDs, setAnsweredTopicIDs] = useState([]);
  const [answeredLoaded, setAnsweredLoaded] = useState(false);
  const [drawerTopic, setDrawerTopic] = useState(null);

  // -------- Library coach mark tour --------
  const [libTourStep, setLibTourStep] = useState(-1);
  const libTourDismissed = useRef(!!localStorage.getItem("onboarding_libraryTour"));
  const firstTileRef = useRef(null);
  const localLensRef = useRef(null);

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
  const hasAnyAnswers =
    Object.keys(answers).length > 0 &&
    Object.values(answers).some((v) => v > 0);
  const hasCompass = selectedTopics.length > 0 && hasAnyAnswers;

  // Always include all selectedTopics so spoke labels appear immediately on tile click
  const chartData = useMemo(() => {
    if (selectedTopics.length === 0) return {};
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
  }, [selectedTopics, topics, answers]);

  // Mark unanswered spokes so RadarChart renders them as dashed grey
  const unansweredSpokesMap = useMemo(() => {
    const map = {};
    for (const id of selectedTopics) {
      const topic = topics.find(t => t.id === id);
      if (!topic) continue;
      const val = answers[topic.short_title];
      if (!(val != null && val > 0)) map[topic.short_title] = true;
    }
    return map;
  }, [selectedTopics, topics, answers]);

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

  // Handle calibrate button → add to compass if needed, then navigate to calibration
  const handleCalibrateClick = (e, topic) => {
    e.stopPropagation();
    if (!selectedTopics.includes(topic.id) && selectedTopics.length < MAX_TOPICS) {
      setSelectedTopics(prev => [...prev, topic.id]);
    }
    sessionStorage.setItem("start_resume_calibration", "1");
    navigate("/results");
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

  // Clicking a lens button shows the inline explainer first
  const handleStartLocalLens = () => setSelectedLens('local');
  const handleStartJudicialLens = () => setSelectedLens('judicial');

  // "Start" buttons inside the explainers do the actual navigation.
  // Clear current topics and any active comparison first — lenses are mutually
  // exclusive; merging would push past 8 topics, and a stale comparison would
  // show replacement spokes from the previous session instead of lens topics.
  const doStartLocalLens = () => {
    setSelectedTopics([]);
    localStorage.removeItem("comparePolitician");
    sessionStorage.setItem("start_local_lens", "1");
    navigate("/results");
  };
  const doStartJudicialLens = () => {
    setSelectedTopics([]);
    localStorage.removeItem("comparePolitician");
    sessionStorage.setItem("start_judicial_lens", "1");
    navigate("/results");
  };
  const doStartAllTopics = () => {
    localStorage.removeItem("comparePolitician");
    sessionStorage.setItem("start_all_topics", "1");
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

  const showCompass = answeredCompassCount >= MIN_TOPICS;

  // Derived lens topic lists for explainer chips
  const localLensTopics = useMemo(
    () => LOCAL_LENS.topicIds.map(id => topics.find(t => t.id === id)).filter(Boolean),
    [topics]
  );
  const judicialLensTopics = useMemo(
    () => JUDICIAL_LENS.topicIds.map(id => topics.find(t => t.id === id)).filter(Boolean),
    [topics]
  );

  return (
    <>
      {/* ── Hero Section: onboarding / lens explainer / compass ── */}
      <div className="border-b border-gray-200 dark:border-zinc-800">

        {selectedLens ? (
          /* ── Lens Explainer ── */
          (() => {
            const isLocal    = selectedLens === 'local';
            const isJudicial = selectedLens === 'judicial';
            const lens       = isLocal ? LOCAL_LENS : isJudicial ? JUDICIAL_LENS : null;
            const lensColor  = lens ? lens.color : '#D4940B';
            const lensTopics = isLocal ? localLensTopics : isJudicial ? judicialLensTopics : [];

            return (
              <div className="px-4 md:px-6 pt-4 pb-6 max-w-5xl mx-auto">
                <button
                  onClick={() => setSelectedLens(null)}
                  className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer mb-5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                  </svg>
                  Back
                </button>

                <div className="flex flex-col md:flex-row gap-8">
                  {/* Left: narrative */}
                  <div className="md:w-1/2">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: lensColor }}>
                        {isJudicial ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                            <path fillRule="evenodd" d="M10 1a.75.75 0 01.75.75v1.5h2.75A2.75 2.75 0 0116.25 6v.75H18a.75.75 0 010 1.5h-1.75v5H18a.75.75 0 010 1.5h-1.75V15a2.75 2.75 0 01-2.75 2.75H6.5A2.75 2.75 0 013.75 15v-.25H2a.75.75 0 010-1.5h1.75v-5H2a.75.75 0 010-1.5h1.75V6A2.75 2.75 0 016.5 3.25h2.75v-1.5A.75.75 0 0110 1zm0 4.25H6.5A1.25 1.25 0 005.25 6.5v7A1.25 1.25 0 006.5 14.75h7A1.25 1.25 0 0014.75 13.5v-7A1.25 1.25 0 0013.5 5.25H10z" clipRule="evenodd" />
                          </svg>
                        ) : selectedLens === 'all' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                            <path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06v-11a.75.75 0 00-.546-.721A9.006 9.006 0 0015 3a8.963 8.963 0 00-4.25 1.065V16.82zM9.25 4.065A8.963 8.963 0 005 3c-.85 0-1.673.118-2.454.339A.75.75 0 002 4.06v11a.75.75 0 00.954.721A7.506 7.506 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.065z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                            <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs font-bold tracking-widest uppercase" style={{ color: lensColor }}>
                        {selectedLens === 'all' ? 'All Topics' : lens.name}
                      </span>
                    </div>

                    {isJudicial ? (
                      <>
                        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
                          Courts. Prosecutors.<br /><span style={{ color: lensColor }}>Your vote decides them.</span>
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                          Judges and district attorneys shape who gets bail, how laws are interpreted, and whether communities get accountability or incarceration. These races rarely get the attention they deserve.
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-500 mb-6">8 questions · for judicial races, DAs, and public defenders</p>
                      </>
                    ) : selectedLens === 'all' ? (
                      <>
                        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
                          Every topic.<br /><span style={{ color: lensColor }}>Your full compass.</span>
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                          We cover {totalTopics} topics across {categories.length} categories. Pick up to 8 for your compass — mix and match based on the elections and issues you care about most.
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-500 mb-6">You choose · any combination of topics from any category</p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
                          Local issues.<br /><span style={{ color: lensColor }}>Your real power.</span>
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                          City councils, mayors, and local officials make the decisions that shape your daily life — housing costs, public safety, schools, and development. Your vote matters most here.
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-500 mb-6">8 questions · most local candidates have already answered these</p>
                      </>
                    )}

                    <button
                      onClick={isLocal ? doStartLocalLens : isJudicial ? doStartJudicialLens : doStartAllTopics}
                      className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm"
                      style={{ background: lensColor }}
                    >
                      {selectedLens === 'all' ? 'Pick my topics' : `Start ${lens.name}`}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Right: topic chips or category chips */}
                  <div className="md:w-1/2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                      {selectedLens === 'all'
                        ? `${categories.length} categories · ${totalTopics} topics`
                        : `${lensTopics.length} topics covered`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedLens === 'all' ? (
                        categories.map((cat, i) => {
                          const cc = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                          return (
                            <span key={cat.id} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${cc.bg} ${cc.text} border ${cc.border}`}>
                              {cat.title} · {(cat.topics || []).length}
                            </span>
                          );
                        })
                      ) : (
                        lensTopics.map(t => (
                          <span
                            key={t.id}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold"
                            style={{ background: lensColor + '18', border: `1px solid ${lensColor}50`, color: lensColor }}
                          >
                            {t.short_title}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()

        ) : showCompass ? (
          /* ── Compass Preview (has 3+ answered topics) ── */
          <div className="px-4 md:px-6 pt-4 pb-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div
                className="w-full max-w-xs cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => navigate('/results', { state: { clearCompare: true } })}
                title="View your compass"
              >
                <RadarChart
                  data={chartData}
                  unansweredSpokes={unansweredSpokesMap}
                  invertedSpokes={invertedSpokes}
                  darkMode={isDark}
                  labelFontSize={14}
                  padding={80}
                  labelOffset={60}
                />
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-gray-800 dark:text-white mb-0.5">Your Compass</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{answeredCompassCount} topic{answeredCompassCount !== 1 ? 's' : ''} calibrated</p>
                <button
                  onClick={() => navigate('/results', { state: { clearCompare: true } })}
                  className="px-4 py-2 text-sm font-semibold bg-[#00657c] text-white rounded-full hover:opacity-90 transition-opacity cursor-pointer mb-5 block"
                >
                  View full compass →
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Explore more topics:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    ref={localLensRef}
                    onClick={() => setSelectedLens('local')}
                    style={{ background: LOCAL_LENS.color }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white hover:opacity-90 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                      <path d="M8.543 2.232a.75.75 0 00-1.085 0l-5.25 5.5A.75.75 0 002.75 9H4v4.75A.25.25 0 004.25 14h2.5a.25.25 0 00.25-.25v-3.5a.25.25 0 01.25-.25h1.5a.25.25 0 01.25.25v3.5c0 .138.112.25.25.25h2.5a.25.25 0 00.25-.25V9h1.25a.75.75 0 00.543-1.268l-5.25-5.5z" />
                    </svg>
                    Local Lens{localLensRemaining > 0 ? ` · ${localLensRemaining} left` : ' · Complete ✓'}
                  </button>
                  <button
                    onClick={() => setSelectedLens('judicial')}
                    style={{ background: JUDICIAL_LENS.color }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white hover:opacity-90 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M8 1.75a.75.75 0 01.692.462l1.41 3.393 3.664.293a.75.75 0 01.428 1.317l-2.791 2.39.853 3.575a.75.75 0 01-1.12.814L8 11.154l-3.136 2.84a.75.75 0 01-1.12-.814l.853-3.576-2.79-2.39a.75.75 0 01.427-1.316l3.663-.294 1.41-3.393A.75.75 0 018 1.75z" clipRule="evenodd" />
                    </svg>
                    Judicial Lens{judicialLensRemaining > 0 ? ` · ${judicialLensRemaining} left` : ' · Complete ✓'}
                  </button>
                  <button
                    onClick={() => setSelectedLens('all')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#D4940B] text-white hover:opacity-90 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                      <path d="M7.25 3.688L6.5 2H2.75A1.75 1.75 0 001 3.75v.513c.041-.013.084-.013.125 0a2.25 2.25 0 012.25 2.25V9.25a2.25 2.25 0 11-4.5 0V3.75A3.25 3.25 0 012.75.5h4.5a.75.75 0 01.694.464l.5 1.188a.75.75 0 01-.194.536z" />
                    </svg>
                    All Topics
                  </button>
                </div>
              </div>
            </div>
          </div>

        ) : (
          /* ── Full-page Onboarding (no compass yet) ── */
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4 md:px-6 py-12">
            <div className="w-full max-w-2xl text-center">
              {/* Eyebrow */}
              <p className="text-xs font-bold tracking-widest uppercase text-[#00657c] dark:text-[#59b0c4] mb-4">
                EV Compass
              </p>

              {/* Headline */}
              <h1
                className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 leading-tight"
                style={{ letterSpacing: '-0.03em' }}
              >
                Know exactly who<br />shares your values.
              </h1>

              {/* Sub-headline */}
              <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mb-10 max-w-lg mx-auto leading-relaxed">
                Build a political compass in 6 minutes. Compare any candidate to your stances on the issues that matter to you.
              </p>

              {/* 3-step cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10 text-left">
                {[
                  { num: '01', title: 'Choose your topics', desc: 'Pick the issues that shape how you vote — start with a lens or build your own.', color: LOCAL_LENS.color },
                  { num: '02', title: 'Set your stances', desc: 'Tell us where you stand on each topic. No right answers — only yours.', color: '#FED12E' },
                  { num: '03', title: 'Compare candidates', desc: 'See which leaders match your political compass and priorities.', color: '#00657C' },
                ].map(s => (
                  <div
                    key={s.num}
                    className="flex gap-3 p-4 rounded-2xl border"
                    style={{ borderColor: s.color + '50', background: s.color + (isDark ? '14' : '0D') }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                      style={{ background: s.color, color: s.num === '02' ? '#1C1C1C' : '#fff' }}
                    >
                      {s.num}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 dark:text-white">{s.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  ref={localLensRef}
                  onClick={() => setSelectedLens('local')}
                  style={{ background: LOCAL_LENS.color }}
                  className="flex items-center gap-2 px-7 py-3 rounded-full text-base font-bold text-white hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
                  </svg>
                  Local Lens
                </button>
                <button
                  onClick={() => setSelectedLens('judicial')}
                  style={{ background: JUDICIAL_LENS.color }}
                  className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Judicial Lens
                </button>
                <button
                  onClick={() => setSelectedLens('all')}
                  className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-[#D4940B] text-white hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  All Topics
                </button>
              </div>

              {/* Soft hint */}
              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-6">
                Or scroll down to browse all topics and add them individually
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── DELETED old section below — replaced by hero above ──
          (old CTA buttons were here, now removed)
      ── */}

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
                  sessionStorage.setItem("start_resume_calibration", "1");
                  navigate("/results");
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
          targetRef={libTourStep === 0 ? firstTileRef : localLensRef}
          message={libTourStep === 0
            ? "Click any topic to add it to your compass — up to 8. Drag the pills above to reorder your spokes."
            : "Start here — the Local Lens picks the 8 topics most local candidates have already answered, so you can compare right away."}
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
