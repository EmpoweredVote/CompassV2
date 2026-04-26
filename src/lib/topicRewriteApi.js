// topicRewriteApi.js — fetch wrappers for /api/admin/topic-rewrites/*
// Uses the shared apiFetch helper (handles admin JWT + 401 redirect).

import { apiFetch } from './auth';

async function j(method, path, body) {
  const res = await apiFetch(path, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res) return null; // apiFetch returns null on 401 (redirects to login)
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export const topicRewriteApi = {
  list: () => j('GET', '/admin/topic-rewrites'),
  detail: (id) => j('GET', `/admin/topic-rewrites/${id}`),
  create: (payload) => j('POST', '/admin/topic-rewrites', payload),
  submitFraming: (id) => j('POST', `/admin/topic-rewrites/${id}/submit-framing`, {}),
  approveFraming: (id) => j('POST', `/admin/topic-rewrites/${id}/approve-framing`, {}),
  markPublishReady: (id) =>
    j('POST', `/admin/topic-rewrites/${id}/mark-publish-ready`, {}),
  publish: (id) => j('POST', `/admin/topic-rewrites/${id}/publish`, {}),
  upsertProposal: (id, politicianId, payload) =>
    j('PUT', `/admin/topic-rewrites/${id}/proposals/${politicianId}`, payload),
  approveProposal: (id, politicianId, reviewerNotes) =>
    j('POST', `/admin/topic-rewrites/${id}/proposals/${politicianId}/approve`, {
      reviewer_notes: reviewerNotes,
    }),
  rejectProposal: (id, politicianId, reviewerNotes) =>
    j('POST', `/admin/topic-rewrites/${id}/proposals/${politicianId}/reject`, {
      reviewer_notes: reviewerNotes,
    }),
};
