import { useState } from "react";
import { useNavigate } from "react-router";
import { AuthForm } from "@chrisandrewsedu/ev-ui";

function Register() {
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

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
          body: JSON.stringify({ username, password }),
        }
      );

      if (!response.ok) {
        setError("Username is already taken.");
        return;
      }

      navigate("/");
    } catch (err) {
      console.error("Error during registration:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
  );
}

export default Register;
