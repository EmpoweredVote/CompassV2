import { useState, useEffect } from "react";
import { Navigate } from "react-router";
import { apiFetch } from "../lib/auth";

function ProtectedRoute(props) {
  const [authStatus, setAuthStatus] = useState("loading");

  useEffect(() => {
    console.log("Fetching auth status");
    apiFetch('/auth/me')
      .then((response) => {
        if (!response || !response.ok) {
          setAuthStatus("unauthorized");
        } else {
          setAuthStatus("authorized");
        }
      })
      .catch(() => {
        setAuthStatus("unauthorized");
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
