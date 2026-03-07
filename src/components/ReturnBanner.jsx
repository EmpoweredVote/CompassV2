import { useState } from "react";
import { serializeCompassFragment } from "./CompassContext";

/**
 * Persistent thin banner shown at the top of CompassV2 when a guest arrives
 * via the Essentials CTA (which includes ?return= in the URL).
 *
 * Clicking "Return to profile" navigates back to Essentials with the
 * current compass data appended as a #compass= URL fragment.
 */
export default function ReturnBanner() {
  const [returnUrl] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("return") || "";
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
    // Strip ?return= from URL to keep things clean on internal navigation
    const url = new URL(window.location.href);
    url.searchParams.delete("return");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  };

  return (
    <div
      className="bg-[#00657c] text-white text-sm flex items-center justify-center gap-2 px-4 py-2 relative"
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
  );
}
