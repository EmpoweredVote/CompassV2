import { useState, useEffect, useMemo, useRef } from "react";
import { useCompass } from "../components/CompassContext";
import { useNavigate, useSearchParams } from "react-router";
import RadarChart from "../components/RadarChart";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

const SMOOTH_TRANSITION = {
  duration: 300,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
};

function SortableStanceLabel({ id, text }) {
  const { setNodeRef, transform, transition } = useSortable({
    id,
    disabled: { draggable: true },
    transition: SMOOTH_TRANSITION,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="px-4 py-2.5 rounded-lg text-sm sm:text-base font-medium bg-gray-50 text-gray-600 border border-gray-200"
    >
      {text}
    </div>
  );
}

function SortableWriteInCard({ id, text, onChange, onCancel, showHint }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: SMOOTH_TRANSITION });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex items-start gap-2 px-3 py-2.5 rounded-lg
        ${
          text.trim()
            ? "border-2 border-ev-yellow bg-ev-yellow-light"
            : "border-2 border-dashed border-gray-400"
        }`}
    >
      <div
        {...listeners}
        className={`cursor-grab active:cursor-grabbing pt-1.5 shrink-0 rounded p-1 ${
          showHint
            ? "animate-pulse bg-ev-yellow/30 text-ev-coral"
            : ""
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5"
          fill="currentColor"
        >
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your stance here..."
          rows={2}
          className="text-sm sm:text-base font-medium resize-none bg-transparent focus:outline-none"
        />
        {showHint && (
          <p className="text-xs font-medium text-ev-coral">
            Drag your own view to where it fits among these stances
          </p>
        )}
      </div>
      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-black shrink-0 pt-1 cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}

export function Quiz() {
  const { topics, categories, selectedTopics, answers, setAnswers, writeIns, setWriteIns, invertedSpokes, setInvertedSpokes, initRandomInversions } =
    useCompass();

  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "full" ? "full" : "curated";

  // Build ordered list of topic IDs for full mode (grouped by category)
  const fullQuizTopicIds = useMemo(() => {
    if (mode !== "full" || !categories.length) return [];
    const ids = [];
    for (const cat of categories) {
      for (const topic of cat.topics) {
        ids.push(topic.id);
      }
    }
    return ids;
  }, [mode, categories]);

  const quizTopicIds = mode === "full" ? fullQuizTopicIds : selectedTopics;

  // In full mode, fetch ALL user answers so previous responses show up
  useEffect(() => {
    if (mode !== "full" || !topics.length) return;

    fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        const mapped = data
          .map((a) => {
            const topic = topics.find((t) => t.id === a.topic_id);
            if (!topic) return null;
            return [topic.short_title, a.value];
          })
          .filter(Boolean);
        setAnswers((prev) => ({ ...prev, ...Object.fromEntries(mapped) }));

        const writeInEntries = data
          .map((a) => {
            const topic = topics.find((t) => t.id === a.topic_id);
            if (!topic || !a.write_in_text) return null;
            return [topic.short_title, a.write_in_text];
          })
          .filter(Boolean);
        if (writeInEntries.length) {
          setWriteIns((prev) => ({ ...prev, ...Object.fromEntries(writeInEntries) }));
        }
      });
  }, [mode, topics]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showWriteIn, setShowWriteIn] = useState(false);
  const [writeInText, setWriteInText] = useState("");
  const [orderedItems, setOrderedItems] = useState([]);
  const [hasRepositioned, setHasRepositioned] = useState(false);
  const prevIndexRef = useRef(currentIndex);
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  // In curated mode, randomly invert ~50% of spokes on first quiz mount
  useEffect(() => {
    if (mode !== "curated" || !topics.length || !selectedTopics.length) return;
    const shortTitles = selectedTopics
      .map((id) => topics.find((t) => t.id === id)?.short_title)
      .filter(Boolean);
    if (shortTitles.length) initRandomInversions(shortTitles);
  }, [mode, topics, selectedTopics, initRandomInversions]);

  const chartData = useMemo(() => {
    if (mode === "full") return {};
    return Object.fromEntries(
      selectedTopics
        .map((id) => {
          const topic = topics.find((t) => t.id === id);
          if (!topic) return null;
          const value = answers[topic.short_title] ?? 0;
          return [topic.short_title, value];
        })
        .filter(Boolean)
    );
  }, [mode, selectedTopics, topics, answers]);

  useEffect(() => {
    const isTopicChange = prevIndexRef.current !== currentIndex;
    prevIndexRef.current = currentIndex;

    const topic = topics.find((t) => t.id === quizTopicIds[currentIndex]);
    if (!topic) return;

    const prev = answers[topic.short_title] || null;
    setSelectedAnswer(prev);

    const savedWriteIn = writeIns[topic.short_title];
    if (savedWriteIn && prev && !Number.isInteger(prev)) {
      setShowWriteIn(true);
      setWriteInText(savedWriteIn);
      if (isTopicChange) setHasRepositioned(true);
      const stanceIds = topic.stances.map((s) => s.id);
      const writeInIndex = Math.floor(prev);
      const items = [...stanceIds];
      items.splice(writeInIndex, 0, "write-in");
      setOrderedItems(items);
    } else {
      setShowWriteIn(false);
      setWriteInText("");
      if (isTopicChange) setHasRepositioned(false);
      setOrderedItems([]);
    }
  }, [currentIndex, quizTopicIds, topics, answers, writeIns]);

  if (!quizTopicIds.length || !topics.length) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading quiz...</div>;
  }

  const currentTopicId = quizTopicIds[currentIndex];
  const currentTopic = topics.find((topic) => topic.id == currentTopicId);
  const isLastQuestion = currentIndex === quizTopicIds.length - 1;

  // For full mode: find which category the current topic belongs to
  const currentCategory = mode === "full"
    ? categories.find((cat) => cat.topics.some((t) => t.id === currentTopicId))
    : null;

  // Check if this is the first topic of a new category (for showing category headers)
  const isNewCategory = mode === "full" && currentIndex > 0
    ? (() => {
        const prevTopicId = quizTopicIds[currentIndex - 1];
        const prevCat = categories.find((cat) => cat.topics.some((t) => t.id === prevTopicId));
        return prevCat?.id !== currentCategory?.id;
      })()
    : mode === "full";

  const selectAnswer = (value, isWriteIn = false) => {
    setSelectedAnswer(value);

    const topic = topics.find((t) => t.id === currentTopicId);
    if (!topic) return;

    setAnswers((prev) => ({
      ...prev,
      [topic.short_title]: value,
    }));

    if (!isWriteIn) {
      setWriteIns((prev) => {
        const updated = { ...prev };
        delete updated[topic.short_title];
        return updated;
      });
    }
  };

  const handleNext = () => {
    const topic = topics.find((t) => t.id === currentTopicId);
    const currentWriteIn = topic ? writeIns[topic.short_title] : undefined;

    fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic_id: currentTopicId,
        value: selectedAnswer,
        ...(currentWriteIn ? { write_in_text: currentWriteIn } : {}),
      }),
    })
      .then((response) => {
        console.log(response);
        setSelectedAnswer(null);

        if (isLastQuestion) {
          if (mode === "full") {
            navigate("/build");
          } else {
            navigate("/results");
          }
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

  const selectWriteInPlacement = (midpointValue) => {
    selectAnswer(midpointValue, true);
    setWriteIns((prev) => ({
      ...prev,
      [currentTopic.short_title]: writeInText,
    }));
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = orderedItems.indexOf(active.id);
    const newIndex = orderedItems.indexOf(over.id);
    const reordered = arrayMove(orderedItems, oldIndex, newIndex);
    setOrderedItems(reordered);
    setHasRepositioned(true);
    const writeInIndex = reordered.indexOf("write-in");
    selectWriteInPlacement(writeInIndex + 0.5);
  };

  const handleWriteInTextChange = (newText) => {
    setWriteInText(newText);
    if (selectedAnswer && !Number.isInteger(selectedAnswer)) {
      if (newText.trim()) {
        setWriteIns((prev) => ({
          ...prev,
          [currentTopic.short_title]: newText,
        }));
      } else {
        setSelectedAnswer(null);
        setAnswers((prev) => {
          const updated = { ...prev };
          delete updated[currentTopic.short_title];
          return updated;
        });
        setWriteIns((prev) => {
          const updated = { ...prev };
          delete updated[currentTopic.short_title];
          return updated;
        });
      }
    }
  };

  const handleCancelWriteIn = () => {
    setShowWriteIn(false);
    setWriteInText("");
    setOrderedItems([]);
    if (selectedAnswer && !Number.isInteger(selectedAnswer)) {
      setSelectedAnswer(null);
      setAnswers((prev) => {
        const updated = { ...prev };
        delete updated[currentTopic.short_title];
        return updated;
      });
      setWriteIns((prev) => {
        const updated = { ...prev };
        delete updated[currentTopic.short_title];
        return updated;
      });
    }
  };

  // Stance buttons (shared between both modes)
  const stanceContent = (
    <>
      <h2 className="text-xl md:text-2xl font-semibold mb-2">
        {currentTopic.start_phrase}...
      </h2>

      {!showWriteIn ? (
        <>
          {ordered.map((stance, i) => (
            <button
              key={stance.id}
              onClick={() => {
                setShowWriteIn(false);
                setWriteInText("");
                selectAnswer(i + 1);
              }}
              className={`text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm sm:text-base font-medium cursor-pointer
              ${
                selectedAnswer === i + 1
                  ? "border-ev-yellow border-2 bg-ev-yellow-light"
                  : "bg-white text-black border-2 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {stance.text}
            </button>
          ))}

          <button
            onClick={() => {
              setShowWriteIn(true);
              setHasRepositioned(false);
              setOrderedItems([
                ...ordered.map((s) => s.id),
                "write-in",
              ]);
            }}
            className="text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm sm:text-base font-medium cursor-pointer border-2 border-dashed border-gray-400 text-gray-500 hover:border-ev-yellow hover:text-black"
          >
            Write your own...
          </button>
        </>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedItems}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
              {orderedItems.map((itemId) =>
                itemId === "write-in" ? (
                  <SortableWriteInCard
                    key="write-in"
                    id="write-in"
                    text={writeInText}
                    onChange={handleWriteInTextChange}
                    onCancel={handleCancelWriteIn}
                    showHint={!!writeInText.trim() && !hasRepositioned}
                  />
                ) : (
                  <SortableStanceLabel
                    key={itemId}
                    id={itemId}
                    text={
                      ordered.find((s) => s.id === itemId)?.text ?? ""
                    }
                  />
                )
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </>
  );

  // --- FULL MODE LAYOUT ---
  if (mode === "full") {
    return (
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-center px-4 pt-3 md:px-6 md:pt-4">
          <div />
          <button
            onClick={() => navigate("/library")}
            className="p-2 rounded-full text-gray-400 hover:text-black hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
            aria-label="Exit quiz"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6"
            >
              <path
                fillRule="evenodd"
                d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Category label */}
        {currentCategory && (
          <div className="text-center mt-2">
            <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600 uppercase tracking-wide">
              {currentCategory.title}
            </span>
          </div>
        )}

        {/* Question title - centered, full width */}
        <h1 className="text-2xl md:text-3xl font-semibold mt-4 mb-6 text-center px-4">
          {currentTopic.title}
        </h1>

        {/* Stances - centered, wider layout */}
        <div className="flex-1 flex justify-center px-4">
          <div className="w-full max-w-2xl flex flex-col gap-3 mb-4">
            {stanceContent}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t border-gray-100">
          <footer className="flex justify-between items-center mx-4 my-3 md:mx-10">
            <button
              onClick={handleBack}
              disabled={currentIndex === 0}
              className={`px-6 py-2 rounded-full border text-sm font-medium transition-colors duration-200
              ${
                currentIndex === 0
                  ? "bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white text-black border-black hover:bg-gray-100 cursor-pointer"
              }`}
            >
              Back
            </button>

            <div className="flex flex-col text-center items-center">
              <div className="w-32 md:w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
                <div
                  className="h-full bg-ev-yellow rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentIndex + 1) / quizTopicIds.length) * 100}%`,
                  }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {currentIndex + 1} of {quizTopicIds.length}
              </p>
            </div>

            <button
              onClick={handleNext}
              disabled={!selectedAnswer}
              className={`px-6 py-2 rounded-full border text-sm font-medium transition-colors duration-200
              ${
                selectedAnswer
                  ? "bg-black text-white border-black hover:opacity-90 cursor-pointer"
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

  // --- CURATED MODE LAYOUT (original) ---
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex justify-end px-4 pt-3 md:px-6 md:pt-4">
        <button
          onClick={() => navigate("/library")}
          className="p-2 rounded-full text-gray-400 hover:text-black hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
          aria-label="Exit quiz"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path
              fillRule="evenodd"
              d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="flex flex-col">
        <h1 className="text-2xl md:text-3xl font-semibold mt-1 md:my-4 text-center">
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
            {stanceContent}
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
                : "bg-white text-black border-black hover:bg-gray-100 cursor-pointer"
            }`}
          >
            Back
          </button>

          <div className="flex flex-col text-center items-center">
            <div className="w-32 md:w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-ev-yellow rounded-full transition-all duration-300"
                style={{
                  width: `${((currentIndex + 1) / selectedTopics.length) * 100}%`,
                }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {currentIndex + 1} of {selectedTopics.length}
            </p>
          </div>

          <button
            onClick={handleNext}
            disabled={!selectedAnswer}
            className={`px-6 py-2 rounded-full border text-sm font-medium transition-colors duration-200
            ${
              selectedAnswer
                ? "bg-black text-white border-black hover:opacity-90 cursor-pointer"
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
