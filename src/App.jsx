import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router";
import { usePostHog } from "posthog-js/react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import Unauthorized from "./pages/Unauthorized";
import { Quiz } from "./pages/Quiz";
import BuildCompass from "./pages/BuildCompass";
import Layout from "./components/Layout";
import { CompassProvider, useCompass } from "./components/CompassContext";
import AdminDashboard from "./components/admin/AdminDashboard";
import HowItWorks from "./pages/HowItWorks";
import FullCalibration from "./pages/FullCalibration";
import CombinedPage from "./pages/CombinedPage";

// Routes that should bypass the calibration guard
const GUARD_BYPASS = ["/help", "/how-it-works", "/login", "/register", "/admin", "/401", "/results", "/library", "/calibrate"];

function HelpGuard({ children }) {
  const location = useLocation();
  const calibrationDone =
    localStorage.getItem("calibration_completed") === "true" ||
    localStorage.getItem("calibration_skipped") === "true";
  const isBypass = GUARD_BYPASS.some(
    (path) => location.pathname === path || location.pathname.startsWith("/admin")
  );

  if (!calibrationDone && !isBypass) {
    // Preserve ?return= param in sessionStorage before redirect strips it
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get("return");
    if (returnUrl) {
      sessionStorage.setItem("essentials_return_url", returnUrl);
    }
    return <Navigate to="/results" replace />;
  }

  return children;
}

function PostHogPageview() {
  const location = useLocation();
  const posthog = usePostHog();
  useEffect(() => {
    posthog?.capture('$pageview');
    return () => posthog?.capture('$pageleave');
  }, [location.pathname]);
  return null;
}

function App() {
  const { compassVersion, userId, isLoggedIn } = useCompass();
  const posthog = usePostHog();

  // Identify logged-in users so PostHog can stitch cross-app journeys
  useEffect(() => {
    if (isLoggedIn && userId) {
      posthog?.identify(userId);
    }
  }, [isLoggedIn, userId]);

  // Cross-app calibration handoff: essentials links here as
  // compass.empowered.vote/?calibrate=<lensKey>&return=<url> to open a specific
  // lens's calibration. Stash the lens key before any guard redirect can strip
  // it; CombinedPage consumes it once on mount. (?return= is handled separately
  // by ReturnBanner for the round-trip back.)
  useEffect(() => {
    const cal = new URLSearchParams(window.location.search).get("calibrate");
    if (cal) sessionStorage.setItem("start_calibrate_lens", cal);
  }, []);

  return (
    <>
      <PostHogPageview />
      <Routes>
        {/* Public routes that bypass the help guard */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/help" element={<Navigate to="/how-it-works" replace />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/401" element={<Unauthorized />} />

        {/* Protected admin route */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <Layout>
                  <AdminDashboard />
                </Layout>
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        {/* Guest-accessible routes guarded by HelpGuard */}
        <Route
          path="/"
          element={
            <HelpGuard>
              <Layout><CombinedPage key={compassVersion} /></Layout>
            </HelpGuard>
          }
        />
        <Route
          path="/library"
          element={<Navigate to="/results" replace />}
        />
        <Route
          path="/quiz"
          element={
            <HelpGuard>
              <Quiz />
            </HelpGuard>
          }
        />
        <Route
          path="/build"
          element={
            <HelpGuard>
              <Layout><BuildCompass /></Layout>
            </HelpGuard>
          }
        />
        <Route
          path="/results"
          element={
            <HelpGuard>
              <Layout><CombinedPage key={compassVersion} /></Layout>
            </HelpGuard>
          }
        />
        <Route path="/calibrate" element={<FullCalibration />} />

        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HelpGuard>
                <Home />
              </HelpGuard>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;
