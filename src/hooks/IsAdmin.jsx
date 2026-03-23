import { useState, useEffect } from "react";
import { publicFetch } from "../lib/auth";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(null); // null = loading

  useEffect(() => {
    publicFetch('/admin/me')
      .then((res) => {
        setIsAdmin(res && res.ok);
      })
      .catch(() => setIsAdmin(false));
  }, []);

  return isAdmin;
}
