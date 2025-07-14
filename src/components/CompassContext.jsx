// CompassContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

function safeParse(str, fallback) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

const CompassContext = createContext();

export function CompassProvider({ children }) {
  const [topics, setTopics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catLoaded, setCatLoaded] = useState(false);
  const [showPrevAnswers, setShowPrevAnswers] = useState();
  const [selectedTopics, setSelected] = useState(
    () => safeParse(localStorage.getItem("selectedTopics"), []) // <- load once
  );
  const [answers, setAnswers] = useState({});
  const [compareAnswers, setCompareAnswers] = useState({});

  const refreshData = async () => {
    const [topicsRes, catsRes] = await Promise.all([
      fetch(`${import.meta.env.VITE_API_URL}/compass/topics`, {
        credentials: "include",
      }).then((r) => r.json()),
      fetch(`${import.meta.env.VITE_API_URL}/compass/categories`, {
        credentials: "include",
      }).then((r) => r.json()),
    ]);
    setTopics(topicsRes);
    setCategories(catsRes);
  };

  useEffect(() => {
    refreshData().then(() => setCatLoaded(true));
  }, []);

  useEffect(() => {
    localStorage.setItem("selectedTopics", JSON.stringify(selectedTopics));
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
        compareAnswers,
        setCompareAnswers,
        showPrevAnswers,
        setShowPrevAnswers,
        refreshData,
        catLoaded,
      }}
    >
      {children}
    </CompassContext.Provider>
  );
}

export const useCompass = () => useContext(CompassContext);
