import { useState, useEffect } from "react";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(null); // null = loading

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/admin`, {
      credentials: "include",
    })
      .then((res) => setIsAdmin(res.ok))
      .catch(() => setIsAdmin(false));
  }, []);

  return isAdmin;
}
