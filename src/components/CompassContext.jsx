// CompassContext.jsx
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

function safeParse(str, fallback) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

const API = import.meta.env.VITE_API_URL;
const CompassContext = createContext();

export function CompassProvider({ children }) {
  const [topics, setTopics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catLoaded, setCatLoaded] = useState(false);
  const [showPrevAnswers, setShowPrevAnswers] = useState();
  const [selectedTopics, setSelected] = useState(
    () => safeParse(localStorage.getItem("selectedTopics"), [])
  );
  const [answers, setAnswers] = useState({});
  const [writeIns, setWriteIns] = useState({});
  const [compareAnswers, setCompareAnswers] = useState({});
  const [invertedSpokes, setInvertedSpokesRaw] = useState(
    () => safeParse(localStorage.getItem("invertedSpokes"), {})
  );

  const setInvertedSpokes = useCallback((updater) => {
    setInvertedSpokesRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      localStorage.setItem("invertedSpokes", JSON.stringify(next));
      return next;
    });
  }, []);

  // Randomly invert ~50% of given topics (only if none of them are already inverted)
  const initRandomInversions = useCallback((shortTitles) => {
    setInvertedSpokesRaw((prev) => {
      const hasExisting = shortTitles.some((st) => st in prev);
      if (hasExisting) return prev;
      const next = { ...prev };
      for (const st of shortTitles) {
        if (Math.random() < 0.5) {
          next[st] = true;
        }
      }
      localStorage.setItem("invertedSpokes", JSON.stringify(next));
      return next;
    });
  }, []);

  // Track whether we've loaded server-side selectedTopics
  const serverLoaded = useRef(false);

  const refreshData = async () => {
    try {
      const [topicsRes, catsRes] = await Promise.all([
        fetch(`${API}/compass/topics`, {
          credentials: "include",
        }).then((r) => r.json()),
        fetch(`${API}/compass/categories`, {
          credentials: "include",
        }).then((r) => r.json()),
      ]);
      setTopics(topicsRes);
      setCategories(catsRes);
    } catch {
      // Server unreachable — state stays at defaults
    }
  };

  // Fetch selected topics from server (called on mount + after login)
  const refreshSelectedTopics = async () => {
    try {
      const res = await fetch(`${API}/compass/selected-topics`, {
        credentials: "include",
      });
      if (res.ok) {
        const ids = await res.json();
        if (Array.isArray(ids) && ids.length > 0) {
          setSelected(ids);
          localStorage.setItem("selectedTopics", JSON.stringify(ids));
        }
      }
    } catch {
      // Offline or not logged in — keep localStorage value
    }
    serverLoaded.current = true;
  };

  // On mount: fetch topics/categories AND restore selectedTopics from server
  useEffect(() => {
    const init = async () => {
      await refreshData();
      setCatLoaded(true);
      await refreshSelectedTopics();
    };
    init().catch(() => {});
  }, []);

  // Sync selectedTopics to localStorage + server when it changes
  const syncTimer = useRef(null);
  useEffect(() => {
    localStorage.setItem("selectedTopics", JSON.stringify(selectedTopics));

    // Don't sync back to server until we've loaded from it first
    if (!serverLoaded.current) return;

    // Debounce server sync to avoid rapid calls during topic toggling
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      fetch(`${API}/compass/selected-topics`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic_ids: selectedTopics }),
      }).catch(() => {});
    }, 500);
  }, [selectedTopics]);

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
      }}
    >
      {children}
    </CompassContext.Provider>
  );
}

export const useCompass = () => useContext(CompassContext);
