import { useState, useEffect } from "react";
import { publicFetch } from "../lib/auth";

// isLoggedIn must be passed in so the check only fires after the auth token
// is confirmed in localStorage — otherwise the SSO flow may not have saved
// the token yet and the request goes out unauthenticated, permanently
// resolving to false.
export function useIsAdmin(isLoggedIn) {
  const [isAdmin, setIsAdmin] = useState(null); // null = loading

  useEffect(() => {
    if (!isLoggedIn) {
      setIsAdmin(false);
      return;
    }
    publicFetch('/admin/me')
      .then((res) => {
        setIsAdmin(res && res.ok);
      })
      .catch(() => setIsAdmin(false));
  }, [isLoggedIn]);

  return isAdmin;
}
