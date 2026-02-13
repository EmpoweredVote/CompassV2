// Compass.jsx
import { useCompass } from "../components/CompassContext";
import RadarChart from "../components/RadarChart";
import AddTopicModal from "../components/AddTopicModal";
import ReplaceTopicModal from "../components/ReplaceTopicModal";
import CompareModal from "../components/CompareModal";
import CompareDetail from "../components/CompareDetail";
import StanceExplorer from "../components/StanceExplorer";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";

function Compass() {
  function TabBar() {
    const icons = [
      /* 0 – Stances */
      <svg
        width="20"
        height="22"
        viewBox="0 0 20 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={selectedTab != 0 ? "stroke-slate-500" : "stroke-black"}
      >
        <path
          d="M11.6667 2.1665H5.00004C4.55801 2.1665 4.13409 2.3421 3.82153 2.65466C3.50897 2.96722 3.33337 3.39114 3.33337 3.83317V17.1665C3.33337 17.6085 3.50897 18.0325 3.82153 18.345C4.13409 18.6576 4.55801 18.8332 5.00004 18.8332H15C15.4421 18.8332 15.866 18.6576 16.1786 18.345C16.4911 18.0325 16.6667 17.6085 16.6667 17.1665V7.1665L11.6667 2.1665Z"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11.6666 2.1665V7.1665H16.6666"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.3333 11.3335H6.66663"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.3333 14.6665H6.66663"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.33329 8H7.49996H6.66663"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
      /* 2 – Details */
      <svg
        width="18"
        height="22"
        viewBox="0 0 20 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={selectedTab != 2 ? "stroke-slate-500" : "stroke-black"}
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
    ];

    return (
      <div className="relative flex justify-around w-full bg-gray-300/50 rounded-lg p-1 mx-2 mb-4 md:hidden border-l-4 border-ev-yellow">
        {/* moving highlight */}
        <div
          className="absolute top-1 h-[calc(100%-0.5rem)] bg-white rounded-lg transition-all"
          style={{
            left: bgStyle.left,
            width: bgStyle.width,
            pointerEvents: "none",
          }}
        />
        {["Stances", "Graph", "Details"].map((label, idx) => (
          <button
            key={label}
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
        <span className="inline-block w-4 h-4 bg-pink-500/40 border border-pink-500 rounded-sm" />
        You
        <span
          className="inline-block w-4 h-4 bg-blue-500/20 border border-blue-500 rounded-sm cursor-pointer"
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
          className="px-6 py-2 bg-black text-white rounded-full hover:bg-ev-yellow-dark hover:text-black transition-colors cursor-pointer"
        >
          Edit Topics
        </button>
        <button
          onClick={() => setIsCompareModal(true)}
          className="px-6 py-2 bg-black text-white rounded-full hover:bg-ev-yellow-dark hover:text-black transition-colors cursor-pointer"
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
  } = useCompass();

  // -------- Local UI State --------
  const [invertedSpokes, setInvertedSpokes] = useState({});
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
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
  const tabRefs = [useRef(null), useRef(null), useRef(null)];
  const [bgStyle, setBgStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const tab = tabRefs[selectedTab].current;
    if (tab) {
      const { offsetLeft, offsetWidth } = tab;
      setBgStyle({ left: offsetLeft, width: offsetWidth });
    }
  }, [selectedTab]);

  // -------- Load localStorage on first mount --------
  useEffect(() => {
    const savedInversions = localStorage.getItem("invertedSpokes");
    const savedPol = localStorage.getItem("comparePolitician");

    if (savedInversions) setInvertedSpokes(JSON.parse(savedInversions));
    if (savedPol) {
      try {
        setComparePol(JSON.parse(savedPol));
      } catch {}
    }

    setHasLoadedFromStorage(true);
  }, []);

  // -------- Sync invertedSpokes -> localStorage --------
  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    localStorage.setItem("invertedSpokes", JSON.stringify(invertedSpokes));
  }, [invertedSpokes, hasLoadedFromStorage]);

  // -------- Sync compare politician -> localStorage --------
  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    if (comparePol) {
      localStorage.setItem("comparePolitician", JSON.stringify(comparePol));
    } else {
      localStorage.removeItem("comparePolitician");
    }
  }, [comparePol, hasLoadedFromStorage]);

  // Keep a ref to topics so the answer-fetch effect can use the latest
  // without re-firing every time topic metadata is edited in admin
  const topicsRef = useRef(topics);
  topicsRef.current = topics;

  // -------- Keep YOUR answers up to date when selectedTopics change --------
  useEffect(() => {
    if (!hasLoadedFromStorage || !topicsRef.current.length || !selectedTopics.length)
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
  }, [selectedTopics, hasLoadedFromStorage, setAnswers, setWriteIns]);

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
    <div className="px-4 py-6 flex flex-col md:flex-row  items-center overflow-hidden">
      {/* -------- back button -------- */}
      <button
        onClick={() => navigate("/library")}
        className="self-start flex items-center gap-1 text-sm text-gray-500 hover:text-black transition-colors cursor-pointer mb-2 md:absolute md:top-20 md:left-24"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Back to Library
      </button>

      {/* -------- mobile nav bar -------- */}
      <TabBar />

      {/* -------- compare column (hidden on mobile) -------- */}
      {comparePol && (
        <div className="hidden md:block md:w-2/3 md:max-w-90">
          <CompareDetail
            politician={comparePol}
            dropdownValue={dropdownValue}
            setDropdownValue={setDropdownValue}
          />
        </div>
      )}

      {/* -------- center column (chart / stances / Details) -------- */}
      <div className="w-full flex flex-col items-center">
        {selectedTab === 0 && (
          <div className="w-full max-w-2xl flex flex-col items-center gap-4 md:hidden">
            {comparePol ? (
              <StanceExplorer
                // If StanceExplorer still expects `user`, we pass both for compatibility
                user={comparePol}
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

        {selectedTab === 1 && (
          <div className="w-full max-w-2xl flex flex-col items-center">
            <Legend />
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
            <ActionButtons />
          </div>
        )}

        {selectedTab === 2 &&
          (comparePol ? (
            <div className="md:hidden w-full">
              <CompareDetail
                politician={comparePol}
                dropdownValue={dropdownValue}
                setDropdownValue={setDropdownValue}
              />
            </div>
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
          ))}
      </div>

      {comparePol && (
        <div className="hidden md:block w-1/2 md:min-w-[280px]">
          <StanceExplorer
            user={comparePol}
            politician={comparePol}
            dropdownValue={dropdownValue}
            setDropdownValue={setDropdownValue}
          />
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
