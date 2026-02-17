import { useNavigate, useLocation } from "react-router";
import { SiteHeader } from "@chrisandrewsedu/ev-ui";
import { useCompass } from "../components/CompassContext";
import { useIsAdmin } from "../hooks/IsAdmin";

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const { setSelectedTopics, setAnswers, setWriteIns, isLoggedIn, username, setIsLoggedIn } = useCompass();

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
        localStorage.removeItem("answers");
        localStorage.removeItem("writeIns");
        setSelectedTopics([]);
        setAnswers({});
        setWriteIns({});
        setIsLoggedIn(false);
        navigate("/");
      })
      .catch((err) => {
        console.error(err);
        navigate("/");
      });
  };

  const handleClearCompass = () => {
    if (!window.confirm("Are you sure? This will clear all your compass answers.")) return;
    fetch(`${import.meta.env.VITE_API_URL}/compass/answers/me`, {
      method: "DELETE",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Clear failed");
        localStorage.removeItem("answers");
        localStorage.removeItem("writeIns");
        localStorage.removeItem("selectedTopics");
        localStorage.removeItem("invertedSpokes");
        setAnswers({});
        setWriteIns({});
        setSelectedTopics([]);
      })
      .catch((err) => console.error("Failed to clear compass:", err));
  };

  const handleNavigate = (href) => {
    if (href.startsWith("/")) {
      navigate(href);
    } else {
      window.location.href = href;
    }
  };

  const profileItems = [
    ...(isAdmin ? [
      { label: "Admin", href: "/admin" },
      { label: "Clear compass", onClick: handleClearCompass },
    ] : []),
    { label: "Logout", onClick: logout },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader
        logoSrc="/EVLogo.svg"
        currentPath={location.pathname}
        onNavigate={handleNavigate}
        profileMenu={
          isLoggedIn
            ? { label: username, items: profileItems }
            : { label: null, items: [{ label: "Sign in", onClick: () => navigate("/login") }] }
        }
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default Layout;
