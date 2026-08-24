/**
 * revisionApi — thin client for /api/compass/revisions (ADR 0004 §7).
 *
 * Mirrors lib/topicRewriteApi.js in shape. Every function throws an Error whose
 * message is the SERVER'S message, not a generic one: the RPCs behind these
 * routes are written for a human reviewer (REPOINTING_NOT_IMPLEMENTED explains
 * what is missing and what to do instead), and swallowing that in favour of
 * "Request failed" would waste the most useful thing they say.
 */

import { apiFetch, publicFetch } from './auth';

async function unwrap(res, fallback) {
  if (!res) throw new Error('Not signed in.');
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    throw new Error(body?.message || fallback || `Request failed (${res.status})`);
  }
  return body;
}

/** Open proposals awaiting review. Requires the Compass Stance Editor role. */
export async function fetchReviewQueue() {
  const body = await unwrap(
    await apiFetch('/compass/revisions/queue'),
    'Could not load the review queue.'
  );
  return body?.revisions ?? [];
}

/** One proposal, already paired against what is currently live. */
export async function fetchRevision(id) {
  return unwrap(
    await apiFetch(`/compass/revisions/${id}`),
    'Could not load that proposal.'
  );
}

export async function approveRevision(id) {
  return unwrap(
    await apiFetch(`/compass/revisions/${id}/approve`, { method: 'POST' }),
    'Could not approve.'
  );
}

export async function rejectRevision(id, reason) {
  return unwrap(
    await apiFetch(`/compass/revisions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
    'Could not record the rejection.'
  );
}

export async function publishRevision(id) {
  return unwrap(
    await apiFetch(`/compass/revisions/${id}/publish`, { method: 'POST' }),
    'Could not publish.'
  );
}

/**
 * The public change record for one topic. Uses publicFetch: this endpoint is
 * intentionally open, and redirecting an anonymous reader to a login page would
 * defeat the point of a transparency surface.
 */
export async function fetchTopicHistory(topicKey) {
  return unwrap(
    await publicFetch(`/compass/revisions/history/${encodeURIComponent(topicKey)}`),
    'Could not load the change history.'
  );
}
