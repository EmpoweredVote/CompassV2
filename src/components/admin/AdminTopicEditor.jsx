import React from "react";

function AdminTopicEditor({
  topic,
  allCategories,
  isOpen,
  onToggleOpen,
  onEditClick,
  onSubmitEdit,
  onStanceEdit,
  editedTopic,
  setEditedTopic,
  editedFields,
  setEditedFields,
  newStance,
  setNewStance,
  handleAddCategory,
  handleRemoveCategory,
}) {
  const handleShortTitleChange = (event) => {
    const value = event.target.value;
    setEditedFields((prev) => ({
      ...prev,
      [topic.ID]: {
        ...prev[topic.ID],
        ShortTitle: value,
      },
    }));
  };

  const handleTitleChange = (event) => {
    const value = event.target.value;
    setEditedFields((prev) => ({
      ...prev,
      [topic.ID]: {
        ...prev[topic.ID],
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

  const topicCategoryIDs = new Set(topic.Categories.map((c) => c.ID));
  const availableCategories = allCategories.filter(
    (c) => !topicCategoryIDs.has(c.ID)
  );

  return (
    <div>
      <div className="flex flex-row m-2 px-4 border justify-between items-center">
        <div
          className="w-3/4 py-4 h-full cursor-pointer"
          onClick={onToggleOpen}
        >
          <h1 className="text-lg">{topic.Title}</h1>
        </div>
        <div className="flex justify-end cursor-pointer" onClick={onEditClick}>
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

      {isOpen && (
        <div className="flex flex-col border m-2 p-4 gap-2">
          {editedTopic === topic.ID ? (
            <>
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
                    onChange={handleTitleChange}
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
                      editedFields[topic.ID]?.ShortTitle ?? topic.ShortTitle
                    }
                    onChange={handleShortTitleChange}
                    className="border rounded-lg ml-4 px-2"
                  />
                </label>
              </div>
              <div className="flex flex-col">
                <h1 className="ml-6 mb-2 font-semibold">Categories:</h1>
                <ol className="ml-6 mb-2">
                  {topic.Categories.map((category) => (
                    <li key={category.ID} className="flex items-center gap-2">
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
                  <div key={stance.ID}>
                    <textarea
                      id={stance.ID}
                      value={newStance[stance.ID] ?? stance.Text}
                      onChange={(e) => handleStanceChange(e, stance.ID)}
                      className="border rounded-lg ml-8 px-2 w-3/4"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-6 justify-end">
                <button
                  className="border rounded-lg p-2 cursor-pointer hover:bg-gray-200"
                  onClick={() => setEditedTopic("")}
                >
                  Cancel
                </button>
                <button
                  className="border text-white rounded-lg px-4 py-2 cursor-pointer bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    onSubmitEdit(topic.ID);
                    onStanceEdit(topic);
                  }}
                >
                  Save
                </button>
              </div>
            </>
          ) : (
            <>
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
                  <div key={stance.ID}>
                    <p className="ml-8">
                      {stance.Value}. {newStance[stance.ID] ?? stance.Text}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminTopicEditor;
