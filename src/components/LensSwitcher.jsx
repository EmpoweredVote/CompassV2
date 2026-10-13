import { forwardRef } from "react";
import { readableOn, DARK_PAGE_BG, LIGHT_PAGE_BG } from "../lib/lensColors.js";
import LensIcon from "./LensIcon.jsx";

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
