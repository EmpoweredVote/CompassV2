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
  } = useCompass();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const updateSearch = (e) => {
    setSearch(e.target.value);
  };

  const filteredTopics = categories.map((category) =>
    category.Topics.filter((topic) =>
      topic.ShortTitle.toLowerCase().includes(search.toLowerCase())
    )
  );

  useEffect(() => {
    fetch("http://localhost:5050/compass/topics", {
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("HTTP error " + response.status);
        } else {
          return response.json();
        }
      })
      .then((data) => {
        setTopics(data);
      })
      .catch((error) => {
        console.error("Error during HTTP request:", error);
      });

    fetch("http://localhost:5050/compass/categories", {
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("HTTP error " + response.status);
        } else {
          return response.json();
        }
      })
      .then((data) => {
        setCategories(data);
      })
      .catch((error) => {
        console.error("Error during HTTP request:", error);
      });
  }, []);

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
      <div className="flex items-center w-full max-w-xl mx-auto bg-gray-100 rounded-xl px-4 py-2 mb-6">
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

      <div className="m-4 md:m-6">
        {categories.map((category) => (
          <div key={category.ID} className="p-2 md:p-4 mb-6">
            <h2 className="text-xl md:text-2xl font-semibold mb-2 px-2">
              {category.Title}
            </h2>
            <div className="flex flex-wrap gap-2 md:gap-3 p-2 md:p-4">
              {category.Topics.map((topic) => (
                <button
                  key={topic.ID}
                  onClick={() => toggleTopic(topic.ID)}
                  className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full border text-sm md:text-base font-medium transition-colors duration-200 cursor-pointer ${
                    selectedTopics.includes(topic.ID)
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-black border-black hover:bg-gray-100"
                  }`}
                >
                  {topic.ShortTitle}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="h-20" />

      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => navigate("/quiz")}
          disabled={selectedTopics.length === 0}
          className="px-4 py-2 rounded-full border text-sm font-medium transition-colors duration-200 cursor-pointer bg-white text-black border-black hover:bg-gray-100 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-500"
        >
          Continue
        </button>
      </div>
    </>
  );
}

export default Library;
