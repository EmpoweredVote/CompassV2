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
