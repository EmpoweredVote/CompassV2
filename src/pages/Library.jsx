import { useState, useEffect } from "react";
import { useCompass } from "../components/CompassContext";
import { useNavigate } from "react-router";

function Library() {
  const {
    topics,
    setTopics,
    selectedTopics,
    setSelectedTopics,
    categories,
    setCategories,
    showPrevAnswers,
    setShowPrevAnswers,
  } = useCompass();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [answeredTopicIDs, setAnsweredTopicIDs] = useState([]);
  const [answeredLoaded, setAnsweredLoaded] = useState(false);

  const updateSearch = (e) => {
    setSearch(e.target.value);
  };

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/answers`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        const ids = data.map((a) => a.topic_id);
        setAnsweredTopicIDs(ids);
        setAnsweredLoaded(true);
      });
  }, []);

  const getVisibleTopics = (category) => {
    return category.Topics.filter(
      (t) => showPrevAnswers || !answeredTopicIDs.includes(t.ID)
    ).filter((t) => t.ShortTitle.toLowerCase().includes(search.toLowerCase()));
  };

  const toggleTopic = (topicID) => {
    if (selectedTopics.includes(topicID)) {
      setSelectedTopics(selectedTopics.filter((topic) => topic !== topicID));
    } else {
      setSelectedTopics((prevTopics) => [...prevTopics, topicID]);
    }
  };

  return (
    <>
      <div className="mt-6 px-4 md:px-0">
        <h1 className="text-4xl md:text-4xl font-semibold mb-6 text-center">
          Topic Library
        </h1>
      </div>
      <div className="flex items-center w-90 md:w-full max-w-xl mx-auto bg-gray-100 rounded-xl px-4 py-2 mb-6">
        <span className="text-gray-400 mr-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="w-5 h-5 md:w-6 md:h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </span>
        <input
          type="text"
          name="search"
          onChange={updateSearch}
          value={search}
          placeholder="Search..."
          className="w-full bg-transparent outline-none text-sm md:text-base"
        />
      </div>
      <div className="flex items-center justify-center w-full max-w-xl mx-auto">
        <button
          className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full border text-sm md:text-base font-medium transition-colors duration-200 cursor-pointer ${
            showPrevAnswers
              ? "bg-green-600 text-white border-green-600"
              : "bg-white text-black border-black hover:bg-gray-100"
          }`}
          onClick={() => setShowPrevAnswers(!showPrevAnswers)}
        >
          Show Previously Answered
        </button>
      </div>
      {answeredLoaded && (
        <div className="m-4 md:m-6">
          {categories.map((category) => {
            const visible = getVisibleTopics(category);

            if (visible.length === 0) return null;

            return (
              <div key={category.ID} className="p-2 md:p-4 mb-6">
                <h2 className="text-xl md:text-2xl font-semibold mb-2 px-2">
                  {category.Title}
                </h2>
                <div className="flex flex-wrap gap-2 md:gap-3 p-2 md:p-4">
                  {visible.map((topic) => (
                    <button
                      key={topic.ID}
                      onClick={() => toggleTopic(topic.ID)}
                      className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full border text-sm md:text-base font-medium transition-colors duration-200 cursor-pointer ${
                        selectedTopics.includes(topic.ID)
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-white text-black border-black hover:bg-gray-100"
                      }`}
                    >
                      {answeredTopicIDs.includes(topic.ID) ? (
                        <span className="flex flex-row gap-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill={
                              selectedTopics.includes(topic.ID)
                                ? "#eab308"
                                : "none"
                            }
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className={`size-6 ${
                              selectedTopics.includes(topic.ID)
                                ? "text-black"
                                : "text-yellow-500"
                            }`}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                            />
                          </svg>

                          {topic.ShortTitle}
                        </span>
                      ) : (
                        topic.ShortTitle
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="h-20" />

      <div className="fixed bottom-25 right-2 md:bottom-4 md:right-4 z-50">
        <button
          onClick={() => navigate("/quiz")}
          disabled={selectedTopics.length === 0}
          className="px-4 py-2 rounded-full border text-sm font-medium transition-colors duration-200 cursor-pointer bg-white text-black border-black hover:bg-gray-100 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </>
  );
}

export default Library;
