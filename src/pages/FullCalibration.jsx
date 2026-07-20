import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { track } from "@empoweredvote/analytics";
import { useCompass } from "../components/CompassContext";
import { useTheme } from "../ThemeProvider";
import { apiFetch } from "../lib/auth";
import { getQuestionText, parseTensionTitle } from "../util/topic";

const CATEGORY_COLORS = [
  '#00657C', '#FF5740', '#59B0C4', '#5A9A6E', '#7C6B9E', '#D4940B', '#FED12E',
];

const DARK = {
  bg:           '#131416',
  sidebar:      '#1A1C1F',
  sidebarBdr:   '#2A2D33',
  card:         '#2F3237',
  border:       '#41454E',
  textHead:     '#EBEDEF',
  textBody:     '#D3D7DE',
  textMuted:    '#9CA3AF',
  textAccent:   '#59B0C4',
  selBg:        'rgba(89,176,196,0.12)',
  selBorder:    '#59B0C4',
  yellow:       '#FED12E',
  progressBg:   '#41454E',
  stanceBg:     '#2F3237',
  stanceBdr:    '#41454E',
  stanceShadow: 'none',
  activeItem:   'rgba(89,176,196,0.09)',
  checkColor:   '#59B0C4',
  flipBtn:      '#41454E',
};

const LIGHT = {
  bg:           '#F7F7F8',
  sidebar:      '#FFFFFF',
  sidebarBdr:   '#E5E7EB',
  card:         '#FFFFFF',
  border:       '#D3D7DE',
  textHead:     '#2F3237',
  textBody:     '#535964',
  textMuted:    '#9CA3AF',
  textAccent:   '#00657C',
  selBg:        '#E4F3F6',
  selBorder:    '#00657C',
  yellow:       '#FED12E',
  progressBg:   '#D3D7DE',
  stanceBg:     '#FFFFFF',
  stanceBdr:    '#D3D7DE',
  stanceShadow: '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05)',
  activeItem:   '#EAF5F8',
  checkColor:   '#00657C',
  flipBtn:      '#E5E7EB',
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
  const { isDark, toggle: toggleDark } = useTheme();
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

  // Any live topic not in any category gets its own "Other" section so it's
  // still answerable here (guards against admin mis-configuration).
  const sidebarCategories = useMemo(() => {
    const coveredIds = new Set(dedupedCategories.flatMap(cat => cat.topics.map(t => t.id)));
    const uncategorized = topics.filter(t => !coveredIds.has(t.id));
    if (uncategorized.length === 0) return dedupedCategories;
    return [...dedupedCategories, { id: '__other__', title: 'Other', topics: uncategorized }];
  }, [dedupedCategories, topics]);

  const allTopics = useMemo(
    () => sidebarCategories.flatMap(cat => cat.topics),
    [sidebarCategories]
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
      track('compass_calibration_started', { total_topics: allTopics.length });
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
    const newAnsweredCount = allTopics.filter(tp => updatedAnswers[tp.short_title] > 0).length;

    track('compass_calibration_question_answered', {
      topic_slug: activeTopic.short_title,
      answered_count: newAnsweredCount,
      total_topics: allTopics.length,
    });

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
        track('compass_calibration_completed', {
          answered_count: newAnsweredCount,
          total_topics: allTopics.length,
        });
      }
    }, 420);
  }, [activeTopic, allTopics, answers, isLoggedIn, selectedValue]);

  const handleSkip = useCallback(() => {
    if (!activeTopic) return;
    track('compass_calibration_question_skipped', {
      topic_slug: activeTopic.short_title,
      answered_count: answeredCount,
      total_topics: allTopics.length,
    });
    const curIdx = allTopics.findIndex(tp => tp.id === activeTopic.id);
    const next =
      allTopics.slice(curIdx + 1).find(tp => !(answers[tp.short_title] > 0)) ||
      allTopics.find(tp => tp.id !== activeTopic.id && !(answers[tp.short_title] > 0));
    if (next) setActiveTopic(next);
  }, [activeTopic, allTopics, answeredCount, answers]);

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
  const catIdx   = sidebarCategories.findIndex(cat => cat.topics.some(tp => tp.id === activeTopic?.id));
  const catColor = CATEGORY_COLORS[catIdx >= 0 ? catIdx % CATEGORY_COLORS.length : 0];
  const catName  = sidebarCategories[catIdx]?.title ?? "";

  // ── Main layout ──────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col" style={{ background: th.bg }}>

      {/* ── Header ── */}
      <header
        className="flex-none z-30"
        style={{
          backgroundColor: isDark ? '#131416' : '#FFFFFF',
          borderBottom: `1px solid ${isDark ? '#41454E' : '#E2EBEF'}`,
        }}
      >
        <div style={{ maxWidth: '1512px', margin: '0 auto', padding: '0 24px' }}>

          {/* Row 1: logo + back | nav links + dark toggle */}
          <div className="flex items-center justify-between" style={{ paddingTop: '12px', paddingBottom: '8px' }}>
            <div className="flex items-center gap-3">
              <img
                src={isDark ? "/compass-logo-dark.png" : "/compass-logo-light.svg"}
                alt="Empowered Compass"
                className="cursor-pointer flex-none"
                style={{ height: '32px' }}
                onClick={() => navigate('/library')}
              />
              <button
                onClick={() => {
                  track('compass_calibration_abandoned', {
                    answered_count: answeredCount,
                    total_topics: allTopics.length,
                    progress_pct: progressPct,
                  });
                  navigate('/library');
                }}
                className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70 cursor-pointer"
                style={{ color: isDark ? '#9CA3AF' : '#535964', fontFamily: "'Manrope', sans-serif" }}
              >
                ← Back
              </button>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://login.empowered.vote/profile"
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ color: isDark ? '#59B0C4' : '#00657C', fontFamily: "'Manrope', sans-serif", textDecoration: 'none' }}
              >
                Profile
              </a>
              <a
                href="https://financials.empowered.vote"
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ color: isDark ? '#59B0C4' : '#00657C', fontFamily: "'Manrope', sans-serif", textDecoration: 'none' }}
              >
                EV Financials
              </a>
              <button
                onClick={toggleDark}
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                style={{ color: isDark ? '#9CA3AF' : '#535964' }}
              >
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.061-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.061-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.061zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.061z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Row 2: Full Calibration title + count, then progress bar */}
          <div style={{ paddingBottom: '12px' }}>
            <div className="flex items-baseline gap-2" style={{ marginBottom: '6px' }}>
              <span
                className="text-sm font-bold"
                style={{ color: isDark ? '#EBEDEF' : '#2F3237', fontFamily: "'Manrope', sans-serif" }}
              >
                Full Calibration
              </span>
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: isDark ? '#59B0C4' : '#00657C', fontFamily: "'Manrope', sans-serif" }}
              >
                {answeredCount} / {totalCount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="rounded-full overflow-hidden flex-none"
                style={{ width: '160px', height: '4px', background: isDark ? '#41454E' : '#D3D7DE' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: isDark ? '#59B0C4' : '#00657C' }}
                />
              </div>
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: isDark ? '#9CA3AF' : '#535964', fontFamily: "'Manrope', sans-serif" }}
              >
                {progressPct}%
              </span>
            </div>
          </div>

        </div>
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
          {sidebarCategories.map((cat, catI) => {
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
              <div className="flex flex-col gap-2.5">
                {orderedStances.map(stance => {
                  const isSelected = selectedValue === stance.value;
                  const wasPicked  = answers[activeTopic.short_title] === stance.value;
                  const highlight  = isSelected || (selectedValue === null && wasPicked);
                  return (
                    <button
                      key={stance.id}
                      onClick={() => handleAnswer(stance.value)}
                      disabled={selectedValue !== null}
                      className="w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium leading-snug transition-all duration-150 cursor-pointer"
                      style={{
                        background:  highlight ? th.selBg : th.stanceBg,
                        border:      `1.5px solid ${highlight ? th.selBorder : th.stanceBdr}`,
                        color:       highlight ? th.textAccent : th.textHead,
                        boxShadow:   highlight ? 'none' : th.stanceShadow,
                        opacity:     selectedValue !== null && !isSelected ? 0.4 : 1,
                        transform:   isSelected ? 'scale(1.01)' : 'scale(1)',
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
