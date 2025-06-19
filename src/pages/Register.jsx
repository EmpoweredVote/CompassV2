import { useState } from "react";
import { useNavigate } from "react-router";

function Register() {
  // Render form with username/password field
  // send form data to POST /auth/login
  // If 200, redirect to Home page
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();

    if (validatePassword(password, confirmPassword)) {
      fetch("http://localhost:5050/auth/register", {
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
            throw new Error("HTTP error " + response.status);
          }
        })
        .then(navigate("/"))
        .catch((error) => {
          console.error("Error during HTTP request:", error);
        });
    } else {
      alert("Passwords do not match");
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
          <input
            type="password"
            name="password"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="mb-6">
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Confirm Password
          </label>
          <input
            type="password"
            name="confirmPassword"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
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
