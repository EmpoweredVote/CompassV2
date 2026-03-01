// SavePromptModal.jsx
import { useState, useEffect } from "react";
import { useCompass } from "./CompassContext";
import { AnimatePresence, motion } from "framer-motion";

const BANNER_KEY = "savePromptBannerDismissCount";

export default function SavePromptModal() {
  const { isLoggedIn, answers } = useCompass();
  const [showBanner, setShowBanner] = useState(false);

  const hasAnswers = Object.keys(answers || {}).length > 0;

  useEffect(() => {
    if (isLoggedIn || !hasAnswers) {
      setShowBanner(false);
      return;
    }

    const bannerCount = parseInt(localStorage.getItem(BANNER_KEY) || "0");
    if (bannerCount < 2) {
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, hasAnswers]);

  useEffect(() => {
    if (isLoggedIn) setShowBanner(false);
  }, [isLoggedIn]);

  const dismissBanner = () => {
    const count = parseInt(localStorage.getItem(BANNER_KEY) || "0");
    localStorage.setItem(BANNER_KEY, String(count + 1));
    setShowBanner(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg"
        >
          <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Save your compass results</span> — create a free account to keep your answers.
            </p>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <a
                href="/register"
                className="px-4 py-1.5 bg-ev-coral text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Sign up
              </a>
              <button
                onClick={dismissBanner}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
