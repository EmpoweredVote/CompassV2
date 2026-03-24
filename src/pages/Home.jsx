import { useState } from "react";
import { useNavigate } from "react-router";
import { apiFetch, getToken, clearToken } from "../lib/auth";

function Home() {
  const [user, setUser] = useState();
  const navigate = useNavigate();

  apiFetch('/account/me')
    .then((response) => {
      if (!response || !response.ok) {
        navigate("/");
        throw new Error("HTTP error " + (response ? response.status : "null"));
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

  const logout = async () => {
    try {
      const token = getToken();
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {
      // Network error — clear local state anyway
    }
    clearToken();
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
