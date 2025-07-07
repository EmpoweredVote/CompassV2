import { useState, useEffect } from "react";
import { useCompass } from "../components/CompassContext";
import { source } from "framer-motion/m";

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
  const [editedFields, setEditedFields] = useState({});
  const [allCategories, setAllCategories] = useState([]);
  const [currentTab, setCurrentTab] = useState("Topics");
  const [users, setUsers] = useState([]);
  const [context, setContext] = useState();
  const [openTopics, setOpenTopics] = useState([]);
  const [visibleOnlyWithContext, setVisibleOnlyWithContext] = useState({});
  const [editingContext, setEditingContext] = useState(null); // { user_id, topic_id }
  const [editedContextFields, setEditedContextFields] = useState({});

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/categories`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setAllCategories(data))
      .catch((err) => console.error("Failed to fetch categories:", err));
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/empowered-accounts`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then(setUsers)
      .catch((err) => {
        console.error("Failed to fetch empowered users:", err);
      });
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/context`, {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        const contextMap = {};

        data.forEach((context) => {
          if (!contextMap[context.UserID]) {
            contextMap[context.UserID] = [];
          }

          contextMap[context.UserID].push({
            topic_id: context.topic_id,
            reasoning: context.reasoning,
            sources: context.sources,
          });
        });

        setContext(contextMap);
        console.log("Context map:", contextMap);
      })
      .then(console.log("data: ", context));
  }, []);

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

  const handleClick = (ID) => {
    setOpenMenu((prev) =>
      openMenu.includes(ID) ? openMenu.filter((id) => id != ID) : [...prev, ID]
    );
  };

  const changeTab = (event) => {
    setCurrentTab(event.target.innerText);
    setOpenMenu([]);
  };

  const toggleDisplay = (ID) => {
    setOpenTopics((prev) =>
      openTopics.includes(ID)
        ? openTopics.filter((id) => id != ID)
        : [...prev, ID]
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

  const handleContextChange = (userID, topicID, field, value) => {
    setEditedContextFields((prev) => ({
      ...prev,
      [userID]: {
        ...(prev[userID] || {}),
        [topicID]: {
          ...(prev[userID]?.[topicID] || {}),
          [field]: value,
        },
      },
    }));
  };

  const saveContextEdit = async (userID, topicID) => {
    const payload = {
      user_id: userID,
      topic_id: topicID,
      ...editedContextFields[userID]?.[topicID],
    };

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/compass/context`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("Failed to update context");

      // Clear edit state
      setEditingContext(null);
      setEditedContextFields((prev) => {
        const updated = { ...prev };
        delete updated[userID]?.[topicID];
        return updated;
      });

      // Refresh context
      const updatedRes = await fetch(
        `${import.meta.env.VITE_API_URL}/compass/context`,
        {
          credentials: "include",
        }
      );
      const newData = await updatedRes.json();

      const contextMap = {};
      newData.forEach((c) => {
        if (!contextMap[c.UserID]) contextMap[c.UserID] = [];
        contextMap[c.UserID].push({
          topic_id: c.topic_id,
          reasoning: c.reasoning,
          sources: c.sources,
        });
      });

      setContext(contextMap);
    } catch (err) {
      console.error("Context save error:", err);
    }
  };

  const submitStanceEdits = (topic) => {
    const relevantStances = topic.stances.map((s) => s.ID);
    const stancePayload = Object.entries(newStance)
      .filter(([id]) => relevantStances.includes(id))
      .map(([id, text]) => ({ ID: id, Text: text }));

    if (stancePayload.length === 0) return;

    fetch(`${import.meta.env.VITE_API_URL}/compass/stances/update`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stancePayload),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to update stances");
        return res.text();
      })
      .then((data) => {
        console.log("Stance update success:", data);
        setNewStance({});
        fetchTopics();
      })
      .catch((err) => {
        console.error("Stance update error:", err);
      });
  };

  const handleAddCategory = (topicID, categoryID) => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/topics/categories/update`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic_id: topicID,
        add: [categoryID],
        remove: [],
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to add category");
        fetchTopics(); // Refresh topic data
      })
      .catch((err) => console.error("Error adding category:", err));
  };

  const handleRemoveCategory = (topicID, categoryID) => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/topics/categories/update`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic_id: topicID,
        add: [],
        remove: [categoryID],
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to remove category");
        fetchTopics();
      })
      .catch((err) => console.error("Error removing category:", err));
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

  return (
    <div className="mx-6">
      <h1 className="text-center text-2xl font-bold">Admin Dashboard</h1>
      <div className="w-1/2 m-auto">
        <div className="flex flex-row justify-center gap-8 my-4">
          <button
            className="py-2 px-8 border rounded-md cursor-pointer font-semibold hover:bg-gray-200"
            onClick={(e) => changeTab(e)}
          >
            Topics
          </button>
          <button
            className="py-2 px-8 border rounded-md cursor-pointer font-semibold hover:bg-gray-200"
            onClick={(e) => changeTab(e)}
          >
            Users
          </button>
        </div>
      </div>
      {currentTab == "Topics" ? (
        topics.map((topic) => {
          const topicCategoryIDs = new Set(topic.Categories.map((c) => c.ID));
          const availableCategories = allCategories.filter(
            (c) => !topicCategoryIDs.has(c.ID)
          );
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
                      <h1 className="ml-6 font-semibold">ID:</h1>
                      <p className="px-4">{topic.ID}</p>
                    </div>
                    <div className="flex flex-row w-full">
                      <label className="ml-6 font-semibold">
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
                      <label className="ml-6 font-semibold">
                        Short Title:
                        <input
                          type="text"
                          value={
                            editedFields[topic.ID]?.ShortTitle ??
                            topic.ShortTitle
                          }
                          onChange={(e) => handleShortTitleChange(e, topic.ID)}
                          className="border rounded-lg ml-4 px-2"
                        />
                      </label>
                    </div>
                    <div className="flex flex-col">
                      <h1 className="ml-6 mb-2 font-semibold">Categories:</h1>
                      <ol className="ml-6 mb-2">
                        {topic.Categories.map((category) => (
                          <li
                            key={category.ID}
                            className="flex items-center gap-2"
                          >
                            {category.Title}
                            <button
                              className="text-red-600 hover:underline text-sm"
                              onClick={() =>
                                handleRemoveCategory(topic.ID, category.ID)
                              }
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ol>
                      <div className="ml-6">
                        <h2 className="font-semibold">Add Category:</h2>
                        <select
                          className="border rounded px-2 py-1 mt-1"
                          onChange={(e) =>
                            handleAddCategory(topic.ID, e.target.value)
                          }
                          defaultValue=""
                        >
                          <option disabled value="">
                            Select a category
                          </option>
                          {availableCategories.map((category) => (
                            <option key={category.ID} value={category.ID}>
                              {category.Title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <h1 className="ml-6 font-semibold">Stances:</h1>
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
                        onClick={() => {
                          submitEdit(topic.ID);
                          submitStanceEdits(topic);
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col border m-2 p-4 gap-2">
                    <div className="flex flex-row">
                      <h1 className="ml-6 font-semibold">ID:</h1>
                      <p className="px-4">{topic.ID}</p>
                    </div>
                    <div className="flex flex-row">
                      <h1 className="ml-6 font-semibold">Title:</h1>
                      <p className="px-4">{topic.Title}</p>
                    </div>
                    <div className="flex flex-row">
                      <h1 className="ml-6 font-semibold">Short Title:</h1>
                      <p className="px-4">{topic.ShortTitle}</p>
                    </div>
                    <div className="flex flex-row">
                      <h1 className="ml-6 font-semibold">Categories:</h1>
                      <ul>
                        {topic.Categories.map((category) => (
                          <li className="px-4" key={category.ID}>
                            {category.Title}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col">
                      <h1 className="ml-6 font-semibold">Stances:</h1>
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
        })
      ) : (
        <div>
          <h1 className="text-2xl font-bold text-center">Empowered Users</h1>
          <div className="w-3/4 m-auto mt-6">
            <div className="flex flex-col w-full gap-4">
              {users.map((user) => (
                <div key={user.user_id}>
                  <div
                    className="m-auto border px-8 py-6 font-semibold cursor-pointer"
                    onClick={() => handleClick(user.user_id)}
                  >
                    <h1 className="text-xl font-bold">{user.username}</h1>
                  </div>

                  {openMenu.includes(user.user_id) && (
                    <div className="flex flex-col border mt-2 min-h-48 p-4 gap-4">
                      <p>User ID: {user.user_id}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={
                            visibleOnlyWithContext[user.user_id] || false
                          }
                          onChange={() =>
                            setVisibleOnlyWithContext((prev) => ({
                              ...prev,
                              [user.user_id]: !prev[user.user_id],
                            }))
                          }
                        />
                        <label className="text-sm">
                          Show only topics with context
                        </label>
                      </div>

                      {topics
                        .filter((topic) => {
                          const userContexts = context[user.user_id] || [];
                          const ctx = userContexts.find(
                            (c) => c.topic_id === topic.ID
                          );

                          if (visibleOnlyWithContext[user.user_id]) {
                            return !!ctx; // Only show if context exists
                          }

                          return true; // Otherwise show all
                        })
                        .map((topic) => {
                          const userContexts = context[user.user_id] || [];
                          const ctx = userContexts.find(
                            (c) => c.topic_id === topic.ID
                          );

                          return (
                            <div
                              key={topic.ID}
                              className="border cursor-pointer p-2"
                            >
                              <div className="flex cursor-pointer">
                                <div
                                  className="w-full"
                                  onClick={() => toggleDisplay(topic.ID)}
                                >
                                  <h1 className="font-semibold">
                                    {topic.ShortTitle}
                                  </h1>
                                </div>
                                <div
                                  onClick={() => {
                                    setEditingContext({
                                      user_id: user.user_id,
                                      topic_id: topic.ID,
                                    });
                                    if (!openTopics.includes(topic.ID))
                                      toggleDisplay(topic.ID);
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

                              {openTopics.includes(topic.ID) &&
                                (editingContext?.user_id === user.user_id &&
                                editingContext?.topic_id === topic.ID ? (
                                  <div className="flex flex-col gap-4 m-4">
                                    <div>
                                      <p className="font-semibold">
                                        Reasoning:
                                      </p>
                                      <textarea
                                        className="border rounded px-2 py-1 w-full"
                                        value={
                                          editedContextFields[user.user_id]?.[
                                            topic.ID
                                          ]?.reasoning ??
                                          ctx?.reasoning ??
                                          ""
                                        }
                                        onChange={(e) =>
                                          handleContextChange(
                                            user.user_id,
                                            topic.ID,
                                            "reasoning",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>
                                    <div>
                                      <p className="font-semibold">Sources:</p>
                                      <textarea
                                        className="border rounded px-2 py-1 w-full"
                                        value={
                                          editedContextFields[user.user_id]?.[
                                            topic.ID
                                          ]?.sources?.join("\n") ??
                                          ctx?.sources?.join("\n") ??
                                          ""
                                        }
                                        onChange={(e) =>
                                          handleContextChange(
                                            user.user_id,
                                            topic.ID,
                                            "sources",
                                            e.target.value.split("\n")
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="flex gap-4 mt-2">
                                      <button
                                        className="border px-4 py-2 rounded hover:bg-gray-200"
                                        onClick={() => setEditingContext(null)}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                        onClick={() =>
                                          saveContextEdit(
                                            user.user_id,
                                            topic.ID
                                          )
                                        }
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-4 m-4">
                                    <div>
                                      <p className="font-semibold">
                                        Reasoning:
                                      </p>
                                      <p className="ml-1">
                                        {ctx?.reasoning ?? (
                                          <span className="italic text-gray-400">
                                            No reasoning provided.
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-semibold">Sources:</p>
                                      {ctx?.sources?.length ? (
                                        <ul className="list-disc list-inside">
                                          {ctx.sources.map((source, i) => (
                                            <li key={i}>{source}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="ml-1 italic text-gray-400">
                                          No sources provided.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}

                              {!ctx && openTopics.includes(topic.ID) && (
                                <div className="text-sm text-gray-400 italic mt-2 ml-1">
                                  No context written for this topic.
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
