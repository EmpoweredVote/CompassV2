// InlinePoliticianPicker.jsx
// Inline dropdown picker that replaces the politician header in ComparePanel.
// Props:
//   currentPolitician - the currently compared politician object (or null)
//   onSelect(politician) - called when user picks from the list
//   onClear() - called when user chooses "Clear comparison"
//   onOpenFullModal() - called when user clicks the browse/expand button
import { useEffect, useMemo, useRef, useState } from "react";
import { getPolName, normalizeOfficeTitle, getOfficeSubtitle } from "../util/name";
import placeholder from "../assets/placeholder.png";
import usePoliticianList from "../hooks/usePoliticianList";
import { useFilteredPoliticians } from "../hooks/useFilteredPoliticians";
import PoliticianFilters from "./PoliticianFilters";

const normalize = (s = "") =>
  s
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export default function InlinePoliticianPicker({
  currentPolitician,
  onSelect,
  onClear,
  onOpenFullModal,
}) {
  const { politicians, loading } = usePoliticianList();
  const {
    level,
    setLevel,
    stateFilter,
    setStateFilter,
    clearAll,
    hasActiveFilters,
    levelCounts,
    availableStates,
    filtered,
  } = useFilteredPoliticians(politicians);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const containerRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Hydrate stale localStorage politician with fresh API data (new fields)
  useEffect(() => {
    if (!currentPolitician || !politicians.length) return;
    const fresh = politicians.find((p) => p.id === currentPolitician.id);
    if (fresh && fresh.district_type && !currentPolitician.district_type) {
      onSelect?.(fresh);
    }
  }, [politicians, currentPolitician, onSelect]);

  // Close dropdown on outside click
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Reset highlight when query or politicians change
  useEffect(() => {
    setHighlight(0);
  }, [query, politicians]);

  const options = useMemo(() => {
    const q = normalize(query);
    if (!q) return filtered;
    return filtered.filter((p) => {
      const name = normalize(getPolName(p));
      const office = normalize(getOfficeSubtitle(p));
      return name.includes(q) || office.includes(q);
    });
  }, [filtered, query]);

  const ensureVisible = (i) => {
    const list = listRef.current;
    if (!list) return;
    const el = list.children[i];
    if (!el) return;
    const t = el.offsetTop;
    const b = t + el.offsetHeight;
    const vt = list.scrollTop;
    const vb = vt + list.clientHeight;
    if (t < vt) list.scrollTop = t;
    else if (b > vb) list.scrollTop = b - list.clientHeight;
  };

  const handleSelect = (p) => {
    onSelect?.(p);
    setOpen(false);
    setQuery("");
  };

  const handleClear = () => {
    onClear?.();
    setOpen(false);
    setQuery("");
  };

  const handleOpenFullModal = () => {
    onOpenFullModal?.();
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => {
        const nh = Math.min(h + 1, Math.max(0, options.length - 1));
        ensureVisible(nh);
        return nh;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => {
        const nh = Math.max(h - 1, 0);
        ensureVisible(nh);
        return nh;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = options[highlight];
      if (pick) handleSelect(pick);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const polName = currentPolitician ? getPolName(currentPolitician) : null;
  const polPhoto = currentPolitician
    ? currentPolitician.photo_origin_url ||
      currentPolitician.photo_custom_url ||
      placeholder
    : placeholder;

  return (
    <div className="relative" ref={containerRef}>
      {/* Collapsed trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 w-full text-left cursor-pointer hover:bg-neutral-50 rounded-lg px-1 py-1 transition-colors"
      >
        <div className="size-16 rounded-full overflow-hidden shrink-0 ring-2 ring-neutral-100">
          <img
            src={polPhoto}
            className="w-full h-full object-cover object-center"
            alt={polName || "Politician"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight truncate">
            {polName || "Selected Politician"}
          </h2>
          {currentPolitician?.office_title && (
            <p className="text-neutral-500 text-sm leading-snug">
              {getOfficeSubtitle(currentPolitician)}
            </p>
          )}
        </div>
        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-5 h-5 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-neutral-200 shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-neutral-100">
            <input
              ref={inputRef}
              type="text"
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#59b0c4]/40 focus:border-[#59b0c4] transition-colors"
              placeholder="Search politician by name or office..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Filter controls */}
          <PoliticianFilters
            level={level}
            onLevelChange={setLevel}
            levelCounts={levelCounts}
            stateFilter={stateFilter}
            onStateChange={setStateFilter}
            availableStates={availableStates}
            hasActiveFilters={hasActiveFilters}
            onClearAll={clearAll}
          />

          {/* Divider between filters and action rows */}
          <div className="border-t border-neutral-100" />

          {/* Clear comparison row */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-500 hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-neutral-400 shrink-0"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
            Clear comparison
          </button>

          {/* Divider */}
          <div className="border-t border-neutral-100" />

          {/* Browse all row */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleOpenFullModal}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-500 hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-neutral-400 shrink-0"
            >
              <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
              <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
            </svg>
            Browse all politicians
          </button>

          {/* Divider */}
          <div className="border-t border-neutral-100" />

          {/* Politician list */}
          <div
            ref={listRef}
            className="max-h-64 overflow-auto"
          >
            {loading && politicians.length === 0 && (
              <div className="px-4 py-3 text-sm text-neutral-400 text-center">
                Loading...
              </div>
            )}
            {!loading && options.length === 0 && (
              <div className="px-4 py-3 text-sm text-neutral-400 text-center">
                {hasActiveFilters
                  ? "No politicians match the current filters"
                  : "No results"}
              </div>
            )}
            {options.map((p, i) => {
              const active = i === highlight;
              const isCurrent =
                currentPolitician && p.id === currentPolitician.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(p)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
                    active ? "bg-neutral-100" : isCurrent ? "bg-[#59b0c4]/10" : ""
                  }`}
                >
                  <div className="flex flex-row gap-3 items-center">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                      <img
                        src={p.photo_origin_url || p.photo_custom_url || placeholder}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        alt={getPolName(p)}
                      />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="font-medium truncate">{getPolName(p)}</div>
                      <div className="text-neutral-500 text-xs truncate">
                        {getOfficeSubtitle(p)}
                      </div>
                    </div>
                    {isCurrent && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4 text-[#59b0c4] shrink-0"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
