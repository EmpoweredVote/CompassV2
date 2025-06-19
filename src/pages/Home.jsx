import { useState } from "react";
import { useNavigate } from "react-router";

function Home() {
  const [user, setUser] = useState();
  const navigate = useNavigate();

  fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
    credentials: "include", // REQUIRED to send session cookie
  })
    .then((response) => {
      if (!response.ok) {
        navigate("/");
        throw new Error("HTTP error " + response.status);
      } else {
        return response.json();
      }
    })
    .then((data) => {
      console.log(data);
      setUser(JSON.stringify(data));
    })
    .catch((error) => {
      console.error("Error during HTTP request:", error);
    });

  const logout = () => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) {
          navigate("/");
          throw new Error("HTTP error " + response.status);
        } else {
          return response.text();
        }
      })
      .then(() => navigate("/"))
      .catch((error) => {
        console.error("Error during HTTP request:", error);
      });
  };

  return (
    <>
      <h1>Hello, world :)</h1>
      <p>{user ? user : "Error fetching user"}</p>
      <button onClick={logout}>Logout</button>
    </>
  );
}

export default Home;
