import { useState } from "react";
import { useNavigate } from "react-router";
import Logo from "../assets/EVLogo.png";

function Register() {
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

  const PasswordToggle = () => (
    <button
      type="button"
      className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
      onClick={() => setShowPasswords((prev) => !prev)}
    >
      {showPasswords ? (
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
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4">
      <div className="w-full max-w-sm">
        {/* Logo and Title */}
        <div className="flex flex-col items-center mb-8">
          <img src={Logo} alt="Empowered Vote" className="w-16 h-16 mb-4" />
          <h1 className="text-2xl font-semibold text-[#00657c]">
            Empowered Vote
          </h1>
          <p className="text-gray-500 text-sm mt-1">Political Compass</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-semibold mb-6 text-center text-gray-800">
            Create Account
          </h2>

          <div className="mb-4">
            <label className="block mb-1.5 text-sm font-medium text-gray-600">
              Username
            </label>
            <input
              type="text"
              name="username"
              autoComplete="off"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#59b0c4] focus:border-transparent transition-all"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1.5 text-sm font-medium text-gray-600">
              Password
            </label>
            <div className="relative">
              <input
                type={showPasswords ? "text" : "password"}
                name="password"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#59b0c4] focus:border-transparent transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <PasswordToggle />
            </div>
          </div>

          <div className="mb-6">
            <label className="block mb-1.5 text-sm font-medium text-gray-600">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showPasswords ? "text" : "password"}
                name="confirmPassword"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#59b0c4] focus:border-transparent transition-all"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <PasswordToggle />
            </div>
          </div>

          {isInvalidUsername && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm text-center">
                Username is already taken.
              </p>
            </div>
          )}

          {invalidPass && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm text-center">
                Passwords do not match.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-[#ff5740] text-white py-2.5 rounded-lg hover:bg-[#e64d38] transition-colors font-semibold cursor-pointer shadow-sm"
          >
            Create Account
          </button>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-center text-sm text-gray-500 mb-3">
              Already have an account?
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full py-2.5 border-2 border-[#00657c] text-[#00657c] rounded-lg hover:bg-[#00657c] hover:text-white transition-colors font-medium cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </form>
      </div>
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
