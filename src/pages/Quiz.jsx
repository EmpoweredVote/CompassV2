import { useState, useEffect, useMemo } from "react";
import { useCompass } from "../components/CompassContext";
import { useNavigate } from "react-router";
import RadarChart from "../components/RadarChart";

export function Quiz() {
  const { topics, selectedTopics, answers, setAnswers } = useCompass();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [invertedSpokes, setInvertedSpokes] = useState({});
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const navigate = useNavigate();

  if (!selectedTopics.length || !topics.length) {
    return <div>Loading quiz...</div>;
  }

  const currentTopicId = selectedTopics[currentIndex];
  const currentTopic = topics.find((topic) => topic.id == currentTopicId);
  const isLastQuestion = currentIndex === selectedTopics.length - 1;

  const chartData = useMemo(() => {
    return Object.fromEntries(
      selectedTopics.map((id) => {
        const topic = topics.find((t) => t.id === id);
        const label = topic?.short_title ?? id;
        const value = answers[label] ?? 0;
        return [label, value];
      })
    );
  }, [selectedTopics, topics, answers]);

  useEffect(() => {
    const topic = topics.find((t) => t.id === selectedTopics[currentIndex]);
    if (!topic) return;

    const prev = answers[topic.short_title] || null;
    setSelectedAnswer(prev);
  }, [currentIndex, selectedTopics, topics, answers]);

  const selectAnswer = (value) => {
    setSelectedAnswer(value);

    const topic = topics.find((t) => t.id === currentTopicId);
    if (!topic) return;

    setAnswers((prev) => ({
      ...prev,
      [topic.short_title]: value,
    }));
  };

  const handleNext = () => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
      method: "POST",
      credentials: "include", // REQUIRED for cookie auth
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic_id: currentTopicId,
        value: selectedAnswer,
      }),
    })
      .then((response) => {
        console.log(response);
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

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const ordered = currentTopic.stances;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}

      <div className="flex flex-col md:mt-6">
        <h1 className="text-2xl md:text-3xl font-semibold mt-4 md:my-4 text-center">
          {currentTopic.title}
        </h1>

        <div className="flex-1 flex flex-col md:flex-row md:pb-0">
          <div className="md:basis-3/5 flex justify-center">
            <div className="w-full max-w-[700px] aspect-square">
              <RadarChart
                data={chartData}
                invertedSpokes={invertedSpokes}
                onToggleInversion={(topic) =>
                  setInvertedSpokes((prev) => ({
                    ...prev,
                    [topic]: !prev[topic],
                  }))
                }
              />
            </div>
          </div>

          {/* Stances */}
          <div className="md:basis-2/5 flex flex-col gap-3 px-4 overflow-y-auto mb-2 md:mb-0 md:pb-0 justify-center md:mr-6">
            <h2 className="text-xl md:text-2xl font-semibold mb-2">
              {currentTopic.start_phrase}...
            </h2>
            {ordered.map((stance, i) => (
              <button
                key={stance.id}
                onClick={() => selectAnswer(i + 1)}
                className={`text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm sm:text-base font-medium cursor-pointer
              ${
                selectedAnswer === i + 1
                  ? "border-green-600 border-2"
                  : "bg-white text-black border-2 border-gray-300 hover:bg-gray-50"
              }`}
              >
                {stance.text}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="inset-shadow-sm md:fixed md:bottom-5 md:left-0 md:right-0">
        <footer className="flex justify-between items-center mx-4 my-4 md:mx-10 md:my-0 md:mt-4">
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

          <div className="flex flex-col text-center">
            <h1 className="text-xl text-gray-600">Stances Chosen</h1>
            <p className="text-2xl md:text-3xl font-semibold">
              {currentIndex + 1} of {selectedTopics.length}
            </p>
          </div>

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
        </footer>
      </div>
    </div>
  );
}
