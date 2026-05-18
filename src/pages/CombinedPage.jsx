// CombinedPage.jsx — merges Compass.jsx and Library.jsx into a single unified page.
// Renders the radar chart with compare panel at top and the full topic library below.
import { useCompass } from "../components/CompassContext";
import { apiFetch, API_BASE } from "../lib/auth";
import { useEvContextPromotion } from "@empoweredvote/ev-ui";
import RadarChart from "../components/RadarChart";
import CalibrationOverlay from "../components/CalibrationOverlay";
import LibraryDrawer from "../components/LibraryDrawer";
import ComparePanel from "../components/ComparePanel";
import SavePromptModal from "../components/SavePromptModal";
import CoachMark from "../components/CoachMark";
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import { useTheme } from "../ThemeProvider";
import { LOCAL_LENS, JUDICIAL_LENS } from "../lib/lenses";
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
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToHorizontalAxis, restrictToVerticalAxis } from "@dnd-kit/modifiers";

// -------- Constants --------
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

// -------- Helper Components (outside CombinedPage) --------

// 260426-mw6 — Inline banner shown to authed users who calibrated as a guest
// (compass answers exist in ev-context but the API has none for this account).
function CompassPromotionBanner({ payload, onSave, onDismiss, status, error }) {
  const ans = (payload && (payload.answers || payload.a)) || {};
  const count = Object.keys(ans).length;
  if (count === 0) return null;
  const saving = status === 'saving';
  return (
    <div
      role="status"
      className="w-full mb-4 flex items-center gap-3 px-4 py-3 rounded-lg border border-[#59b0c4] bg-[#E4F3F6] dark:bg-[#1a3038]"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div className="flex-1 min-w-0 text-sm text-[#003E4D] dark:text-[#59B0C4]">
        You answered <strong>{count}</strong> question{count === 1 ? '' : 's'} before signing up — save them to your account?
        {status === 'error' && error && (
          <div className="text-[#e64a34] text-xs mt-1">Couldn't save: {error.message}. Try again?</div>
        )}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="px-4 py-1.5 rounded-full text-sm font-semibold text-white bg-[#00657c] hover:bg-[#005566] disabled:opacity-60 transition-colors"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        disabled={saving}
        aria-label="Dismiss"
        className="px-2 py-1 text-gray-500 hover:text-gray-800 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

function BuildCompassPrompt({ answeredCompassCount, needsMore, onStartCalibration }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="flex items-center justify-center gap-3 mb-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-colors duration-300 ${
              i < answeredCompassCount ? "bg-[#59b0c4]" : "bg-gray-300 dark:bg-zinc-600"
            }`}
          />
        ))}
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
        {answeredCompassCount === 0
          ? "Build your compass"
          : `Answer ${needsMore} more topic${needsMore !== 1 ? "s" : ""} to see your compass`}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 max-w-xs">
        Your compass takes shape after you answer at least 3 topics
      </p>
      <button
        onClick={onStartCalibration}
        className="px-6 py-2.5 bg-[#00657c] text-white rounded-full text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
      >
        {answeredCompassCount === 0 ? "Start building" : "Continue building"}
      </button>
    </div>
  );
}

function SortableTopicPill({ id, label, isCalibrated, onRemove, onMouseEnter, onMouseLeave, pillBg }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: { duration: 200, easing: "ease" },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.5 : 1,
        background: pillBg ?? (isCalibrated ? CALIBRATED_TEAL : UNCALIBRATED_PURPLE),
        touchAction: "none",
        outline: !isCalibrated ? `2px solid ${UNCALIBRATED_PURPLE}` : undefined,
        outlineOffset: !isCalibrated ? '1px' : undefined,
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

function SortableVerticalPill({ id, topic, isCalibrated, onRemove, onOpen, pillBg }) {
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
        opacity: isDragging ? 0.4 : 1,
        touchAction: "none",
        background: pillBg,
        outline: !isCalibrated ? `2px solid ${UNCALIBRATED_PURPLE}` : undefined,
        outlineOffset: !isCalibrated ? '1px' : undefined,
      }}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-white text-xs font-medium group select-none cursor-grab active:cursor-grabbing"
    >
      {/* Drag grip (visual only) */}
      <span className="shrink-0 text-white/30">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
          <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
          <path d="M5 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM5 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM6.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
        </svg>
      </span>
      {/* Topic name — click to open stance modal */}
      <button
        onClick={onOpen}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-1 text-left min-w-0 flex items-center gap-1 cursor-pointer"
      >
        {!isCalibrated && (
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: UNCALIBRATED_PURPLE }} />
        )}
        <span className="truncate">{topic.short_title}</span>
      </button>
      {/* Remove */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="shrink-0 opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/20 text-white/60 hover:text-white transition-all cursor-pointer"
        aria-label={`Remove ${topic.short_title}`}
      >×</button>
    </div>
  );
}

// -------- Main Component --------
function CombinedPage() {
  function TabBar() {
    const icons = [
      /* 0 – Compare (chain-link icon) */
      <svg
        width="18"
        height="22"
        viewBox="0 0 20 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={selectedTab != 0 ? "stroke-slate-500" : "stroke-black"}
      >
        <g clipPath="url(#clip0_71_343)">
          <path
            d="M7.91675 11.2622C8.25673 11.7167 8.69049 12.0928 9.1886 12.3649C9.68671 12.6371 10.2375 12.7989 10.8037 12.8394C11.3698 12.88 11.9381 12.7983 12.4699 12.5999C13.0017 12.4015 13.4846 12.0911 13.8859 11.6897L16.2609 9.31468C16.982 8.56813 17.3809 7.56825 17.3719 6.53038C17.3629 5.49252 16.9466 4.49972 16.2127 3.76581C15.4788 3.03191 14.486 2.61561 13.4481 2.60659C12.4103 2.59758 11.4104 2.99655 10.6638 3.7176L9.30216 5.07135"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M11.0834 9.67917C10.7434 9.22466 10.3096 8.84857 9.81152 8.57643C9.31341 8.30429 8.76259 8.14246 8.19644 8.10191C7.63028 8.06136 7.06203 8.14305 6.53022 8.34143C5.99841 8.53981 5.51549 8.85024 5.1142 9.25167L2.7392 11.6267C2.01816 12.3732 1.61918 13.3731 1.6282 14.411C1.63722 15.4488 2.05351 16.4416 2.78742 17.1755C3.52133 17.9094 4.51413 18.3257 5.55199 18.3348C6.58985 18.3438 7.58974 17.9448 8.33629 17.2238L9.69004 15.87"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <defs>
          <clipPath id="clip0_71_343">
            <rect
              width="19"
              height="19"
              fill="white"
              transform="translate(0 0.970703)"
            />
          </clipPath>
        </defs>
      </svg>,
      /* 1 – Graph  */
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={selectedTab != 1 ? "stroke-slate-500" : "stroke-black"}
      >
        <path
          d="M12 20.5V10.5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 20.5V4.5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 20.5V16.5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>,
    ];

    return (
      <div className="relative flex justify-around w-full bg-gray-300/50 dark:bg-zinc-700/50 rounded-lg p-1 mx-2 mb-4 lg:hidden border-l-4 border-ev-yellow">
        {/* moving highlight */}
        <div
          className="absolute top-1 h-[calc(100%-0.5rem)] bg-white dark:bg-zinc-600 rounded-lg transition-all"
          style={{
            left: bgStyle.left,
            width: bgStyle.width,
            pointerEvents: "none",
          }}
        />
        {["Compare", "Graph"].map((label, idx) => (
          <button
            key={label}
            ref={tabRefs[idx]}
            onClick={() => setSelectedTab(idx)}
            className="relative z-10 flex items-center gap-1 px-2 py-2"
          >
            {icons[idx]}
            <span
              className={`${
                selectedTab === idx ? "text-black dark:text-white" : "text-slate-500 dark:text-gray-400"
              } text-base font-medium`}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  function Legend() {
    if (!comparePol) return null;
    const name =
      comparePol.full_name ||
      [comparePol.first_name, comparePol.last_name].filter(Boolean).join(" ");
    return (
      <div className="flex gap-4 items-center">
        <span className="inline-block w-4 h-4 bg-[rgba(124,107,158,0.4)] border border-[#7C6B9E] rounded-sm" />
        You
        <span
          className={`inline-block w-4 h-4 rounded-sm cursor-pointer ${isDark ? "bg-[rgba(110,210,140,0.55)] border border-[#6DD28C]" : "bg-[rgba(90,154,110,0.45)] border border-[#5A9A6E]"}`}
          onClick={handleClearComparison}
          title="Clear comparison"
        />
        {name || "Selected Politician"}
      </div>
    );
  }

  function ActionButtons() {
    return (
      <div className="flex gap-4 mt-1">
        {showChart && (
          <button
            ref={(el) => {
              // Only assign if this button is visible (has layout dimensions)
              if (el && el.offsetWidth > 0) compareRef.current = el;
            }}
            onClick={() => setCompareMode(true)}
            className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-black text-white rounded-full hover:bg-ev-yellow-dark hover:text-black transition-colors cursor-pointer"
          >
            Compare
          </button>
        )}
      </div>
    );
  }

  const { isDark } = useTheme();

  // -------- Compass Context --------
  const {
    topics,
    selectedTopics,
    setSelectedTopics,
    categories,
    answers,
    setAnswers,
    writeIns,
    setWriteIns,
    compareAnswers,
    setCompareAnswers,
    invertedSpokes,
    setInvertedSpokes,
    isLoggedIn,
    userId,
    topicsLoaded,
    topicsError,
    retryLoadTopics,
  } = useCompass();

  // 260426-mw6 — promotion banner for users who calibrated as a guest before
  // signing up. Fires only when API has zero answers AND ev-context has a
  // populated guest compass slice. Posts each guest answer to /compass/answers
  // (no batch endpoint exists). After save, refreshes local state from the API.
  const compassPromoteWriter = async (compassPayload) => {
    const ans = (compassPayload && (compassPayload.answers || compassPayload.a)) || {};
    const inv = (compassPayload && (compassPayload.invertedSpokes || compassPayload.i)) || {};
    const writeIns = (compassPayload && (compassPayload.writeIns || compassPayload.w)) || {};
    // Map short_title back to topic_id for the API.
    const titleToId = new Map(topics.map((t) => [t.short_title, t.id]));
    for (const [shortTitle, value] of Object.entries(ans)) {
      const topic_id = titleToId.get(shortTitle);
      if (!topic_id) continue;
      const numeric = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) continue;
      const body = {
        topic_id,
        value: numeric,
        inverted: !!inv[shortTitle],
      };
      if (typeof writeIns[shortTitle] === 'string' && writeIns[shortTitle].length > 0) {
        body.write_in_text = writeIns[shortTitle];
      }
      const res = await apiFetch('/compass/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res || !res.ok) {
        throw new Error(`Failed to save answer for ${shortTitle} (${res?.status ?? 'no response'})`);
      }
    }
    // Mirror into local context so the chart/library reflect the new answers
    // without a reload. This is layered on top of the hook's authed-slice
    // mirror — both are idempotent.
    setAnswers((prev) => ({ ...prev, ...ans }));
    if (Object.keys(inv).length > 0) {
      setInvertedSpokes((prev) => ({ ...prev, ...inv }));
    }
    if (Object.keys(writeIns).length > 0) {
      setWriteIns((prev) => ({ ...prev, ...writeIns }));
    }
  };
  const {
    shouldPrompt: promoteCompassShouldPrompt,
    payload: promoteCompassPayload,
    promote: promoteCompass,
    dismiss: dismissCompassPromotion,
    status: promoteCompassStatus,
    error: promoteCompassError,
  } = useEvContextPromotion({
    domain: 'compass',
    isLoggedIn,
    userId,
    apiData: answers, // CompassContext's answers map; isApiEmpty(compass) treats {} as empty
    apiWriter: compassPromoteWriter,
  });

  // -------- Minimum topic gate --------
  const answeredCompassTopics = selectedTopics.filter((id) => {
    const topic = topics.find((t) => t.id === id);
    if (!topic) return false;
    const val = answers[topic.short_title];
    return val != null && val > 0;
  });
  const answeredCompassCount = answeredCompassTopics.length;
  const MIN_TOPICS = 3;
  const needsMore = MIN_TOPICS - answeredCompassCount;
  const showChart = answeredCompassCount >= MIN_TOPICS;

  // Unanswered selected topics (selected but no valid answer yet)
  const unansweredCompassTopics = selectedTopics.filter((id) => {
    const topic = topics.find((t) => t.id === id);
    if (!topic) return false;
    const val = answers[topic.short_title];
    return !(val != null && val > 0);
  });

  // -------- Calibration overlay state --------
  // calibrationSkipped: user clicked "Skip for now" — don't show overlay
  const [calibrationSkipped, setCalibrationSkipped] = useState(
    () => localStorage.getItem("calibration_skipped") === "true"
  );
  // calibrationCompleted: user finished onboarding — don't re-trigger overlay if topics drop below 3 later
  const [calibrationCompleted, setCalibrationCompleted] = useState(
    () => localStorage.getItem("calibration_completed") === "true"
  );
  // startWithLocalLens / startWithJudicialLens: flags consumed once on mount
  const [startWithLocalLens, setStartWithLocalLens] = useState(() => {
    const flag = sessionStorage.getItem("start_local_lens") === "1";
    if (flag) sessionStorage.removeItem("start_local_lens");
    return flag;
  });
  const [startWithJudicialLens, setStartWithJudicialLens] = useState(() => {
    const flag = sessionStorage.getItem("start_judicial_lens") === "1";
    if (flag) sessionStorage.removeItem("start_judicial_lens");
    return flag;
  });
  const [startResumeCalibration, setStartResumeCalibration] = useState(() => {
    const flag = sessionStorage.getItem("start_resume_calibration") === "1";
    if (flag) sessionStorage.removeItem("start_resume_calibration");
    return flag;
  });
  const [startAllTopics, setStartAllTopics] = useState(() => {
    const flag = sessionStorage.getItem("start_all_topics") === "1";
    if (flag) sessionStorage.removeItem("start_all_topics");
    return flag;
  });

  // calibrationActive: overlay is currently in progress — stays true even if answeredCompassCount changes mid-flow
  const [calibrationActive, setCalibrationActive] = useState(
    () => !!localStorage.getItem("calibration_progress") || startWithLocalLens || startWithJudicialLens || startResumeCalibration || startAllTopics
  );

  // Celebration screen edge case: if calibration_progress exists but all pickedTopics are already
  // answered (user refreshed on the "complete" celebration screen), skip celebration and go straight
  // to compass. This runs once after topics load.
  useEffect(() => {
    if (!topicsLoaded) return;
    try {
      const saved = localStorage.getItem("calibration_progress");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const pickedIds = parsed.pickedTopics || [];
      if (pickedIds.length === 0) return;
      const allAnswered = pickedIds.every((id) => {
        const topic = topics.find((t) => t.id === id);
        if (!topic) return false;
        const val = answers[topic.short_title];
        return val != null && val > 0;
      });
      if (allAnswered) {
        // All topics answered — user was on celebration screen. Clear progress and dismiss overlay.
        localStorage.removeItem("calibration_progress");
        setCalibrationActive(false);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsLoaded]);

  // Determine if calibration needs to start:
  // Trigger when ANY selected topics are unanswered AND user hasn't skipped or completed calibration.
  // Also trigger for fresh users with NO selected topics (returning uncalibrated users, first-time
  // after clearing state, etc.) — captures the "never started" scenario.
  // Note: when calibrationCompleted is true and user deselects topics to drop below 3,
  // needsCalibration stays false — they see MinimumProgress inline prompt instead.
  const needsCalibration = (!calibrationSkipped && !calibrationCompleted) &&
    (unansweredCompassTopics.length > 0 || selectedTopics.length === 0);

  // Start calibration when needed — but once active, it stays active until onComplete/onSkip
  useEffect(() => {
    if (needsCalibration && !calibrationActive) {
      setCalibrationActive(true);
    }
  }, [needsCalibration, calibrationActive]);

  // Auto-route to CalibrationOverlay whenever there aren't enough answered topics.
  // Don't show a partial/broken compass — always send them into Compass Construction.
  // Only skip if the user explicitly clicked "Skip for now" (calibrationSkipped).
  useEffect(() => {
    if (topicsLoaded && !showChart && !calibrationActive && !calibrationSkipped) {
      setStartAtPick(selectedTopics.length > 0);
      setCalibrationActive(true);
    }
  }, [topicsLoaded, showChart, calibrationActive, calibrationSkipped, selectedTopics.length]);

  // Show overlay when active (stays shown even as answers change mid-flow)
  const showCalibration = calibrationActive;

  // resumeMode: user has some answered topics already — skip welcome/pick steps
  // Also treat startResumeCalibration as resume if they have answers; pick otherwise.
  const resumeMode = (answeredCompassCount > 0 && unansweredCompassTopics.length > 0)
    || (startResumeCalibration && answeredCompassCount > 0);

  // startAtPick: when true, CalibrationOverlay opens directly at the pick step
  const [startAtPick, setStartAtPick] = useState(startResumeCalibration && answeredCompassCount === 0);

  // handleStartCalibration: full reset — used for first-time entry points
  const handleStartCalibration = () => {
    localStorage.removeItem("calibration_skipped");
    localStorage.removeItem("calibration_completed");
    setCalibrationSkipped(false);
    setCalibrationCompleted(false);
    setStartAtPick(false);
    setCalibrationActive(true);
  };

  // handleStartCalibrationFromBelow3: enter calibration at pick step WITHOUT resetting state.
  // Used from the below-3 grayed chart overlay. Does not clear calibration_completed or
  // calibration_skipped — just opens the overlay at the pick step with existing topics pre-selected.
  const handleStartCalibrationFromBelow3 = () => {
    setStartAtPick(true);
    setCalibrationActive(true);
  };

  // Declared here so all useMemo hooks that reference comparePol/compareDisplayTopics
  // below are declared AFTER these state variables — prevents TDZ in the production
  // bundle where the minifier merges const chains and incorrectly orders declarations.
  const [comparePol, setComparePol] = useState(null); // { id, full_name/first/last, ... }
  const [compareDisplayTopics, setCompareDisplayTopics] = useState(null);
  const [compareReplacedSpokes, setCompareReplacedSpokes] = useState({});

  // -------- Chart data including all selected topics (unanswered = 0) --------
  const chartData = useMemo(() => {
    const data = {};
    for (const id of selectedTopics) {
      const topic = topics.find(t => t.id === id);
      if (!topic) continue;
      const val = answers[topic.short_title];
      data[topic.short_title] = (val != null && val > 0) ? val : 0;
    }
    return data;
  }, [selectedTopics, topics, answers]);

  // Set of unanswered spoke short_titles for RadarChartCore gray rendering
  const unansweredSpokesMap = useMemo(() => {
    const set = {};
    for (const id of selectedTopics) {
      const topic = topics.find(t => t.id === id);
      if (!topic) continue;
      const val = answers[topic.short_title];
      if (!(val != null && val > 0)) {
        set[topic.short_title] = true;
      }
    }
    return set;
  }, [selectedTopics, topics, answers]);

  // When a comparison is active, the chart uses a spoke-adjusted topic list
  const compareChartData = useMemo(() => {
    if (!comparePol || !compareDisplayTopics) return chartData;
    const data = {};
    for (const id of compareDisplayTopics) {
      const topic = topics.find(t => t.id === id);
      if (!topic) continue;
      const val = answers[topic.short_title];
      data[topic.short_title] = (val != null && val > 0) ? val : 0;
    }
    return data;
  }, [comparePol, compareDisplayTopics, topics, answers, chartData]);

  const compareUnansweredSpokesMap = useMemo(() => {
    if (!comparePol || !compareDisplayTopics) return unansweredSpokesMap;
    const set = {};
    for (const id of compareDisplayTopics) {
      const topic = topics.find(t => t.id === id);
      if (!topic) continue;
      const val = answers[topic.short_title];
      if (!(val != null && val > 0)) set[topic.short_title] = true;
    }
    return set;
  }, [comparePol, compareDisplayTopics, topics, answers, unansweredSpokesMap]);

  // If the compare compass ends up with fewer than 3 spokes, suppress it
  const compareHasEnoughSpokes = !comparePol || compareDisplayTopics === null || compareDisplayTopics.length >= 3;

  // -------- Spoke click handler: calibration for unanswered, drawer for answered --------
  const handleSpokeClick = (shortTitle) => {
    const val = answers[shortTitle];
    const isUnanswered = !(val != null && val > 0);
    if (isUnanswered) {
      handleStartCalibration();
    } else {
      const topic = topics.find(t => t.short_title === shortTitle);
      if (topic) setDrawerTopic(topic);
    }
  };

  // -------- Stance Max / Min --------
  const displayedTopicIds = comparePol && compareDisplayTopics ? compareDisplayTopics : selectedTopics;

  const handleStanceMax = () => {
    setInvertedSpokes((prev) => {
      const next = { ...prev };
      for (const id of displayedTopicIds) {
        const topic = topics.find((t) => t.id === id);
        if (!topic) continue;
        const val = answers[topic.short_title];
        if (val == null || val <= 0) continue;
        const isInverted = !!next[topic.short_title];
        const displayVal = isInverted ? 6 - val : val;
        if (displayVal < 3) {
          if (val < 3) next[topic.short_title] = true;
          else delete next[topic.short_title];
        }
      }
      return next;
    });
  };
  const handleStanceMin = () => {
    setInvertedSpokes((prev) => {
      const next = { ...prev };
      for (const id of displayedTopicIds) {
        const topic = topics.find((t) => t.id === id);
        if (!topic) continue;
        const val = answers[topic.short_title];
        if (val == null || val <= 0) continue;
        const isInverted = !!next[topic.short_title];
        const displayVal = isInverted ? 6 - val : val;
        if (displayVal > 3) {
          if (val > 3) next[topic.short_title] = true;
          else delete next[topic.short_title];
        }
      }
      return next;
    });
  };

  // -------- Local UI State --------
  // Post-calibration tour state
  const [tourStep, setTourStep] = useState(-1); // -1 = not active, 0-1 = active step

  // Tour target refs
  const spokeRef = useRef(null);      // Chart container div (step 0 — "tap any spoke label")
  const minMaxRef = useRef(null);     // Min/Max buttons (step 1 — explain Max/Min)
  const compareRef = useRef(null);    // Compare button (step 2)
  const backToLibRef = useRef(null);  // Step 3 ref — kept for CoachMark positioning (may be null)

  // Tour messages indexed by step (2 steps total)
  const tourMessages = [
    "Tap any spoke label to flip its direction — purely visual, your stance doesn't change.",
    (
      <>
        The shape isn&apos;t a political score. We randomize which end of each spoke is &ldquo;strong&rdquo; so the chart doesn&apos;t encode left vs. right.{" "}
        <a
          href="/how-it-works#compass-positions"
          target="_blank"
          rel="noopener"
          className="text-[#00657c] dark:text-ev-teal-light underline hover:text-[#ff5740]"
          onClick={(e) => e.stopPropagation()}
        >
          Why?
        </a>
      </>
    ),
  ];

  // Tour advancement logic
  const finishPostCalTour = () => {
    localStorage.setItem("onboarding_postCalTour", "1");
    setTourStep(-1);
    // Start compare tour now if comparePol is already set and compare tour hasn't run
    if (comparePol && !compareTourDismissed.current) {
      setTimeout(() => setCompareTourStep(0), 300);
    }
  };
  const advanceTour = () => {
    if (tourStep < 1) {
      setTourStep(tourStep + 1);
    } else {
      finishPostCalTour();
    }
  };
  const skipTour = () => {
    finishPostCalTour();
  };

  const [drawerTopic, setDrawerTopic] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareExpanded, setCompareExpanded] = useState(false);

  // -------- Compare deep-dive tour --------
  const [compareTourStep, setCompareTourStep] = useState(-1); // -1 = inactive, 0-1 = active
  const compareTourDismissed = useRef(!!localStorage.getItem("onboarding_compareTour"));
  // Ref for the radar chart container — used as target for compare tour steps 2 & 3
  const chartContainerRef = useRef(null);

  // -------- Compare switching callbacks --------
  const handleSwitchPolitician = (newPol) => {
    setComparePol(newPol);
  };

  const handleClearComparison = () => {
    setComparePol(null);
    setCompareAnswers({});
    setCompareDisplayTopics(null);
    setCompareReplacedSpokes({});
    setCompareMode(false);
  };

  // -------- Compare tour trigger: fires on first compare selection --------
  useEffect(() => {
    if (!comparePol || compareTourDismissed.current) return;
    if (!localStorage.getItem("onboarding_postCalTour")) return;
    const timer = setTimeout(() => setCompareTourStep(0), 600);
    return () => clearTimeout(timer);
  }, [comparePol]);

  // Helper: get the DOM target for each compare tour step
  const getCompareTourRef = (step) => {
    const el = (() => {
      switch (step) {
        case 0: {
          const panel = document.querySelector('.bg-white.rounded-2xl.border.border-neutral-200');
          return panel?.querySelector('.p-5') || panel;
        }
        case 1:
          return document.getElementById('topic-dropdown');
        case 2:
        case 3:
          return chartContainerRef.current;
        default:
          return null;
      }
    })();
    return { current: el };
  };

  const compareTourMessages = [
    "Pick a topic from the dropdown to see your stances side by side. No party labels — just the ideas.",
    "The blue overlay shows the politician's positions. Closer points on a spoke = more aligned on that issue.",
  ];

  const advanceCompareTour = () => {
    if (compareTourStep < 1) {
      setCompareTourStep(compareTourStep + 1);
    } else {
      localStorage.setItem("onboarding_compareTour", "1");
      compareTourDismissed.current = true;
      setCompareTourStep(-1);
    }
  };

  const skipCompareTour = () => {
    localStorage.setItem("onboarding_compareTour", "1");
    compareTourDismissed.current = true;
    setCompareTourStep(-1);
  };

  // Compare Details & Stance Explorer state
  const [dropdownValue, setDropdownValue] = useState("");

  // Nav State:
  const [selectedTab, setSelectedTab] = useState(1);
  const tabRefs = [useRef(null), useRef(null)];
  const [bgStyle, setBgStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const tab = tabRefs[selectedTab].current;
    if (tab) {
      const { offsetLeft, offsetWidth } = tab;
      setBgStyle({ left: offsetLeft, width: offsetWidth });
    }
  }, [selectedTab]);

  // -------- Load comparePol from localStorage on mount --------
  const location = useLocation();
  useEffect(() => {
    if (location.state?.clearCompare) {
      setComparePol(null);
      setCompareAnswers({});
      localStorage.removeItem("comparePolitician");
      return;
    }
    const savedPol = localStorage.getItem("comparePolitician");
    if (savedPol) {
      try {
        setComparePol(JSON.parse(savedPol));
      } catch {}
    }
  }, []);

  // -------- Sync compare politician -> localStorage --------
  useEffect(() => {
    if (comparePol) {
      localStorage.setItem("comparePolitician", JSON.stringify(comparePol));
    } else {
      localStorage.removeItem("comparePolitician");
    }
  }, [comparePol]);

  // Keep a ref to topics so the answer-fetch effect can use the latest
  // without re-firing every time topic metadata is edited in admin
  const topicsRef = useRef(topics);
  topicsRef.current = topics;

  // Keep a ref to answers so compare-spoke logic can read latest without re-firing
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // -------- Keep YOUR answers up to date when selectedTopics change --------
  useEffect(() => {
    if (!topicsRef.current.length || !selectedTopics.length)
      return;
    if (!isLoggedIn) return; // Guest answers already in state from localStorage

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
            // Don't overwrite an answer the user just set locally — the batch
            // fetch can race with a stance click during calibration and revert it.
            if (next[key] == null) next[key] = val;
          }
          return next;
        });

        // Populate writeIns from saved write_in_text
        const writeInEntries = selectedTopics
          .map((id) => {
            const answer = data.find((a) => a.topic_id === id);
            const topic = currentTopics.find((t) => t.id === id);
            if (!answer || !topic || !answer.write_in_text) return null;
            return [topic.short_title, answer.write_in_text];
          })
          .filter(Boolean);

        if (writeInEntries.length > 0) {
          setWriteIns((prev) => ({
            ...prev,
            ...Object.fromEntries(writeInEntries),
          }));
        }
      });
  }, [selectedTopics, setAnswers, setWriteIns, isLoggedIn]);

  // -------- Remove inversion if a topic is deleted --------
  const handleRemoveTopic = (idToRemove) => {
    setSelectedTopics((prev) => prev.filter((id) => id !== idToRemove));

    const topic = topics.find((t) => t.id === idToRemove);
    if (topic) {
      const short_title = topic.short_title;
      setInvertedSpokes((prev) => {
        const updated = { ...prev };
        delete updated[short_title];
        return updated;
      });
    }
  };

  // -------- Drawer handlers --------
  const getAnswer = (topic) => {
    if (!topic) return undefined;
    const val = answers[topic.short_title];
    return typeof val === "number" ? val : undefined;
  };

  // Library versions of drawer handlers — also update answeredTopicIDs
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
    setAnswers(prev => { const u = { ...prev }; delete u[topic.short_title]; return u; });
    setWriteIns(prev => { const u = { ...prev }; delete u[topic.short_title]; return u; });
  };

  // -------- Build compareAnswers when comparePol or topics change --------
  useEffect(() => {
    if (!comparePol || !selectedTopics.length) {
      setCompareAnswers({});
      setCompareDisplayTopics(null);
      setCompareReplacedSpokes({});
      return;
    }

    const polFetch = comparePol.is_candidate
      ? apiFetch(`/compass/candidates/${comparePol.id}/answers`).then((r) => r.json())
      : apiFetch(`/compass/politicians/${comparePol.id}/answers`).then((r) => r.json());
    const userFetch = isLoggedIn
      ? apiFetch('/compass/answers').then((r) => r.json())
      : Promise.resolve([]);

    Promise.all([polFetch, userFetch])
      .then(([allAnswers, userAnswers]) => {
        const currentTopics = topicsRef.current;
        const currentAnswers = answersRef.current;

        const userAnswerMap = { ...currentAnswers };
        for (const a of userAnswers) {
          const t = currentTopics.find((tt) => tt.id === a.topic_id);
          if (t && userAnswerMap[t.short_title] == null) {
            userAnswerMap[t.short_title] = a.value;
          }
        }

        const polAnsweredSet = new Set(
          allAnswers.filter((a) => parseFloat(a.value) > 0).map((a) => a.topic_id)
        );
        const selectedTopicSet = new Set(selectedTopics);

        const userAnsweredNotSelected = currentTopics.filter((t) => {
          const val = userAnswerMap[t.short_title];
          return !selectedTopicSet.has(t.id) && val != null && val > 0;
        });
        const replacementPool = userAnsweredNotSelected.filter((t) =>
          polAnsweredSet.has(t.id)
        );
        let replacementIdx = 0;

        const displayTopics = [];
        const replacedSpokes = {};
        const compareAnswersMap = {};

        for (const id of selectedTopics) {
          const t = currentTopics.find((tt) => tt.id === id);
          if (!t) continue;

          if (polAnsweredSet.has(id)) {
            displayTopics.push(id);
            const a = allAnswers.find((x) => x.topic_id === id);
            if (a && parseFloat(a.value) > 0) compareAnswersMap[t.short_title] = parseFloat(a.value);
          } else {
            if (replacementIdx < replacementPool.length) {
              const replT = replacementPool[replacementIdx++];
              displayTopics.push(replT.id);
              replacedSpokes[replT.short_title] = true;
              const a = allAnswers.find((x) => x.topic_id === replT.id);
              if (a && parseFloat(a.value) > 0) compareAnswersMap[replT.short_title] = parseFloat(a.value);
            }
          }
        }

        setCompareDisplayTopics(displayTopics);
        setCompareReplacedSpokes(replacedSpokes);
        setCompareAnswers(compareAnswersMap);
      })
      .catch((e) => {
        console.error("[CombinedPage] compare fetch failed", e);
        setCompareAnswers({});
        setCompareDisplayTopics(null);
        setCompareReplacedSpokes({});
      });
  }, [comparePol, selectedTopics, isLoggedIn, setCompareAnswers]);

  // -------- Library State --------
  const [answeredTopicIDs, setAnsweredTopicIDs] = useState([]);
  const [answeredLoaded, setAnsweredLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [hoveredPillShortTitle, setHoveredPillShortTitle] = useState(null);

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

  // -------- Fetch ALL answered topic IDs (Library full fetch) --------
  // This populates answeredTopicIDs for the library topic grid green checkmarks.
  // topicsRef and answersRef are declared above — safe to use here.
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

  // -------- Library Derived State --------
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
    () => localLensTopicIds.filter(id => {
      const topic = topics.find(t => t.id === id);
      if (!topic) return true;
      const val = answers[topic.short_title];
      return !(val != null && val > 0);
    }).length,
    [localLensTopicIds, topics, answers]
  );
  const localLensNotStarted = localLensRemaining === localLensTopicIds.length && localLensTopicIds.length > 0;
  const localLensActive = selectedTopics.length > 0 && selectedTopics.every(id => LOCAL_LENS.topicIds.includes(id));
  const judicialLensActive = selectedTopics.length > 0 && selectedTopics.every(id => JUDICIAL_LENS.topicIds.includes(id));
  const activeLens = localLensActive ? LOCAL_LENS : (judicialLensActive ? JUDICIAL_LENS : null);
  const pillBg = activeLens ? activeLens.color : (isDark ? '#52525b' : '#6B7280');

  const localLensTopics = useMemo(
    () => LOCAL_LENS.topicIds.map(id => topics.find(t => t.id === id)).filter(Boolean),
    [topics]
  );

  const MAX_TOPICS = 8;
  const uncalibratedCount = selectedTopics.filter(id => {
    const topic = topics.find(t => t.id === id);
    if (!topic) return false;
    const val = answers[topic.short_title];
    return !(val != null && val > 0);
  }).length;

  // -------- Library Helper Functions --------
  const getCategoryColor = (index) => CATEGORY_COLORS[index % CATEGORY_COLORS.length];

  const getVisibleTopics = (category) => {
    return (category.topics || [])
      .filter((t) =>
        (t.short_title || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.question_text && t.question_text.toLowerCase().includes(search.toLowerCase())) ||
        (t.title && t.title.toLowerCase().includes(search.toLowerCase()))
      );
  };

  const isTopicCalibrated = (topicId) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return false;
    const val = answers[topic.short_title];
    return val != null && val > 0;
  };

  // -------- Lens Triggers — swap spokes instantly; no overlay --------
  // Toggle: if local lens already active, restore answered topics instead of clearing.
  // If the user only has local lens answers, restoring = no-op (same topics shown).
  // Exit lens mode helper — saves current lens order, returns base topics to resume from.
  const exitLensMode = () => {
    localStorage.setItem("lensTopicsOrder", JSON.stringify(selectedTopics));
    try {
      const preLens = JSON.parse(localStorage.getItem("preLensTopics") || "null");
      if (Array.isArray(preLens) && preLens.length > 0) {
        localStorage.removeItem("preLensTopics");
        return preLens;
      }
    } catch {}
    return selectedTopics;
  };

  const doStartLocalLens = () => {
    if (localLensActive) {
      // Save lens order; restore pre-lens topics if they exist
      const base = exitLensMode();
      if (base !== selectedTopics) setSelectedTopics(base);
      // else no pre-lens to restore — stay on current topics
    } else {
      // Save current topics as pre-lens
      if (selectedTopics.length > 0) {
        localStorage.setItem("preLensTopics", JSON.stringify(selectedTopics));
      }
      // Restore saved lens order (validated to LOCAL_LENS IDs) or fall back to default
      let lensTopics = localLensTopicIds.slice(0, MAX_TOPICS);
      try {
        const saved = JSON.parse(localStorage.getItem("lensTopicsOrder") || "null");
        if (Array.isArray(saved) && saved.length > 0) {
          const validated = saved.filter(id => LOCAL_LENS.topicIds.includes(id));
          if (validated.length > 0) lensTopics = validated;
        }
      } catch {}
      setSelectedTopics(lensTopics);
      // If all lens topics already answered, mark calibration complete to block the overlay
      if (!calibrationCompleted) {
        const allAnswered = lensTopics.every(id => {
          const t = topics.find(tt => tt.id === id);
          return t && answers[t.short_title] != null && answers[t.short_title] > 0;
        });
        if (allAnswered) {
          setCalibrationCompleted(true);
          localStorage.setItem("calibration_completed", "true");
        }
      }
    }
  };

  // Full calibration overlay entry points (used by the empty-state "Start Local Lens →" CTA)
  const doCalibrateLens = (isLocal) => {
    setSelectedTopics([]);
    localStorage.removeItem("calibration_skipped");
    localStorage.removeItem("calibration_completed");
    setCalibrationSkipped(false);
    setCalibrationCompleted(false);
    setStartAtPick(false);
    setStartWithLocalLens(isLocal);
    setStartWithJudicialLens(!isLocal);
    setCalibrationActive(true);
  };

  // -------- Library Handlers --------
  const handleTileClick = (topicId) => {
    if (selectedTopics.includes(topicId)) {
      setSelectedTopics(selectedTopics.filter(id => id !== topicId));
    } else if (selectedTopics.length < MAX_TOPICS) {
      setSelectedTopics([...selectedTopics, topicId]);
    }
  };

  // handleCalibrateClick: exit lens if active, add topic if room, open drawer
  const handleCalibrateClick = (e, topic) => {
    e.stopPropagation();
    const base = localLensActive ? exitLensMode() : selectedTopics;
    if (!base.includes(topic.id) && base.length < MAX_TOPICS) {
      setSelectedTopics([...base, topic.id]);
    } else if (localLensActive) {
      setSelectedTopics(base); // Exit lens even if topic already present or at cap
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

  const navigate = useNavigate();

  // -------- Loading gate --------
  if (!topicsLoaded && !topicsError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-[3px] border-[#ff5740] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (topicsError && topics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-600 dark:text-gray-400 text-base">Couldn't load topics</p>
        <button onClick={retryLoadTopics} className="px-5 py-2 bg-black text-white rounded-full text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer">
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {showCalibration ? (
        <CalibrationOverlay
          resumeMode={resumeMode}
          startAtPick={startAtPick}
          startWithLocalLens={startWithLocalLens}
          startWithJudicialLens={startWithJudicialLens}
          startWithAllTopics={startAllTopics}
          onComplete={() => {
            localStorage.removeItem("calibration_skipped");
            localStorage.removeItem("calibration_progress");
            localStorage.setItem("calibration_completed", "true");
            setCalibrationSkipped(false);
            setCalibrationCompleted(true);
            setCalibrationActive(false);
            setStartAtPick(false);
            setStartWithLocalLens(false);
            setStartWithJudicialLens(false);
            setStartResumeCalibration(false);
            setStartAllTopics(false);
            // Start post-cal tour if not already dismissed
            if (!localStorage.getItem("onboarding_postCalTour")) {
              setTimeout(() => setTourStep(0), 500);
            }
          }}
          onSkip={() => {
            setCalibrationSkipped(true);
            localStorage.setItem("calibration_skipped", "true");
            localStorage.removeItem("calibration_progress");
            setCalibrationActive(false);
            setStartAtPick(false);
            setStartWithLocalLens(false);
            setStartWithJudicialLens(false);
            setStartResumeCalibration(false);
            setStartAllTopics(false);
            // No navigate("/library") — we are already on the combined page
          }}
        />
      ) : (
        <div className="px-4 lg:px-0 py-6 pb-16 flex flex-col items-center overflow-x-hidden dark:bg-[#131416] min-h-full">

          {/* -------- 260426-mw6: guest → authed promotion banner -------- */}
          {promoteCompassShouldPrompt && (
            <div className="w-full max-w-6xl mx-auto lg:px-4">
              <CompassPromotionBanner
                payload={promoteCompassPayload}
                onSave={promoteCompass}
                onDismiss={dismissCompassPromotion}
                status={promoteCompassStatus}
                error={promoteCompassError}
              />
            </div>
          )}

          {/* -------- mobile nav bar -------- */}
          <TabBar />

          {/* -------- desktop 3-column layout: pills | chart | compare -------- */}
          <div className="hidden lg:block w-full relative">
            <div className="flex items-start gap-4 pl-2 pr-[490px]">

            {/* Left column: vertical topic pills */}
            <div className="w-44 shrink-0 flex flex-col gap-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <h2 className="text-sm font-semibold dark:text-white">
                  Your Compass
                  <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-zinc-500">{selectedTopics.length}/8</span>
                </h2>
                {uncalibratedCount > 0 && (
                  <button
                    onClick={() => { setStartAtPick(false); setCalibrationActive(true); }}
                    style={{ background: UNCALIBRATED_PURPLE }}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-white hover:opacity-90 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0016.75 8h-6.572l1.305-6.093z" clipRule="evenodd" />
                    </svg>
                    Calibrate
                  </button>
                )}
              </div>
              {selectedTopics.length === 0 ? (
                <div className={`rounded-xl border-2 px-3 py-2.5 flex flex-col gap-2 ${
                  localLensNotStarted
                    ? "border-[#5A9A6E] bg-[#5A9A6E]/5 dark:bg-[#5A9A6E]/10"
                    : "border-dashed border-gray-300 dark:border-zinc-600"
                }`}>
                  {localLensNotStarted ? (
                    <>
                      <div>
                        <p className="text-xs font-semibold text-[#3d7a53] dark:text-[#7dbf94]">Start with the Local Lens</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">8 local election questions — fastest way to build your compass</p>
                      </div>
                      <button
                        onClick={() => doCalibrateLens(true)}
                        style={{ background: LOCAL_LENS.color }}
                        className="px-3 py-1.5 rounded-full text-xs font-bold text-white hover:opacity-90 cursor-pointer w-full"
                      >
                        Start Local Lens →
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-zinc-500">Click any topic below to add it</p>
                  )}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handlePillDragEnd}
                  modifiers={[restrictToVerticalAxis]}
                >
                  <SortableContext items={selectedTopics} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-1">
                      {selectedTopics.map((id) => {
                        const topic = topics.find(t => t.id === id);
                        if (!topic) return null;
                        return (
                          <SortableVerticalPill
                            key={id}
                            id={id}
                            topic={topic}
                            isCalibrated={isTopicCalibrated(id)}
                            onRemove={() => setSelectedTopics(prev => prev.filter(tid => tid !== id))}
                            onOpen={() => setDrawerTopic(topic)}
                            pillBg={pillBg}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            {/* Full Calibration CTA */}
            <a
              href="https://compass.empowered.vote/calibrate"
              target="_blank"
              rel="noopener"
              className="mt-10 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-80
                bg-[#FED12E] text-neutral-900 border border-transparent
                dark:bg-zinc-800 dark:text-[#FED12E] dark:border-[#FED12E]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
                <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.24a1 1 0 000 1.962l1.192.24a1 1 0 01.785.785l.24 1.192a1 1 0 001.962 0l.24-1.192a1 1 0 01.785-.785l1.192-.24a1 1 0 000-1.962l-1.192-.24a1 1 0 01-.785-.785l-.24-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" />
              </svg>
              Full Calibration
            </a>
            </div>

            {/* Center: chart */}
            <div className="flex-1 min-w-0 flex flex-col items-center">
              {showChart && <Legend />}
              <div
                ref={(el) => { chartContainerRef.current = el; spokeRef.current = el; }}
                className="w-full max-w-[min(900px,calc(100dvh-160px))] mx-auto relative"
              >
                {/* Local Lens toggle badge — top-left, always visible */}
                <div className="absolute top-2 left-2 z-10">
                  <button
                    onClick={doStartLocalLens}
                    title={localLensActive ? "Local Lens active — click to restore full compass" : `Local Lens — ${LOCAL_LENS.name}`}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer"
                    style={localLensActive
                      ? { background: "#9ca3af", color: "#fff" }
                      : { background: LOCAL_LENS.color, color: "#fff", opacity: 1 }
                    }
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                  </button>
                </div>
                {showChart && (
                  <>
                    {/* ? help link — top-right */}
                    <a
                      href="/how-it-works#compass-positions"
                      target="_blank"
                      rel="noopener"
                      title="How do I read this?"
                      aria-label="How to read the compass. Opens explanation in a new tab."
                      className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-gray-200 dark:border-zinc-600 text-gray-400 dark:text-gray-400 hover:text-[#00657c] dark:hover:text-ev-teal-light hover:border-[#00657c] dark:hover:border-ev-teal-light transition-colors inline-flex items-center justify-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </a>
                    {/* Stance Max / Min — top-right, below the ? button */}
                    <div
                      ref={minMaxRef}
                      className="absolute top-[12%] right-0 flex flex-col gap-1.5 z-10"
                    >
                      <button
                        onClick={handleStanceMax}
                        title="Stance Max — flip any spoke showing 1–2 to its strong side (4–5)"
                        aria-label="Stance Max"
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity cursor-pointer hover:opacity-90 active:scale-95 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 text-gray-500 dark:text-gray-400"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                        </svg>
                      </button>
                      <button
                        onClick={handleStanceMin}
                        title="Stance Min — flip any spoke showing 4–5 to its moderate side (1–2)"
                        aria-label="Stance Min"
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity cursor-pointer hover:opacity-90 active:scale-95 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 text-gray-500 dark:text-gray-400"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
                {showChart ? (
                  comparePol && !compareHasEnoughSpokes ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-center text-gray-500 dark:text-gray-400 text-sm px-6">
                        Not enough shared topics to display a comparison compass.
                      </p>
                    </div>
                  ) : (
                    <RadarChart
                      key={(comparePol ? compareDisplayTopics?.length : selectedTopics.length) ?? selectedTopics.length}
                      data={comparePol ? compareChartData : chartData}
                      unansweredSpokes={comparePol ? compareUnansweredSpokesMap : unansweredSpokesMap}
                      compareData={compareAnswers}
                      invertedSpokes={invertedSpokes}
                      writeIns={writeIns}
                      darkMode={isDark}
                      replacedSpokes={compareReplacedSpokes}
                      boldOriginalSpokes={!!comparePol}
                      onToggleInversion={(topic) =>
                        setInvertedSpokes((prev) => ({
                          ...prev,
                          [topic]: !prev[topic],
                        }))
                      }
                      onReplaceTopic={handleSpokeClick}
                    />
                  )
                ) : (
                  <BuildCompassPrompt
                    answeredCompassCount={answeredCompassCount}
                    needsMore={needsMore}
                    onStartCalibration={handleStartCalibrationFromBelow3}
                  />
                )}
              </div>
            </div>

            </div>{/* end inner flex row */}

            {/* Right: compare panel (absolute, floats over library when expanded) */}
            {showChart && (
              <div className={`absolute top-0 right-0 w-[480px] z-10 ${compareExpanded ? 'shadow-2xl' : 'bottom-0 overflow-y-auto'}`}>
                {(comparePol || compareMode) ? (
                  <>
                    <ComparePanel
                      politician={comparePol}
                      dropdownValue={dropdownValue}
                      setDropdownValue={setDropdownValue}
                      onSwitchPolitician={handleSwitchPolitician}
                      onClearComparison={handleClearComparison}
                      defaultLevel={localLensActive ? "Local" : "All"}
                    />
                    <div className="sticky bottom-0 flex justify-center pb-2 pt-6 bg-gradient-to-t from-white dark:from-zinc-800 to-transparent pointer-events-none">
                      <button
                        onClick={() => setCompareExpanded(v => !v)}
                        className="pointer-events-auto w-7 h-7 rounded-full bg-white dark:bg-zinc-700 border border-neutral-200 dark:border-zinc-600 shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
                        title={compareExpanded ? "Collapse compare panel" : "Expand compare panel"}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          {compareExpanded ? (
                            <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd" />
                          ) : (
                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                          )}
                        </svg>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-neutral-200 dark:border-zinc-700 shadow-sm p-8 flex flex-col items-center gap-4 h-full">
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      See how a candidate aligns with your compass
                    </p>
                    <button
                      ref={(el) => {
                        if (el && el.offsetWidth > 0) compareRef.current = el;
                      }}
                      onClick={() => setCompareMode(true)}
                      className="px-6 py-2 text-sm bg-black text-white rounded-full hover:bg-ev-yellow-dark hover:text-black transition-colors cursor-pointer"
                    >
                      Compare
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* -------- mobile: tab 0 (Compare) -------- */}
          {selectedTab === 0 && (
            <div className="w-full max-w-2xl lg:hidden">
              {(comparePol || compareMode) ? (
                <ComparePanel
                  politician={comparePol}
                  dropdownValue={dropdownValue}
                  setDropdownValue={setDropdownValue}
                  onSwitchPolitician={handleSwitchPolitician}
                  onClearComparison={handleClearComparison}
                />
              ) : (
                <div className="flex flex-col gap-6 w-full items-center mt-8">
                  <h1 className="text-xl font-semibold dark:text-white">
                    Select a politician to compare with
                  </h1>
                  {showChart && (
                    <button
                      onClick={() => setCompareMode(true)}
                      className="px-6 py-2 bg-black text-white rounded-full hover:bg-opacity-90"
                    >
                      Compare
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* -------- mobile: tab 1 (Graph) -------- */}
          {selectedTab === 1 && (
            <div className="w-full max-w-md md:max-w-lg flex flex-col items-center mx-auto lg:hidden">
              {showChart && <Legend />}
              <div className="w-full max-h-[calc(100dvh-240px)] mx-auto relative">
                {/* Local Lens toggle badge (mobile) — top-left, always visible */}
                <div className="absolute top-2 left-2 z-10">
                  <button
                    onClick={doStartLocalLens}
                    title={localLensActive ? "Local Lens active — click to restore full compass" : `Local Lens — ${LOCAL_LENS.name}`}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer"
                    style={localLensActive
                      ? { background: "#9ca3af", color: "#fff" }
                      : { background: LOCAL_LENS.color, color: "#fff" }
                    }
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                  </button>
                </div>
                {showChart ? (
                  comparePol && !compareHasEnoughSpokes ? (
                    <div className="flex items-center justify-center py-12">
                      <p className="text-center text-gray-500 dark:text-gray-400 text-sm px-6">
                        Not enough shared topics to display a comparison compass.
                      </p>
                    </div>
                  ) : (
                    <RadarChart
                      key={(comparePol ? compareDisplayTopics?.length : selectedTopics.length) ?? selectedTopics.length}
                      data={comparePol ? compareChartData : chartData}
                      unansweredSpokes={comparePol ? compareUnansweredSpokesMap : unansweredSpokesMap}
                      compareData={compareAnswers}
                      invertedSpokes={invertedSpokes}
                      writeIns={writeIns}
                      darkMode={isDark}
                      replacedSpokes={compareReplacedSpokes}
                      boldOriginalSpokes={!!comparePol}
                      onToggleInversion={(topic) =>
                        setInvertedSpokes((prev) => ({
                          ...prev,
                          [topic]: !prev[topic],
                        }))
                      }
                      onReplaceTopic={handleSpokeClick}
                    />
                  )
                ) : (
                  <BuildCompassPrompt
                    answeredCompassCount={answeredCompassCount}
                    needsMore={needsMore}
                    onStartCalibration={handleStartCalibrationFromBelow3}
                  />
                )}
              </div>
              <ActionButtons />
            </div>
          )}

          {/* -------- LIBRARY SECTION -------- */}
          <div className="w-full max-w-[1400px] mx-auto mt-8">

            {/* Pill strip — hidden on desktop (shown in left column instead) */}
            <div className="lg:hidden mb-5 px-4 md:px-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold dark:text-white">
                  Your Compass Topics
                  <span className="ml-2 text-sm font-normal text-gray-400 dark:text-zinc-500">{selectedTopics.length}/8</span>
                </h2>
                {uncalibratedCount > 0 && (
                  <button
                    onClick={() => { setStartAtPick(false); setCalibrationActive(true); }}
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
                        onClick={doStartLocalLens}
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
                            onMouseEnter={() => setHoveredPillShortTitle(topic.short_title)}
                            onMouseLeave={() => setHoveredPillShortTitle(null)}
                            pillBg={pillBg}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Search bar */}
            <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-xl px-4 py-2 mb-6 mx-4 md:mx-0">
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
            <div className="px-4 md:px-0">
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
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 dark:text-white">
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
          </div>

          {/* -------- LibraryDrawer — ONE instance with onRemoveFromCompass -------- */}
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
              setSelectedTopics(prev => prev.filter(id => id !== topic.id));
              setDrawerTopic(null);
            }}
            compassTopicCount={selectedTopics.length}
          />

          {/* -------- save prompt for guests -------- */}
          <SavePromptModal />

          {/* -------- Compare deep-dive tour -------- */}
          {compareTourStep >= 0 && comparePol && (
            <CoachMark
              targetRef={getCompareTourRef(compareTourStep)}
              message={compareTourMessages[compareTourStep]}
              stepLabel={`${compareTourStep + 1} of 2`}
              onNext={advanceCompareTour}
              onSkipAll={skipCompareTour}
              onDismiss={advanceCompareTour}
              show={true}
            />
          )}

          {/* -------- Post-calibration guided tour -------- */}
          {tourStep >= 0 && (
            <CoachMark
              targetRef={tourStep === 0 ? spokeRef : chartContainerRef}
              message={tourMessages[tourStep]}
              stepLabel={`${tourStep + 1} of 2`}
              onNext={advanceTour}
              onSkipAll={skipTour}
              onDismiss={advanceTour}
              show={true}
              allowSpotlightInteraction={true}
            />
          )}

          {/* -------- Library coach mark tour -------- */}
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

        </div>
      )}
    </>
  );
}

export default CombinedPage;
