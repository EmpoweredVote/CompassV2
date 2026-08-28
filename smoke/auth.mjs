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
