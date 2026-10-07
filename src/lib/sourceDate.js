// Formats the date a cited source was said or done (CA_0301), by precision.
// Pure logic. Parses the YYYY-MM-DD text by hand: new Date() would read it as UTC
// and show the previous day west of Greenwich.
//
// A year date arrives as YYYY-01-01 and a month date as YYYY-MM-01. They must
// never render as a full day. Unknown (null) or malformed input returns '' so
// the caller shows no date at all: no placeholder, no "unknown".

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatSourceDate(sourceDate, precision) {
  if (!sourceDate || typeof sourceDate !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(sourceDate);
  if (!m) return '';
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';

  if (precision === 'year') return String(year);
  if (precision === 'month') return `${MONTHS[month - 1]} ${year}`;
  if (precision === 'day') return `${MONTHS[month - 1]} ${day}, ${year}`;
  // A date with no precision cannot be trusted to be a real day: show nothing.
  return '';
}
