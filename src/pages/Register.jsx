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
    <>
      <form onSubmit={handleSubmit}>
        <label>
          Username:
          <input
            type="text"
            name="username"
            value={username || ""}
            onChange={handleChange}
          />
        </label>
        <label>
          Password:
          <input
            type="password"
            name="password"
            value={password || ""}
            onChange={handleChange}
          />
        </label>
        <label>
          Confirm Password:
          <input
            type="password"
            name="confirmPassword"
            value={confirmPassword || ""}
            onChange={handleChange}
          />
        </label>
        <input type="submit" />
      </form>
    </>
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
