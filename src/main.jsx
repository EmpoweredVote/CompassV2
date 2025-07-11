import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { CompassProvider } from "./components/CompassContext.jsx";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <BrowserRouter basename={import.meta.env.VITE_BASENAME}>
    <CompassProvider>
      <StrictMode>
        <App />
      </StrictMode>
    </CompassProvider>
  </BrowserRouter>
);
