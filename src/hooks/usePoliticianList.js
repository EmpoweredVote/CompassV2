// usePoliticianList.js
// Shared hook for fetching the politician list from /compass/politicians.
// Uses module-level caching so the API call only happens once across all consumers.

let cachedList = null;
let pendingPromise = null;

function fetchPoliticianList() {
  if (cachedList !== null) {
    return Promise.resolve(cachedList);
  }
  if (pendingPromise) {
    return pendingPromise;
  }
  pendingPromise = fetch(
    `${import.meta.env.VITE_API_URL}/compass/politicians`,
    { credentials: "include" }
  )
    .then((r) => r.json())
    .then((r) => {
      const list = Array.isArray(r) ? r : [];
      cachedList = list;
      pendingPromise = null;
      return list;
    })
    .catch((e) => {
      console.error("[usePoliticianList] fetch failed", e);
      pendingPromise = null;
      return [];
    });
  return pendingPromise;
}

import { useState, useEffect } from "react";

export default function usePoliticianList() {
  const [politicians, setPoliticians] = useState(cachedList ?? []);
  const [loading, setLoading] = useState(cachedList === null);

  useEffect(() => {
    if (cachedList !== null) {
      setPoliticians(cachedList);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPoliticianList().then((list) => {
      setPoliticians(list);
      setLoading(false);
    });
  }, []);

  return { politicians, loading };
}
