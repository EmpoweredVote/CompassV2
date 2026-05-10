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

// Returns the subset of a topics array that belongs to this lens, in lens order.
export function getTopicsForLens(lens, allTopics) {
  return lens.topicIds
    .map(id => allTopics.find(t => t.id === id))
    .filter(Boolean);
}
