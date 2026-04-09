// CompassContext.jsx
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { extractHashToken, getToken, setToken, apiFetch, publicFetch, clearToken, API_BASE } from '../lib/auth';

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

function shouldFlip(guestId, topicId) {
  let hash = 0;
  const str = guestId + String(topicId);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash * 31) + str.charCodeAt(i)) >>> 0;
  }
  return (hash & 1) === 1;
}

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
  const [username, setUsername] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const setInvertedSpokes = useCallback((updater) => {
    setInvertedSpokesRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      localStorage.setItem("invertedSpokes", JSON.stringify(next));
      return next;
    });
  }, []);

  // Deterministically invert ~50% of given topics using guestId + topicId hash
  // (only if none of them are already inverted — guard prevents re-randomizing)
  const initRandomInversions = useCallback((topicsArray) => {
    setInvertedSpokesRaw((prev) => {
      const hasExisting = topicsArray.some((t) => t.short_title in prev);
      if (hasExisting) return prev;
      const guestId = getOrCreateGuestId();
      const next = { ...prev };
      for (const topic of topicsArray) {
        if (shouldFlip(guestId, topic.id)) {
          next[topic.short_title] = true;
        }
      }
      localStorage.setItem("invertedSpokes", JSON.stringify(next));
      return next;
    });
  }, []);

  // Persist answers to localStorage on every change
  useEffect(() => {
    localStorage.setItem("answers", JSON.stringify(answers));
  }, [answers]);

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
            setUsername(data.display_name || null);
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

  // Track whether we've loaded server-side selectedTopics
  const serverLoaded = useRef(false);

  const refreshData = async () => {
    try {
      const [topicsRes, catsRes] = await Promise.all([
        publicFetch('/compass/topics').then((r) => r.json()),
        publicFetch('/compass/categories').then((r) => r.json()),
      ]);
      setTopics(topicsRes);
      setCategories(catsRes);
      setTopicsLoaded(true);
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
          setSelected(ids);
          localStorage.setItem("selectedTopics", JSON.stringify(ids));
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

    // Debounce server sync to avoid rapid calls during topic toggling
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      apiFetch('/compass/selected-topics', {
        method: "PUT",
        body: JSON.stringify({ topic_ids: selectedTopics }),
      }).catch(() => {});
    }, 500);
  }, [selectedTopics, isLoggedIn]);

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
        answers,
        setAnswers,
        writeIns,
        setWriteIns,
        compareAnswers,
        setCompareAnswers,
        invertedSpokes,
        setInvertedSpokes,
        initRandomInversions,
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
        username,
        setUsername,
        authChecking,
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
