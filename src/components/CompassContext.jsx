import { createContext, useContext, useState } from "react";

const CompassContext = createContext();

export function CompassProvider({ children }) {
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [categories, setCategories] = useState([]);

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
