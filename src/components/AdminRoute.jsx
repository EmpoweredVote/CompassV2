import { useState, useEffect } from "react";
import { Navigate } from "react-router";

function AdminRoute(props) {
  const [adminStatus, setAdminStatus] = useState("loading");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/admin-check`, {
      credentials: "include",
    })
      .then((res) => {
        setAdminStatus(res.ok ? "authorized" : "unauthorized");
      })
      .catch((err) => {
        console.error(err);
        setAdminStatus("unauthorized");
      });
  }, []);

  if (adminStatus === "loading") return <h1>Loading...</h1>;
  if (adminStatus === "unauthorized") return <Navigate to="/401" />;
  return props.children;
}

export default AdminRoute;
