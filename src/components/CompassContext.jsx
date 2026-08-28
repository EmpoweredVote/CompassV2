// CompassContext.jsx
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { extractHashToken, getToken, setToken, apiFetch, publicFetch, clearToken, API_BASE } from '../lib/auth';
import { evContext } from '@empoweredvote/ev-ui';
import { isLensTopicSet, LENSES, normalizeApiLens } from '../lib/lenses';

function safeParse(str, fallback) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

function getOrCreateGuestId() {
  let id = localStorage.getItem("guestId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("guestId", id);
  }
  return id;
}

// Identity-preserving comparisons. The subscribe callback uses these to skip
// state updates that would change nothing: a fresh object from the broker still
// has a new identity, which re-runs the write effect and re-publishes — so a
// no-op update bounces back and forth between tabs and can resurrect state
// another tab just cleared.
function sameObject(a, b) {
  if (a === b) return true;
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every((k) => a[k] === b[k]);
}

function sameArray(a, b) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function shouldFlip(guestId, topicId) {
  let hash = 0;
  const str = guestId + String(topicId);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash * 31) + str.charCodeAt(i)) >>> 0;
  }
  return (hash & 1) === 1;
}

// Upper bound on answers published to the shared broker slice: the user's 8
// compass topics plus, when a lens overlay is active, that lens's 8. The cap
// exists because payload size was blamed for a TDZ crash in ev-ui; see
// smoke/README.md for what is and is not established about that.
const MAX_SHARED_ANSWERS = 16;

const CompassContext = createContext();

export function CompassProvider({ children }) {
  const [topics, setTopics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catLoaded, setCatLoaded] = useState(false);
  const [topicsLoaded, setTopicsLoaded] = useState(false);
  const [topicsError, setTopicsError] = useState(false);
  const [showPrevAnswers, setShowPrevAnswers] = useState();
  const [selectedTopics, setSelected] = useState(
    () => safeParse(localStorage.getItem("selectedTopics"), [])
  );
  // Compass lenses — live source of truth is GET /compass/lenses; constants are
  // the offline fallback until the fetch resolves.
  const [lenses, setLenses] = useState(LENSES);
  const [answers, setAnswers] = useState(
    () => safeParse(localStorage.getItem("answers"), {})
  );
  const [writeIns, setWriteIns] = useState(
    () => safeParse(localStorage.getItem("writeIns"), {})
  );
  const [compareAnswers, setCompareAnswers] = useState({});
  const [invertedSpokes, setInvertedSpokesRaw] = useState(
    () => safeParse(localStorage.getItem("invertedSpokes"), {})
  );

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState(null);
  const [userId, setUserId] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  // Incremented by Restore Stances and Reset Compass to force CombinedPage to
  // remount and re-initialize its local calibration state from localStorage.
  const [compassVersion, setCompassVersion] = useState(0);

  // Timestamp of the last explicit "clear my compass" this browser performed.
  //
  // The published payload cannot express a reset on its own: `a` only carries
  // the topics on the compass (8 max, deliberately — a radar chart with 44 axes
  // is unreadable), so an empty payload is indistinguishable from a tab that
  // simply has not hydrated yet. Special-casing `s: []` + `a: {}` as "clear"
  // would let a freshly-loaded tab wipe a populated one.
  //
  // An explicit timestamp removes the ambiguity. Only a real reset sets it, so
  // a tab that has never cleared can never wipe another. Consumers that do not
  // know the field simply ignore it.
  const [clearedAt, setClearedAt] = useState(
    () => Number(localStorage.getItem("compassClearedAt")) || 0
  );
  useEffect(() => {
    if (clearedAt > 0) localStorage.setItem("compassClearedAt", String(clearedAt));
  }, [clearedAt]);

  // Persistence lives in the effect below, not here — see the note on that
  // effect for why writing inside the updater was a bug.
  const setInvertedSpokes = useCallback((updater) => {
    setInvertedSpokesRaw((prev) =>
      typeof updater === "function" ? updater(prev) : updater
    );
  }, []);

  // Clear this compass and tell every other tab/subdomain to do the same.
  // Use this instead of clearing the slices by hand: without the timestamp the
  // reset stays local and other tabs push their copy straight back.
  const clearCompassEverywhere = useCallback(() => {
    setAnswers({});
    setWriteIns({});
    setInvertedSpokesRaw({});
    setSelected([]);
    setClearedAt(Date.now());
  }, []);

  // Deterministically invert ~50% of given topics using guestId + topicId hash.
  // Always recomputes for the given topics (shouldFlip is deterministic, so same
  // user+topic always produces the same result). Explicitly clears topics that
  // should NOT be flipped, preventing stale inversion state from prior sessions.
  const initRandomInversions = useCallback((topicsArray) => {
    setInvertedSpokesRaw((prev) => {
      const guestId = getOrCreateGuestId();
      const next = { ...prev };
      for (const topic of topicsArray) {
        if (shouldFlip(guestId, topic.id)) {
          next[topic.short_title] = true;
        } else {
          delete next[topic.short_title];
        }
      }
      return next;
    });
  }, []);

  // Persist answers to localStorage on every change
  useEffect(() => {
    localStorage.setItem("answers", JSON.stringify(answers));
  }, [answers]);

  // Persist invertedSpokes the same way. This used to live inside the two
  // setter wrappers, which meant the two paths that call setInvertedSpokesRaw
  // directly — the cross-tab subscribe and the authed SWR hydrate — updated
  // React state but never localStorage. A spoke orientation arriving from
  // another tab or subdomain silently reverted on the next reload.
  useEffect(() => {
    localStorage.setItem("invertedSpokes", JSON.stringify(invertedSpokes));
  }, [invertedSpokes]);

  // Cache of the full ev-context object so writes don't need a prior get().
  // Seeded on mount, kept fresh by the subscribe callback below.
  // This lets the write effect call evContext.set() directly (one postMessage
  // round-trip) instead of get().then(set()) (two), which is critical because
  // the user may navigate away before a two-step async chain completes.
  const evContextCacheRef = useRef({});

  // Serialized copy of the last `compass` payload this tab published to the
  // broker. The broker echoes our own writes back to us, so the subscribe
  // callback uses this to tell "our echo" from "a real remote change".
  const publishedRef = useRef(null);

  // Preload the broker iframe immediately so it's ready before any write.
  useEffect(() => {
    evContext.preload();
    evContext.get().then((v) => { evContextCacheRef.current = v || {}; }).catch(() => {});
  }, []);

  // Cross-subdomain shared state: write compass to ev-context broker
  // so essentials/readrank/etc. on other subdomains see the same data.
  // Wait until auth is resolved (authChecking=false) before writing —
  // otherwise stale localStorage state gets written while isLoggedIn is
  // still false but the user is actually logged in.
  //
  // Two paths:
  // - Guest: write top-level `compass` slice. Uses the cached ev-context value
  //   (evContextCacheRef) so we only need one postMessage round-trip instead of
  //   two — this prevents the write from being abandoned if the user navigates
  //   away quickly after a change (e.g., removing a spoke then going to essentials).
  // - Authed (260426-mc5): mirror into the userId-stamped `authed.compass`
  //   slice. API remains source of truth; this is the SWR cache. Excludes
  //   `s` (selectedTopics) per D-01 — only answers/writeIns/invertedSpokes.
  useEffect(() => {
    if (authChecking) return;
    // A lens is a local VIEW overlay, not the user's compass. While one is
    // active, `selectedTopics` holds the lens's topics — and publishing those as
    // `s` tells every other app that the lens IS the user's compass. Essentials
    // then draws the lens in its "custom" mode, the mode that means "my compass".
    //
    // Compass already refuses to persist a lens as selected_topic_ids on the
    // server (see the sync effect below); this applies the same rule one layer
    // out. Other apps keep their own lens selection and do not want ours.
    const lensActive = isLensTopicSet(selectedTopics, lenses);
    const preLensTopics = lensActive
      ? safeParse(localStorage.getItem("preLensTopics"), null)
      : null;
    const ownCompass = Array.isArray(preLensTopics) && preLensTopics.length > 0
      ? preLensTopics
      : selectedTopics;

    // Answers cover the user's compass AND any active lens, so a lens the user
    // just calibrated here still renders in another app that chose that lens
    // independently. Still capped — this is a projection, not the full answer
    // set — but the scope is now "what a consumer could plausibly draw".
    const answerScope = lensActive
      ? [...new Set([...ownCompass, ...selectedTopics])]
      : selectedTopics;
    const activeIds = new Set(answerScope.slice(0, MAX_SHARED_ANSWERS));
    const topicById = new Map(topics.map((t) => [t.id, t]));
    const evAnswers = activeIds.size > 0 && topics.length > 0
      ? Object.fromEntries(
          [...activeIds]
            .map((id) => {
              const t = topicById.get(id);
              return (t && answers[t.short_title] != null)
                ? [t.short_title, answers[t.short_title]]
                : null;
            })
            .filter(Boolean)
        )
      : answers;
    if (isLoggedIn) {
      if (!userId) return;
      evContext.setAuthedSlice(userId, {
        compass: { a: evAnswers, i: invertedSpokes, w: writeIns },
      }).catch(() => {});
      return;
    }
    const compass = {
      a: evAnswers, s: ownCompass, i: invertedSpokes, w: writeIns,
      ...(clearedAt > 0 ? { clearedAt } : {}),
    };
    // Remember the exact payload we published so the subscribe callback can
    // recognise our own echo. Comparing the echo against local state instead
    // would fail whenever `a` is capped (i.e. the user has answers outside the
    // 8 selected topics — every answer given on /calibrate), and the capped
    // copy would then overwrite the fuller local answers.
    publishedRef.current = JSON.stringify(compass);
    const next = { ...evContextCacheRef.current, compass };
    evContextCacheRef.current = next;
    evContext.set(next).catch(() => {});
  }, [authChecking, isLoggedIn, userId, answers, selectedTopics, invertedSpokes, writeIns, topics, clearedAt, lenses]);

  // Authed SWR hydrate (260426-mc5): when we learn the userId, read the
  // authed slice and seed local state. The /compass/answers fetch elsewhere
  // will still run and replace this silently. Idempotent React state updates
  // make a stale cache hit safe — API always wins on conflict.
  const authedHydratedRef = useRef(false);
  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    if (authedHydratedRef.current) return;
    authedHydratedRef.current = true;
    evContext.getAuthedSlice(userId).then((slice) => {
      const c = slice && slice.compass;
      if (!c || typeof c !== 'object') return;
      // Only hydrate from cache when local state is empty — if localStorage already
      // has answers (e.g. after a Restore Stances flow), the cache may be stale
      // (the pre-reload setAuthedSlice write races with the reload and often loses).
      // The write effect will push the correct local data to ev-context momentarily.
      if (c.a && typeof c.a === 'object' && Object.keys(answersRef.current).length === 0) setAnswers(c.a);
      if (c.i && typeof c.i === 'object' && Object.keys(invertedSpokesRef.current).length === 0) setInvertedSpokesRaw(c.i);
      if (c.w && typeof c.w === 'object' && Object.keys(writeInsRef.current).length === 0) setWriteIns(c.w);
    }).catch(() => {});
  }, [isLoggedIn, userId]);

  // API answer hydration: fetch /compass/answers from the server once we know
  // both the user is logged in AND topics have loaded (needed to map topic_id
  // back to short_title). Runs once per session.
  //
  // Server answers FILL GAPS: a topic already answered locally keeps its local
  // value (it is either already synced or a newer edit, and replacing it would
  // flash), while every topic the local state does not have is taken from the
  // server. This is strictly additive, so it cannot lose an answer.
  //
  // It used to skip the fetch entirely whenever localStorage held any answer at
  // all. That broke the main onboarding path: calibrate as a guest, then sign
  // in. A returning user on a new device or browser who answered even one
  // question before signing in never loaded their real compass and was shown a
  // plausible but wrong one, with nothing to indicate anything was missing.
  const apiAnswersHydratedRef = useRef(false);
  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    if (topics.length === 0) return;
    if (apiAnswersHydratedRef.current) return;
    apiAnswersHydratedRef.current = true;

    apiFetch('/compass/answers').then(async (res) => {
      if (!res || !res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;

      const topicById = new Map(topics.map((t) => [t.id, t]));
      const hydratedAnswers = {};
      const hydratedWriteIns = {};

      for (const row of data) {
        const topic = topicById.get(row.topic_id);
        if (!topic) continue;
        if (row.value != null) hydratedAnswers[topic.short_title] = row.value;
        if (row.write_in_text) hydratedWriteIns[topic.short_title] = row.write_in_text;
      }

      // Apply as a gap-fill against whatever local state holds right now —
      // including anything another effect populated while the fetch was in
      // flight. Local values win; the server supplies the rest.
      const fillGaps = (prev, incoming) => {
        const next = { ...incoming, ...prev };
        return sameObject(prev, next) ? prev : next;
      };
      if (Object.keys(hydratedAnswers).length > 0) {
        setAnswers((prev) => fillGaps(prev, hydratedAnswers));
      }
      if (Object.keys(hydratedWriteIns).length > 0) {
        setWriteIns((prev) => fillGaps(prev, hydratedWriteIns));
      }
    }).catch(() => {});
  }, [isLoggedIn, userId, topics]);

  // Cross-subdomain live receive: when another tab/subdomain updates the
  // shared compass (e.g. user calibrated on essentials), apply it locally
  // so this tab stays in sync without a refresh. Guest only.
  // Guard on !authChecking: during the auth-check window isLoggedIn=false even
  // for logged-in users, so without this guard the subscription fires with stale
  // guest cache data and corrupts selectedTopics before auth resolves.
  useEffect(() => {
    if (isLoggedIn || authChecking) return;
    const unsub = evContext.subscribe((shared) => {
      // Keep the full-state cache up to date so writes can use it without a get().
      if (shared && typeof shared === 'object') evContextCacheRef.current = shared;
      const c = shared && shared.compass;
      if (!c || typeof c !== 'object') return;
      // Skip echo of our own writes. The broker re-broadcasts every set() back
      // to the tab that made it, so compare against the payload we published —
      // NOT against local state. `a` is capped to the 8 selected topics, so a
      // local comparison never matches once the user has answers beyond those
      // 8, and we'd treat our own echo as a remote change.
      // An explicit reset elsewhere wins outright, and only a real reset can
      // send this — an unhydrated tab publishes no clearedAt at all, so it can
      // never wipe a populated one. Handled before the echo checks because a
      // clear is not a content diff.
      const incomingCleared = Number(c.clearedAt) || 0;
      if (incomingCleared > clearedAtRef.current) {
        setClearedAt(incomingCleared);
        setAnswers({});
        setWriteIns({});
        setInvertedSpokesRaw({});
        setSelected([]);
        return;
      }

      const incoming = JSON.stringify({ a: c.a, s: c.s, i: c.i, w: c.w });
      if (incoming === publishedRef.current) return;
      // Use refs so this always reflects current values without re-registering.
      const local = JSON.stringify({ a: answersRef.current, s: selectedTopicsRef.current, i: invertedSpokesRef.current, w: writeInsRef.current });
      if (incoming === local) return;
      // `a` carries only the topics in the sender's compass (`s`, capped at 8),
      // so it is a partial view. Treat it as authoritative for the topics it
      // declares and leave every other answer untouched: a plain replace deletes
      // answers the sender never had (#65), while a plain merge can never remove
      // one, so a stance cleared on another subdomain would come straight back.
      if (c.a && typeof c.a === 'object') {
        const scope = new Set(
          (Array.isArray(c.s) ? c.s : [])
            .map((id) => topicsRef.current.find((t) => t.id === id)?.short_title)
            .filter(Boolean)
        );
        setAnswers((prev) => {
          const next = {};
          for (const [key, value] of Object.entries(prev)) {
            if (!scope.has(key)) next[key] = value;
          }
          Object.assign(next, c.a);
          return sameObject(prev, next) ? prev : next;
        });
      }
      // Each of these keeps the previous value when nothing actually changed —
      // a new-but-equal object would re-run the write effect and re-publish.
      if (Array.isArray(c.s)) setSelected((prev) => (sameArray(prev, c.s) ? prev : c.s));
      if (c.i && typeof c.i === 'object') {
        setInvertedSpokesRaw((prev) => (sameObject(prev, c.i) ? prev : c.i));
      }
      if (c.w && typeof c.w === 'object') {
        setWriteIns((prev) => (sameObject(prev, c.w) ? prev : c.w));
      }
    });
    return unsub;
  }, [isLoggedIn, authChecking]);

  // Persist writeIns to localStorage on every change
  useEffect(() => {
    localStorage.setItem("writeIns", JSON.stringify(writeIns));
  }, [writeIns]);

  // Check auth state on mount — extract hash token first, try SSO cookie if no
  // local token, then verify with /account/me. Uses publicFetch so a stale/expired
  // token silently clears and falls back to guest mode instead of redirecting.
  // authChecking stays true until ALL code paths (token-present, SSO success,
  // SSO failure) reach the finally block — prevents flash of "Sign in" UI.
  useEffect(() => {
    (async () => {
      try {
        extractHashToken();

        // SSO check — only when no local token exists
        if (!getToken()) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${API_BASE}/auth/session`, {
              credentials: 'include',
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (res.ok) {
              const data = await res.json();
              if (data.access_token) setToken(data.access_token);
            }
          } catch {
            // Silent fallback — no cookie or network error
          }
        }

        // Auth check (runs after potential SSO token injection)
        if (getToken()) {
          const r = await publicFetch('/account/me');
          if (r.status === 401) {
            clearToken();
          } else if (r.ok) {
            const data = await r.json();
            setIsLoggedIn(true);
            setIsAdmin(!!data.is_admin);
            setUsername(data.display_name || null);
            // Capture userId for authed ev-context slice (260426-mc5).
            // /account/me returns the user's id at top level.
            if (data.id) setUserId(data.id);
            // Seed help_seen from DB: if user completed onboarding, don't show /help again
            if (data.completed_onboarding) {
              localStorage.setItem("help_seen", "true");
            }
          }
        }
      } catch {
        // Silent — degrade to guest
      } finally {
        setAuthChecking(false);
      }
    })();
  }, []);

  // Refs for current state — used by the subscribe echo-suppression guard
  // so the callback always compares against the latest values without
  // needing to re-register the subscription on every state change.
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const selectedTopicsRef = useRef(selectedTopics);
  selectedTopicsRef.current = selectedTopics;
  const invertedSpokesRef = useRef(invertedSpokes);
  invertedSpokesRef.current = invertedSpokes;
  const writeInsRef = useRef(writeIns);
  writeInsRef.current = writeIns;
  // The subscribe callback is registered once, so it needs a ref to map the
  // sender's topic ids to short_titles against the current topic list.
  const topicsRef = useRef(topics);
  topicsRef.current = topics;
  const clearedAtRef = useRef(clearedAt);
  clearedAtRef.current = clearedAt;

  // Track whether we've loaded server-side selectedTopics
  const serverLoaded = useRef(false);

  const refreshData = async () => {
    try {
      const okJson = async (path) => {
        const r = await publicFetch(path);
        // Without the status check a JSON error body (`{"error": ...}`) parses
        // fine and lands in state as a non-array, so `topics.map` throws later
        // with no hint of where the bad value came from.
        if (!r.ok) throw new Error(`${path} responded ${r.status}`);
        const body = await r.json();
        if (!Array.isArray(body)) throw new Error(`${path} did not return an array`);
        return body;
      };
      const [topicsRes, catsRes] = await Promise.all([
        okJson('/compass/topics'),
        okJson('/compass/categories'),
      ]);
      setTopics(topicsRes);
      setCategories(catsRes);
      setTopicsLoaded(true);
      // Lenses are non-critical — hydrate from the API but never block topics on them.
      publicFetch('/compass/lenses')
        .then((r) => r.json())
        .then((rows) => {
          if (Array.isArray(rows) && rows.length > 0) setLenses(rows.map(normalizeApiLens));
        })
        .catch(() => { /* keep fallback constants */ });
    } catch {
      // Server unreachable — signal error to consumers
      setTopicsError(true);
    }
  };

  const retryLoadTopics = () => {
    setTopicsError(false);
    refreshData();
  };

  // Fetch selected topics from server (called after login, not on mount for guests)
  const refreshSelectedTopics = async () => {
    if (!getToken()) {
      serverLoaded.current = true;
      return;
    }
    try {
      const res = await apiFetch('/compass/selected-topics');
      if (res && res.ok) {
        const ids = await res.json();
        if (Array.isArray(ids) && ids.length > 0) {
          const capped = ids.slice(0, 8);
          setSelected(capped);
          localStorage.setItem("selectedTopics", JSON.stringify(capped));
        }
      }
    } catch {
      // Offline or token expired — keep localStorage value
    }
    serverLoaded.current = true;
  };

  // On mount: fetch topics/categories; only restore selectedTopics from server if logged in
  useEffect(() => {
    const init = async () => {
      await refreshData();
      setCatLoaded(true);
      await refreshSelectedTopics();
    };
    init().catch(() => {});
  }, []);

  // Filter out stale topic IDs (admin-deleted topics) from selectedTopics
  useEffect(() => {
    if (topics.length === 0) return;
    setSelected((prev) => {
      const validIds = new Set(topics.map((t) => t.id));
      const filtered = prev.filter((id) => validIds.has(id));
      if (filtered.length !== prev.length) {
        // Some topics were removed — update localStorage
        localStorage.setItem("selectedTopics", JSON.stringify(filtered));
        // If count drops below 3, re-trigger calibration
        if (filtered.length < 3) {
          localStorage.removeItem("calibration_completed");
        }
        return filtered;
      }
      return prev;
    });
  }, [topics]);

  // Sync selectedTopics to localStorage + server when it changes
  const syncTimer = useRef(null);
  useEffect(() => {
    localStorage.setItem("selectedTopics", JSON.stringify(selectedTopics));

    // Don't sync back to server until we've loaded from it first
    if (!serverLoaded.current) return;

    // Don't sync to server for guests
    if (!isLoggedIn) return;

    // A lens (Local/Judicial) is a VIEW overlay, not the user's chosen compass.
    // Never persist a lens set as selected_topic_ids — doing so clobbers the user's
    // real compass on the server and makes consumers (e.g. essentials) unable to
    // distinguish "my compass" from "the lens". The lens still renders locally; we
    // just leave the server's saved compass untouched while it's active.
    if (isLensTopicSet(selectedTopics, lenses)) return;

    // Debounce server sync to avoid rapid calls during topic toggling
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      apiFetch('/compass/selected-topics', {
        method: "PUT",
        body: JSON.stringify({ topic_ids: selectedTopics }),
      }).catch(() => {});
    }, 500);
  }, [selectedTopics, isLoggedIn, lenses]);

  // Cross-app logout sync — detect ev_session cookie cleared by another app
  useEffect(() => {
    if (!isLoggedIn) return;

    const SESSION_URL = `${API_BASE}/auth/session`;

    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(SESSION_URL, { credentials: 'include' });
        if (res.status === 401) {
          clearToken();
          setIsLoggedIn(false);
          setUsername(null);
        }
      } catch {
        // Network error — don't log out
      }
    };

    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [isLoggedIn]);

  return (
    <CompassContext.Provider
      value={{
        topics,
        setTopics,
        categories,
        setCategories,
        selectedTopics,
        setSelectedTopics: setSelected,
        lenses,
        answers,
        setAnswers,
        writeIns,
        setWriteIns,
        compareAnswers,
        setCompareAnswers,
        invertedSpokes,
        setInvertedSpokes,
        initRandomInversions,
        clearCompassEverywhere,
        showPrevAnswers,
        setShowPrevAnswers,
        refreshData,
        refreshSelectedTopics,
        catLoaded,
        topicsLoaded,
        topicsError,
        retryLoadTopics,
        isLoggedIn,
        setIsLoggedIn,
        isAdmin,
        username,
        setUsername,
        userId,
        setUserId,
        authChecking,
        compassVersion,
        setCompassVersion,
      }}
    >
      {children}
    </CompassContext.Provider>
  );
}

export const useCompass = () => useContext(CompassContext);

/**
 * Serialize current guest compass state into a URL fragment string.
 * Returns "#compass=BASE64" or "" if no answers exist.
 */
export function serializeCompassFragment() {
  try {
    const answers = JSON.parse(localStorage.getItem("answers") || "{}");
    const selectedTopics = JSON.parse(localStorage.getItem("selectedTopics") || "[]");
    const invertedSpokes = JSON.parse(localStorage.getItem("invertedSpokes") || "{}");
    if (Object.keys(answers).length === 0) return "";
    const payload = { a: answers, s: selectedTopics, i: invertedSpokes };
    return "#compass=" + btoa(JSON.stringify(payload));
  } catch {
    return "";
  }
}
