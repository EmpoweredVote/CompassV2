import { useCompass } from "./CompassContext";
import { useState, useEffect } from "react";
import placeholder from "../assets/placeholder.png";
import Favicon from "./Favicon";
import { getPolName, normalizeOfficeTitle } from "../util/name";
import { getQuestionText } from "../util/topic";

function ComparePanel({ politician, dropdownValue, setDropdownValue }) {
  const { topics, answers, setAnswers, compareAnswers, writeIns } =
    useCompass();

  const topicNames = Object.keys(answers);
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
    fetch(
      `${import.meta.env.VITE_API_URL}/compass/politicians/${politician.id}/${selectedTopicID}/context`,
      { method: "GET", credentials: "include" }
    )
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

  const updateStance = (stanceIndex) => {
    if (saving || !selectedTopic) return;
    setSaving(true);
    fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
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
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm w-full flex flex-col">
      {/* Politician header */}
      <div className="flex items-center gap-4 p-5 pb-3">
        <div className="size-16 rounded-full overflow-hidden shrink-0 ring-2 ring-neutral-100">
          <img
            src={
              politician.photo_origin_url ||
              politician.photo_custom_url ||
              placeholder
            }
            className="w-full h-full object-cover object-center"
          />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight truncate">
            {polName || "Selected Politician"}
          </h2>
          {politician.office_title && (
            <p className="text-neutral-500 text-sm leading-snug">
              {normalizeOfficeTitle(politician.office_title)}
            </p>
          )}
        </div>
      </div>

      {/* Topic selector */}
      <div className="px-5 pb-3">
        <select
          id="topic-dropdown"
          value={dropdownValue}
          onChange={handleChange}
          className="w-full font-semibold text-base py-2 px-3 rounded-lg bg-neutral-50 border border-neutral-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#59b0c4]/40 focus:border-[#59b0c4] transition-colors"
        >
          <option value="default">Select a topic...</option>
          {topicNames.map((topic) => (
            <option value={topic} key={topic}>
              {topic}
            </option>
          ))}
        </select>
      </div>

      {/* Stance list + reasoning (only when topic selected) */}
      {topicSelected && selectedTopic && (
        <>
          {/* Question header */}
          <p className="px-5 pb-3 text-base font-semibold text-neutral-800">
            {getQuestionText(selectedTopic)}
          </p>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-neutral-400 px-5 pb-2">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ff5740]" />
              You
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#59b0c4]" />
              {polName}
            </span>
          </div>

          {/* Stances */}
          <div className="px-3 pb-3 flex flex-col gap-1.5">
            {stances.map((stance, i) => {
              const stanceNum = i + 1;
              const isUser = !isWriteIn && userValue === stanceNum;
              const isPol = polHasAnswered && polValue === stanceNum;
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
                        ? "bg-neutral-50 border border-neutral-200"
                        : "border border-transparent hover:bg-neutral-50"
                    }
                  `}
                >
                  <span
                    className={`pr-6 ${isActive ? "text-neutral-900" : "text-neutral-500"}`}
                  >
                    {stance.text}
                  </span>

                  {(isUser || isPol) && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {isUser && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5740] ring-2 ring-[#ff5740]/20" />
                      )}
                      {isPol && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#59b0c4] ring-2 ring-[#59b0c4]/20" />
                      )}
                    </span>
                  )}
                </button>
              );
            })}

            {isWriteIn && (
              <div className="relative px-3 py-3 rounded-xl bg-[#ff5740]/5 border border-[#ff5740]/20">
                <span className="text-sm text-neutral-900 pr-6">
                  {writeIns[dropdownValue] || "(Custom stance)"}
                </span>
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5740] ring-2 ring-[#ff5740]/20 inline-block" />
                </span>
              </div>
            )}

            {!polHasAnswered && (
              <p className="text-xs text-neutral-400 text-center pt-1">
                {polName} hasn&apos;t answered this topic yet.
              </p>
            )}
          </div>

          {/* Scrollable reasoning + sources */}
          {hasContent && (
            <div className="px-5 pb-5 border-t border-neutral-100 overflow-y-auto lg:max-h-[20rem]">
              {reasoning && (
                <p className="whitespace-pre-wrap text-[0.94rem] leading-relaxed text-neutral-800 pt-4">
                  {reasoning}
                </p>
              )}

              {Array.isArray(sources) && sources.length > 0 && (
                <div
                  className={reasoning ? "mt-5 pt-4 border-t border-neutral-100" : "pt-4"}
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2.5">
                    References
                  </h3>
                  <ol className="flex flex-col gap-1.5">
                    {sources.map((source, i) => (
                      <li key={source + i} className="group">
                        <a
                          href={source}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2.5 px-2.5 py-2 -mx-2.5 rounded-lg hover:bg-neutral-50 transition-colors"
                        >
                          <span className="text-xs font-medium text-neutral-400 w-4 shrink-0 text-right">
                            {i + 1}
                          </span>
                          <Favicon url={source} size={16} />
                          <span className="text-sm text-[#00657c] group-hover:underline truncate">
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
      )}

      {/* Empty state: no topic selected */}
      {!topicSelected && (
        <p className="text-center text-neutral-400 text-sm px-5 pb-5">
          Select a topic to compare
        </p>
      )}
    </div>
  );
}

export default ComparePanel;

function getDisplayUrl(url) {
  try {
    const u = new URL(url);
    let host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname;
    const display = host + path;
    return display.length > 60 ? display.slice(0, 57) + "..." : display;
  } catch {
    return url.length > 60 ? url.slice(0, 57) + "..." : url;
  }
}
