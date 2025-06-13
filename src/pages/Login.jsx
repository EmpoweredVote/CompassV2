import { useState } from "react";
import { useNavigate } from "react-router";

function Login() {
  // Render form with username/password field
  // send form data to POST /auth/login
  // If 200, redirect to Home page
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();
    fetch("http://localhost:5050/auth/login", {
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
      .then(() => navigate("/home"))
      .catch((error) => {
        console.error("Error during HTTP request:", error);
      });
  };

  const handleChange = (event) => {
    const name = event.target.name;
    const value = event.target.value;

    if (name == "username") {
      setUsername(value);
      console.log(username);
    } else if (name == "password") {
      setPassword(value);
      console.log(password);
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
        <input type="submit" />
      </form>
    </>
  );
}

export default Login;
