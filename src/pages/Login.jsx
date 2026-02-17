import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { AuthForm } from "@chrisandrewsedu/ev-ui";
import { useCompass } from "../components/CompassContext";
import { AnimatePresence, motion } from "framer-motion";

function Login() {
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showRestoredToast, setShowRestoredToast] = useState(false);
  const navigate = useNavigate();
  const { refreshSelectedTopics, setIsLoggedIn, setUsername: setCtxUsername } = useCompass();

  // Check if already logged in
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
      credentials: "include",
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Not logged in");
      })
      .then((data) => {
        navigate(data.completed_onboarding ? "/library" : "/help", {
          replace: true,
        });
      })
      .catch(() => {
        setChecking(false);
      });
  }, []);

  const handleSubmit = async (username, password) => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/login`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }
      );

      if (!response.ok) {
        setError("Invalid credentials. Please try again.");
        return;
      }

      const meRes = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/me`,
        { method: "GET", credentials: "include" }
      );

      if (!meRes.ok) throw new Error("Failed to fetch user info");

      const data = await meRes.json();

      // Update context
      setIsLoggedIn(true);
      setCtxUsername(data.username);
      await refreshSelectedTopics();

      // Check if guest had local answers — server-wins, show a notice
      const localAnswers = localStorage.getItem("answers");
      const hadLocalAnswers = localAnswers && Object.keys(JSON.parse(localAnswers) || {}).length > 0;

      // Clear localStorage answers — server answers now take priority
      localStorage.removeItem("answers");
      localStorage.removeItem("writeIns");

      if (hadLocalAnswers) {
        setShowRestoredToast(true);
        setTimeout(() => {
          navigate(data.completed_onboarding ? "/library" : "/help");
        }, 2000); // Show toast for 2 seconds then navigate
      } else {
        navigate(data.completed_onboarding ? "/library" : "/help");
      }
    } catch (err) {
      console.error("Error during login:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) return null;

  return (
    <>
      <AnimatePresence>
        {showRestoredToast && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#00657c] text-white px-5 py-2.5 rounded-lg shadow-lg text-sm font-medium"
          >
            Your saved answers have been restored.
          </motion.div>
        )}
      </AnimatePresence>
      <AuthForm
        logoSrc="/EVLogo.svg"
        appName="Empowered Vote"
        appSubtitle="Empowered Compass"
        mode="login"
        onSubmit={handleSubmit}
        onModeSwitch={() => navigate("/register")}
        error={error}
        submitting={submitting}
      />
    </>
  );
}

export default Login;
