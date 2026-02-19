// SavePromptModal.jsx
import { useState, useEffect } from "react";
import { useCompass } from "./CompassContext";
import { AnimatePresence, motion } from "framer-motion";

const API = import.meta.env.VITE_API_URL;
const MODAL_KEY = "savePromptModalDismissed";
const BANNER_KEY = "savePromptBannerDismissCount";

function safeParse(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

export default function SavePromptModal() {
  const { isLoggedIn, setIsLoggedIn, setUsername, topics, answers, refreshSelectedTopics } = useCompass();
  const [showModal, setShowModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // Registration form state
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regError, setRegError] = useState(null);
  const [regSubmitting, setRegSubmitting] = useState(false);

  // Check if user has any answers worth saving
  const hasAnswers = Object.keys(answers || {}).length > 0;

  // Determine which prompt to show on mount
  useEffect(() => {
    if (isLoggedIn || !hasAnswers) {
      setShowModal(false);
      setShowBanner(false);
      return;
    }

    const modalDismissed = localStorage.getItem(MODAL_KEY) === "1";
    const bannerCount = parseInt(localStorage.getItem(BANNER_KEY) || "0");

    if (!modalDismissed) {
      // Small delay so the user sees results first
      const timer = setTimeout(() => setShowModal(true), 1500);
      return () => clearTimeout(timer);
    } else if (bannerCount < 2) {
      setShowBanner(true);
    }
  }, [isLoggedIn, hasAnswers]);

  // Hide prompts when user becomes logged in
  useEffect(() => {
    if (isLoggedIn) {
      setShowModal(false);
      setShowBanner(false);
    }
  }, [isLoggedIn]);

  const dismissModal = () => {
    localStorage.setItem(MODAL_KEY, "1");
    setShowModal(false);
    const bannerCount = parseInt(localStorage.getItem(BANNER_KEY) || "0");
    if (bannerCount < 2) {
      setShowBanner(true);
    }
  };

  const dismissBanner = () => {
    const count = parseInt(localStorage.getItem(BANNER_KEY) || "0");
    localStorage.setItem(BANNER_KEY, String(count + 1));
    setShowBanner(false);
  };

  // Build guest_state from localStorage, converting short_title keys to topic UUIDs
  const buildGuestState = () => {
    const localAnswers = safeParse(localStorage.getItem("answers"), {});
    const localWriteIns = safeParse(localStorage.getItem("writeIns"), {});
    const localSelectedTopics = safeParse(localStorage.getItem("selectedTopics"), []);

    const answers = Object.entries(localAnswers).map(([shortTitle, value]) => {
      const topic = topics.find(t => t.short_title === shortTitle);
      if (!topic) return null;
      return {
        topic_id: topic.id,
        value: value,
        write_in_text: localWriteIns[shortTitle] || "",
      };
    }).filter(Boolean);

    return {
      answers,
      selected_topics: localSelectedTopics,
    };
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regUsername.trim() || !regPassword) return;
    if (regPassword !== regConfirm) {
      setRegError("Passwords do not match.");
      return;
    }

    setRegSubmitting(true);
    setRegError(null);

    try {
      const guestState = buildGuestState();

      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername.trim(),
          password: regPassword,
          guest_state: guestState,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        setRegError(text.includes("taken") ? "Username is already taken." : "Registration failed. Please try again.");
        return;
      }

      // Registration auto-creates a session (per 02-01 backend change)
      setIsLoggedIn(true);
      setUsername(regUsername.trim());
      await refreshSelectedTopics();

      // Clear save prompt flags — user is now registered
      setShowModal(false);
      setShowBanner(false);
    } catch (err) {
      console.error("Registration error:", err);
      setRegError("Something went wrong. Please try again.");
    } finally {
      setRegSubmitting(false);
    }
  };

  // --- Modal ---
  const modalContent = (
    <AnimatePresence>
      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) dismissModal(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Save your results</h2>
              <button
                onClick={dismissModal}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-5">
              Create an account to save your compass results and access them from any device.
            </p>

            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ev-light-blue focus:border-transparent"
                required
                autoComplete="off"
              />
              <input
                type="password"
                placeholder="Password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ev-light-blue focus:border-transparent"
                required
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ev-light-blue focus:border-transparent"
                required
              />

              {regError && (
                <p className="text-xs text-red-500 text-center">{regError}</p>
              )}

              <button
                type="submit"
                disabled={regSubmitting || !regUsername.trim() || !regPassword}
                className="w-full py-2.5 bg-ev-coral text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {regSubmitting ? "Creating account..." : "Create account & save"}
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-4">
              Already have an account?{" "}
              <a href="/login" className="text-ev-muted-blue hover:underline">Sign in</a>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // --- Banner ---
  const bannerContent = (
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

  return (
    <>
      {modalContent}
      {bannerContent}
    </>
  );
}
