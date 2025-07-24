import UserTopicContext from "./UserTopicContext";
import placeholder from "../../assets/placeholder.png";
import UserEditModal from "./UserEditModal";
import { useState } from "react";

function UserAccordion({
  user,
  answers,
  isOpen,
  toggleOpen,
  context,
  setContext,
  topics,
  openTopics,
  toggleTopicOpen,
  editingContext,
  setEditingContext,
  editedContextFields,
  setEditedContextFields,
  saveContextEdit,
  visibleOnlyWithContext,
  toggleVisibleOnlyWithContext,
  updateUserPic,
  updateUsername,
  updateUserList,
  searchQuery,
  setSearchQuery,
}) {
  const [isEditingPic, setIsEditingPic] = useState(false);
  const [newPicURL, setNewPicURL] = useState("");
  const [showUserModal, setShowUserModal] = useState(false);

  const userContexts = context[user.user_id] || [];
  const hasContent = (ctx) =>
    ctx && (ctx.reasoning?.trim() || ctx.sources?.length > 0);

  const closeModal = () => {
    setShowUserModal(false);
  };

  const onSaveModal = async (userID, updated) => {
    // Send new user info to the backend
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/auth/update-username`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userID, username: updated.username }),
      }
    );

    if (!res.ok) {
      alert("Failed to update username");
      return;
    }

    updateUsername(userID, updated.username);
  };

  const deleteUser = async (userID) => {
    // Send userID to backend to be deleted
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/auth/delete-user/${userID}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!res.ok) {
      alert("Failed to delete user.");
      return;
    }

    updateUserList(userID);
  };

  const submitPic = async (pic_url, userID) => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/auth/update-profile-pic`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userID, url: pic_url }),
      }
    );

    if (!res.ok) {
      alert("Failed to update profile picture");
      return;
    }

    updateUserPic(userID, pic_url);
    setIsEditingPic(false);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="bg-gray-100 p-4 cursor-pointer flex justify-between items-center"
        onClick={toggleOpen}
      >
        <div
          className="relative group w-24 h-24 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditingPic(true);
            setNewPicURL(user.profile_pic_url || "");
          }}
        >
          <img
            src={user.profile_pic_url || placeholder}
            alt={`${user.username}'s profile`}
            className="w-full h-full object-cover rounded-full border shadow"
          />

          <div className="absolute inset-0 bg-black/60 hidden group-hover:flex justify-center items-center rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="white"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
              />
            </svg>
          </div>
        </div>
        {isEditingPic && (
          <div className="flex flex-col gap-2 mt-2">
            <input
              type="text"
              className="border p-1 rounded"
              placeholder="Enter image URL"
              value={newPicURL}
              onChange={(e) => setNewPicURL(e.target.value)}
            />
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  submitPic(newPicURL, user.user_id);
                }}
                className="bg-blue-500 text-white px-2 py-1 rounded cursor-pointer hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingPic(false);
                  setNewPicURL("");
                }}
                className="text-gray-500 underline cursor-pointer hover:text-gray-700"
              >
                Cancel
              </button>
              {user.profile_pic_url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewPicURL("");
                    submitPic("", user.user_id);
                  }}
                  className="text-red-500 underline cursor-pointer hover:text-red-700"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="size-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
        <h2 className="text-xl font-semibold">{user.username}</h2>
        <div onClick={() => setShowUserModal(true)}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="size-6"
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
        <div className="p-4 bg-white">
          <input
            type="text"
            placeholder="Search topics..."
            className="border px-2 py-1 mb-2 rounded w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <label className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={visibleOnlyWithContext[user.user_id] || false}
              onChange={() => toggleVisibleOnlyWithContext(user.user_id)}
            />
            <span className="text-sm">Show only topics with context</span>
          </label>

          {topics
            .filter((topic) => {
              const ctx = userContexts.find((c) => c.topic_id === topic.ID);
              const matchesSearch = topic.ShortTitle.toLowerCase().includes(
                searchQuery.toLowerCase()
              );
              const shouldShow = visibleOnlyWithContext[user.user_id]
                ? hasContent(ctx)
                : true;
              return matchesSearch && shouldShow;
            })
            .map((topic) => (
              <UserTopicContext
                key={topic.ID}
                user={user}
                answer={answers.find((a) => a.topic_id === topic.ID)}
                topic={topic}
                context={userContexts}
                openTopics={openTopics}
                toggleTopicOpen={toggleTopicOpen}
                editingContext={editingContext}
                setEditingContext={setEditingContext}
                editedContextFields={editedContextFields}
                setEditedContextFields={setEditedContextFields}
                saveContextEdit={saveContextEdit}
              />
            ))}
        </div>
      )}
      {showUserModal && (
        <UserEditModal
          user={user}
          onClose={closeModal}
          onSave={onSaveModal}
          deleteUser={deleteUser}
        />
      )}
    </div>
  );
}

export default UserAccordion;
