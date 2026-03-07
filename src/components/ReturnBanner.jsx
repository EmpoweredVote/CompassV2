import { useState } from "react";
import { serializeCompassFragment } from "./CompassContext";

/**
 * Persistent thin banner shown at the top of CompassV2 when a guest arrives
 * via the Essentials CTA (which includes ?return= in the URL).
 *
 * Clicking "Return to profile" navigates back to Essentials with the
 * current compass data appended as a #compass= URL fragment.
 */
const SESSION_KEY = "essentials_return_url";

export default function ReturnBanner() {
  const [returnUrl] = useState(() => {
    // Check URL first — fresh arrival from Essentials
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("return");
    if (fromUrl) {
      sessionStorage.setItem(SESSION_KEY, fromUrl);
      // Strip ?return= from URL to keep things clean
      const url = new URL(window.location.href);
      url.searchParams.delete("return");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
      return fromUrl;
    }
    // Fall back to sessionStorage — survives HelpGuard redirects & navigation
    return sessionStorage.getItem(SESSION_KEY) || "";
  });
  const [dismissed, setDismissed] = useState(false);

  if (!returnUrl || dismissed) return null;

  const handleReturn = (e) => {
    e.preventDefault();
    const fragment = serializeCompassFragment();
    window.location.href = returnUrl + fragment;
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.removeItem(SESSION_KEY);
  };

  return (
    <>
      {/* Fixed banner — floats above CalibrationOverlay (z-50) */}
      <div
        className="bg-[#00657c] text-white text-sm flex items-center justify-center gap-2 px-4 py-2 fixed top-0 left-0 right-0 z-[60]"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        <span>You came from Essentials</span>
        <span className="mx-1 opacity-50">---</span>
        <a
          href="#"
          onClick={handleReturn}
          className="font-semibold underline underline-offset-2 hover:text-[#fed12e] transition-colors"
        >
          Return to profile
        </a>
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors cursor-pointer"
          aria-label="Dismiss banner"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
      {/* Spacer so Layout content isn't hidden behind the fixed banner */}
      <div className="h-9" />
    </>
  );
}
