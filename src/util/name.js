export function getPolName(politician) {
  const polName = politician.preferred_name
    ? politician.preferred_name + " " + politician.last_name
    : politician.full_name
    ? politician.full_name
    : politician.first_name + " " + politician.last_name;
  return polName;
}

export function normalizeOfficeTitle(title) {
  if (!title) return "";

  // Replace "...member" with "... member" if missing a space
  return title.replace(/([A-Za-z])member\b/, "$1 Member");
}

// Bare role names that need geographic context appended
const GENERIC_TITLES = new Set([
  "representative",
  "senator",
  "governor",
  "mayor",
  "lieutenant governor",
  "council member",
  "council president",
  "commissioner",
  "judge",
  "justice",
]);

/**
 * Build a descriptive office subtitle from the politician object.
 * For federal offices (NATIONAL_*), always build a standardized format
 * to ensure consistency across data sources.
 * For other offices, generic titles get geographic context appended;
 * already-descriptive titles pass through.
 */
export function getOfficeSubtitle(p) {
  const title = normalizeOfficeTitle(p.office_title);
  if (!title) return "";

  const state = p.representing_state || "";
  const city = p.representing_city || "";
  const distLabel = p.district_label || "";
  const dt = p.district_type || "";

  // Federal offices: always standardize regardless of raw title
  switch (dt) {
    case "NATIONAL_LOWER": {
      const distNum = distLabel.match(/\d+/)?.[0];
      if (distNum && state) return `U.S. Representative - ${state}-${distNum}`;
      if (state) return `U.S. Representative - ${state}`;
      return title;
    }
    case "NATIONAL_UPPER":
      if (distLabel) return `U.S. Senator - ${distLabel}`;
      if (state) return `U.S. Senator - ${state}`;
      return title;

    case "NATIONAL_EXEC":
      return title;
  }

  // Non-federal: only enhance generic titles
  if (!GENERIC_TITLES.has(title.toLowerCase().trim())) return title;

  switch (dt) {
    case "STATE_EXEC":
      if (distLabel) return `${title} - ${distLabel}`;
      if (state) return `${title} - ${state}`;
      return title;

    case "LOCAL_EXEC":
    case "LOCAL":
    case "COUNTY":
    case "SCHOOL":
    case "JUDICIAL":
      if (city && state) return `${title} - ${city}, ${state}`;
      if (distLabel) return `${title} - ${distLabel}`;
      return title;

    default:
      if (state) return `${title} - ${state}`;
      return title;
  }
}
