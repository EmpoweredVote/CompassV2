import { useState, useEffect, useMemo, useRef } from "react";
import { track } from "@empoweredvote/analytics";
import { useCompass } from "../components/CompassContext";
import { useNavigate, useSearchParams } from "react-router";
import { apiFetch } from "../lib/auth";
import { getQuestionText, parseTensionTitle } from "../util/topic";
import RadarChart from "../components/RadarChart";
import StanceChooser from "../components/StanceChooser";
import { isWriteIn } from "../lib/writeIn";

const QUIZ_STORAGE_KEY = "quiz_progress";

export function Quiz() {
  const { topics, categories, selectedTopics, setSelectedTopics, answers, setAnswers, writeIns, setWriteIns, invertedSpokes, setInvertedSpokes, initRandomInversions, isLoggedIn } =
    useCompass();

  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "full" ? "full" : "curated";

  // Build ordered list of topic IDs for full mode (grouped by category)
  const fullQuizTopicIds = useMemo(() => {
    if (mode !== "full" || !categories.length) return [];
    const seen = new Set();
    const ids = [];
    for (const cat of categories) {
      for (const topic of cat.topics) {
        if (!seen.has(topic.id)) {
          seen.add(topic.id);
          ids.push(topic.id);
        }
      }
    }
    return ids;
  }, [mode, categories]);

  const quizTopicIds = mode === "full" ? fullQuizTopicIds : selectedTopics;

  // Fire quiz_started once topics are ready
  useEffect(() => {
    if (!quizTopicIds.length) return;
    track('compass_quiz_started', { quiz_type: mode, topic_count: quizTopicIds.length });
  }, [quizTopicIds.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // In full mode, fetch ALL user answers so previous responses show up
  useEffect(() => {
    if (mode !== "full" || !topics.length) return;
    if (!isLoggedIn) return; // Guests already have answers from localStorage

    apiFetch('/compass/answers')
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
  }, [mode, topics, isLoggedIn]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    try {
      const saved = localStorage.getItem(QUIZ_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if mode matches
        if (parsed.mode === mode) {
          return parsed.currentIndex || 0;
        }
      }
    } catch { /* corrupt or unreadable localStorage — fall back to the default */ }
    return 0;
  });
  // The value the footer reads: Next is disabled without one, and it is what
  // the POST on Next carries. StanceChooser owns the write-in card's own state
  // (placement, editor text, drag), so none of that lives here any more.
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  // Last (topic, value) pair reported to analytics. Every keystroke in a
  // write-in card comes back through onSelectWriteIn, so without this the
  // question-answered event would fire once per letter.
  const reportedAnswerRef = useRef({ slug: null, value: null });
  const navigate = useNavigate();

  // Validate saved quiz progress against current topic data — restart if stale
  useEffect(() => {
    if (!quizTopicIds.length) return;
    try {
      const saved = localStorage.getItem(QUIZ_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.mode !== mode) {
          // Mode mismatch — restart
          localStorage.removeItem(QUIZ_STORAGE_KEY);
          setCurrentIndex(0);
          return;
        }
        if (parsed.currentIndex >= quizTopicIds.length) {
          // Saved index beyond current topic list — restart
          localStorage.removeItem(QUIZ_STORAGE_KEY);
          setCurrentIndex(0);
        }
      }
    } catch {
      localStorage.removeItem(QUIZ_STORAGE_KEY);
    }
  }, [quizTopicIds.length, mode]);

  // Persist quiz progress on every currentIndex change
  useEffect(() => {
    const progress = { currentIndex, mode };
    localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(progress));
  }, [currentIndex, mode]);

  // Randomly invert ~50% of spokes on first quiz mount (curated and full modes)
  useEffect(() => {
    if (!topics.length) return;

    let topicObjects;
    if (mode === "curated") {
      if (!selectedTopics.length) return;
      topicObjects = selectedTopics
        .map((id) => topics.find((t) => t.id === id))
        .filter(Boolean);
    } else {
      // Full mode: use all active topics
      topicObjects = topics;
    }

    if (topicObjects.length) initRandomInversions(topicObjects);
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

  // Mirror the stored answer into the footer's state. Restoring the write-in
  // card itself used to happen here too, and it rebuilt `orderedItems` from the
  // raw, unreversed `topic.stances` ids — while opening the card fresh built
  // them from the reversed display order. On an inverted spoke a restore
  // therefore redrew the whole stance list upside-down, and the next drag
  // applied the inversion transform to an ascending list: a card dragged to the
  // top saved 5.5 where it should have saved 0.5, and came back at the bottom.
  // StanceChooser builds one list, in display order, for both.
  useEffect(() => {
    const topic = topics.find((t) => t.id === quizTopicIds[currentIndex]);
    if (!topic) return;
    setSelectedAnswer(answers[topic.short_title] || null);
  }, [currentIndex, quizTopicIds, topics, answers]);

  if (!quizTopicIds.length || !topics.length) {
    return <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#131416] text-[#9CA3AF]">Loading calibration...</div>;
  }

  const currentTopicId = quizTopicIds[currentIndex];
  const currentTopic = topics.find((topic) => topic.id == currentTopicId);
  const isLastQuestion = currentIndex === quizTopicIds.length - 1;

  // For full mode: find which category the current topic belongs to
  const currentCategory = mode === "full"
    ? categories.find((cat) => cat.topics.some((t) => t.id === currentTopicId))
    : null;

  const selectAnswer = (topic, value, isWriteInAnswer = false) => {
    if (!topic) return;
    setSelectedAnswer(value);

    // Typing in a write-in card re-reports the same placement on every letter.
    // Writing an unchanged value back would still mint a fresh `answers`
    // object, which re-runs chartData's memo and makes CompassContext
    // re-serialise the whole answers map to localStorage once per keystroke.
    // Nothing has moved, so stop here. Still correct after a cancel: the key is
    // deleted then, so the retyped value is a change and is stored again.
    if (answers[topic.short_title] === value) return;

    // Reported on a change of placement, not a change of wording: the chooser
    // calls onSelectWriteIn on every keystroke, and one answer is one event.
    const reported = reportedAnswerRef.current;
    if (reported.slug !== topic.short_title || reported.value !== value) {
      reportedAnswerRef.current = { slug: topic.short_title, value };
      track('compass_quiz_question_answered', {
        quiz_type: mode,
        question_index: currentIndex,
        questions_total: quizTopicIds.length,
        topic_slug: topic.short_title,
        answer_type: isWriteInAnswer ? 'write_in' : 'stance',
      });
    }

    setAnswers((prev) => ({
      ...prev,
      [topic.short_title]: value,
    }));
  };

  // A stance pick no longer deletes the stored write-in text here: when one is
  // live (or a stale one is stored) StanceChooser fires onCancelWriteIn first,
  // so the clear cannot eat the answer it was just handed.
  const handleSelectStance = (topic, value) => selectAnswer(topic, value, false);

  // Local state only. Quiz saves on Next, from `writeIns` and `selectedAnswer`,
  // so there is no per-keystroke API call to debounce and `onPersistWriteIn` is
  // deliberately not wired — see handleNext.
  const handleSelectWriteIn = (topic, value, text) => {
    if (!topic) return;
    selectAnswer(topic, value, true);
    setWriteIns((prev) => ({ ...prev, [topic.short_title]: text }));
  };

  // An obligation, not a notification: StanceChooser latches the value it
  // dismissed, so a half-step left standing here would show an unselected list
  // for a question this page calls answered. The answer only goes when it IS a
  // write-in — the chooser also cancels on the way into a stance pick, to clear
  // stale text, and deleting an integer answer there would undo the pick
  // arriving right behind it.
  const handleCancelWriteIn = (topic) => {
    if (!topic) return;
    // The answer is going, so the pair it was reported under must go with it:
    // otherwise re-placing at the same slot (or retyping after the text was
    // emptied) is a new answer that emits no event.
    reportedAnswerRef.current = { slug: null, value: null };
    setSelectedAnswer((prev) => (isWriteIn(prev) ? null : prev));
    setAnswers((prev) => {
      if (!isWriteIn(prev[topic.short_title])) return prev;
      const updated = { ...prev };
      delete updated[topic.short_title];
      return updated;
    });
    setWriteIns((prev) => {
      if (!(topic.short_title in prev)) return prev;
      const updated = { ...prev };
      delete updated[topic.short_title];
      return updated;
    });
  };

  // The quiz's only write to the API: one POST per question, on Next. That is
  // why StanceChooser's `onPersistWriteIn` is not wired here — there is no
  // per-keystroke save to debounce, and `writeIns` is already current by the
  // time this runs, because `onSelectWriteIn` updates it immediately.
  const handleNext = () => {
    const topic = topics.find((t) => t.id === currentTopicId);
    const currentWriteIn = topic ? writeIns[topic.short_title] : undefined;

    const advanceOrFinish = () => {
      setSelectedAnswer(null);
      if (isLastQuestion) {
        track('compass_quiz_completed', { quiz_type: mode, topics_answered: quizTopicIds.length });
        localStorage.removeItem(QUIZ_STORAGE_KEY);
        if (mode === "full") {
          // Keep the user's existing preferred 8 if they have a valid selection;
          // otherwise default to the first 8 from the quiz. Never set all quiz
          // topics as selected — that empties the replacement pool on profile pages.
          const MAX_SPOKES = 8;
          const existingValid = selectedTopics
            .filter(id => fullQuizTopicIds.includes(id))
            .slice(0, MAX_SPOKES);
          const newSelection = existingValid.length >= 3
            ? existingValid
            : fullQuizTopicIds.slice(0, MAX_SPOKES);
          setSelectedTopics(newSelection);
          localStorage.setItem("selectedTopics", JSON.stringify(newSelection));
          localStorage.setItem("calibration_completed", "true");
          localStorage.removeItem("calibration_skipped");
          localStorage.removeItem("calibration_progress");
        }
        navigate(mode === "full" ? "/build" : "/results");
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    };

    if (isLoggedIn) {
      apiFetch('/compass/answers', {
        method: "POST",
        body: JSON.stringify({
          topic_id: currentTopicId,
          value: selectedAnswer,
          // Gated on the VALUE, not on the text alone (the same hardening
          // Layout's Save does). `writeIns` can be hydrated from the broker
          // cache or an API fill-gap with text for a topic whose stored answer
          // is now an integer — the user has since picked a pre-written stance
          // and the server already dropped the text on that value-only POST.
          // Re-attaching it here would resurrect a write-in the server had
          // correctly cleared. Clearing means OMITTING the field: null is a 422.
          ...(isWriteIn(selectedAnswer) && currentWriteIn ? { write_in_text: currentWriteIn } : {}),
        }),
      })
        .then((response) => {
          console.log(response);
          advanceOrFinish();
        })
        .catch((err) => {
          alert("Error saving your answer. Please try again.");
          console.log(err);
        });
    } else {
      // Guest: localStorage already updated via setAnswers in selectAnswer
      advanceOrFinish();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  // Display-only: this spoke's inversion flips which pole reads first. The
  // ordering itself — and the write-in placement math that depends on it —
  // lives in StanceChooser now, so the quiz, the overlay, Full Calibration and
  // the library drawer can no longer disagree about it. The quiz's old copy
  // honoured the flag when it rendered and when it dragged, but not when it
  // restored, which is the bug that adoption kills.
  const isInverted = !!invertedSpokes[currentTopic?.short_title];

  // Stance list (shared between both modes)
  const stanceContent = (
    <StanceChooser
      topic={currentTopic}
      stances={currentTopic?.stances}
      // Read from the store rather than from `selectedAnswer`: a child's effects
      // run before the parent's, so on the render that changes question the
      // mirrored state still holds the previous topic's value.
      currentAnswer={currentTopic ? (answers[currentTopic.short_title] ?? null) : null}
      writeInText={currentTopic ? (writeIns[currentTopic.short_title] ?? "") : ""}
      isInverted={isInverted}
      gapClassName="gap-3"
      onSelectStance={handleSelectStance}
      onSelectWriteIn={handleSelectWriteIn}
      onCancelWriteIn={handleCancelWriteIn}
    />
  );

  // --- FULL MODE LAYOUT ---
  if (mode === "full") {
    return (
      <div className="flex flex-col min-h-screen bg-white dark:bg-[#131416]">
        {/* Header */}
        <div className="flex justify-between items-center px-4 pt-3 md:px-6 md:pt-4">
          <div />
          <button
            onClick={() => {
              track('compass_quiz_abandoned', {
                quiz_type: mode,
                question_index: currentIndex,
                questions_total: quizTopicIds.length,
                topic_slug: currentTopic?.short_title,
              });
              navigate("/library");
            }}
            className="p-2 rounded-full text-[#9CA3AF] hover:text-[#2F3237] dark:hover:text-[#EBEDEF] hover:bg-[#EBEDEF] dark:hover:bg-[#2F3237] transition-colors duration-200 cursor-pointer"
            aria-label="Exit calibration"
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
            <span className="inline-block px-3 py-1 rounded-full bg-[#EBEDEF] dark:bg-[#2F3237] text-xs font-medium text-[#535964] dark:text-[#9CA3AF] uppercase tracking-wide">
              {currentCategory.title}
            </span>
          </div>
        )}

        {/* Question title - question text first, topic name as subtitle */}
        {(() => {
          const { name: topicName } = parseTensionTitle(currentTopic);
          const question = getQuestionText(currentTopic);
          return (
            <div className="text-center px-4 mt-4 mb-2">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-xl md:text-2xl font-semibold text-[#2F3237] dark:text-[#EBEDEF]">{question || topicName}</h1>
                <a
                  href="/how-it-works#spectrum-direction"
                  target="_blank"
                  rel="noopener"
                  title="Why is the order of stances not fixed?"
                  aria-label="Why is the stance order not fixed? Opens explanation in a new tab."
                  className="flex-shrink-0 w-6 h-6 rounded-full text-gray-400 hover:text-[#00657c] dark:hover:text-ev-teal-light transition-colors inline-flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
              {question && (
                <p className="text-base text-[#535964] dark:text-[#9CA3AF] font-normal mt-1">{topicName}</p>
              )}
            </div>
          );
        })()}

        {/* Stances - centered, wider layout */}
        <div className="flex-1 flex justify-center px-4">
          <div className="w-full max-w-2xl flex flex-col gap-3 mb-4">
            {stanceContent}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/90 dark:bg-[#131416]/95 backdrop-blur-sm border-t border-[#D3D7DE] dark:border-[#41454E]">
          <footer className="flex justify-between items-center mx-4 my-3 md:mx-10">
            <button
              onClick={handleBack}
              disabled={currentIndex === 0}
              className={`px-6 py-2 rounded-full border text-sm font-medium transition-colors duration-200
              ${
                currentIndex === 0
                  ? "bg-[#D3D7DE] dark:bg-[#41454E] text-[#9CA3AF] border-[#D3D7DE] dark:border-[#41454E] cursor-not-allowed"
                  : "bg-white dark:bg-[#2F3237] text-[#535964] dark:text-[#D3D7DE] border-[#D3D7DE] dark:border-[#41454E] hover:bg-gray-50 dark:hover:bg-[#41454E] cursor-pointer"
              }`}
            >
              Back
            </button>

            <div className="flex flex-col text-center items-center">
              <div className="w-32 md:w-48 h-1.5 bg-[#D3D7DE] dark:bg-[#41454E] rounded-full overflow-hidden mb-1">
                <div
                  className="h-full bg-ev-yellow rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentIndex + 1) / quizTopicIds.length) * 100}%`,
                  }}
                />
              </div>
              <p className="text-sm text-[#535964] dark:text-[#9CA3AF]">
                {currentIndex + 1} of {quizTopicIds.length}
              </p>
            </div>

            <button
              onClick={handleNext}
              disabled={!selectedAnswer}
              className={`px-6 py-2 rounded-full border text-sm font-medium transition-colors duration-200
              ${
                selectedAnswer
                  ? "bg-ev-muted-blue text-white border-ev-muted-blue hover:opacity-90 cursor-pointer"
                  : "bg-[#D3D7DE] dark:bg-[#41454E] text-[#9CA3AF] border-[#D3D7DE] dark:border-[#41454E] cursor-not-allowed"
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
          onClick={() => {
            track('compass_quiz_abandoned', {
              quiz_type: mode,
              question_index: currentIndex,
              questions_total: quizTopicIds.length,
              topic_slug: currentTopic?.short_title,
            });
            navigate("/library");
          }}
          className="p-2 rounded-full text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors duration-200 cursor-pointer"
          aria-label="Exit calibration"
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
        {(() => {
          const { name: topicName } = parseTensionTitle(currentTopic);
          const question = getQuestionText(currentTopic);
          return (
            <div className="text-center mt-1 md:mt-4 px-4">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-xl md:text-2xl font-semibold text-[#2F3237] dark:text-[#EBEDEF]">{question || topicName}</h1>
                <a
                  href="/how-it-works#spectrum-direction"
                  target="_blank"
                  rel="noopener"
                  title="Why is the order of stances not fixed?"
                  aria-label="Why is the stance order not fixed? Opens explanation in a new tab."
                  className="flex-shrink-0 w-6 h-6 rounded-full text-gray-400 hover:text-[#00657c] dark:hover:text-ev-teal-light transition-colors inline-flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
              {question && (
                <p className="text-base text-[#535964] dark:text-[#9CA3AF] font-normal mt-1">{topicName}</p>
              )}
            </div>
          );
        })()}

        <div className="flex-1 flex flex-col md:flex-row md:pb-0">
          <div className="md:basis-3/5 flex justify-center">
            <div className="w-full max-w-[700px]">
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
                ? "bg-gray-200 dark:bg-zinc-700 text-gray-400 border-gray-200 dark:border-zinc-700 cursor-not-allowed"
                : "bg-white dark:bg-zinc-800 text-black dark:text-white border-black dark:border-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer"
            }`}
          >
            Back
          </button>

          <div className="flex flex-col text-center items-center">
            <div className="w-32 md:w-48 h-1.5 bg-[#D3D7DE] dark:bg-[#41454E] rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-ev-yellow rounded-full transition-all duration-300"
                style={{
                  width: `${((currentIndex + 1) / selectedTopics.length) * 100}%`,
                }}
              />
            </div>
            <p className="text-sm text-[#535964] dark:text-[#9CA3AF]">
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
                : "bg-gray-200 dark:bg-zinc-700 text-gray-400 border-gray-200 dark:border-zinc-700 cursor-not-allowed"
            }`}
          >
            {isLastQuestion ? "Finish" : "Next"}
          </button>
        </footer>
      </div>
    </div>
  );
}
