import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { PostHogProvider } from "posthog-js/react";
import posthog from "posthog-js";
import { CompassProvider } from "./components/CompassContext.jsx";
import { ThemeProvider } from "./ThemeProvider.jsx";
import "./index.css";
import App from "./App.jsx";

posthog.init('phc_kpUWTjEcRRwSn7zdNstbDVYqAMQvEFZ5EgrWFeaAh5mu', {
  api_host: 'https://us.i.posthog.com',
  defaults: '2026-01-30',
  person_profiles: 'identified_only',
  capture_pageview: false,
  capture_dead_clicks: true,
});

createRoot(document.getElementById("root")).render(
  <PostHogProvider client={posthog}>
    <BrowserRouter basename={import.meta.env.VITE_BASENAME || "/"}>
      <ThemeProvider>
        <CompassProvider>
          <StrictMode>
            <App />
          </StrictMode>
        </CompassProvider>
      </ThemeProvider>
    </BrowserRouter>
  </PostHogProvider>
);
