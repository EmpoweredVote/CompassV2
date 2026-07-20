import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { PostHogProvider } from "posthog-js/react";
import { init, getClient } from "@empoweredvote/analytics";
import { AppErrorBoundary } from "@empoweredvote/analytics/react";
import { CompassProvider } from "./components/CompassContext.jsx";
import { ThemeProvider } from "./ThemeProvider.jsx";
import "./index.css";
import App from "./App.jsx";

// Shared analytics: app + environment auto-stamped, key env-gated (unset locally
// = no-op), exception capture + noise filter built in. See @empoweredvote/analytics.
// NOTE: the deployed env MUST set VITE_POSTHOG_KEY, else analytics is a no-op.
init({
  app: "compass",
  key: import.meta.env.VITE_POSTHOG_KEY,
  captureDeadClicks: true,
});

createRoot(document.getElementById("root")).render(
  <PostHogProvider client={getClient()}>
    <AppErrorBoundary>
      <BrowserRouter basename={import.meta.env.VITE_BASENAME || "/"}>
        <ThemeProvider>
          <CompassProvider>
            <StrictMode>
              <App />
            </StrictMode>
          </CompassProvider>
        </ThemeProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </PostHogProvider>
);
