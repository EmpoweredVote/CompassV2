import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getQuestionText, parseTensionTitle } from "../util/topic";
import StanceChooser from "./StanceChooser";

function LibraryDrawer({
  topic,
  currentAnswer,
  onSelectStance,
  onClose,
  invertedSpokes,
  writeIns,
  onSelectWriteIn,
  onPersistWriteIn,
  onCancelWriteIn,
  isOnCompass,
  onRemoveFromCompass,
  compassTopicCount,
}) {

  // Display-only: this spoke's inversion flips which pole reads first. The
  // ordering itself — and the write-in placement math that depends on it —
  // lives in StanceChooser, so the drawer, the overlay, Full Calibration and
  // the quiz can no longer disagree about it.
  const isInverted = !!(topic && invertedSpokes?.[topic.short_title]);

  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // The remove-confirm panel is the drawer's own state, not the chooser's:
  // opening a different topic must not leave the previous topic's "Remove from
  // compass?" prompt standing.
  useEffect(() => {
    setShowRemoveConfirm(false);
  }, [topic?.id]);

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
            className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white dark:bg-zinc-900 shadow-xl z-50 flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header with close button */}
            <div className="flex items-start justify-between p-4 border-b border-gray-100 dark:border-zinc-700">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-base font-semibold text-neutral-800 dark:text-white leading-snug">{getQuestionText(topic) || parseTensionTitle(topic).name}</p>
                {getQuestionText(topic) && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-normal mt-0.5">{parseTensionTitle(topic).name}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Remove from compass action (only shown when topic is on compass) */}
            {isOnCompass && (
              <div className="px-4 pt-2">
                <button
                  onClick={() => {
                    if (compassTopicCount <= 3) {
                      setShowRemoveConfirm(true);
                    } else {
                      onRemoveFromCompass(topic);
                    }
                  }}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  Remove from compass
                </button>
              </div>
            )}

            {/* Remove confirmation inline panel */}
            {showRemoveConfirm && (
              <div className="mx-4 mt-2 p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Remove from compass?</p>
                {compassTopicCount <= 3 && (
                  <p className="text-xs text-amber-600 mb-2">Your compass needs 3+ topics to display</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onRemoveFromCompass(topic);
                      setShowRemoveConfirm(false);
                    }}
                    className="text-sm px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowRemoveConfirm(false)}
                    className="text-sm px-3 py-1 bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-zinc-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Stances — with write-in support */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
              {topic.fc_community_slug && (
                <a
                  href={`https://fc.empowered.vote/communities/${topic.fc_community_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Discuss on Focused Communities
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
                  </svg>
                </a>
              )}
              <StanceChooser
                topic={topic}
                stances={topic.stances}
                currentAnswer={currentAnswer}
                writeInText={writeIns?.[topic.short_title] ?? ""}
                isInverted={isInverted}
                gapClassName="gap-3"
                onSelectStance={onSelectStance}
                onSelectWriteIn={onSelectWriteIn}
                onPersistWriteIn={onPersistWriteIn}
                onCancelWriteIn={onCancelWriteIn}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default LibraryDrawer;
