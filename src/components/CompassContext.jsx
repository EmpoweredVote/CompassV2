// CompassContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

const CompassContext = createContext();

export function CompassProvider({ children }) {
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [categories, setCategories] = useState([]);

  // ✅ Fetch topics on mount (e.g., from your backend)
  useEffect(() => {
    fetch("http://localhost:5050/compass/topics", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setTopics(data);
      });
  }, []);

  return (
    <CompassContext.Provider
      value={{
        topics,
        setTopics,
        selectedTopics,
        setSelectedTopics,
        categories,
        setCategories,
      }}
    >
      {children}
    </CompassContext.Provider>
  );
}

export const useCompass = () => useContext(CompassContext);
