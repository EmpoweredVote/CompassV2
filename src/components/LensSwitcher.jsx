import { forwardRef } from "react";
import { readableOn, DARK_PAGE_BG, LIGHT_PAGE_BG } from "../lib/lensColors.js";

/**
 * Chip icon. Capitol dome (federal), gavel (judicial), house (local), tag (a
 * user's own lens). Keyed on the lens key, and user keys always start `u_` —
 * which is exactly why they do: curated and user lenses share this row, so a
 * user lens named "federal" must not be able to shadow the editorial one.
 */
function LensIcon({ lensKey }) {
  if (lensKey === "federal") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
      </svg>
    );
  }
  if (lensKey === "judicial") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M10 1a.75.75 0 01.75.75v1.5h2.75A2.75 2.75 0 0116.25 6v.75H18a.75.75 0 010 1.5h-1.75v5H18a.75.75 0 010 1.5h-1.75V15a2.75 2.75 0 01-2.75 2.75H6.5A2.75 2.75 0 013.75 15v-.25H2a.75.75 0 010-1.5h1.75v-5H2a.75.75 0 010-1.5h1.75V6A2.75 2.75 0 016.5 3.25h2.75v-1.5A.75.75 0 0110 1zm0 4.25H6.5A1.25 1.25 0 005.25 6.5v7A1.25 1.25 0 006.5 14.75h7A1.25 1.25 0 0014.75 13.5v-7A1.25 1.25 0 0013.5 5.25H10z" clipRule="evenodd" />
      </svg>
    );
  }
  if (lensKey === "local") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
      </svg>
    );
  }
  // A user-authored lens.
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
  );
}

/**
 * The lens row.
 *
 * `activeLensKey` decides which chip reads as active — never a comparison of
 * the current topic set against each lens's topics. See lib/compassSync.js for
 * why that distinction is load-bearing rather than stylistic.
 *
 * Every chip carries a data-testid. The smoke suite otherwise has to click by
 * button text, which collides with the Federal Lens offer card elsewhere on the
 * page and routes into calibration instead of switching lens.
 */
const LensSwitcher = forwardRef(function LensSwitcher(
  { lenses, activeLensKey, isDark, onSelect, onExit, renderChipExtra },
  ref
) {
  const neutral = isDark ? "#52525b" : "#6B7280";
  return (
    <div
      ref={ref}
      className="w-full max-w-6xl mx-auto lg:px-4 mb-3 flex items-center gap-2 flex-wrap justify-center lg:justify-start"
    >
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-0.5">Lens:</span>
      {lenses.map((lens) => {
        const active = activeLensKey === lens.key;
        const color = lens.color || neutral;
        // Only the INACTIVE chip needs adjusting. It paints the lens colour as
        // text and border directly on the page, where the stored colours — set
        // for a light background — fall as low as 1.6:1 on dark. The active chip
        // uses the colour as a BACKGROUND under white text, so lightening it
        // there would reduce contrast, not improve it.
        const outline = readableOn(color, isDark ? DARK_PAGE_BG : LIGHT_PAGE_BG);
        return (
          <span key={lens.key} className="inline-flex items-center">
            <button
              onClick={() => onSelect(lens)}
              title={active ? `${lens.name} active — click to restore your compass` : lens.name}
              data-testid={`lens-chip-${lens.key}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer hover:opacity-90 active:scale-95"
              style={active
                ? { background: color, color: "#fff", borderColor: color }
                : { background: "transparent", color: outline, borderColor: outline }}
            >
              <LensIcon lensKey={lens.key} />
              {lens.shortLabel || lens.name}
              {lens.flagCount > 0 && (
                <span
                  title={`${lens.flagCount} question${lens.flagCount === 1 ? "" : "s"} to recalibrate`}
                  data-testid={`lens-flags-${lens.key}`}
                  className="ml-0.5 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold w-4 h-4"
                >
                  {lens.flagCount}
                </span>
              )}
            </button>
            {renderChipExtra ? renderChipExtra(lens, active) : null}
          </span>
        );
      })}
      <button
        onClick={onExit}
        title="Show my full compass"
        data-testid="lens-chip-my-compass"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer hover:opacity-90 active:scale-95"
        style={!activeLensKey
          ? { background: neutral, color: "#fff", borderColor: neutral }
          : { background: "transparent", color: isDark ? "#a1a1aa" : "#6B7280", borderColor: isDark ? "#52525b" : "#d1d5db" }}
      >
        My compass
      </button>
    </div>
  );
});

export default LensSwitcher;
