import { useState } from "react";
import { useNavigate } from "react-router";

function Register() {
  // Render form with username/password field
  // send form data to POST /auth/login
  // If 200, redirect to Home page
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isInvalidUsername, setIsInvalidUsername] = useState(false);
  const [invalidPass, setInvalidPass] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();

    if (validatePassword(password, confirmPassword)) {
      setInvalidPass(false);
      fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
        method: "POST",
        credentials: "include", // REQUIRED for cookie auth
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      })
        .then((response) => {
          if (response.ok) {
            return response.text();
          } else {
            setIsInvalidUsername(true);
            throw new Error("HTTP error " + response.status);
          }
        })
        .then(() => {
          navigate("/");
        })
        .catch((error) => {
          console.error("Error during HTTP request:", error);
        });
    } else {
      setInvalidPass(true);
    }
  };

  const handleChange = (event) => {
    const name = event.target.name;
    const value = event.target.value;

    if (name == "username") {
      console.log(username);
      setUsername(value);
    } else if (name == "password") {
      console.log(password);
      setPassword(value);
    } else if (name == "confirmPassword") {
      console.log(confirmPassword);
      setConfirmPassword(value);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm"
      >
        <h2 className="text-2xl font-semibold mb-6 text-center">Register</h2>
        <div className="mb-4">
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            type="text"
            name="username"
            autoComplete="off"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="relative">
            <input
              type={showPasswords ? "text" : "password"}
              name="password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div
              className="absolute inset-y-0 right-2 flex items-center cursor-pointer text-gray-500"
              onClick={() => setShowPasswords((prev) => !prev)}
            >
              {showPasswords ? (
                // Open eye
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
              ) : (
                // Closed eye
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>
        <div className="mb-6">
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showPasswords ? "text" : "password"}
              name="confirmPassword"
              className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <div
              className="absolute inset-y-0 right-2 flex items-center cursor-pointer text-gray-500"
              onClick={() => setShowPasswords((prev) => !prev)}
            >
              {showPasswords ? (
                // Open eye
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
              ) : (
                // Closed eye
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>
        <div className="mb-4">
          {isInvalidUsername && <p className="text-red-600">Username Taken</p>}
        </div>
        <div className="mb-4">
          {invalidPass && (
            <p className="text-red-600">Passwords do not match</p>
          )}
        </div>
        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition-colors font-semibold"
        >
          Sign Up
        </button>
      </form>
    </div>
  );
}

function validatePassword(password, confirmPassword) {
  if (password !== confirmPassword) {
    console.log("password: " + password + " confirm: " + confirmPassword);
    return false;
  } else if (password == confirmPassword) {
    return true;
  }
}

export default Register;
