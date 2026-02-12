import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { SiteHeader } from "@chrisandrewsedu/ev-ui";
import { useCompass } from "../components/CompassContext";
import { useIsAdmin } from "../hooks/IsAdmin";

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const { setSelectedTopics } = useCompass();
  const [username, setUsername] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.username) setUsername(data.username);
      })
      .catch(() => {});
  }, []);

  const logout = () => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Logout failed");
        return res.text();
      })
      .then(() => {
        localStorage.removeItem("compareUser");
        localStorage.removeItem("invertedSpokes");
        localStorage.removeItem("selectedTopics");
        setSelectedTopics([]);
        navigate("/");
      })
      .catch((err) => {
        console.error(err);
        navigate("/");
      });
  };

  const handleNavigate = (href) => {
    if (href.startsWith("/")) {
      navigate(href);
    } else {
      window.location.href = href;
    }
  };

  const profileItems = [
    ...(isAdmin ? [{ label: "Admin", href: "/admin" }] : []),
    { label: "Logout", onClick: logout },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader
        logoSrc="/EVLogo.svg"
        currentPath={location.pathname}
        onNavigate={handleNavigate}
        profileMenu={{ label: username, items: profileItems }}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default Layout;
