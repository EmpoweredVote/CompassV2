import { useEffect, useState } from "react";
import UserAccordion from "./UserAccordion";

function UserAdminPanel({ topics }) {
  const [users, setUsers] = useState([]);
  const [expanded, setExpanded] = useState([]);
  const [context, setContext] = useState({});
  const [editingContext, setEditingContext] = useState(null);
  const [editedContextFields, setEditedContextFields] = useState({});
  const [visibleOnlyWithContext, setVisibleOnlyWithContext] = useState({});
  const [openTopics, setOpenTopics] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchByUser, setSearchByUser] = useState({});
  const [answersByUser, setAnswersByUser] = useState({});

  const toggleExpanded = async (user_id) => {
    if (expanded.includes(user_id)) {
      setExpanded((prev) => prev.filter((id) => id !== user_id));
      return;
    }

    try {
      const topicIDs = topics.map((t) => t.ID); // All topics

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/compass/compare`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id, ids: topicIDs }),
        }
      );

      if (!res.ok) throw new Error("Failed to fetch answers");

      const answerData = await res.json();
      setAnswersByUser((prev) => ({ ...prev, [user_id]: answerData }));
      setExpanded((prev) => [...prev, user_id]);
    } catch (err) {
      console.error("Error fetching answers:", err);
    }
  };

  const toggleTopicOpen = (topicID) => {
    setOpenTopics((prev) =>
      prev.includes(topicID)
        ? prev.filter((id) => id !== topicID)
        : [...prev, topicID]
    );
  };

  const toggleVisibleOnlyWithContext = (user_id) => {
    setVisibleOnlyWithContext((prev) => ({
      ...prev,
      [user_id]: !prev[user_id],
    }));
  };

  const saveContextEdit = async (user_id, topic_id, valueOverride) => {
    const edited = editedContextFields[user_id]?.[topic_id];
    if (!edited) return;

    const existing =
      context[user_id]?.find((c) => c.topic_id === topic_id) || {};

    const reasoning =
      edited.reasoning !== undefined
        ? edited.reasoning
        : existing.reasoning || "";

    const sources = (edited.sources ?? existing.sources?.join("\n") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const value = valueOverride ?? edited.value;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/compass/context`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id,
            topic_id,
            reasoning,
            sources,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to save context");

      await fetch(`${import.meta.env.VITE_API_URL}/compass/answers/admin`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, topic_id, value }),
      });

      // Update local cache
      setContext((prev) => {
        const prevUserContext = prev[user_id] || [];
        const updated = prevUserContext.map((ctx) =>
          ctx.topic_id === topic_id ? { ...ctx, reasoning, sources } : ctx
        );

        // If topic wasn't there before, add it
        const alreadyExists = prevUserContext.some(
          (ctx) => ctx.topic_id === topic_id
        );
        const finalList = alreadyExists
          ? updated
          : [...prevUserContext, { topic_id, reasoning, sources }];

        return { ...prev, [user_id]: finalList };
      });

      setAnswersByUser((prev) => {
        const prevAnswers = prev[user_id] || [];

        const updated = prevAnswers.map((a) =>
          a.topic_id === topic_id ? { ...a, value } : a
        );

        const alreadyExists = prevAnswers.some((a) => a.topic_id === topic_id);
        const finalList = alreadyExists
          ? updated
          : [...prevAnswers, { topic_id, value }];

        return { ...prev, [user_id]: finalList };
      });

      setEditedContextFields((prev) => {
        const updated = { ...prev };
        delete updated[user_id]?.[topic_id];
        return updated;
      });

      setEditingContext(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save context or answers");
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [usersRes, contextRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/auth/empowered-accounts`, {
            credentials: "include",
          }),
          fetch(`${import.meta.env.VITE_API_URL}/compass/context`, {
            credentials: "include",
          }),
        ]);

        if (!usersRes.ok || !contextRes.ok) throw new Error("Fetch failed");

        const [usersData, contextData] = await Promise.all([
          usersRes.json(),
          contextRes.json(),
        ]);

        console.log(contextData);

        const grouped = contextData.reduce((acc, ctx) => {
          const id = ctx.UserID;
          if (!acc[id]) acc[id] = [];
          acc[id].push(ctx);
          return acc;
        }, {});
        setUsers(usersData);
        setContext(grouped);
      } catch (err) {
        console.error(err);
        alert("Failed to load admin data");
      }
    };

    fetchAllData();
  }, []);

  return (
    <div className="w-3/4 mx-auto mt-6 space-y-4">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Empowered Users</h1>
      </div>

      {users.map((user) => (
        <UserAccordion
          key={user.user_id}
          user={user}
          answers={answersByUser[user.user_id] || []}
          isOpen={expanded.includes(user.user_id)}
          toggleOpen={() => toggleExpanded(user.user_id)}
          context={context}
          setContext={setContext}
          topics={topics}
          openTopics={openTopics}
          toggleTopicOpen={toggleTopicOpen}
          editingContext={editingContext}
          setEditingContext={setEditingContext}
          editedContextFields={editedContextFields}
          setEditedContextFields={setEditedContextFields}
          saveContextEdit={saveContextEdit}
          visibleOnlyWithContext={visibleOnlyWithContext}
          toggleVisibleOnlyWithContext={toggleVisibleOnlyWithContext}
          updateUserPic={(userID, newURL) => {
            setUsers((prev) =>
              prev.map((u) =>
                u.user_id === userID ? { ...u, profile_pic_url: newURL } : u
              )
            );
          }}
          updateUsername={(userID, username) => {
            setUsers((prev) =>
              prev.map((u) =>
                u.user_id === userID ? { ...u, username: username } : u
              )
            );
          }}
          updateUserList={(userID) => {
            setUsers((prev) => prev.filter((u) => u.user_id !== userID));
          }}
          searchQuery={searchByUser[user.user_id] || ""}
          setSearchQuery={(query) =>
            setSearchByUser((prev) => ({ ...prev, [user.user_id]: query }))
          }
        />
      ))}
    </div>
  );
}

export default UserAdminPanel;
