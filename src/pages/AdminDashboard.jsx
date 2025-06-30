import { useState } from "react";
import { useCompass } from "../components/CompassContext";

// Dashboard for admins to easily update data without accessing the database manually.
// Need to create an auth check for account role (Must be admin to access).

// Display topics as a list of accordion menus.
// Each topic has their properties (Title, ShortTitle, Categories, Stances). Can include ID but make it uneditable.
// Able to click a pencil Icon to edit any topic's properties.
// Stances are another nested accordion menu.

function AdminDashboard() {
  const {
    topics,
    setTopics,
    selectedTopics,
    setSelectedTopics,
    answers,
    setAnswers,
    compareAnswers,
    setCompareAnswers,
  } = useCompass();

  const [openMenu, setOpenMenu] = useState([]);
  const [editedTopic, setEditedTopic] = useState();
  const [newStance, setNewStance] = useState({});
  const [newShortTitle, setNewShortTitle] = useState({});
  const [editedFields, setEditedFields] = useState({});

  const fetchTopics = () => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/topics`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setTopics(data);
      })
      .catch((err) => {
        console.error("Failed to fetch topics:", err);
      });
  };

  const handleClick = (topicID) => {
    setOpenMenu((prev) =>
      openMenu.includes(topicID)
        ? openMenu.filter((id) => id != topicID)
        : [...prev, topicID]
    );
  };

  const handleEdit = (topicID) => {
    if (!openMenu.includes(topicID)) {
      setOpenMenu((prev) => [...prev, topicID]);
    }
    setEditedTopic((prev) => (prev != topicID ? topicID : ""));
  };

  const handleShortTitleChange = (event, topicID) => {
    const value = event.target.value;
    setEditedFields((prev) => ({
      ...prev,
      [topicID]: {
        ...prev[topicID],
        ShortTitle: value,
      },
    }));
  };

  const handleTitleChange = (event, topicID) => {
    const value = event.target.value;
    setEditedFields((prev) => ({
      ...prev,
      [topicID]: {
        ...prev[topicID],
        Title: value,
      },
    }));
  };

  const handleStanceChange = (event, stanceID) => {
    setNewStance((prev) => ({
      ...prev,
      [stanceID]: event.target.value,
    }));
  };

  const submitEdit = (topicID) => {
    const payload = {
      ID: topicID,
      ...editedFields[topicID],
    };

    fetch(`${import.meta.env.VITE_API_URL}/compass/topics/update`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to update topic");
        return res.text();
      })
      .then((data) => {
        console.log("Success:", data);
        setEditedTopic("");
        fetchTopics();
      })
      .catch((err) => console.error("Error updating topic:", err));
  };

  console.log(topics);
  console.log(newStance);

  return (
    <div>
      <h1 className="text-center text-xl">Admin Dashboard</h1>
      {topics.map((topic) => {
        return (
          <div>
            <div
              key={topic.ID}
              className="flex flex-row m-2 px-4 border justify-between items-center"
            >
              <div
                className="w-3/4 py-4 h-full cursor-pointer"
                onClick={() => handleClick(topic.ID)}
              >
                <h1 className="text-lg">{topic.Title}</h1>
              </div>
              <div
                className="flex justify-end cursor-pointer"
                onClick={() => {
                  handleEdit(topic.ID);
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                  />
                </svg>
              </div>
            </div>
            {openMenu.includes(topic.ID) &&
              (editedTopic === topic.ID ? (
                <div className="flex flex-col border m-2 p-4 gap-2">
                  <div className="flex flex-row">
                    <h1 className="ml-6">ID:</h1>
                    <p className="px-4">{topic.ID}</p>
                  </div>
                  <div className="flex flex-row w-full">
                    <label className="ml-6">
                      Title:
                      <input
                        type="text"
                        value={editedFields[topic.ID]?.Title ?? topic.Title}
                        onChange={(e) => handleTitleChange(e, topic.ID)}
                        className="border rounded-lg ml-4 px-2 min-w-96"
                      />
                    </label>
                  </div>
                  <div className="flex flex-row">
                    <label className="ml-6">
                      Short Title:
                      <input
                        type="text"
                        value={
                          editedFields[topic.ID]?.ShortTitle ?? topic.ShortTitle
                        }
                        onChange={(e) => handleShortTitleChange(e, topic.ID)}
                        className="border rounded-lg ml-4 px-2"
                      />
                    </label>
                  </div>
                  <div className="flex flex-row">
                    <h1 className="ml-6">Categories:</h1>
                    <ol>
                      {topic.Categories.map((category) => (
                        <li className="px-4" key={topic.ID}>
                          {category.Title}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="flex flex-col">
                    <h1 className="ml-6">Stances:</h1>
                    {topic.stances.map((stance) => (
                      <div>
                        <textarea
                          id={stance.ID}
                          value={newStance[stance.ID]}
                          onChange={(event) =>
                            handleStanceChange(event, stance.ID)
                          }
                          defaultValue={stance.Text}
                          className="border rounded-lg ml-8 px-2 w-3/4"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-6 justify-end">
                    <button
                      className="border rounded-lg p-2 cursor-pointer hover:bg-gray-200"
                      onClick={() => {
                        setEditedTopic("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="border text-white rounded-lg px-4 py-2 cursor-pointer bg-green-600 hover:bg-green-700"
                      onClick={() => submitEdit(topic.ID)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col border m-2 p-4 gap-2">
                  <div className="flex flex-row">
                    <h1 className="ml-6">ID:</h1>
                    <p className="px-4">{topic.ID}</p>
                  </div>
                  <div className="flex flex-row">
                    <h1 className="ml-6">Title:</h1>
                    <p className="px-4">{topic.Title}</p>
                  </div>
                  <div className="flex flex-row">
                    <h1 className="ml-6">Short Title:</h1>
                    <p className="px-4">{topic.ShortTitle}</p>
                  </div>
                  <div className="flex flex-row">
                    <h1 className="ml-6">Categories:</h1>
                    <ol>
                      {topic.Categories.map((category) => (
                        <li className="px-4" key={topic.ID}>
                          {category.Title}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="flex flex-col">
                    <h1 className="ml-6">Stances:</h1>
                    {topic.stances.map((stance) => (
                      <div>
                        <p className="ml-8">
                          {stance.Value}.{" "}
                          {newStance[stance.ID]
                            ? newStance[stance.ID]
                            : stance.Text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

export default AdminDashboard;
