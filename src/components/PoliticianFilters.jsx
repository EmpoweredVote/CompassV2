// PoliticianFilters.jsx
// Reusable filter UI: level pills (All / Federal / State / Local) + state dropdown + clear controls.
// Purely presentational — all state lives in the parent via useFilteredPoliticians hook.
//
// Props:
//   level          - current level string: "All" | "Federal" | "State" | "Local"
//   onLevelChange  - (lvl: string) => void
//   levelCounts    - { Federal: number, State: number, Local: number }
//   stateFilter    - current state code string or ""
//   onStateChange  - (code: string) => void
//   availableStates - Array<{ code: string, name: string }>
//   hasActiveFilters - boolean
//   onClearAll     - () => void

const LEVELS = ["Federal", "State", "Local"];

const pillBase =
  "rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-colors";
const pillActive = "bg-[#00657c] text-white";
const pillInactive = "bg-neutral-100 text-neutral-600 hover:bg-neutral-200";

export default function PoliticianFilters({
  level,
  onLevelChange,
  levelCounts,
  stateFilter,
  onStateChange,
  availableStates,
  hasActiveFilters,
  onClearAll,
}) {
  return (
    <div className="select-none">
      {/* Single row: state dropdown → level pills → clear controls */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        {/* State dropdown */}
        <select
          value={stateFilter}
          onChange={(e) => onStateChange(e.target.value)}
          className="rounded-lg border border-neutral-200 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#59b0c4]/40 focus:border-[#59b0c4] transition-colors"
        >
          <option value="">State</option>
          {availableStates.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>

        {/* All pill — always visible, no count */}
        <button
          type="button"
          className={`${pillBase} ${level === "All" ? pillActive : pillInactive}`}
          onClick={() => onLevelChange("All")}
        >
          All
        </button>

        {/* Federal / State / Local pills — only render if count > 0 */}
        {LEVELS.map((lvl) => {
          const count = levelCounts[lvl] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={lvl}
              type="button"
              className={`${pillBase} ${level === lvl ? pillActive : pillInactive}`}
              onClick={() => onLevelChange(lvl)}
            >
              {lvl} ({count})
            </button>
          );
        })}

        {/* Clear all link — pushed to the right */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="ml-auto text-xs text-neutral-400 hover:text-neutral-600 cursor-pointer underline transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
