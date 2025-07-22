import UserTopicContext from "./UserTopicContext";
import placeholder from "../../assets/placeholder.png";
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
  searchQuery,
  setSearchQuery,
}) {
  const [isEditingPic, setIsEditingPic] = useState(false);
  const [newPicURL, setNewPicURL] = useState("");
  const userContexts = context[user.user_id] || [];
  const hasContent = (ctx) =>
    ctx && (ctx.reasoning?.trim() || ctx.sources?.length > 0);

  const submitPic = async (userID) => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/auth/update-profile-pic`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userID, url: newPicURL }),
      }
    );

    if (!res.ok) {
      alert("Failed to update profile picture");
      return;
    }

    setIsEditingPic(false);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="bg-gray-100 p-4 cursor-pointer flex justify-between items-center"
        onClick={toggleOpen}
      >
        <img
          src={user.profile_pic_url || placeholder}
          alt={`${user.username}'s profile`}
          className="w-20 h-20 object-cover rounded-full border shadow"
        />
        {isEditingPic ? (
          <div className="flex flex-col gap-2 mt-2">
            <input
              type="text"
              className="border p-1 rounded"
              placeholder="Enter image URL"
              value={newPicURL}
              onChange={(e) => setNewPicURL(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => submitPic(user.user_id)}
                className="bg-blue-500 text-white px-2 py-1 rounded"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingPic(false);
                  setNewPicURL("");
                }}
                className="text-gray-500 underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setIsEditingPic(true);
              setNewPicURL(user.profile_pic_url || "");
            }}
            className="text-blue-600 underline text-sm mt-2"
          >
            {user.profile_pic_url ? "Edit Profile Image" : "Add Profile Image"}
          </button>
        )}
        <h2 className="text-xl font-semibold">{user.username}</h2>
        <span>{isOpen ? "▲" : "▼"}</span>
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
    </div>
  );
}

export default UserAccordion;
