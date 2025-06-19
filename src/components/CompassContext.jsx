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
  const [selectedTopics, setSelected] = useState(
    () => safeParse(localStorage.getItem("selectedTopics"), []) // <- load once
  );
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5050/compass/topics", { credentials: "include" })
      .then((r) => r.json())
      .then(setTopics);
  }, []);

  useEffect(() => {
    localStorage.setItem("selectedTopics", JSON.stringify(selectedTopics));
  }, [selectedTopics]);

  return (
    <CompassContext.Provider
      value={{
        topics,
        setTopics,
        selectedTopics,
        setSelectedTopics: setSelected,
        categories,
        setCategories,
      }}
    >
      {children}
    </CompassContext.Provider>
  );
}

export const useCompass = () => useContext(CompassContext);
