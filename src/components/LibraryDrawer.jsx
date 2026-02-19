import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getQuestionText } from "../util/topic";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

const SMOOTH_TRANSITION = {
  duration: 300,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
};

function SortableStanceLabel({ id, text }) {
  const { setNodeRef, transform, transition } = useSortable({
    id,
    disabled: { draggable: true },
    transition: SMOOTH_TRANSITION,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="px-4 py-2.5 rounded-lg text-sm sm:text-base font-medium bg-gray-50 text-gray-600 border border-gray-200"
    >
      {text}
    </div>
  );
}

function SortableWriteInCard({ id, text, onChange, onCancel, showHint }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: SMOOTH_TRANSITION });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex items-start gap-2 px-3 py-2.5 rounded-lg
        ${
          text.trim()
            ? "border-2 border-ev-yellow bg-ev-yellow-light"
            : "border-2 border-dashed border-gray-400"
        }`}
    >
      <div
        {...listeners}
        className={`cursor-grab active:cursor-grabbing pt-1.5 shrink-0 rounded p-1 ${
          showHint
            ? "animate-pulse bg-ev-yellow/30 text-ev-coral"
            : ""
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5"
          fill="currentColor"
        >
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your stance here..."
          rows={2}
          className="text-sm sm:text-base font-medium resize-none bg-transparent focus:outline-none"
        />
        {showHint && (
          <p className="text-xs font-medium text-ev-coral">
            Drag your own view to where it fits among these stances
          </p>
        )}
      </div>
      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-black shrink-0 pt-1 cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}

function LibraryDrawer({ topic, currentAnswer, onSelectStance, onClose, invertedSpokes, writeIns, onSelectWriteIn, onCancelWriteIn }) {
  const question = getQuestionText(topic);

  // Apply stance flip if this topic is inverted
  const isInverted = topic && invertedSpokes[topic.short_title];
  const stances = topic?.stances ?? [];
  const displayStances = isInverted ? [...stances].reverse() : stances;

  const [showWriteIn, setShowWriteIn] = useState(false);
  const [writeInText, setWriteInText] = useState("");
  const [orderedItems, setOrderedItems] = useState([]);
  const [hasRepositioned, setHasRepositioned] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // Reset write-in state when topic changes, restoring existing write-in if present
  useEffect(() => {
    if (!topic) {
      setShowWriteIn(false);
      setWriteInText("");
      setOrderedItems([]);
      setHasRepositioned(false);
      return;
    }
    // Check if this topic has an existing write-in
    const existingWriteIn = writeIns?.[topic.short_title];
    if (existingWriteIn && currentAnswer != null && !Number.isInteger(currentAnswer)) {
      setShowWriteIn(true);
      setWriteInText(existingWriteIn);
      setHasRepositioned(true);
      // Reconstruct ordered items with write-in at the correct position
      const stanceIds = displayStances.map(s => s.id);
      const writeInIndex = Math.floor(currentAnswer);
      const items = [...stanceIds];
      items.splice(writeInIndex, 0, "write-in");
      setOrderedItems(items);
    } else {
      setShowWriteIn(false);
      setWriteInText("");
      setOrderedItems([]);
      setHasRepositioned(false);
    }
  }, [topic?.id]);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = orderedItems.indexOf(active.id);
    const newIndex = orderedItems.indexOf(over.id);
    const reordered = arrayMove(orderedItems, oldIndex, newIndex);
    setOrderedItems(reordered);
    setHasRepositioned(true);
    const writeInIndex = reordered.indexOf("write-in");
    const midpointValue = writeInIndex + 0.5;
    onSelectWriteIn(topic, midpointValue, writeInText);
  };

  const handleWriteInTextChange = (newText) => {
    setWriteInText(newText);
    if (currentAnswer != null && !Number.isInteger(currentAnswer)) {
      if (newText.trim()) {
        onSelectWriteIn(topic, currentAnswer, newText);
      } else {
        onCancelWriteIn(topic);
        setShowWriteIn(false);
        setWriteInText("");
        setOrderedItems([]);
      }
    }
  };

  const handleCancelWriteIn = () => {
    setShowWriteIn(false);
    setWriteInText("");
    setOrderedItems([]);
    if (currentAnswer != null && !Number.isInteger(currentAnswer)) {
      onCancelWriteIn(topic);
    }
  };

  return (
    <AnimatePresence>
      {topic && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 bg-black/20 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-xl z-50 flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header with close button */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                {topic.short_title}
              </span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Question */}
            <p className="px-4 pt-4 pb-2 text-lg font-semibold text-neutral-800">
              {question}
            </p>

            {/* Stances — with write-in support */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
              {!showWriteIn ? (
                <>
                  {displayStances.map((stance) => (
                    <button
                      key={stance.id}
                      onClick={() => {
                        setShowWriteIn(false);
                        setWriteInText("");
                        onSelectStance(topic, stance.value);
                      }}
                      className={`text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm sm:text-base font-medium cursor-pointer ${
                        currentAnswer === stance.value
                          ? "border-ev-yellow border-2 bg-ev-yellow-light"
                          : "bg-white text-black border-2 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {stance.text}
                    </button>
                  ))}

                  <button
                    onClick={() => {
                      setShowWriteIn(true);
                      setHasRepositioned(false);
                      setOrderedItems([
                        ...displayStances.map(s => s.id),
                        "write-in",
                      ]);
                    }}
                    className="text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm sm:text-base font-medium cursor-pointer border-2 border-dashed border-gray-400 text-gray-500 hover:border-ev-yellow hover:text-black"
                  >
                    Write your own...
                  </button>
                </>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis]}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={orderedItems} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-3">
                      {orderedItems.map((itemId) =>
                        itemId === "write-in" ? (
                          <SortableWriteInCard
                            key="write-in"
                            id="write-in"
                            text={writeInText}
                            onChange={handleWriteInTextChange}
                            onCancel={handleCancelWriteIn}
                            showHint={!!writeInText.trim() && !hasRepositioned}
                          />
                        ) : (
                          <SortableStanceLabel
                            key={itemId}
                            id={itemId}
                            text={displayStances.find(s => s.id === itemId)?.text ?? ""}
                          />
                        )
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default LibraryDrawer;
