import { motion, AnimatePresence } from "framer-motion";

function LibraryDrawer({ topic, currentAnswer, onSelectStance, onClose, invertedSpokes }) {
  const question = topic
    ? topic.question_text || `What should the government do about ${topic.short_title}?`
    : "";

  // Apply stance flip if this topic is inverted
  const isInverted = topic && invertedSpokes[topic.short_title];
  const displayStances = topic
    ? isInverted
      ? [...topic.stances].reverse()
      : topic.stances
    : [];

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

            {/* Stances — same button pattern as Quiz.jsx */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
              {displayStances.map((stance) => (
                <button
                  key={stance.id}
                  onClick={() => onSelectStance(topic, stance.value)}
                  className={`text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm sm:text-base font-medium cursor-pointer ${
                    currentAnswer === stance.value
                      ? "border-ev-yellow border-2 bg-ev-yellow-light"
                      : "bg-white text-black border-2 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {stance.text}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default LibraryDrawer;
