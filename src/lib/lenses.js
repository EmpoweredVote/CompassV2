// Mirrors the compass_lenses + compass_lens_topics tables in inform schema.
// Until a /compass/lenses API endpoint exists, these constants are the source of truth.
export const LOCAL_LENS = {
  key: 'local',
  name: 'Local Lens',
  description: '8 questions most local candidates have already answered',
  color: '#5A9A6E',
  topicIds: [
    '669cac97-66a6-4087-b036-936fbe62efb3', // Housing
    '4938766b-b45a-46e3-93bd-b8b30651271a', // Homelessness
    'd4f18138-a2e0-4110-b925-7387d9d0d16d', // Residential Zoning
    '0bc588c6-39e1-4084-b5de-cac909b8b762', // Civil Rights
    'e9ebefcd-c496-45e8-b816-a79f8442ba85', // Public Safety Approach
    'b9ccee94-ad96-4f10-b655-889d8e5abe92', // Local Immigration Enforcement
    'eb3d1247-0de1-4b7f-baec-7259861efd53', // Economic Development Incentives
    'ba59337e-30e2-4aba-a39a-426b3366eb27', // Transportation Priorities
  ],
};

export const JUDICIAL_LENS = {
  key: 'judicial',
  name: 'Judicial Lens',
  description: '8 questions for judicial and DA candidates',
  color: '#C2440A',
  topicIds: [
    '1fab5edf-6151-4da0-9704-a7f2113ba54c', // Bail & Pretrial
    '9d45acaf-1ba4-4cb8-95e1-5ed985223b91', // Court Access
    '9db07b16-1076-4b7d-ad89-ebe7b51f4336', // Criminal Justice
    'e5e48f0e-8f3a-40e1-8080-889fea389603', // Government Deference
    '448b1c9a-b6f3-42b8-8f39-d3bbb5bfa9ee', // Interpretation
    'c267e137-0ff9-4e7d-9d13-e3cea1756cd0', // Jail Capacity
    '6674d87e-999d-433a-aab7-3f626f59fd5f', // Legal Transparency
    'abb99d95-cbb1-4617-8f8b-f220ef6028ca', // Prosecution
  ],
};

// The 8 issues most U.S. House & Senate members and candidates have answered,
// ranked by how many of the ~1,258 answering federal politicians have a stance
// (measured 2026-07-12 against inform.politician_answers).
export const FEDERAL_LENS = {
  key: 'federal',
  name: 'Federal Lens',
  description: '8 issues most U.S. House & Senate members and candidates have answered',
  color: '#1E3A5F',
  topicIds: [
    'e8dad4a8-eb93-4931-91f5-d8fb5d7dd529', // Healthcare
    'f7e5678d-dadd-4556-a2fc-446e24642ceb', // Taxes
    '4e2c69ce-591e-4197-9cd5-7aceff79d390', // Immigration
    'af2fdfd6-02c4-49df-b09c-cf8536f4773f', // Abortion
    'f1e44d66-5d27-4b51-b54f-b7ace86f6a3c', // Climate Change
    '44905f3b-e105-4f6c-afc7-5d223813dbac', // Deportation
    'cab61e8a-64fe-4bbd-bc08-fe9914d0091b', // Medicare/aid
    'a22215c3-6693-4bc2-b248-01aebba14570', // Fossil Fuels
  ],
};

// All lenses, for generic iteration (badges, calibration offers, order storage).
export const LENSES = [LOCAL_LENS, JUDICIAL_LENS, FEDERAL_LENS];

// Returns the subset of a topics array that belongs to this lens, in lens order.
export function getTopicsForLens(lens, allTopics) {
  return lens.topicIds
    .map(id => allTopics.find(t => t.id === id))
    .filter(Boolean);
}

// True when a selected-topics array is just a lens overlay (every id belongs to a
// single lens), not the user's own chosen compass. Used to avoid persisting a lens
// view as the user's saved selected_topic_ids on the server — the lens is a view,
// not the user's compass. Mirrors the localLensActive/judicialLensActive heuristic
// in CombinedPage.
export function isLensTopicSet(topicIds) {
  if (!Array.isArray(topicIds) || topicIds.length === 0) return false;
  const everyIn = (lens) => topicIds.every((id) => lens.topicIds.includes(id));
  return LENSES.some(everyIn);
}
