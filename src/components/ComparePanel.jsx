import { useCompass, serializeCompassFragment } from "./CompassContext";
import { useState, useEffect } from "react";
import { apiFetch } from "../lib/auth";
import Favicon from "./Favicon";
import { getPolName } from "../util/name";
import { getQuestionText, parseTensionTitle } from "../util/topic";
import InlinePoliticianPicker from "./InlinePoliticianPicker";

const ESSENTIALS_URL =
  import.meta.env.VITE_ESSENTIALS_URL || "https://essentials.empowered.vote";

function ComparePanel({
  politician,
  dropdownValue,
  setDropdownValue,
  onSwitchPolitician,
  onClearComparison,
  onOpenFullModal,
  defaultLevel = "All",
}) {
  const { topics, selectedTopics, answers, setAnswers, compareAnswers, writeIns } =
    useCompass();

  const topicNames = selectedTopics
    .map((id) => {
      const t = topics.find((topic) => topic.id === id);
      return t ? t.short_title : null;
    })
    .filter(Boolean);
  const [selectedTopicID, setSelectedTopicID] = useState("");
  const [sources, setSources] = useState([]);
  const [reasoning, setReasoning] = useState("");
  const [saving, setSaving] = useState(false);

  const polName = getPolName(politician);
  const selectedTopic = topics.find((t) => t.short_title === dropdownValue);
  const userValue = answers[dropdownValue];
  const polValue = compareAnswers[dropdownValue];
  const isWriteIn = userValue && !Number.isInteger(userValue);
  const topicSelected = dropdownValue && dropdownValue !== "default";

  // Sync dropdown selection to topic ID
  useEffect(() => {
    const t = topics.find((topic) => topic.short_title === dropdownValue);
    setSelectedTopicID(t ? t.id : "");
  }, [dropdownValue, topics]);

  // Fetch reasoning + sources
  useEffect(() => {
    if (!selectedTopicID || !politician?.id) return;
    apiFetch(`/compass/politicians/${politician.id}/${selectedTopicID}/context`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            setReasoning("");
            setSources([]);
            return null;
          }
          const msg = await res.text();
          throw new Error(`${res.status} ${res.statusText}: ${msg}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setReasoning(data.reasoning || "");
        setSources(Array.isArray(data.sources) ? data.sources : []);
      })
      .catch((err) => {
        console.error("[ComparePanel] context fetch failed", err);
      });
  }, [selectedTopicID, politician?.id]);

  const handleChange = (event) => {
    setDropdownValue(event.target.value);
    setReasoning("");
    setSources([]);
  };

  const selectTopic = (topicName) => {
    setDropdownValue(topicName);
    setReasoning("");
    setSources([]);
  };

  const currentTopicIndex = topicSelected ? topicNames.indexOf(dropdownValue) : -1;
  const hasPrev = currentTopicIndex > 0;
  const hasNext = currentTopicIndex >= 0 && currentTopicIndex < topicNames.length - 1;

  const updateStance = (stanceIndex) => {
    if (saving || !selectedTopic) return;
    setSaving(true);
    apiFetch('/compass/answers', {
      method: "POST",
      body: JSON.stringify({
        topic_id: selectedTopic.id,
        value: stanceIndex,
      }),
    })
      .then((response) => {
        if (response.status === 200) {
          setAnswers((prev) => ({
            ...prev,
            [dropdownValue]: stanceIndex + 1,
          }));
        }
      })
      .catch((err) => {
        console.error("Error updating stance:", err);
      })
      .finally(() => setSaving(false));
  };

  const stances = selectedTopic?.stances || [];
  const polHasAnswered = polValue && polValue > 0;
  const hasContent =
    reasoning || (Array.isArray(sources) && sources.length > 0);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-neutral-200 dark:border-zinc-700 shadow-sm w-full flex flex-col">
      {/* Politician header — inline switcher */}
      <div className="p-5 pb-3">
        <InlinePoliticianPicker
          currentPolitician={politician}
          onSelect={onSwitchPolitician}
          onClear={onClearComparison}
          defaultOpen={!politician}
          defaultLevel={defaultLevel}
        />
        {politician?.id && (
          <a
            href={`${ESSENTIALS_URL}/politician/${politician.id}${serializeCompassFragment()}`}
            className="text-xs text-[#59b0c4] hover:text-[#00657c] dark:hover:text-ev-teal-light transition-colors mt-1 inline-flex items-center gap-1"
          >
            View full profile on Essentials
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3 h-3"
            >
              <path
                fillRule="evenodd"
                d="M4.22 11.78a.75.75 0 010-1.06L9.44 5.5H5.75a.75.75 0 010-1.5h5.5a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0V6.56l-5.22 5.22a.75.75 0 01-1.06 0z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        )}
      </div>

      {/* Topic selector + content — only once a politician is selected */}
      {politician?.id && <>
      <div className="px-5 pb-3">
        <select
          id="topic-dropdown"
          value={dropdownValue}
          onChange={handleChange}
          className="w-full font-semibold text-base py-2 px-3 rounded-lg bg-neutral-50 dark:bg-zinc-700 dark:text-white border border-neutral-200 dark:border-zinc-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#59b0c4]/40 focus:border-[#59b0c4] transition-colors"
        >
          <option value="default">Select a topic...</option>
          {topicNames.map((topic) => {
            const fullTopic = topics.find((t) => t.short_title === topic);
            return (
              <option value={topic} key={topic}>
                {fullTopic ? parseTensionTitle(fullTopic).name : topic}
              </option>
            );
          })}
        </select>
      </div>

      {/* Stance list + reasoning (only when topic selected) */}
      {topicSelected && selectedTopic && (
        <>
          {/* Topic heading: question_text first, tension name as subtitle (mirrors LibraryDrawer/Quiz) */}
          {(() => {
            const { name } = parseTensionTitle(selectedTopic);
            const question = getQuestionText(selectedTopic);
            return (
              <div className="px-5 pb-3">
                <h3 className="text-base font-semibold text-neutral-800 dark:text-white">{question || name}</h3>
                {question && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-normal mt-0.5">{name}</p>
                )}
              </div>
            );
          })()}

          {polHasAnswered ? (
            <>
              {/* Legend */}
              <div className="flex items-center gap-3 text-xs text-neutral-400 dark:text-gray-500 px-5 pb-2">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#7C6B9E]" />
                  You
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#5A9A6E] dark:bg-[#6DD28C]" />
                  {polName}
                </span>
              </div>

              {/* Stances */}
              <div className="px-3 pb-3 flex flex-col gap-1.5">
                {stances.map((stance, i) => {
                  const stanceNum = i + 1;
                  const isUser = !isWriteIn && userValue === stanceNum;
                  const isPol = polValue === stanceNum;
                  const isActive = isUser || isPol;

                  return (
                    <button
                      key={i}
                      onClick={() => !isWriteIn && updateStance(i)}
                      disabled={isWriteIn || saving}
                      className={`
                        relative text-left px-3 py-3 rounded-xl transition-all text-sm leading-snug
                        ${isWriteIn ? "cursor-default" : "cursor-pointer"}
                        ${
                          isActive
                            ? "bg-neutral-50 dark:bg-zinc-700 border border-neutral-200 dark:border-zinc-600"
                            : "border border-transparent hover:bg-neutral-50 dark:hover:bg-zinc-700"
                        }
                      `}
                    >
                      <span
                        className={`pr-6 ${isActive ? "text-neutral-900 dark:text-white" : "text-neutral-500 dark:text-gray-400"}`}
                      >
                        {stance.text}
                      </span>

                      {(isUser || isPol) && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          {isUser && (
                            <span className="w-2.5 h-2.5 rounded-full bg-[#7C6B9E] ring-2 ring-[#7C6B9E]/20" />
                          )}
                          {isPol && (
                            <span className="w-2.5 h-2.5 rounded-full bg-[#5A9A6E] dark:bg-[#6DD28C] ring-2 ring-[#5A9A6E]/20 dark:ring-[#6DD28C]/20" />
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}

                {isWriteIn && (
                  <div className="relative px-3 py-3 rounded-xl bg-[#7C6B9E]/5 dark:bg-[#7C6B9E]/10 border border-[#7C6B9E]/20">
                    <span className="text-sm text-neutral-900 dark:text-white pr-6">
                      {writeIns[dropdownValue] || "(Custom stance)"}
                    </span>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#7C6B9E] ring-2 ring-[#7C6B9E]/20 inline-block" />
                    </span>
                  </div>
                )}
              </div>

              {/* Reasoning + sources */}
              {hasContent && (
                <div className="px-5 pb-5 border-t border-neutral-100 dark:border-zinc-700">
                  {reasoning && (
                    <p className="whitespace-pre-wrap text-[0.94rem] leading-relaxed text-neutral-800 dark:text-gray-200 pt-4">
                      {reasoning}
                    </p>
                  )}

                  {Array.isArray(sources) && sources.length > 0 && (
                    <div
                      className={reasoning ? "mt-5 pt-4 border-t border-neutral-100 dark:border-zinc-700" : "pt-4"}
                    >
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-gray-500 mb-2.5">
                        References
                      </h3>
                      <ol className="flex flex-col gap-1.5">
                        {sources.map((source, i) => (
                          <li key={source + i} className="group">
                            <a
                              href={ensureProtocol(source)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2.5 px-2.5 py-2 -mx-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-zinc-700 transition-colors"
                            >
                              <span className="text-xs font-medium text-neutral-400 dark:text-gray-500 w-4 shrink-0 text-right">
                                {i + 1}
                              </span>
                              <Favicon url={source} size={16} />
                              <span className="text-sm text-[#00657c] dark:text-ev-teal-light group-hover:underline truncate">
                                {getDisplayUrl(source)}
                              </span>
                            </a>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="px-5 py-6">
              <p className="text-sm text-neutral-500 dark:text-gray-400 text-center italic">
                {polName} hasn&apos;t answered this topic yet.
              </p>
            </div>
          )}

          {topicNames.length > 1 && (
            <div className="px-5 py-3 border-t border-neutral-100 dark:border-zinc-700 flex items-center justify-between">
              <button
                onClick={() => hasPrev && selectTopic(topicNames[currentTopicIndex - 1])}
                disabled={!hasPrev}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${hasPrev ? "text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-zinc-700 cursor-pointer" : "text-neutral-300 dark:text-zinc-600 cursor-not-allowed"}`}
              >
                ← Back
              </button>
              <span className="text-xs text-neutral-400 dark:text-gray-500">
                {currentTopicIndex + 1} of {topicNames.length}
              </span>
              <button
                onClick={() => hasNext && selectTopic(topicNames[currentTopicIndex + 1])}
                disabled={!hasNext}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${hasNext ? "text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-zinc-700 cursor-pointer" : "text-neutral-300 dark:text-zinc-600 cursor-not-allowed"}`}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty state: no topic selected */}
      {!topicSelected && (
        <p className="text-center text-neutral-400 dark:text-gray-500 text-sm px-5 pb-5">
          Select a topic to compare
        </p>
      )}
      </>}
    </div>
  );
}

export default ComparePanel;

function ensureProtocol(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return "https://" + url;
}

function getDisplayUrl(url) {
  try {
    const u = new URL(ensureProtocol(url));
    let host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname;
    const display = host + path;
    return display.length > 60 ? display.slice(0, 57) + "..." : display;
  } catch {
    return url.length > 60 ? url.slice(0, 57) + "..." : url;
  }
}
