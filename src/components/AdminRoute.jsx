import { useState, useEffect } from "react";
import { Navigate } from "react-router";
import { apiFetch } from "../lib/auth";

function AdminRoute(props) {
  const [adminStatus, setAdminStatus] = useState("loading");

  useEffect(() => {
    apiFetch('/auth/me')
      .then((res) => {
        if (!res || !res.ok) {
          setAdminStatus("unauthorized");
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.is_admin === true) {
          setAdminStatus("authorized");
        } else {
          setAdminStatus("unauthorized");
        }
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
