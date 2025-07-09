import { useState } from "react";
import { useCompass } from "../CompassContext";
import TopicAccordion from "./TopicAccordion";

function TopicAdminPanel({ allCategories }) {
  const { topics, setTopics } = useCompass();

  const [openMenu, setOpenMenu] = useState([]);
  const [editedTopic, setEditedTopic] = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [newStance, setNewStance] = useState({});

  const handleAccordionToggle = (topicID) => {
    setOpenMenu((prev) =>
      prev.includes(topicID)
        ? prev.filter((id) => id !== topicID)
        : [...prev, topicID]
    );
  };

  return (
    <div className="w-3/4 m-auto mt-6 flex flex-col gap-4">
      {topics.map((topic) => (
        <TopicAccordion
          key={topic.ID}
          topic={topic}
          isOpen={openMenu.includes(topic.ID)}
          onToggle={() => handleAccordionToggle(topic.ID)}
          isEditing={editedTopic === topic.ID}
          setEditedTopic={setEditedTopic}
          editedFields={editedFields}
          setEditedFields={setEditedFields}
          newStance={newStance}
          setNewStance={setNewStance}
          allCategories={allCategories}
          setTopics={setTopics}
        />
      ))}
    </div>
  );
}

export default TopicAdminPanel;
