import { useState } from "react";
import { Routes, Router, Route } from "react-router";
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

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        {/* Guest-accessible routes */}
        <Route path="/library" element={<Layout><Library /></Layout>} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/build" element={<Layout><BuildCompass /></Layout>} />
        <Route path="/results" element={<Layout><Compass /></Layout>} />
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
        <Route path="/401" element={<Unauthorized />} />
      </Routes>
    </>
  );
}

export default App;
