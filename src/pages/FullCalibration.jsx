import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { nextTopicFrom, needsAnswer } from '../lib/calibrationQueue';
import { buildSidebarGroups } from '../lib/calibrationSidebar';
import { displayLenses, getLensColor, getLensInk } from '../lib/lenses';
import { readableOn } from '../lib/lensColors';
import { lensProgress } from '../lib/lensProgress';
import { answerReveal, indexStats } from '../lib/topicStats';
import LensIcon from '../components/LensIcon';
import ProgressRing from '../components/ProgressRing';
import ExplainerPopover from '../components/ExplainerPopover';
import { mergeFlags } from '../lib/recalibration';
import { indexJournal, showsThread, markAffected } from '../lib/journal';
import QuestionNotes from '../components/QuestionNotes';
import { useNavigate } from "react-router";
import { track } from "@empoweredvote/analytics";
import { useCompass } from "../components/CompassContext";
import { useTheme } from "../ThemeProvider";
import { apiFetch, publicFetch } from "../lib/auth";
import { getQuestionText, parseTensionTitle } from "../util/topic";

const CATEGORY_COLORS = [
  '#00657C', '#FF5740', '#59B0C4', '#5A9A6E', '#7C6B9E', '#D4940B', '#FED12E',
];

// The same violet the compass uses for "this needs calibrating" (the pill
// markers and the recalibration prompt). Reused rather than reinvented so a
// question flagged on one screen looks flagged on the other. The background is
// translucent so it reads on both themes without a second pair of tokens.
const RECALIBRATE_ACCENT = '#7C3AED';
const RECALIBRATE_BG = 'rgba(124,58,237,0.12)';

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
  const {
    topics, categories, answers, setAnswers, isLoggedIn, topicsLoaded,
    lenses, userLenses,
    invertedSpokes, setInvertedSpokes, initRandomInversions,
  } = useCompass();
  const { isDark, toggle: toggleDark } = useTheme();
  const th = isDark ? DARK : LIGHT;
  const navigate = useNavigate();

  const [activeTopic, setActiveTopic] = useState(null);
  const [selectedValue, setSelectedValue] = useState(null);
  // The last gap just closed. A note above the question, not a destination:
  // finishing used to swap the whole page for a "Fully Calibrated" screen whose
  // only exits were the Library and the compass, so the moment you completed the
  // set you lost the thing you were using to refine it.
  const [justCompleted, setJustCompleted] = useState(false);
  // The compass was already complete when this page opened, so there are no
  // gaps to chase and the session must not auto-end after a single change.
  const [reviewMode, setReviewMode] = useState(false);
  // Topics the user arrived to re-answer, handed over by the recalibration
  // prompt. Read once on mount and cleared from sessionStorage immediately, so
  // a later reload is an ordinary visit rather than a second re-ask.
  const [mustReanswer, setMustReanswer] = useState(() => {
    try {
      const raw = sessionStorage.getItem("recalibrate_topic_ids");
      if (!raw) return new Set();
      sessionStorage.removeItem("recalibrate_topic_ids");
      const ids = JSON.parse(raw);
      return new Set(Array.isArray(ids) ? ids.filter(Boolean) : []);
    } catch {
      return new Set(); // unreadable handoff — just an ordinary visit
    }
  });
  // Which lens's questions are pinned to the top of the sidebar.
  //
  // 🔴 LOCAL VIEW STATE ONLY — never setActiveLensKey. That key decides whether
  // the user's selection is written to the server (shouldSyncCompass returns
  // false while a lens is active), so routing a browsing choice through it
  // would let "let me see what Federal asks" quietly change someone's compass,
  // and what Essentials reads as it.
  const [pinnedLensKey, setPinnedLensKey] = useState(null);

  // Why a question is asking to be answered again. Rendered through the same
  // QuestionNotes panel the compass uses, so editorial's publicNote reads
  // identically on both screens.
  const [flags, setFlags] = useState([]);
  const [openFlagTopicId, setOpenFlagTopicId] = useState(null);
  // Which topics have a design-diary thread, and the threads already fetched.
  //
  // 🔴 THE INDEX IS WHAT MAKES THE ⓘ DECIDABLE. 60 sidebar rows are drawn
  // before anybody clicks anything, and asking per topic would be 60 requests
  // for 60 answers that are nearly all "no". The thread itself is fetched when
  // the panel opens, once per topic, and kept.
  const [journalIndex, setJournalIndex] = useState(() => new Map());
  const [threads, setThreads] = useState(() => new Map());
  const [loadingThread, setLoadingThread] = useState(null);
  const fetchedThreads = useRef(new Set());
  // "Why do the options move around?" — the Flip control's own explainer.
  const [showFlipExplainer, setShowFlipExplainer] = useState(false);

  // How the officials answered, keyed by topic. Public and identical for
  // everyone, so it is fetched once and never refetched.
  const [statsByTopic, setStatsByTopic] = useState(() => new Map());
  // The line about the answer just given. It deliberately OUTLIVES the question
  // that produced it: the gap between answering and the next question is 420ms,
  // which is not long enough to read a sentence, and stretching it to be long
  // enough would add a minute of waiting across a sixty-question run. So it
  // names its own topic and sits above the NEXT question instead, where it can
  // be read at whatever pace the reader likes and costs the run nothing.
  const [reveal, setReveal] = useState(null);

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

  // The same row the compass switcher draws — same order, same short labels,
  // same colours, same season filter. Built by the same helper so a lens cannot
  // look like one thing here and another thing there.
  const lensOptions = useMemo(
    () => displayLenses({ lenses, userLenses, topics }).filter(l => l?.key && l?.name),
    [lenses, userLenses, topics]
  );
  const pinnedLens = useMemo(
    () => lensOptions.find(l => l.key === pinnedLensKey) ?? null,
    [lensOptions, pinnedLensKey]
  );

  // The sidebar as rendered: the pinned lens group, then the whole library.
  const sidebarGroups = useMemo(
    () => buildSidebarGroups({ categories: sidebarCategories, lens: pinnedLens }),
    [sidebarCategories, pinnedLens]
  );

  // Flags keyed by topic, for the "what changed" note. Both sources, the same
  // way the compass screen does it: the server covers a signed-in user's
  // answers, and a saved lens carries its own snapshot — which is all a guest
  // ever has, since their answers were never stamped against a revision.
  // mergeFlags owns the tie-break (a suppressed record wins).
  const flagsByTopic = useMemo(
    () => mergeFlags({ compassFlags: flags, lensFlags: pinnedLens?.needsRecalibration }),
    [flags, pinnedLens]
  );

  // The flag for the question on screen, if it has one. Drives the "What
  // changed" button beside the category chip — the same note the sidebar dot
  // opens, surfaced where the reader's eye already is.
  const activeFlag = activeTopic ? flagsByTopic.get(activeTopic.id) : undefined;

  // And whether that question has a diary worth offering. Same rule as the
  // sidebar's: entries exist, and this reader has answered it.
  const activeThread = showsThread({
    index: journalIndex,
    topicId: activeTopic?.id,
    answered: activeTopic ? answers[activeTopic.short_title] > 0 : false,
  });

  useEffect(() => {
    if (!isLoggedIn) { setFlags([]); return; }
    let cancelled = false;
    apiFetch('/compass/recalibration-flags')
      .then(r => (r && r.ok ? r.json() : []))
      .then(data => { if (!cancelled) setFlags(Array.isArray(data) ? data : []); })
      // A failed flag fetch must not break calibration. The worst case is the
      // note being absent, which is where this page was before.
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  // Public, identical for every caller, and cached server-side for an hour —
  // so it is fetched once for everyone, signed in or not, and never refetched.
  // Failing silently is correct: no stats means no line after an answer, which
  // is exactly where this page was before.
  //
  // 🔴 publicFetch, NOT apiFetch, AND THE DIFFERENCE IS A LOGOUT. apiFetch
  // treats a 401 as an expired session: it tries a refresh and, when that comes
  // back terminal, clears the token and redirects to the login hub. This
  // endpoint is optionalAuth and returns 200 to a guest — but it answered 401
  // for the minutes between this app deploying and the API deploying, and under
  // apiFetch that would have thrown guests off the calibration page mid-run,
  // over a decorative line. A public read must never be able to end a session.
  useEffect(() => {
    let cancelled = false;
    publicFetch('/compass/topic-stats')
      .then(r => (r && r.ok ? r.json() : []))
      .then(rows => { if (!cancelled) setStatsByTopic(indexStats(rows)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Which questions have something written about them. Public, tiny, and the
  // same for everyone, so it is fetched once alongside the stats.
  //
  // 🔴 publicFetch, FOR THE REASON SPELLED OUT ABOVE. A public read must never
  // be able to end a session, and this endpoint deployed after the client that
  // calls it — exactly the window in which it answers 401 to everybody.
  //
  // Failing silently leaves no ⓘ, which is where this page was yesterday.
  useEffect(() => {
    let cancelled = false;
    publicFetch('/compass/journal/index')
      .then(r => (r && r.ok ? r.json() : []))
      .then(rows => { if (!cancelled) setJournalIndex(indexJournal(rows)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Open the notes for a topic, fetching its thread the first time.
  //
  // ⚠ THE PANEL OPENS IMMEDIATELY, NOT WHEN THE FETCH LANDS. The flag note is
  // already in hand and is the urgent half; making the reader wait on a diary
  // they may not have come for would be a slower panel for a worse reason.
  const openNotes = useCallback((topicId) => {
    setOpenFlagTopicId(topicId);
    // A ref rather than a check against `threads`, because this must be exactly
    // once per topic: a state updater can be called twice for one event and a
    // fetch started inside one would run twice with it.
    if (fetchedThreads.current.has(topicId)) return;
    fetchedThreads.current.add(topicId);
    setLoadingThread(topicId);
    publicFetch(`/compass/topics/${topicId}/journal`)
      .then(r => (r && r.ok ? r.json() : []))
      .then(rows => setThreads(m => new Map(m).set(topicId, Array.isArray(rows) ? rows : [])))
      // An empty thread, cached: a reader who clicks again gets the panel
      // straight away rather than a second spinner over the same failure.
      .catch(() => setThreads(m => new Map(m).set(topicId, [])))
      .finally(() => setLoadingThread(t => (t === topicId ? null : t)));
  }, []);

  const answeredCount = useMemo(
    () => allTopics.filter(tp => answers[tp.short_title] > 0).length,
    [allTopics, answers]
  );
  const totalCount = allTopics.length;
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  // ── Init active topic + shared spoke inversions once topics load ─────────
  useEffect(() => {
    if (!topicsLoaded || allTopics.length === 0) return;

    // Arriving to re-answer revised questions: open on the first of them, so
    // the thing the prompt asked for is the thing on screen.
    const firstFlagged = mustReanswer.size > 0
      ? allTopics.find(tp => mustReanswer.has(tp.id))
      : null;

    // Opening with nothing left to answer is a revision pass, not a finish.
    // It used to land on the "Fully Calibrated" screen, whose only exits are
    // Library and the compass — so the one thing the button promises, choosing
    // your stances, was the one thing you could not do. Start on the first
    // topic instead; the sidebar already targets any of them.
    const firstUnanswered = allTopics.find(tp => needsAnswer(tp, answers, null));
    setReviewMode(!firstUnanswered && !firstFlagged);
    setActiveTopic(firstFlagged ?? firstUnanswered ?? allTopics[0]);
    track('compass_calibration_started', {
      total_topics: allTopics.length,
      surface: 'full',
      ...(mustReanswer.size > 0 ? { recalibrating: mustReanswer.size } : {}),
    });

    // Shared, deterministic (guestId + topicId hash) so the order a topic is
    // shown in here is stable across reloads and matches the rest of the app.
    initRandomInversions(allTopics);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsLoaded, allTopics.length]);

  // ── Scroll active sidebar item into view ────────────────────────────────
  useEffect(() => {
    if (!activeTopic) return;
    // A pinned topic is on screen twice — once in the lens group, once in its
    // category. Scroll to the pinned copy when there is one, so clicking a
    // pinned row does not jump the list down to its duplicate.
    const el = itemRefs.current['p:' + activeTopic.id] ?? itemRefs.current[activeTopic.id];
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      surface: 'full',
    });

    setSelectedValue(value);
    setAnswers(prev => ({ ...prev, [activeTopic.short_title]: value }));

    // 🔴 THE ONLY PLACE THIS IS BUILT, AND THAT IS THE SAFEGUARD. A crowd figure
    // shown above five options nobody has chosen yet is an anchor on a product
    // whose claim is that it does not push. Deriving the line here — inside the
    // handler, from the value just picked — means there is no path that renders
    // it before the choice, rather than a convention that it must not be.
    setReveal(answerReveal({
      stats: statsByTopic.get(activeTopic.id),
      value,
      topicName: parseTensionTitle(activeTopic).name,
    }));

    if (isLoggedIn) {
      apiFetch('/compass/answers', {
        method: 'POST',
        body: JSON.stringify({ topic_id: activeTopic.id, value }),
      }).catch(() => {});
    }

    // Re-answered, so it no longer owes one: drop it from the set before
    // looking for the next topic, and the sidebar highlight clears with it.
    const stillOwed = new Set(mustReanswer);
    if (stillOwed.delete(activeTopic.id)) setMustReanswer(stillOwed);

    setTimeout(() => {
      setSelectedValue(null);
      const next = nextTopicFrom(allTopics, activeTopic.id, updatedAnswers, reviewMode, stillOwed);
      if (next) {
        setActiveTopic(next);
      } else if (reviewMode) {
        // End of a revision pass. Stay on the last topic — the compass was
        // already complete, so there is nothing to announce as finished.
      } else {
        // Completed. Stay exactly where we are and say so in a banner; the
        // sidebar is still live, so any answer can be reconsidered on the spot.
        // Dropping into review mode is what stops the next change from trying
        // to finish the run a second time.
        setJustCompleted(true);
        setReviewMode(true);
        localStorage.setItem("calibration_completed", "true");
        track('compass_calibration_completed', {
          answered_count: newAnsweredCount,
          total_topics: allTopics.length,
          surface: 'full',
        });
      }
    }, 420);
    // ⚠ statsByTopic IS LOAD-BEARING HERE. It arrives from its own fetch, well
    // after this callback is first memoised. Left out, the closure keeps the
    // empty Map it was built with and every lookup misses — no reveal, ever,
    // with nothing failing and nothing in the console to say why.
  }, [activeTopic, allTopics, answers, isLoggedIn, selectedValue, reviewMode, mustReanswer, statsByTopic]);

  const handleSkip = useCallback(() => {
    if (!activeTopic) return;
    track('compass_calibration_question_skipped', {
      topic_slug: activeTopic.short_title,
      answered_count: answeredCount,
      total_topics: allTopics.length,
      surface: 'full',
    });
    const next = nextTopicFrom(allTopics, activeTopic.id, answers, reviewMode, mustReanswer);
    if (next) setActiveTopic(next);
  }, [activeTopic, allTopics, answeredCount, answers, reviewMode]);

  const handleFlip = useCallback(() => {
    if (!activeTopic) return;
    setInvertedSpokes(prev => ({
      ...prev,
      [activeTopic.short_title]: !prev[activeTopic.short_title],
    }));
  }, [activeTopic, setInvertedSpokes]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!topicsLoaded) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: th.bg }}>
        <p className="text-sm" style={{ color: th.textMuted }}>Loading topics…</p>
      </div>
    );
  }

  // ── Derive active topic display ──────────────────────────────────────────
  // categories API returns lightweight topic objects (no stances); look up the
  // full topic from the topics array which includes the stances array.
  const fullActiveTopic = activeTopic ? (topics.find(t => t.id === activeTopic.id) ?? activeTopic) : null;
  const isFlipped = fullActiveTopic ? !!invertedSpokes[fullActiveTopic.short_title] : false;
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
                    surface: 'full',
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
                data-testid="calibration-progress"
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

          {/* Lens picker — pins a lens's questions to the top of the list.
              A view choice for this page only; it never touches activeLensKey,
              so browsing by lens cannot change the user's actual compass. */}
          {lensOptions.length > 0 && (
            <div
              className="px-3 py-2.5 border-b flex flex-wrap gap-1.5"
              style={{ borderColor: th.sidebarBdr }}
              data-testid="calibration-lens-picker"
            >
              <button
                onClick={() => setPinnedLensKey(null)}
                data-testid="calibration-lens-all"
                title="Show the whole library, unpinned"
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer"
                style={
                  pinnedLensKey === null
                    ? { background: th.textAccent, color: th.sidebar, borderColor: th.textAccent }
                    : { background: 'transparent', color: th.textMuted, borderColor: th.sidebarBdr }
                }
              >
                All topics
              </button>
              {lensOptions.map(l => {
                const pinned = pinnedLensKey === l.key;
                const color = getLensColor(l, isDark) ?? th.textAccent;
                // What the header count cannot say: "23%" is a number about our
                // question set. "Federal, 6 of 8" is a finishable thing.
                const prog = lensProgress({ lens: l, topics: allTopics, answers });
                // Only the UNPINNED chip needs adjusting: it paints the lens
                // colour as text and border straight onto the sidebar, where
                // the stored colours — chosen for a light background — fall
                // below the contrast floor on dark. The pinned chip uses the
                // colour as a background under getLensInk, so lightening it
                // there would cost contrast rather than gain it.
                const outline = readableOn(color, th.sidebar);
                return (
                  <button
                    key={l.key}
                    onClick={() => setPinnedLensKey(pinned ? null : l.key)}
                    data-testid={`calibration-lens-${l.key}`}
                    // The ring carries no text at 12px, so the fraction lives
                    // here — where it also reaches a screen reader, which the
                    // shape never could.
                    title={
                      (prog.total > 0 ? `${l.name} — ${prog.answered} of ${prog.total} answered. ` : `${l.name}. `) +
                      (pinned ? 'Pinned; click to unpin.' : 'Click to pin to the top.')
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer"
                    style={
                      pinned
                        ? { background: color, color: getLensInk(l, isDark), borderColor: color }
                        : { background: 'transparent', color: outline, borderColor: outline }
                    }
                  >
                    <LensIcon lensKey={l.key} className="w-3 h-3" />
                    {l.shortLabel || l.name}
                    {prog.total > 0 && (
                      <ProgressRing
                        pct={prog.pct}
                        complete={prog.complete}
                        // On the pinned chip the lens colour IS the background,
                        // so the ring has to be drawn in the ink instead or it
                        // vanishes into the fill it is sitting on.
                        color={pinned ? getLensInk(l, isDark) : outline}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Categories + topics, with the pinned lens group first */}
          {sidebarGroups.map((cat, catI) => {
            // The pinned group wears the lens's own colour, not the
            // recalibration violet — that violet means "this needs answering",
            // and a lens group is not that.
            const color = cat.pinned
              ? (getLensColor(pinnedLens, isDark) ?? th.textAccent)
              : CATEGORY_COLORS[catI % CATEGORY_COLORS.length];
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
                  <span className="flex items-center gap-1.5 min-w-0">
                    {/* The lens wears its own mark here too, so the pinned
                        group reads as the chip that produced it rather than as
                        one more category that happens to be first. */}
                    {cat.pinned && (
                      <span className="flex-none" style={{ color: readableOn(color, th.sidebar) }}>
                        <LensIcon lensKey={cat.lensKey} className="w-3 h-3" />
                      </span>
                    )}
                    <span
                      data-testid="sidebar-group-title"
                      className="text-[10px] font-bold uppercase tracking-wider truncate"
                      style={{ color: cat.pinned ? readableOn(color, th.sidebar) : th.textMuted }}
                    >
                      {cat.title}
                    </span>
                  </span>
                  <span
                    className="text-[10px] font-bold ml-2 flex-none tabular-nums"
                    style={{ color: catAnswered === cat.topics.length ? color : th.textMuted }}
                  >
                    {catAnswered}/{cat.topics.length}
                  </span>
                </div>

                {cat.topics.map(tp => {
                  // Owing a re-answer outranks having one: a reworded question
                  // still holds the user's old value, so a plain tick would say
                  // "done" about the very thing they came here to redo.
                  const owesReanswer = mustReanswer.has(tp.id);
                  const isAnswered = !owesReanswer && answers[tp.short_title] > 0;
                  const isActive   = activeTopic?.id === tp.id;
                  const { name }   = parseTensionTitle(tp);
                  // Editorial changed this question and said why. The note is a
                  // sibling control, not nested in the row button.
                  const flag = flagsByTopic.get(tp.id);
                  // And what the team has written about it, flagged or not.
                  //
                  // 🔴 ONLY ON A QUESTION THIS READER HAS ANSWERED. A flag
                  // carried that rule for free — it exists only against a
                  // stored answer — but a journal entry does not, so somebody
                  // building their first compass would meet the change history
                  // of a question they have not answered yet. `answers` is read
                  // rather than `isAnswered`: owing a re-answer does not mean
                  // they never answered, and the diary is exactly what that
                  // reader came for.
                  const hasThread = showsThread({
                    index: journalIndex,
                    topicId: tp.id,
                    answered: answers[tp.short_title] > 0,
                  });
                  return (
                    <div
                      key={tp.id}
                      ref={el => { itemRefs.current[(cat.pinned ? 'p:' : '') + tp.id] = el; }}
                      className="flex items-start"
                      style={{
                        background: isActive
                          ? th.activeItem
                          : owesReanswer ? RECALIBRATE_BG : 'transparent',
                        borderLeft: isActive
                          ? `3px solid ${color}`
                          : owesReanswer ? `3px solid ${RECALIBRATE_ACCENT}` : '3px solid transparent',
                      }}
                    >
                      <button
                        data-testid={owesReanswer ? `recalibrate-pending-${tp.id}` : undefined}
                        onClick={() => { setActiveTopic(tp); setSelectedValue(null); }}
                        className="flex-1 min-w-0 text-left flex items-start gap-2.5 px-3 py-2 text-xs leading-snug transition-colors duration-100 cursor-pointer"
                        style={{ color: isAnswered && !isActive ? th.textMuted : th.textBody }}
                      >
                        <span className="mt-0.5">
                          {isAnswered
                            ? <CheckIcon color={isActive ? color : th.checkColor} />
                            : <CircleIcon color={isActive ? color : owesReanswer ? RECALIBRATE_ACCENT : th.border} />
                          }
                        </span>
                        <span className={`${isAnswered && !isActive ? 'opacity-50' : ''} ${isActive || owesReanswer ? 'font-semibold' : ''}`}>
                          {name}
                        </span>
                      </button>
                      {(flag || hasThread) && (
                        <button
                          onClick={() => openNotes(tp.id)}
                          data-testid={`change-note-${tp.id}`}
                          aria-label={
                            flag ? `What changed about ${name}` : `Why ${name} is asked this way`
                          }
                          title={flag ? "What changed" : "What we've said about this question"}
                          className="flex-none mr-2 mt-2 w-4 h-4 rounded-full text-[10px] font-bold leading-none flex items-center justify-center transition-opacity hover:opacity-80 cursor-pointer"
                          style={
                            // 🔴 A THREAD IS NOT A WARNING. A flagged question
                            // is asking for something back and wears the solid
                            // violet; a question with only a diary behind it is
                            // an invitation to read, and borrows the row's own
                            // muted ink. Giving both the same mark would spend
                            // the flag's urgency on questions that need nothing.
                            flag
                              ? { background: RECALIBRATE_ACCENT, color: '#FFFFFF' }
                              : { border: `1px solid ${th.border}`, color: th.textMuted }
                          }
                        >
                          i
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </aside>

        {/* What editorial changed and why, and the diary for the question.
            Same component the compass uses, so the publicNote reads identically
            on both screens. "Answer it again" brings the question up here
            rather than navigating anywhere.

            ⚠ THE PANEL NO LONGER REQUIRES A FLAG. It used to open only on
            `flagsByTopic.has(...)`, which is the condition that made a note
            vanish the moment its question was answered. A topic reaches here
            with a flag, a thread, or both. */}
        {openFlagTopicId && (
          <QuestionNotes
            flag={flagsByTopic.get(openFlagTopicId)}
            entries={markAffected(
              threads.get(openFlagTopicId),
              flagsByTopic.get(openFlagTopicId)
            )}
            loadingEntries={loadingThread === openFlagTopicId}
            topicTitle={
              parseTensionTitle(
                allTopics.find(tp => tp.id === openFlagTopicId) ?? {}
              ).name
            }
            onClose={() => setOpenFlagTopicId(null)}
            onRecalibrate={() => {
              const tp = allTopics.find(t => t.id === openFlagTopicId);
              if (tp) {
                setMustReanswer(prev => new Set(prev).add(tp.id));
                setActiveTopic(tp);
                setSelectedValue(null);
              }
              setOpenFlagTopicId(null);
            }}
          />
        )}

        {showFlipExplainer && (
          <ExplainerPopover
            title="Why the options are in this order"
            testId="flip-explainer"
            onClose={() => setShowFlipExplainer(false)}
          >
            <p>
              The five options don't run the same way round for everyone. Which direction you
              get is worked out once, from your account and this question, so it stays put —
              it won't shuffle between visits or while you're reading.
            </p>
            <p>
              We do it because a list that always runs the same way teaches the eye where the
              safe answer lives, and people start picking a position instead of reading one.
              Varying the order breaks that habit without changing a single word.
            </p>
            <p>
              Flip turns this question around if you'd rather read it the other way. It changes
              nothing else: your answer means the same thing and lands in the same place on your
              compass either way.
            </p>
          </ExplainerPopover>
        )}

        {/* ── Question panel ── */}
        <main className="flex-1 overflow-y-auto">
          {activeTopic ? (
            <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

              {/* Finished the set. Said here rather than on a screen of its own
                  so the question you just answered, and every other one, stays
                  one click away. */}
              {justCompleted && (
                <div
                  data-testid="calibration-complete-banner"
                  className="mb-6 rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background: th.selBg, border: `1px solid ${th.selBorder}` }}
                >
                  <span className="text-lg leading-none mt-0.5 flex-none">🎯</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: th.textAccent }}>
                      Fully calibrated — all {totalCount} answered
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: th.textBody }}>
                      Your positions are saved. Keep refining any of them from the list, or move on.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-2">
                      <button
                        onClick={() => navigate('/results')}
                        className="text-xs font-semibold underline underline-offset-2 transition-opacity hover:opacity-70 cursor-pointer"
                        style={{ color: th.textAccent }}
                      >
                        View my compass
                      </button>
                      <button
                        onClick={() => navigate('/library')}
                        className="text-xs font-semibold underline underline-offset-2 transition-opacity hover:opacity-70 cursor-pointer"
                        style={{ color: th.textAccent }}
                      >
                        Go to Library
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setJustCompleted(false)}
                    aria-label="Dismiss"
                    className="flex-none text-sm leading-none px-1 transition-opacity hover:opacity-60 cursor-pointer"
                    style={{ color: th.textMuted }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* What the officials said about the question just answered.
                  Never about the one on screen — see `reveal`. */}
              {reveal && (
                <div
                  data-testid="answer-reveal"
                  className="mb-5 rounded-xl px-4 py-2.5 flex items-start gap-2.5"
                  style={{ background: th.selBg, border: `1px solid ${th.selBorder}` }}
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="flex-none mt-0.5">
                    <circle cx="7.5" cy="7.5" r="6.5" stroke={th.textAccent} strokeWidth="1.3" />
                    <path d="M7.5 6.8v4M7.5 4.4v.9" stroke={th.textAccent} strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-xs leading-relaxed flex-1" style={{ color: th.textBody }}>
                    {reveal.text}
                  </p>
                  <button
                    onClick={() => setReveal(null)}
                    aria-label="Dismiss"
                    className="flex-none text-xs leading-none px-1 transition-opacity hover:opacity-60 cursor-pointer"
                    style={{ color: th.textMuted }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Category + flip row */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: catColor + '22', color: catColor }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: catColor, display: 'inline-block' }} />
                    {catName}
                  </div>
                  {/* What changed this season, and what the team has said about
                      this question, where the person is actually looking. The
                      same panel the sidebar's dot opens — not a second copy,
                      only a second way in.

                      🔴 THE FIRST-TIMER GATE USED TO BE FREE AND IS NOT ANY
                      MORE. A flag exists only against a STORED answer given
                      under an earlier revision, so somebody building their
                      first compass never had one and this never rendered for
                      them. A journal entry exists whether or not they have
                      answered, so `activeThread` carries the rule explicitly:
                      change history reaches a person the first time they come
                      back to a question they have answered, which is the only
                      point at which it means anything. */}
                  {(activeFlag || activeThread) && (
                    <button
                      onClick={() => openNotes(activeTopic.id)}
                      data-testid="question-change-note"
                      aria-label={
                        activeFlag
                          ? "What changed about this question"
                          : "What we've said about this question"
                      }
                      className="flex-none inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-opacity hover:opacity-80 cursor-pointer"
                      style={
                        activeFlag
                          ? { background: RECALIBRATE_BG, color: RECALIBRATE_ACCENT }
                          : { background: th.flipBtn, color: th.textBody }
                      }
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full text-[9px] leading-none flex items-center justify-center"
                        style={
                          activeFlag
                            ? { background: RECALIBRATE_ACCENT, color: '#FFFFFF' }
                            : { border: `1px solid ${th.textMuted}`, color: th.textMuted }
                        }
                      >
                        i
                      </span>
                      {activeFlag ? "What changed" : "Why we ask this"}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
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
                {/* "Flip stance order" says what the button does to the list and
                    nothing about why a list that varies between people is a
                    feature. Without that, a voter who notices the order differs
                    from a friend's has been given a reason to distrust the
                    instrument — over the one design choice most meant to earn
                    their trust. */}
                <button
                  onClick={() => setShowFlipExplainer(true)}
                  data-testid="flip-explainer-open"
                  aria-label="Why does the order change?"
                  title="Why does the order change?"
                  className="w-5 h-5 rounded-full text-[10px] font-bold leading-none flex items-center justify-center transition-opacity hover:opacity-70 cursor-pointer"
                  style={{ background: th.flipBtn, color: th.textMuted }}
                >
                  i
                </button>
                </div>
              </div>

              {/* Question */}
              <div className="mb-7">
                <h2
                  className="text-xl sm:text-2xl font-bold leading-snug"
                  style={{ color: th.textHead }}
                >
                  {qText || topicName}
                </h2>
                {/* 🔴 WHAT THIS SLOT USED TO HOLD. `parseTensionTitle` splits a
                    title on a colon — and not one of the sixty promoted titles
                    contains one, so `poles` is null on every question and this
                    line rendered the short_title: the heading, again, in grey.
                    Sixty questions, sixty slots, no information.

                    `guidance` (CC_0231) is editorial's line on what the
                    question asks you to tell apart. It names the axis and never
                    a point on it, because it sits directly above five options
                    somebody is about to choose between. The old line is kept
                    underneath for any topic that does carry real poles. */}
                {activeTopic.guidance && (
                  <p
                    data-testid="topic-guidance"
                    className="mt-2 text-sm leading-relaxed border-l-2 pl-3"
                    style={{ color: th.textBody, borderColor: catColor }}
                  >
                    {activeTopic.guidance}
                  </p>
                )}
                {/* The line as it was, for a topic with no guidance yet — an
                    older server, or a question added after the seed. Not shown
                    alongside guidance, where it would be the heading repeated
                    under a sentence that already orients you. */}
                {!activeTopic.guidance && qText && (topicName || poles) && (
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
                      data-testid="stance-option"
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
