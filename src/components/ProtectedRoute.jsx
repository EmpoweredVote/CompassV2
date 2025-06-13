import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router";

function ProtectedRoute(props) {
  const [authStatus, setAuthStatus] = useState("loading");
  const navigate = useNavigate();

  useEffect(() => {
    console.log("Fetching auth status");
    fetch("http://localhost:5050/auth/me", {
      credentials: "include", // REQUIRED to send session cookie
    })
      .then((response) => {
        if (!response.ok) {
          setAuthStatus("unauthorized");
        } else {
          setAuthStatus("authorized");
        }
      })
      .catch((error) => {
        console.error("Error during HTTP request:", error);
      });
  }, []);

  if (authStatus == "loading") {
    return <h1>Loading...</h1>;
  }

  if (authStatus == "unauthorized") {
    console.log("401: Unauthorized");
    return <Navigate to="/401" />;
  }

  if (authStatus == "authorized") {
    return props.children;
  }
}

export default ProtectedRoute;
