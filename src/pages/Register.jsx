import { useState } from "react";
import { useNavigate } from "react-router";
import { AuthForm } from "@chrisandrewsedu/ev-ui";
import { useCompass } from "../components/CompassContext";
import { AnimatePresence, motion } from "framer-motion";

function safeParse(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

function Register() {
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const navigate = useNavigate();
  const { topics, setIsLoggedIn, setUsername, refreshSelectedTopics } = useCompass();

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

  const handleSubmit = async (username, password) => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/register`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, guest_state: buildGuestState() }),
        }
      );

      if (!response.ok) {
        setError("Username is already taken.");
        return;
      }

      setIsLoggedIn(true);
      setUsername(username.trim());
      await refreshSelectedTopics();
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error("Error during registration:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#00657c] text-white px-5 py-2.5 rounded-lg shadow-lg text-sm font-medium"
          >
            Your quiz answers have been saved to your account.
          </motion.div>
        )}
      </AnimatePresence>
      <AuthForm
        logoSrc="/EVLogo.svg"
        appName="Empowered Vote"
        appSubtitle="Empowered Compass"
        mode="register"
        onSubmit={handleSubmit}
        onModeSwitch={() => navigate("/")}
        error={error}
        submitting={submitting}
      />
    </>
  );
}

export default Register;
