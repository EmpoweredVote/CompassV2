import { useState, useEffect } from "react";
import { useCompass } from "../components/CompassContext";
import { useNavigate } from "react-router";

export function Quiz() {
  const { topics, setTopics, selectedTopics, setSelectedTopics } = useCompass();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const isLastQuestion = currentIndex === selectedTopics.length - 1;
  const navigate = useNavigate();

  if (!selectedTopics.length || !topics.length) {
    return <div>Loading quiz...</div>;
  }

  const currentTopic = topics.find(
    (topic) => topic.ID == selectedTopics[currentIndex]
  );
  console.log(currentTopic);

  const handleNext = () => {
    fetch("http://localhost:5050/compass/answers", {
      method: "POST",
      credentials: "include", // REQUIRED for cookie auth
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic_id: selectedTopics[currentIndex],
        value: selectedAnswer,
      }),
    })
      .then((response) => {
        console.log(response);
        setAnswers((prev) => ({
          ...prev,
          [selectedTopics[currentIndex]]: selectedAnswer,
        }));
        setSelectedAnswer(null);

        if (isLastQuestion) {
          navigate("/results");
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      })
      .catch((err) => {
        alert("Error saving your answer. Please try again.");
        console.log(err);
      });
  };

  useEffect(() => {
    const topicID = selectedTopics[currentIndex];
    const prevAnswer = answers[topicID] || null;
    setSelectedAnswer(prevAnswer);
  }, [currentIndex]);

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const selectAnswer = (value) => {
    setSelectedAnswer(value);
  };

  return (
    <div>
      <div>
        <h1>{currentTopic.Title}</h1>
      </div>
      <div>
        {currentTopic.stances.map((stance) => {
          return (
            <button
              key={stance.ID}
              onClick={() => selectAnswer(stance.Value)}
              style={{
                backgroundColor:
                  selectedAnswer == stance.Value ? "#32d15d" : "#f9f9f9",
              }}
            >
              {stance.Value}. {stance.Text}
            </button>
          );
        })}
      </div>
      <div>
        <button
          onClick={handleBack}
          disabled={currentIndex == 0 ? true : false}
        >
          Back
        </button>
        <button onClick={handleNext} disabled={selectedAnswer ? false : true}>
          {isLastQuestion ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
