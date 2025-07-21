import { useState, useEffect } from "react";
import CreateUserAccordion from "./CreateUserAccordion";

function CreateUser({ topics }) {
  const [status, setStatus] = useState(null);
  const [newUser, setNewUser] = useState({});
  const [openMenu, setOpenMenu] = useState([]);
  const [checkedStances, setCheckedStances] = useState({});
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status) {
      const timeout = setTimeout(() => setStatus(null), 10000);
      return () => clearTimeout(timeout);
    }
  }, [status]);

  const updateSearch = (e) => {
    setSearch(e.target.value);
  };

  const visibleTopics = topics.filter((topic) =>
    topic.ShortTitle.toLowerCase().includes(search.toLowerCase())
  );

  const handleFieldChange = (field, value) => {
    setNewUser((prev) => ({ ...prev, [field]: value }));
  };

  const handleAccordionToggle = (topicID) => {
    setOpenMenu((prev) =>
      prev.includes(topicID)
        ? prev.filter((id) => id !== topicID)
        : [...prev, topicID]
    );
  };

  const toggleIsOpen = () => {
    setIsOpen(!isOpen);
  };

  const handleCheck = (topic, value) => {
    setCheckedStances((prev) => ({
      ...prev,
      [topic.ID]: { answer: value },
    }));
    console.log("Checked: ", checkedStances);
  };

  const isAnswered = (topic) => {
    return topic.ID in checkedStances;
  };

  const formatAnswers = () => {
    return Object.entries(checkedStances).map(([topic_id, data]) => ({
      topic_id,
      value: data.answer,
    }));
  };

  const submitUser = async () => {
    try {
      const createResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/create-dummy`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username: newUser.username }),
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error("Failed to create dummy user:", errorText);
        setStatus("error");
        return;
      }

      const answerResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/compass/answers/dummy`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: newUser.username,
            answers: formatAnswers(),
          }),
        }
      );

      if (!answerResponse.ok) {
        const errorText = await answerResponse.text();
        console.error("Failed to add dummy answers:", errorText);
        setStatus("error");
        return;
      }

      console.log("Dummy user and answers created successfully!");
      setStatus("success");

      setNewUser({});
      setCheckedStances({});
      setOpenMenu([]);
      setIsOpen(false);
      setSearch("");
    } catch (error) {
      console.error("Unexpected error:", error);
      setStatus("error");
    }
  };

  return (
    <div className="w-full md:w-3/4 mx-auto mt-6 space-y-4">
      <div className="mx-6 mt-6 border p-4 rounded-xl">
        <h1 className="text-2xl font-semibold text-center">
          Create a dummy user
        </h1>
        {status === "success" && (
          <div className="text-green-700 text-center font-medium mt-2">
            ✅ Dummy user created successfully!
          </div>
        )}
        {status === "error" && (
          <div className="text-red-600 text-center font-medium mt-2">
            ❌ Failed to create dummy user. Please try again.
          </div>
        )}
        <div className="w-full md:w-3/4 m-auto mt-6 flex gap-4 p-4 rounded-xl">
          <h1 className="block text-xl font-semibold">Username:</h1>
          <input
            className="border rounded p-1 w-1/2 bg-white"
            value={newUser.username}
            onChange={(e) => handleFieldChange("username", e.target.value)}
          />
        </div>
        <div className="w-full md:w-3/4 m-auto mt-6 flex flex-col gap-4 bg-neutral-50 border border-neutral-200 p-4 rounded-xl cursor-pointer">
          <div className="flex justify-between">
            <h1 className="block text-xl font-semibold">Add Answers:</h1>
            <button className="cursor-pointer underline" onClick={toggleIsOpen}>
              {isOpen ? "Close" : "Open"}
            </button>
          </div>
          <div className={`${isOpen ? "block" : "hidden"} flex flex-col gap-4`}>
            <input
              id="search"
              className="border rounded p-2 w-full bg-white"
              value={search}
              placeholder="Search..."
              onChange={(e) => updateSearch(e)}
            />
            {visibleTopics.map((topic) => {
              return (
                <CreateUserAccordion
                  key={topic.ID}
                  topic={topic}
                  isOpen={openMenu.includes(topic.ID)}
                  onToggle={() => handleAccordionToggle(topic.ID)}
                  onCheck={handleCheck}
                  checked={checkedStances}
                  isAnswered={isAnswered}
                />
              );
            })}
          </div>
        </div>
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={!newUser.username}
            onClick={submitUser}
            className="px-4 py-2 bg-black text-white rounded disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateUser;
