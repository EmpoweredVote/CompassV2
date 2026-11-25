// Session helper for the authed smoke scenarios.
//
// Credentials come from SMOKE_EMAIL / SMOKE_PASSWORD, or from a local env file
// (default ~/.ev-compass-smoke/creds.env) so a developer can run the authed
// scenarios without exporting anything. They are never committed. In CI, set
// them as repository secrets; without them the authed scenarios skip rather
// than fail, so the suite still runs for outside contributors.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const API = "https://accounts-api.empowered.vote/api";

export function loadCredentials() {
  if (process.env.SMOKE_EMAIL && process.env.SMOKE_PASSWORD) {
    return { email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD };
  }
  const file =
    process.env.SMOKE_CREDS_FILE ||
    path.join(os.homedir(), ".ev-compass-smoke", "creds.env");
  if (!fs.existsSync(file)) return null;
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env.SMOKE_EMAIL && env.SMOKE_PASSWORD
    ? { email: env.SMOKE_EMAIL, password: env.SMOKE_PASSWORD }
    : null;
}

/** Log in and return the bearer token the app stores as `ev_token`. */
export async function login({ email, password }) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  if (!body.access_token) throw new Error("login response had no access_token");
  return body.access_token;
}

const authed = (token, extra = {}) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
  ...extra,
});

/** Wipe the test account's server-side answers so a run starts from a known state. */
export async function resetServerAnswers(token) {
  await fetch(`${API}/compass/answers/me`, { method: "DELETE", headers: authed(token) });
}

/** Write one answer server-side, as the app does when an authed user answers. */
export async function putServerAnswer(token, topicId, value) {
  const res = await fetch(`${API}/compass/answers`, {
    method: "POST",
    headers: authed(token),
    body: JSON.stringify({ topic_id: topicId, value }),
  });
  if (!res.ok) throw new Error(`answer write failed: ${res.status}`);
}

export async function getServerAnswers(token) {
  const res = await fetch(`${API}/compass/answers`, { headers: authed(token) });
  if (!res.ok) throw new Error(`answer read failed: ${res.status}`);
  return res.json();
}

export async function setServerSelectedTopics(token, topicIds) {
  await fetch(`${API}/compass/selected-topics`, {
    method: "PUT",
    headers: authed(token),
    body: JSON.stringify({ topic_ids: topicIds }),
  });
}

/** The compass the server currently has saved for this user. */
export async function getServerSelectedTopics(token) {
  const res = await fetch(`${API}/compass/selected-topics`, { headers: authed(token) });
  if (!res.ok) throw new Error(`selected-topics read failed: ${res.status}`);
  const body = await res.json();
  // The route returns a flat array (Go-parity); tolerate the object form too.
  return Array.isArray(body) ? body : (body.topic_ids || []);
}

/** A user's custom lenses, as GET /compass/my-lenses returns them. */
export async function getServerLenses(token) {
  const res = await fetch(`${API}/compass/my-lenses`, { headers: authed(token) });
  if (!res.ok) throw new Error(`GET /compass/my-lenses failed (${res.status})`);
  return res.json();
}

/*
 * 🔴🔴 THERE IS NO `clearServerLenses` HERE ANY MORE, AND IT MUST NOT COME BACK.
 * REMOVED 2026-11-25. It deleted every lens the shared test account held, one
 * named `delete_keys` PUT each, so that a scenario could start from a known
 * empty account.
 *
 * WHY IT WENT. ev-accounts runs a nightly `lens durability` check. It reads
 * every soft delete in `inform.compass_user_lens_history` over a 7-day window
 * and fails when ONE owner lost more than one lens, because that is the shape of
 * a member losing work (the 2026-11-22 incident it was built for). Nothing in
 * the data marks this account as a test account, so every reset this helper did
 * read as a person losing lenses. Measured 2026-11-25: 9 removal events in the
 * window, all of them ours, the gate red, and its own self-test blocked — it
 * refuses to run against a red baseline. The cost is not the red. The cost is
 * that a check which is red every morning gets acknowledged without being read,
 * and then it is not watching anything.
 *
 * ⚠ DELETE-THEN-RESTORE IS NOT A WAY ROUND IT. The check counts removal EVENTS,
 * not the lens set as it stands, so an undone deletion still counts. The suite
 * already restored and was still red.
 *
 * ▶ WHAT TO DO INSTEAD: reuse a fixed key and overwrite it, and put a per-run
 * nonce somewhere the assertion reads, so that "it is still there" cannot pass
 * on the last run's leftovers. `guest-lenses-promote-on-sign-in` in run.mjs is
 * the worked example.
 *
 * WHAT THIS GIVES UP, STATED PLAINLY: nothing in smoke now exercises
 * `delete_keys` against production. That contract is covered by unit tests in
 * ev-accounts (`backend/src/routes/compass.lensCap.test.ts`, including a key
 * named twice counting as one deletion), and the delete *interface* is still
 * covered here by `guest-can-edit-and-delete-a-lens`, which is guest-only and
 * never reaches the server.
 *
 * The knowledge the helper carried, kept because it is still true of the API:
 * `{ lenses: [] }` no longer means "delete the rest" — it 409s (ev-accounts#1584,
 * after one transient fetch failure produced that payload with nobody asking for
 * a deletion: prod 2026-11-22, three lenses in, one survivor). An omission means
 * KEEP, a deletion must be NAMED in `delete_keys`, and one PUT may name at most
 * one deletion.
 */
