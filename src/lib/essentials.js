// essentials.js
// Where the Essentials app lives. Comparing a compass against a candidate
// happens there now, not here, so the compass funnels people across once they
// have something worth comparing.
//
// Overridable for local work against a dev Essentials; the default is prod.
export const ESSENTIALS_URL =
  import.meta.env.VITE_ESSENTIALS_URL || "https://essentials.empowered.vote";
