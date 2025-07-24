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
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");

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
      const timeout = setTimeout(() => setIsSuccess(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [isSuccess]);

  const onSuccess = () => {
    setIsSuccess(true);
  };

  const toggleIsDeleting = () => {
    setIsDeleting(!isDeleting);
  };

  const topicsToDisplay = topics.filter((topic) =>
    topic.ShortTitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mt-8">
      <div className="w-3/4 m-auto flex flex-row-reverse justify-center gap-4">
        <div className="flex gap-2">
          <button
            className="bg-red-600 text-white px-4 py-1 rounded cursor-pointer hover:bg-red-700"
            onClick={() => toggleIsDeleting()}
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
        <div className="w-full flex m-auto">
          <input
            type="text"
            placeholder="Search topics..."
            className="border px-2 py-1 rounded w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="w-3/4 m-auto flex flex-col gap-4">
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
        {topicsToDisplay.map((topic) => (
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
            isDeleting={isDeleting}
          />
        ))}
      </div>
    </div>
  );
}

export default TopicAdminPanel;
