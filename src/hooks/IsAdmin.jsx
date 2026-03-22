import { useState, useEffect } from "react";
import { apiFetch } from "../lib/auth";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(null); // null = loading

  useEffect(() => {
    apiFetch('/auth/me')
      .then((res) => {
        if (!res || !res.ok) {
          setIsAdmin(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setIsAdmin(data.is_admin === true);
      })
      .catch(() => setIsAdmin(false));
  }, []);

  return isAdmin;
}
