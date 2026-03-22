import { useEffect } from "react";
import { AUTH_HUB_URL } from "../lib/auth";

function Login() {
  useEffect(() => {
    const returnTo = new URLSearchParams(window.location.search).get("return")
      || window.location.origin + "/results";
    window.location.replace(
      `${AUTH_HUB_URL}/login?redirect=${encodeURIComponent(returnTo)}`
    );
  }, []);
  return null;
}

export default Login;
