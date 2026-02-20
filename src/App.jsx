import { useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Library from "./pages/Library";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import Unauthorized from "./pages/Unauthorized";
import { Quiz } from "./pages/Quiz";
import Compass from "./pages/Compass";
import BuildCompass from "./pages/BuildCompass";
import Layout from "./components/Layout";
import { CompassProvider } from "./components/CompassContext";
import AdminDashboard from "./components/admin/AdminDashboard";
import { Onboarding } from "./pages/Onboarding";

// Routes that should bypass the help guard
const HELP_GUARD_BYPASS = ["/help", "/login", "/register", "/admin", "/401"];

function HelpGuard({ children }) {
  const location = useLocation();
  const helpSeen = localStorage.getItem("help_seen");
  const isBypass = HELP_GUARD_BYPASS.some(
    (path) => location.pathname === path || location.pathname.startsWith("/admin")
  );

  if (!helpSeen && !isBypass) {
    return <Navigate to="/help" replace />;
  }

  return children;
}

function App() {
  return (
    <>
      <Routes>
        {/* Public routes that bypass the help guard */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/help" element={<Onboarding />} />
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
              <Layout><Library /></Layout>
            </HelpGuard>
          }
        />
        <Route
          path="/library"
          element={
            <HelpGuard>
              <Layout><Library /></Layout>
            </HelpGuard>
          }
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
              <Layout><Compass /></Layout>
            </HelpGuard>
          }
        />
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
