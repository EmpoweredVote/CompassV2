import { useCompass } from "./CompassContext";
import { useState, useEffect, useRef } from "react";
import placeholder from "../assets/placeholder.png";
import Favicon from "./Favicon";

function CompareDetail({ user, dropdownValue, setDropdownValue }) {
  const { topics, answers, compareAnswers } = useCompass();

  const topicNames = Object.keys(answers);
  const [selectedTab, setSelectedTab] = useState(0);
  const tabRefs = [useRef(null), useRef(null), useRef(null)];
  const [bgStyle, setBgStyle] = useState({ left: 0, width: 0 });
  const [selectedTopicID, setSelectedTopicID] = useState("");
  const [sources, setSources] = useState([]);
  const [reasoning, setReasoning] = useState("");

  useEffect(() => {
    fetch(
      `${import.meta.env.VITE_API_URL}/compass/context?user_id=${
        user.user_id
      }&topic_id=${selectedTopicID}`,
      {
        method: "GET",
        credentials: "include",
      }
    )
      .then(async (res) => {
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(`${res.status} ${res.statusText}: ${msg}`);
        }
        return res.json();
      })
      .then((data) => {
        setReasoning(data.reasoning);
        setSources(data.sources);
      })
      .catch((err) => {
        if (err.message.startsWith("404")) {
          setReasoning("");
          setSources([]);
        } else {
          console.error(err);
        }
      });
  }, [selectedTopicID]);

  useEffect(() => {
    const tab = tabRefs[selectedTab].current;
    if (tab) {
      const { offsetLeft, offsetWidth } = tab;
      setBgStyle({ left: offsetLeft, width: offsetWidth });
    }
  }, [selectedTab]);

  const handleChange = (event) => {
    setDropdownValue(event.target.value);
    setReasoning("");
    setSources([]);
  };

  useEffect(() => {
    topics
      .filter((topic) => topic.ShortTitle == dropdownValue)
      .map((topic) => setSelectedTopicID(topic.ID));
  }, [dropdownValue]);

  return (
    <div>
      <div className="bg-[#FAFAFA] rounded-lg border border-neutral-200 py-2 px-1 w-full md:h-auto flex flex-col items-center justify-center">
        {/* NAV HEADER */}
        <div className="relative flex flex-row justify-between gap-6 bg-gray-300/50 rounded-lg p-1">
          <div
            className="absolute top-1 h-[calc(100%-0.5rem)] bg-white rounded-lg transition-all duration-300 ease-in-out"
            style={{
              left: bgStyle.left,
              width: bgStyle.width,
            }}
          ></div>
          <div
            ref={tabRefs[0]}
            onClick={() => setSelectedTab(0)}
            className="relative z-10 px-2 py-2 flex gap-1 cursor-pointer"
          >
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
            </svg>
            <h2
              className={`${
                selectedTab != 0 ? "text-slate-500" : "text-black"
              } text-base font-medium`}
            >
              Summary
            </h2>
          </div>
          {/* <div
            ref={tabRefs[1]}
            onClick={() => setSelectedTab(1)}
            className="relative z-10 px-2 py-2 flex gap-1 cursor-pointer"
          >
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
            </svg>
            <h2
              className={`${
                selectedTab != 1 ? "text-slate-500" : "text-black"
              } text-md font-medium`}
            >
              Details
            </h2>
          </div> */}
          <div
            ref={tabRefs[2]}
            onClick={() => setSelectedTab(2)}
            className="relative z-10 px-2 py-2 flex gap-1 cursor-pointer"
          >
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
            </svg>
            <h2
              className={`${
                selectedTab != 2 ? "text-slate-500" : "text-black"
              } text-md font-medium`}
            >
              Sources
            </h2>
          </div>
        </div>
        <div className="mt-6">
          <img src={placeholder} />
        </div>
        {user.username && (
          <h2 className="text-xl font-bold my-6 text-center">
            {user.username}
          </h2>
        )}
        <div className="flex flex-col w-5/6 justify-center border-b border-black/40 my-4">
          <select
            id="topic-dropdown"
            value={dropdownValue}
            onChange={handleChange}
            className="w-full font-semibold text-xl mb-2 cursor-pointer"
          >
            <option value="default" className="text-center">
              Select a topic...
            </option>
            {topicNames.map((topic) => {
              return (
                <option value={topic} key={topic} className="text-center">
                  {topic}
                </option>
              );
            })}
          </select>
        </div>
        {selectedTab == 0 && (
          <div className="mt-4">
            {/* Scrollable section with paragraphs of fact based stance summary */}
            {reasoning ? (
              <div className="p-2 overflow-scroll md:max-h-96">
                <div className="whitespace-pre-wrap text-base leading-relaxed ml-1">
                  {reasoning}
                </div>
              </div>
            ) : (
              <h1 className="p-4 text-center">
                We haven't created {user.username}'s summary for{" "}
                {dropdownValue && dropdownValue != "default"
                  ? dropdownValue
                  : "this topic"}{" "}
                yet!
              </h1>
            )}
          </div>
        )}

        {/* {selectedTab == 1 && (
          <div className="mt-6">
            {dropdownValue && dropdownValue != "default" ? (
              <div className="text-center flex flex-col gap-4 justify-center items-center">
                {compareAnswers[dropdownValue] ? (
                  <h1 className="p-2 px-4 text-lg font-bold border rounded-lg w-1/6">
                    {compareAnswers[dropdownValue]}
                  </h1>
                ) : (
                  <></>
                )}
                {topics
                  .filter((topic) => topic.ShortTitle == dropdownValue)
                  .map((topic) =>
                    compareAnswers[dropdownValue] ? (
                      <p key={topic.ShortTitle} className="p-2">
                        {topic.stances[compareAnswers[dropdownValue] - 1].Text}
                      </p>
                    ) : (
                      <h1 className="p-4">
                        {user.username} has not answered this topic yet.
                      </h1>
                    )
                  )}
              </div>
            ) : (
              <h1 className="mb-4 text-center">
                Select a topic to view details.
              </h1>
            )}
          </div>
        )} */}

        {selectedTab == 2 && (
          <div className="mt-4">
            {sources ? (
              <div>
                {sources.length > 0 ? (
                  <div className="grid grid-cols-2 px-4 gap-6 overflow-scroll md:max-h-96">
                    {sources.map((source, i) => (
                      <div
                        className="flex flex-col border rounded-md items-center py-2 px-6 cursor-pointer gap-2"
                        key={source + i}
                        onClick={() => window.open(source, "_blank")}
                      >
                        <a
                          href={source}
                          target="_blank"
                          className="font-semibold text-lg"
                        >
                          {shortenTitle(getDomainName(source))}
                        </a>
                        <Favicon url={source} size={64} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mb-4">No sources found for this topic.</p>
                )}
              </div>
            ) : (
              <p className="mb-4">No sources found for this topic.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CompareDetail;

function getDomainName(url) {
  const ALIAS = {
    youtu: "YOUTUBE",
    nyti: "NYTIMES",
    amzn: "AMAZON",
    fb: "FACEBOOK", // fb.com
  };

  let cleaned = url.replace(/^(https?:\/\/)?(www\.)?/, "");
  let parts = cleaned.split(".");
  return ALIAS[parts[0]] || parts[0].toUpperCase();
}

function shortenTitle(title) {
  let newTitle = "";
  if (title.length > 8) {
    for (let i = 0; i < 8; i++) {
      newTitle += title[i];
    }
    newTitle += "...";
    return newTitle;
  } else {
    return title;
  }
}
