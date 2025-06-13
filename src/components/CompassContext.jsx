import { createContext, useContext, useState } from "react";

const CompassContext = createContext();

export function CompassProvider({ children }) {
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);

  return (
    <CompassContext.Provider
      value={{ topics, setTopics, selectedTopics, setSelectedTopics }}
    >
      {children}
    </CompassContext.Provider>
  );
}

export const useCompass = () => useContext(CompassContext);
