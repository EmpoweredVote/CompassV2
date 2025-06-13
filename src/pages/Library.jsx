import { useState, useEffect } from "react";
import { useCompass } from "../components/CompassContext";
import { useNavigate } from "react-router";

function Library() {
  const { topics, setTopics, selectedTopics, setSelectedTopics } = useCompass();
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:5050/compass/topics", {
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("HTTP error " + response.status);
        } else {
          return response.json();
        }
      })
      .then((data) => {
        setTopics(data);
      })
      .catch((error) => {
        console.error("Error during HTTP request:", error);
      });
  }, []);

  const toggleTopic = (topicID) => {
    if (selectedTopics.includes(topicID)) {
      setSelectedTopics(selectedTopics.filter((topic) => topic !== topicID));
    } else {
      setSelectedTopics((prevTopics) => [...prevTopics, topicID]);
    }

    console.log("Selected topics: ", selectedTopics);
  };

  return (
    <>
      <h1>Library</h1>
      <div>
        {topics.map((topic) => (
          <button
            key={topic.ID}
            onClick={() => toggleTopic(topic.ID)}
            style={{
              backgroundColor: selectedTopics.includes(topic.ID)
                ? "#32d15d"
                : "#f9f9f9",
            }}
          >
            {topic.ShortTitle}
          </button>
        ))}
      </div>
      <button onClick={() => navigate("/quiz")}>Continue</button>
    </>
  );
}

export default Library;
