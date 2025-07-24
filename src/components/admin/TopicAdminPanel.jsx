import { useState, useEffect } from "react";
import { useCompass } from "../CompassContext";
import TopicAccordion from "./TopicAccordion";
import CreateTopic from "./CreateTopic";

function TopicAdminPanel({ allCategories }) {
  const { topics, setTopics } = useCompass();

  const [openMenu, setOpenMenu] = useState([]);
  const [editedTopic, setEditedTopic] = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [newStance, setNewStance] = useState({});
  const [openModal, setOpenModal] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState(false);

  const closeModal = () => {
    setOpenModal(false);
  };

  const handleAccordionToggle = (topicID) => {
    setOpenMenu((prev) =>
      prev.includes(topicID)
        ? prev.filter((id) => id !== topicID)
        : [...prev, topicID]
    );
  };

  useEffect(() => {
    if (isSuccess) {
      const timeout = setTimeout(() => setIsSuccess(false), 10000);
      return () => clearTimeout(timeout);
    }
  }, [isSuccess]);

  const onSuccess = () => {
    setIsSuccess(true);
  };

  return (
    <div>
      <div className="w-3/4 m-auto flex flex-row-reverse justify-between">
        <div className="flex gap-2">
          <button
            className="bg-red-600 text-white px-4 py-1 rounded cursor-pointer hover:bg-red-700"
            onClick={() => setDeleteStatus(true)}
          >
            -
          </button>
          <button
            className="bg-green-600 text-white px-4 py-1 rounded cursor-pointer hover:bg-green-700"
            onClick={() => setOpenModal(true)}
          >
            +
          </button>
        </div>
        <div>
          {isSuccess && (
            <div className="flex flex-col items-center">
              <div className="w-full px-4 py-2 border border-black/75 rounded-lg bg-gray-50">
                <h1 className="font-semibold text-center text-lg text-green-600">
                  Topic Successfully Saved
                </h1>
              </div>
            </div>
          )}
        </div>
        <div></div>
      </div>

      <div className="w-3/4 m-auto mt-6 flex flex-col gap-4">
        {openModal && (
          <CreateTopic
            onClose={closeModal}
            onSuccess={onSuccess}
            allCategories={allCategories}
            setTopics={setTopics}
            newStance={newStance}
            setNewStance={setNewStance}
          />
        )}
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
    </div>
  );
}

export default TopicAdminPanel;
