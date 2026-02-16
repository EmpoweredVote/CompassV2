// Compass.jsx
import { useCompass } from "../components/CompassContext";
import RadarChart from "../components/RadarChart";
import AddTopicModal from "../components/AddTopicModal";
import ReplaceTopicModal from "../components/ReplaceTopicModal";
import CompareModal from "../components/CompareModal";
import ComparePanel from "../components/ComparePanel";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";

function SpokeHint({ onDismiss }) {
  return (
    <div className="absolute top-[22%] right-[15%] z-10 flex items-start gap-2 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg pl-3 pr-7 py-2.5 text-sm text-gray-600 max-w-[210px] shadow-md">
      <button onClick={onDismiss} className="absolute top-1.5 right-1.5 text-gray-400 hover:text-black cursor-pointer">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-ev-muted-blue mt-0.5">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
      </svg>
      <div>
        <span>Click any spoke to invert it.</span>
        <div className="flex items-center gap-3 mt-1.5 text-gray-400">
          <span className="flex items-center gap-1"><svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeWidth="2"/></svg> normal</span>
          <span className="flex items-center gap-1"><svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3"/></svg> inverted</span>
        </div>
      </div>
    </div>
  );
}

function Compass() {
  function TabBar() {
    const icons = [
      /* 0 – Compare (chain-link icon) */
      <svg
        width="18"
        height="22"
        viewBox="0 0 20 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={selectedTab != 0 ? "stroke-slate-500" : "stroke-black"}
      >
        <g clipPath="url(#clip0_71_343)">
          <path
            d="M7.91675 11.2622C8.25673 11.7167 8.69049 12.0928 9.1886 12.3649C9.68671 12.6371 10.2375 12.7989 10.8037 12.8394C11.3698 12.88 11.9381 12.7983 12.4699 12.5999C13.0017 12.4015 13.4846 12.0911 13.8859 11.6897L16.2609 9.31468C16.982 8.56813 17.3809 7.56825 17.3719 6.53038C17.3629 5.49252 16.9466 4.49972 16.2127 3.76581C15.4788 3.03191 14.486 2.61561 13.4481 2.60659C12.4103 2.59758 11.4104 2.99655 10.6638 3.7176L9.30216 5.07135"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M11.0834 9.67917C10.7434 9.22466 10.3096 8.84857 9.81152 8.57643C9.31341 8.30429 8.76259 8.14246 8.19644 8.10191C7.63028 8.06136 7.06203 8.14305 6.53022 8.34143C5.99841 8.53981 5.51549 8.85024 5.1142 9.25167L2.7392 11.6267C2.01816 12.3732 1.61918 13.3731 1.6282 14.411C1.63722 15.4488 2.05351 16.4416 2.78742 17.1755C3.52133 17.9094 4.51413 18.3257 5.55199 18.3348C6.58985 18.3438 7.58974 17.9448 8.33629 17.2238L9.69004 15.87"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <defs>
          <clipPath id="clip0_71_343">
            <rect
              width="19"
              height="19"
              fill="white"
              transform="translate(0 0.970703)"
            />
          </clipPath>
        </defs>
      </svg>,
      /* 1 – Graph  */
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={selectedTab != 1 ? "stroke-slate-500" : "stroke-black"}
      >
        <path
          d="M12 20.5V10.5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 20.5V4.5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 20.5V16.5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>,
    ];

    return (
      <div className="relative flex justify-around w-full bg-gray-300/50 rounded-lg p-1 mx-2 mb-4 lg:hidden border-l-4 border-ev-yellow">
        {/* moving highlight */}
        <div
          className="absolute top-1 h-[calc(100%-0.5rem)] bg-white rounded-lg transition-all"
          style={{
            left: bgStyle.left,
            width: bgStyle.width,
            pointerEvents: "none",
          }}
        />
        {["Compare", "Graph"].map((label, idx) => (
          <button
            key={label}
            ref={tabRefs[idx]}
            onClick={() => setSelectedTab(idx)}
            className="relative z-10 flex items-center gap-1 px-2 py-2"
          >
            {icons[idx]}
            <span
              className={`${
                selectedTab === idx ? "text-black" : "text-slate-500"
              } text-base font-medium`}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  function Legend() {
    if (!comparePol) return null;
    const name =
      comparePol.full_name ||
      [comparePol.first_name, comparePol.last_name].filter(Boolean).join(" ");
    return (
      <div className="flex gap-4 items-center">
        <span className="inline-block w-4 h-4 bg-[rgba(255,87,64,0.4)] border border-[#ff5740] rounded-sm" />
        You
        <span
          className="inline-block w-4 h-4 bg-[rgba(89,176,196,0.3)] border border-[#59b0c4] rounded-sm cursor-pointer"
          onClick={() => {
            setComparePol(null);
            setCompareAnswers({});
          }}
          title="Clear comparison"
        />
        {name || "Selected Politician"}
      </div>
    );
  }

  function ActionButtons() {
    return (
      <div className="flex gap-4 mt-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-black text-white rounded-full hover:bg-ev-yellow-dark hover:text-black transition-colors cursor-pointer"
        >
          Edit Topics
        </button>
        <button
          onClick={() => setIsCompareModal(true)}
          className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-black text-white rounded-full hover:bg-ev-yellow-dark hover:text-black transition-colors cursor-pointer"
        >
          Compare
        </button>
      </div>
    );
  }

  // -------- Compass Context --------
  const {
    topics,
    selectedTopics,
    setSelectedTopics,
    answers,
    setAnswers,
    writeIns,
    setWriteIns,
    compareAnswers,
    setCompareAnswers,
    invertedSpokes,
    setInvertedSpokes,
  } = useCompass();

  // -------- Local UI State --------
  const [showSpokeHint, setShowSpokeHint] = useState(
    () => !localStorage.getItem("onboarding_spokeFlip")
  );
  const dismissSpokeHint = () => {
    setShowSpokeHint(false);
    localStorage.setItem("onboarding_spokeFlip", "1");
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replacingTopic, setReplacingTopic] = useState(null);
  const [isCompareModal, setIsCompareModal] = useState(false);

  // NEW: selected comparison politician
  const [comparePol, setComparePol] = useState(null); // { id, full_name/first/last, ... }

  // Compare Details & Stance Explorer state
  const [dropdownValue, setDropdownValue] = useState("");

  // Nav State:
  const [selectedTab, setSelectedTab] = useState(1);
  const tabRefs = [useRef(null), useRef(null)];
  const [bgStyle, setBgStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const tab = tabRefs[selectedTab].current;
    if (tab) {
      const { offsetLeft, offsetWidth } = tab;
      setBgStyle({ left: offsetLeft, width: offsetWidth });
    }
  }, [selectedTab]);

  // -------- Load comparePol from localStorage on mount --------
  useEffect(() => {
    const savedPol = localStorage.getItem("comparePolitician");
    if (savedPol) {
      try {
        setComparePol(JSON.parse(savedPol));
      } catch {}
    }
  }, []);

  // -------- Sync compare politician -> localStorage --------
  useEffect(() => {
    if (comparePol) {
      localStorage.setItem("comparePolitician", JSON.stringify(comparePol));
    } else {
      localStorage.removeItem("comparePolitician");
    }
  }, [comparePol]);

  // Keep a ref to topics so the answer-fetch effect can use the latest
  // without re-firing every time topic metadata is edited in admin
  const topicsRef = useRef(topics);
  topicsRef.current = topics;

  // -------- Keep YOUR answers up to date when selectedTopics change --------
  useEffect(() => {
    if (!topicsRef.current.length || !selectedTopics.length)
      return;

    fetch(`${import.meta.env.VITE_API_URL}/compass/answers/batch`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedTopics }),
    })
      .then((res) => res.json())
      .then((data) => {
        const currentTopics = topicsRef.current;
        const mapped = selectedTopics
          .map((id) => {
            const answer = data.find((a) => a.topic_id === id);
            const topic = currentTopics.find((t) => t.id === id);
            if (!answer || !topic) return null;
            return [topic.short_title, answer.value];
          })
          .filter(Boolean);

        setAnswers(Object.fromEntries(mapped));

        // Populate writeIns from saved write_in_text
        const writeInEntries = selectedTopics
          .map((id) => {
            const answer = data.find((a) => a.topic_id === id);
            const topic = currentTopics.find((t) => t.id === id);
            if (!answer || !topic || !answer.write_in_text) return null;
            return [topic.short_title, answer.write_in_text];
          })
          .filter(Boolean);

        if (writeInEntries.length > 0) {
          setWriteIns((prev) => ({
            ...prev,
            ...Object.fromEntries(writeInEntries),
          }));
        }
      });
  }, [selectedTopics, setAnswers, setWriteIns]);

  // -------- Remove inversion if a topic is deleted --------
  const handleRemoveTopic = (idToRemove) => {
    setSelectedTopics((prev) => prev.filter((id) => id !== idToRemove));

    const topic = topics.find((t) => t.id === idToRemove);
    if (topic) {
      const short_title = topic.short_title;
      setInvertedSpokes((prev) => {
        const updated = { ...prev };
        delete updated[short_title];
        return updated;
      });
    }
  };

  const handleReplace = (newID) => {
    const oldTopic = topics.find((t) => t.short_title === replacingTopic);
    if (!oldTopic) return;

    setSelectedTopics((prev) =>
      prev.map((id) => (id === oldTopic.id ? newID : id))
    );

    setInvertedSpokes((prev) => {
      const updated = { ...prev };
      delete updated[replacingTopic];
      return updated;
    });

    setShowReplaceModal(false);
    setReplacingTopic(null);
  };

  // -------- Build compareAnswers when comparePol or topics change --------
  useEffect(() => {
    if (!comparePol || !selectedTopics.length) {
      setCompareAnswers({});
      return;
    }

    const url = `${import.meta.env.VITE_API_URL}/compass/politicians/${
      comparePol.id
    }/answers`;
    fetch(url, { credentials: "include" })
      .then((r) => r.json())
      .then((allAnswers) => {
        // allAnswers: [{topic_id, value}, ...]
        const mapped = selectedTopics
          .map((id) => {
            const a = allAnswers.find((x) => x.topic_id === id);
            const t = topics.find((tt) => tt.id === id);
            if (!t) return null;
            return [t.short_title, a ? a.value : 0];
          })
          .filter(Boolean);
        setCompareAnswers(Object.fromEntries(mapped));
      })
      .catch((e) => {
        console.error("[Compass] compare fetch failed", e);
        setCompareAnswers({});
      });
  }, [comparePol, selectedTopics, topics, setCompareAnswers]);

  const navigate = useNavigate();

  return (
    <div className="px-4 py-6 flex flex-col items-center overflow-hidden">
      {/* -------- back button -------- */}
      <button
        onClick={() => navigate("/library")}
        className="self-start flex items-center gap-1 text-sm text-gray-500 hover:text-black transition-colors cursor-pointer mb-2 lg:ml-4"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Back to Library
      </button>

      {/* -------- mobile nav bar -------- */}
      <TabBar />

      {/* -------- desktop 2-column layout (centered, max-width container) -------- */}
      <div className="hidden lg:flex lg:items-start lg:gap-6 xl:gap-8 w-full max-w-6xl mx-auto">
        {/* left: chart */}
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <Legend />
          <div className="w-[108%] relative">
            {showSpokeHint && <SpokeHint onDismiss={dismissSpokeHint} />}
            <RadarChart
              data={answers}
              compareData={compareAnswers}
              invertedSpokes={invertedSpokes}
              onToggleInversion={(topic) =>
                setInvertedSpokes((prev) => ({
                  ...prev,
                  [topic]: !prev[topic],
                }))
              }
              onReplaceTopic={(topic) => {
                setReplacingTopic(topic);
                setShowReplaceModal(true);
              }}
            />
          </div>
          <ActionButtons />
        </div>

        {/* right: compare panel */}
        {comparePol && (
          <div className="flex-1 min-w-[320px]">
            <ComparePanel
              politician={comparePol}
              dropdownValue={dropdownValue}
              setDropdownValue={setDropdownValue}
            />
          </div>
        )}
      </div>

      {/* -------- mobile: tab 0 (Compare) -------- */}
      {selectedTab === 0 && (
        <div className="w-full max-w-2xl lg:hidden">
          {comparePol ? (
            <ComparePanel
              politician={comparePol}
              dropdownValue={dropdownValue}
              setDropdownValue={setDropdownValue}
            />
          ) : (
            <div className="flex flex-col gap-6 w-full items-center mt-8">
              <h1 className="text-xl font-semibold">
                Select a politician to compare with
              </h1>
              <button
                onClick={() => setIsCompareModal(true)}
                className="px-6 py-2 bg-black text-white rounded-full hover:bg-opacity-90"
              >
                Compare
              </button>
            </div>
          )}
        </div>
      )}

      {/* -------- mobile: tab 1 (Graph) -------- */}
      {selectedTab === 1 && (
        <div className="w-full max-w-md md:max-w-lg flex flex-col items-center mx-auto lg:hidden">
          <Legend />
          <div className="w-full relative">
            {showSpokeHint && <SpokeHint onDismiss={dismissSpokeHint} />}
            <RadarChart
              data={answers}
              compareData={compareAnswers}
              invertedSpokes={invertedSpokes}
              onToggleInversion={(topic) =>
                setInvertedSpokes((prev) => ({
                  ...prev,
                  [topic]: !prev[topic],
                }))
              }
              onReplaceTopic={(topic) => {
                setReplacingTopic(topic);
                setShowReplaceModal(true);
              }}
            />
          </div>
          <ActionButtons />
        </div>
      )}

      {/* -------- modals (shared) -------- */}
      {isCompareModal && (
        <CompareModal
          selectedTopics={selectedTopics}
          onCompare={(p) => setComparePol(p)}
          onClose={() => setIsCompareModal(false)}
        />
      )}
      {isModalOpen && (
        <AddTopicModal
          selectedTopics={selectedTopics}
          onAddTopics={(ids) => setSelectedTopics([...selectedTopics, ...ids])}
          onRemoveTopic={handleRemoveTopic}
          onClose={() => setIsModalOpen(false)}
        />
      )}
      {showReplaceModal && replacingTopic && (
        <ReplaceTopicModal
          replacingTopic={replacingTopic}
          selectedTopics={selectedTopics}
          onReplace={handleReplace}
          onClose={() => setShowReplaceModal(false)}
        />
      )}
    </div>
  );
}

export default Compass;
