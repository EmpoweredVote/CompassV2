import { useEffect } from "react";
import { AUTH_HUB_URL } from "../lib/auth";

function Register() {
  useEffect(() => {
    const returnTo = new URLSearchParams(window.location.search).get("return")
      || window.location.origin + "/results";
    window.location.replace(
      `https://login.empowered.vote/signup/inform?redirect=${encodeURIComponent(returnTo)}`
    );
  }, []);
  return null;
}

export default Register;
