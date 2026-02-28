// useFilteredPoliticians.js
// Shared hook that manages level and state filter state and computes filtered results.
// Accepts the raw politician array from usePoliticianList; does NOT apply text query (that stays in picker).

import { useState, useMemo, useEffect } from "react";

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const STATE_NAMES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  GU: "Guam",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  MP: "Northern Mariana Islands",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  PR: "Puerto Rico",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VI: "U.S. Virgin Islands",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  AS: "American Samoa",
};

// ---------------------------------------------------------------------------
// Tier derivation
// ---------------------------------------------------------------------------

/**
 * Maps a district_type string to a governance tier.
 * Note: JUDICIAL is always Local here because the compass politicians endpoint
 * does not include chamber_name, which would be needed to distinguish state
 * appellate courts. This is an acceptable simplification for the compare picker.
 *
 * @param {string|undefined} dt - district_type value from politician object
 * @returns {"Federal"|"State"|"Local"|null}
 */
function tierFromDistrictType(dt) {
  if (!dt) return null;
  if (dt === "NATIONAL_EXEC" || dt === "NATIONAL_UPPER" || dt === "NATIONAL_LOWER") {
    return "Federal";
  }
  if (dt === "STATE_EXEC" || dt === "STATE_UPPER" || dt === "STATE_LOWER") {
    return "State";
  }
  if (
    dt === "LOCAL_EXEC" ||
    dt === "LOCAL" ||
    dt === "COUNTY" ||
    dt === "SCHOOL" ||
    dt === "JUDICIAL"
  ) {
    return "Local";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useFilteredPoliticians — manages level + state filter state and computes filtered results.
 *
 * @param {Array} politicians - raw politician array from usePoliticianList
 * @returns {{
 *   level: string,
 *   setLevel: function,
 *   stateFilter: string,
 *   setStateFilter: function,
 *   clearAll: function,
 *   hasActiveFilters: boolean,
 *   levelCounts: {Federal: number, State: number, Local: number},
 *   availableStates: Array<{code: string, name: string}>,
 *   filtered: Array
 * }}
 */
export function useFilteredPoliticians(politicians) {
  const [level, setLevelRaw] = useState("All");
  const [stateFilter, setStateFilter] = useState("");

  // When level changes, auto-clear stateFilter if it produces zero results at the new level.
  useEffect(() => {
    if (!stateFilter) return;
    const hasMatch = politicians.some((p) => {
      const tier = tierFromDistrictType(p.district_type);
      const levelMatch = level === "All" || tier === level;
      const stateMatch = p.representing_state === stateFilter;
      return levelMatch && stateMatch;
    });
    if (!hasMatch) {
      setStateFilter("");
    }
  }, [level, politicians]); // intentionally excludes stateFilter to avoid loop

  // Setter that triggers the auto-clear effect via level change.
  const setLevel = (lvl) => {
    setLevelRaw(lvl);
  };

  // levelCounts: when stateFilter active, counts only match that state; otherwise all politicians.
  const levelCounts = useMemo(() => {
    const counts = { Federal: 0, State: 0, Local: 0 };
    for (const p of politicians) {
      const tier = tierFromDistrictType(p.district_type);
      if (!tier) continue;
      if (stateFilter && p.representing_state !== stateFilter) continue;
      counts[tier]++;
    }
    return counts;
  }, [politicians, stateFilter]);

  // availableStates: states with at least one politician matching current level filter.
  const availableStates = useMemo(() => {
    const codeSet = new Set();
    for (const p of politicians) {
      const st = p.representing_state;
      if (!st) continue;
      const tier = tierFromDistrictType(p.district_type);
      const levelMatch = level === "All" || tier === level;
      if (levelMatch) codeSet.add(st);
    }
    return Array.from(codeSet)
      .map((code) => ({ code, name: STATE_NAMES[code] || code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [politicians, level]);

  // filtered: apply level + state filters (NOT text query).
  const filtered = useMemo(() => {
    return politicians.filter((p) => {
      const tier = tierFromDistrictType(p.district_type);
      const levelMatch = level === "All" || tier === level;
      const stateMatch = !stateFilter || p.representing_state === stateFilter;
      return levelMatch && stateMatch;
    });
  }, [politicians, level, stateFilter]);

  const hasActiveFilters = level !== "All" || stateFilter !== "";

  const clearAll = () => {
    setLevelRaw("All");
    setStateFilter("");
  };

  return {
    level,
    setLevel,
    stateFilter,
    setStateFilter,
    clearAll,
    hasActiveFilters,
    levelCounts,
    availableStates,
    filtered,
  };
}
