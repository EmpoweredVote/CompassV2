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

  // const filteredTopics = topics.filter((topic) =>
  //   topic.ShortTitle.toLowerCase().includes(search.toLowerCase())
  // );

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
        console.log(data);
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

    console.log("Selected topics: ", selectedTopics);
  };

  return (
    <>
      <div className="mt-6">
        <h1 className="text-4xl font-semibold mb-6 text-center">
          Topic Library
        </h1>
      </div>
      <div className="flex items-center w-full max-w-xl mx-auto bg-gray-100 rounded-xl px-4 py-2 mb-6">
        <span className="text-gray-400 mr-2">🔍</span>
        <input
          type="text"
          name="search"
          onChange={(event) => updateSearch(event)}
          value={search}
          placeholder="Search..."
          className="w-full bg-transparent outline-none text-sm"
        />
      </div>
      <div>
        {categories.map((category) => (
          <div key={category.ID} className="p-4 mb-6">
            <h1
              key={category.Title}
              className="text-4xl font-semibold mb-2 p-4"
            >
              {category.Title}
            </h1>
            <div className="flex flex-wrap gap-3 p-4">
              {category.Topics.map((topic) => (
                <button
                  key={topic.ID}
                  onClick={() => toggleTopic(topic.ID)}
                  className={`px-4 py-2 rounded-full border text-base font-medium transition-colors duration-200 cursor-pointer ${
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
      <div className="m-10"></div>

      {/* <div className="flex flex-wrap gap-3 p-4">
        {filteredTopics.map((topic) => (
          <button
            key={topic.ID}
            onClick={() => toggleTopic(topic.ID)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors duration-200 cursor-pointer ${
              selectedTopics.includes(topic.ID)
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-black border-black hover:bg-gray-100"
            }`}
          >
            {topic.ShortTitle}
          </button>
        ))}
      </div> */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => navigate("/quiz")}
          disabled={selectedTopics.length > 0 ? false : true}
          className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors duration-200 cursor-pointer bg-white text-black border-black hover:bg-gray-100 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-500 disabled:shadow-none`}
        >
          Continue
        </button>
      </div>
    </>
  );
}

export default Library;
