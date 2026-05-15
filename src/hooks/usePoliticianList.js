// usePoliticianList.js
// Shared hook for fetching the politician list from /compass/politicians.
// Uses module-level caching so the API call only happens once per variant.
// includeCandidates=true fetches ?include_candidates=true and is cached separately.

import { publicFetch } from "../lib/auth";
import { useState, useEffect } from "react";

let cachedList = null;
let cachedListWithCandidates = null;
let pendingPromise = null;
let pendingPromiseWithCandidates = null;

function fetchPoliticianList(includeCandidates) {
  if (includeCandidates) {
    if (cachedListWithCandidates !== null) return Promise.resolve(cachedListWithCandidates);
    if (pendingPromiseWithCandidates) return pendingPromiseWithCandidates;
    pendingPromiseWithCandidates = publicFetch('/compass/politicians?include_candidates=true')
      .then((r) => r ? r.json() : [])
      .then((r) => {
        const list = Array.isArray(r) ? r : [];
        cachedListWithCandidates = list;
        pendingPromiseWithCandidates = null;
        return list;
      })
      .catch((e) => {
        console.error("[usePoliticianList] fetch (with candidates) failed", e);
        pendingPromiseWithCandidates = null;
        return [];
      });
    return pendingPromiseWithCandidates;
  }

  if (cachedList !== null) return Promise.resolve(cachedList);
  if (pendingPromise) return pendingPromise;
  pendingPromise = publicFetch('/compass/politicians')
    .then((r) => r ? r.json() : [])
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

export default function usePoliticianList(includeCandidates = false) {
  const cached = includeCandidates ? cachedListWithCandidates : cachedList;
  const [politicians, setPoliticians] = useState(cached ?? []);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    const current = includeCandidates ? cachedListWithCandidates : cachedList;
    if (current !== null) {
      setPoliticians(current);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPoliticianList(includeCandidates).then((list) => {
      setPoliticians(list);
      setLoading(false);
    });
  }, [includeCandidates]);

  return { politicians, loading };
}
