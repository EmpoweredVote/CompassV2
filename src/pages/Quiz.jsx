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
    (topic) => topic.id == selectedTopics[currentIndex]
  );

  const handleNext = () => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
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
    const topic_id = selectedTopics[currentIndex];
    const prevAnswer = answers[topic_id] || null;
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

  const ordered = currentTopic.stances;

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 py-8 sm:px-8 md:px-16 lg:px-32">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2 text-center">
          {currentTopic.title}
        </h1>
        <p className="text-lg md:text-lg font-semibold mb-2 text-center text-gray-600">
          {currentIndex + 1} / {selectedTopics.length}
        </p>
      </div>

      {/* Stances */}
      <div className="flex flex-col gap-3">
        {ordered.map((stance, i) => (
          <button
            key={stance.id}
            onClick={() => selectAnswer(i + 1)}
            className={`text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm sm:text-base font-medium
              ${
                selectedAnswer === i + 1
                  ? "border-green-600 border-2"
                  : "bg-white text-black border-2 border-gray-300 hover:bg-gray-50"
              }`}
          >
            {i + 1}. {stance.text}
          </button>
        ))}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center mt-10">
        <button
          onClick={handleBack}
          disabled={currentIndex === 0}
          className={`px-6 py-2 rounded-full border text-sm font-medium transition-colors duration-200
            ${
              currentIndex === 0
                ? "bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-white text-black border-black hover:bg-gray-100"
            }`}
        >
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={!selectedAnswer}
          className={`px-6 py-2 rounded-full border text-sm font-medium transition-colors duration-200
            ${
              selectedAnswer
                ? "bg-black text-white border-black hover:opacity-90"
                : "bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed"
            }`}
        >
          {isLastQuestion ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
