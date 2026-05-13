import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { useCompass } from "../components/CompassContext";
import { useTheme } from "../ThemeProvider";
import { apiFetch } from "../lib/auth";
import { getQuestionText, parseTensionTitle } from "../util/topic";

const CATEGORY_COLORS = [
  '#00657C', '#FF5740', '#59B0C4', '#5A9A6E', '#7C6B9E', '#D4940B', '#FED12E',
];

const DARK = {
  bg:         '#131416',
  sidebar:    '#1A1C1F',
  sidebarBdr: '#2A2D33',
  card:       '#2F3237',
  border:     '#41454E',
  textHead:   '#EBEDEF',
  textBody:   '#D3D7DE',
  textMuted:  '#9CA3AF',
  textAccent: '#59B0C4',
  selBg:      'rgba(89,176,196,0.10)',
  selBorder:  '#59B0C4',
  yellow:     '#FED12E',
  progressBg: '#41454E',
  stanceBg:   '#41454E',
  stanceBdr:  '#555B66',
  activeItem: 'rgba(89,176,196,0.09)',
  checkColor: '#59B0C4',
  headerBg:   'rgba(19,20,22,0.97)',
  flipBtn:    '#41454E',
};

const LIGHT = {
  bg:         '#F7F7F8',
  sidebar:    '#FFFFFF',
  sidebarBdr: '#E5E7EB',
  card:       '#FFFFFF',
  border:     '#D3D7DE',
  textHead:   '#2F3237',
  textBody:   '#535964',
  textMuted:  '#9CA3AF',
  textAccent: '#00657C',
  selBg:      '#E4F3F6',
  selBorder:  '#00657C',
  yellow:     '#FED12E',
  progressBg: '#D3D7DE',
  stanceBg:   '#F7F7F8',
  stanceBdr:  '#D3D7DE',
  activeItem: '#EAF5F8',
  checkColor: '#00657C',
  headerBg:   'rgba(247,247,248,0.97)',
  flipBtn:    '#E5E7EB',
};

function CheckIcon({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="flex-none">
      <circle cx="7.5" cy="7.5" r="7" stroke={color} strokeWidth="1.5" fill={color + '25'} />
      <path d="M4.5 7.5l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CircleIcon({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="flex-none">
      <circle cx="7.5" cy="7.5" r="7" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export default function FullCalibration() {
  const { topics, categories, answers, setAnswers, isLoggedIn, topicsLoaded } = useCompass();
  const { isDark } = useTheme();
  const th = isDark ? DARK : LIGHT;
  const navigate = useNavigate();

  const [activeTopic, setActiveTopic] = useState(null);
  const [selectedValue, setSelectedValue] = useState(null);
  const [inversions, setInversions] = useState({});
  const [done, setDone] = useState(false);
  const itemRefs = useRef({});

  // ── Dedup topics across categories ──────────────────────────────────────
  const dedupedCategories = useMemo(() => {
    const seen = new Set();
    return categories
      .map(cat => ({
        ...cat,
        topics: (cat.topics || []).filter(tp => {
          if (seen.has(tp.id)) return false;
          seen.add(tp.id);
          return true;
        }),
      }))
      .filter(cat => cat.topics.length > 0);
  }, [categories]);

  const allTopics = useMemo(
    () => dedupedCategories.flatMap(cat => cat.topics),
    [dedupedCategories]
  );

  const answeredCount = useMemo(
    () => allTopics.filter(tp => answers[tp.short_title] > 0).length,
    [allTopics, answers]
  );
  const totalCount = allTopics.length;
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  // ── Init active topic + random inversions once topics load ───────────────
  useEffect(() => {
    if (!topicsLoaded || allTopics.length === 0) return;

    const firstUnanswered = allTopics.find(tp => !(answers[tp.short_title] > 0));
    if (!firstUnanswered) {
      setDone(true);
    } else {
      setActiveTopic(firstUnanswered);
    }

    const inv = {};
    allTopics.forEach(tp => { inv[tp.id] = Math.random() < 0.5; });
    setInversions(inv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsLoaded, allTopics.length]);

  // ── Scroll active sidebar item into view ────────────────────────────────
  useEffect(() => {
    if (!activeTopic) return;
    itemRefs.current[activeTopic.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeTopic?.id]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleAnswer = useCallback(async (value) => {
    if (!activeTopic || selectedValue !== null) return;
    const updatedAnswers = { ...answers, [activeTopic.short_title]: value };
    setSelectedValue(value);
    setAnswers(prev => ({ ...prev, [activeTopic.short_title]: value }));

    if (isLoggedIn) {
      apiFetch('/compass/answers', {
        method: 'POST',
        body: JSON.stringify({ topic_id: activeTopic.id, value }),
      }).catch(() => {});
    }

    setTimeout(() => {
      setSelectedValue(null);
      const curIdx = allTopics.findIndex(tp => tp.id === activeTopic.id);
      const nextAfter = allTopics.slice(curIdx + 1).find(tp => !(updatedAnswers[tp.short_title] > 0));
      const nextAny   = allTopics.find(tp => !(updatedAnswers[tp.short_title] > 0));
      const next = nextAfter || nextAny;
      if (next) {
        setActiveTopic(next);
      } else {
        setDone(true);
        localStorage.setItem("calibration_completed", "true");
      }
    }, 420);
  }, [activeTopic, allTopics, answers, isLoggedIn, selectedValue]);

  const handleSkip = useCallback(() => {
    if (!activeTopic) return;
    const curIdx = allTopics.findIndex(tp => tp.id === activeTopic.id);
    const next =
      allTopics.slice(curIdx + 1).find(tp => !(answers[tp.short_title] > 0)) ||
      allTopics.find(tp => tp.id !== activeTopic.id && !(answers[tp.short_title] > 0));
    if (next) setActiveTopic(next);
  }, [activeTopic, allTopics, answers]);

  const handleFlip = useCallback(() => {
    if (!activeTopic) return;
    setInversions(prev => ({ ...prev, [activeTopic.id]: !prev[activeTopic.id] }));
  }, [activeTopic]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!topicsLoaded) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: th.bg }}>
        <p className="text-sm" style={{ color: th.textMuted }}>Loading topics…</p>
      </div>
    );
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div
        className="h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: th.bg }}
      >
        <div className="text-5xl mb-5">🎯</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: th.textHead }}>
          Fully Calibrated
        </h1>
        <p className="text-base mb-2" style={{ color: th.textBody }}>
          You've answered all {totalCount} topics.
        </p>
        <p className="text-sm mb-8 max-w-sm" style={{ color: th.textMuted }}>
          Your positions are saved. You can refine any answer from the Library at any time.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/library')}
            className="px-7 py-3 rounded-full font-semibold text-sm transition-all hover:opacity-90 active:scale-95 cursor-pointer shadow-sm"
            style={{ background: th.yellow, color: '#1C1C1C' }}
          >
            Go to Library →
          </button>
          <button
            onClick={() => navigate('/results')}
            className="px-7 py-3 rounded-full font-semibold text-sm border transition-all hover:opacity-90 active:scale-95 cursor-pointer"
            style={{ borderColor: th.border, color: th.textBody, background: th.card }}
          >
            View My Compass
          </button>
        </div>
      </div>
    );
  }

  // ── Derive active topic display ──────────────────────────────────────────
  // categories API returns lightweight topic objects (no stances); look up the
  // full topic from the topics array which includes the stances array.
  const fullActiveTopic = activeTopic ? (topics.find(t => t.id === activeTopic.id) ?? activeTopic) : null;
  const isFlipped = fullActiveTopic ? (inversions[fullActiveTopic.id] ?? false) : false;
  const orderedStances = fullActiveTopic?.stances
    ? isFlipped
      ? [...fullActiveTopic.stances].sort((a, b) => a.value - b.value)
      : [...fullActiveTopic.stances].sort((a, b) => b.value - a.value)
    : [];
  const qText    = fullActiveTopic ? getQuestionText(fullActiveTopic) : "";
  const { name: topicName, poles } = fullActiveTopic
    ? parseTensionTitle(fullActiveTopic)
    : { name: "", poles: null };
  const catIdx   = dedupedCategories.findIndex(cat => cat.topics.some(tp => tp.id === activeTopic?.id));
  const catColor = CATEGORY_COLORS[catIdx >= 0 ? catIdx % CATEGORY_COLORS.length : 0];
  const catName  = dedupedCategories[catIdx]?.title ?? "";

  // ── Main layout ──────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col" style={{ background: th.bg }}>

      {/* ── Header ── */}
      <header
        className="flex-none h-14 flex items-center px-4 gap-3 border-b z-10 backdrop-blur-sm"
        style={{ background: th.headerBg, borderColor: th.border }}
      >
        <button
          onClick={() => navigate('/library')}
          className="text-sm flex-none flex items-center gap-1 transition-opacity hover:opacity-60 cursor-pointer"
          style={{ color: th.textMuted }}
        >
          ← Back
        </button>

        <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
          <span className="hidden sm:block text-sm font-semibold flex-none" style={{ color: th.textHead }}>
            Full Calibration
          </span>
          <div className="flex items-center gap-2">
            <div
              className="w-24 sm:w-36 h-1.5 rounded-full overflow-hidden flex-none"
              style={{ background: th.progressBg }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: th.textAccent }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums flex-none" style={{ color: th.textAccent }}>
              {answeredCount} / {totalCount}
            </span>
          </div>
        </div>

        {/* balance spacer */}
        <div className="w-10 flex-none" />
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Sidebar ── */}
        <aside
          className="hidden md:flex flex-col w-60 lg:w-72 flex-none border-r overflow-y-auto"
          style={{ background: th.sidebar, borderColor: th.sidebarBdr }}
        >
          {/* Overall progress chip */}
          <div className="px-4 py-3 border-b" style={{ borderColor: th.sidebarBdr }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold" style={{ color: th.textMuted }}>Progress</span>
              <span className="text-xs font-bold tabular-nums" style={{ color: th.textAccent }}>
                {progressPct}%
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: th.progressBg }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: th.textAccent }}
              />
            </div>
          </div>

          {/* Categories + topics */}
          {dedupedCategories.map((cat, catI) => {
            const color = CATEGORY_COLORS[catI % CATEGORY_COLORS.length];
            const catAnswered = cat.topics.filter(tp => answers[tp.short_title] > 0).length;
            return (
              <div key={cat.id}>
                <div
                  className="sticky top-0 flex items-center justify-between px-3 py-2 z-10"
                  style={{
                    background: th.sidebar,
                    borderLeft: `3px solid ${color}`,
                    borderBottom: `1px solid ${th.sidebarBdr}`,
                  }}
                >
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider truncate"
                    style={{ color: th.textMuted }}
                  >
                    {cat.title}
                  </span>
                  <span
                    className="text-[10px] font-bold ml-2 flex-none tabular-nums"
                    style={{ color: catAnswered === cat.topics.length ? color : th.textMuted }}
                  >
                    {catAnswered}/{cat.topics.length}
                  </span>
                </div>

                {cat.topics.map(tp => {
                  const isAnswered = answers[tp.short_title] > 0;
                  const isActive   = activeTopic?.id === tp.id;
                  const { name }   = parseTensionTitle(tp);
                  return (
                    <button
                      key={tp.id}
                      ref={el => { itemRefs.current[tp.id] = el; }}
                      onClick={() => { setActiveTopic(tp); setSelectedValue(null); }}
                      className="w-full text-left flex items-start gap-2.5 px-3 py-2 text-xs leading-snug transition-colors duration-100 cursor-pointer"
                      style={{
                        background: isActive ? th.activeItem : 'transparent',
                        borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
                        color: isAnswered && !isActive ? th.textMuted : th.textBody,
                      }}
                    >
                      <span className="mt-0.5">
                        {isAnswered
                          ? <CheckIcon color={isActive ? color : th.checkColor} />
                          : <CircleIcon color={isActive ? color : th.border} />
                        }
                      </span>
                      <span className={`${isAnswered && !isActive ? 'opacity-50' : ''} ${isActive ? 'font-semibold' : ''}`}>
                        {name}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </aside>

        {/* ── Question panel ── */}
        <main className="flex-1 overflow-y-auto">
          {activeTopic ? (
            <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

              {/* Category + flip row */}
              <div className="flex items-center justify-between mb-5">
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: catColor + '22', color: catColor }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: catColor, display: 'inline-block' }} />
                  {catName}
                </div>
                <button
                  onClick={handleFlip}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-70 cursor-pointer"
                  style={{ background: th.flipBtn, color: isFlipped ? th.textAccent : th.textBody }}
                  title="Flip stance order"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4l4-3 4 3M10 8L6 11 2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Flip
                </button>
              </div>

              {/* Question */}
              <div className="mb-7">
                <h2
                  className="text-xl sm:text-2xl font-bold leading-snug"
                  style={{ color: th.textHead }}
                >
                  {qText || topicName}
                </h2>
                {qText && (topicName || poles) && (
                  <p className="mt-1.5 text-sm" style={{ color: th.textMuted }}>
                    {topicName}{poles ? ` · ${poles}` : ''}
                  </p>
                )}
              </div>

              {/* Stance buttons */}
              <div className="flex flex-col gap-2">
                {orderedStances.map(stance => {
                  const isSelected  = selectedValue === stance.value;
                  const wasPicked   = answers[activeTopic.short_title] === stance.value;
                  const highlight   = isSelected || (selectedValue === null && wasPicked);
                  return (
                    <button
                      key={stance.id}
                      onClick={() => handleAnswer(stance.value)}
                      disabled={selectedValue !== null}
                      className="w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium leading-snug transition-all duration-150 cursor-pointer"
                      style={{
                        background:   highlight ? th.selBg  : th.stanceBg,
                        border:       `1.5px solid ${highlight ? th.selBorder : th.stanceBdr}`,
                        color:        highlight ? th.textAccent : th.textBody,
                        opacity:      selectedValue !== null && !isSelected ? 0.45 : 1,
                        transform:    isSelected ? 'scale(1.01)' : 'scale(1)',
                      }}
                    >
                      {stance.text}
                    </button>
                  );
                })}
              </div>

              {/* Skip */}
              <button
                onClick={handleSkip}
                className="mt-5 text-xs transition-opacity hover:opacity-60 cursor-pointer"
                style={{ color: th.textMuted }}
              >
                Skip for now →
              </button>

            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: th.textMuted }}>Select a topic from the list</p>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
