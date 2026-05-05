import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { CompassProvider } from "./components/CompassContext.jsx";
import { ThemeProvider } from "./ThemeProvider.jsx";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <BrowserRouter basename={import.meta.env.VITE_BASENAME || "/"}>
    <ThemeProvider>
      <CompassProvider>
        <StrictMode>
          <App />
        </StrictMode>
      </CompassProvider>
    </ThemeProvider>
  </BrowserRouter>
);
