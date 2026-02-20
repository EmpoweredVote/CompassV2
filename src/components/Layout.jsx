import { useNavigate, useLocation } from "react-router";
import { SiteHeader } from "@chrisandrewsedu/ev-ui";
import { useCompass } from "../components/CompassContext";
import { useIsAdmin } from "../hooks/IsAdmin";

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const { setSelectedTopics, setAnswers, setWriteIns, setInvertedSpokes, isLoggedIn, username, setIsLoggedIn } = useCompass();

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
    if (!window.confirm("Reset your compass? This will remove all your topics, answers, and stances.")) return;
    // Clear localStorage
    localStorage.removeItem("answers");
    localStorage.removeItem("writeIns");
    localStorage.removeItem("selectedTopics");
    localStorage.removeItem("invertedSpokes");
    localStorage.removeItem("onboarding_spokeFlip");
    localStorage.removeItem("calibration_skipped");
    localStorage.removeItem("calibration_completed");
    localStorage.removeItem("calibration_progress");
    localStorage.removeItem("savePromptModalDismissed");
    // Clear context state
    setAnswers({});
    setWriteIns({});
    setSelectedTopics([]);
    setInvertedSpokes({});
    // Server clear for logged-in users
    fetch(`${import.meta.env.VITE_API_URL}/compass/answers/me`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {});
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
    { label: "Reset compass", onClick: handleClearCompass },
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
      {/* Help button — always visible */}
      <button
        onClick={() => navigate("/help")}
        className="fixed bottom-4 right-4 z-40 w-9 h-9 rounded-full bg-white border border-gray-300 shadow-md flex items-center justify-center text-gray-500 hover:text-[#00657c] hover:border-[#00657c] transition-colors cursor-pointer"
        title="Help & walkthrough"
        aria-label="Help"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

export default Layout;
