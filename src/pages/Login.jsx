import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { AuthForm } from "@chrisandrewsedu/ev-ui";

function Login() {
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

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
      navigate(data.completed_onboarding ? "/library" : "/help");
    } catch (err) {
      console.error("Error during login:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) return null;

  return (
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
  );
}

export default Login;
