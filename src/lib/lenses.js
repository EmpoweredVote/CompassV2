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

// Returns the subset of a topics array that belongs to this lens, in lens order.
export function getTopicsForLens(lens, allTopics) {
  return lens.topicIds
    .map(id => allTopics.find(t => t.id === id))
    .filter(Boolean);
}
