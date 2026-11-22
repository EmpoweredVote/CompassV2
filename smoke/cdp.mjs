// Minimal Chrome DevTools Protocol driver.
//
// Deliberately dependency-free: it uses Node's built-in WebSocket (Node >= 22)
// and whatever Chrome is already installed, so `npm ci` stays untouched and CI
// needs no browser download step.

import { spawn } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROFILE_PREFIX = "compass-smoke-";

/**
 * Profiles whose Chrome was still holding its locks when the scenario ended.
 *
 * Not a leak — a deferral. `removePendingProfiles()` clears these at the end
 * of the run, where waiting costs nothing because there is no scenario left to
 * hold up.
 */
const unreleasedProfiles = new Set();

/**
 * Delete `compass-smoke-*` profile directories left behind by earlier runs.
 *
 * A scenario that finishes removes its own profile, so anything still here is
 * the residue of a run that did not finish — a Ctrl-C, a killed CI job, a
 * machine that slept. Nothing collects those: `%TEMP%` on Windows is not swept
 * unless Storage Sense is on, and a profile is tens of megabytes. Three
 * hundred of them filled a disk and stopped a day's work, which is the whole
 * reason this exists.
 *
 * `maxAgeMs` is what makes it safe to run while another copy of the suite is
 * going: a live scenario's profile is seconds old, never hours. Without that
 * guard a second run would delete the first run's browsers out from under it.
 */
export function sweepStaleProfiles({ maxAgeMs = 2 * 60 * 60 * 1000 } = {}) {
  const root = tmpdir();
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  let bytes = 0;
  let skipped = 0;

  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return { removed, bytes, skipped };
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(PROFILE_PREFIX)) continue;
    const path = join(root, entry.name);
    try {
      if (statSync(path).mtimeMs > cutoff) continue;
      bytes += dirSize(path);
      rmSync(path, { recursive: true, force: true });
      removed++;
    } catch {
      // Still locked, or gone between the readdir and now. Either way it is
      // not ours to insist on.
      skipped++;
    }
  }
  return { removed, bytes, skipped };
}

/**
 * Clear the profiles that were still locked when their scenario finished.
 *
 * Call this after every browser in the suite has been killed. At that point
 * the locks are released within a second or two, and the wait is free — the
 * run is over. Returns what is still stuck, which should be nothing.
 */
export async function removePendingProfiles({ attempts = 20, intervalMs = 250 } = {}) {
  const stuck = [];
  for (const profile of unreleasedProfiles) {
    let gone = false;
    for (let attempt = 0; attempt < attempts && !gone; attempt++) {
      try {
        rmSync(profile, { recursive: true, force: true });
        gone = true;
      } catch {
        await sleep(intervalMs);
      }
    }
    if (!gone) stuck.push(profile);
  }
  unreleasedProfiles.clear();
  return stuck;
}

function dirSize(path) {
  let total = 0;
  let entries;
  try {
    entries = readdirSync(path, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const child = join(path, entry.name);
    try {
      total += entry.isDirectory() ? dirSize(child) : statSync(child).size;
    } catch {
      // raced with a delete
    }
  }
  return total;
}

const CHROME_CANDIDATES = {
  win32: [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ],
};

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const p of CHROME_CANDIDATES[process.platform] || []) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `No Chrome found for platform ${process.platform}. Set CHROME_PATH to a Chrome/Edge binary.`
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Launch headless Chrome and attach to its first page target.
 * Returns a handle with eval/navigate/click helpers plus a captured error log.
 */
export async function launch({ port = 9222 } = {}) {
  const profile = join(tmpdir(), `compass-smoke-${port}-${Date.now()}`);
  const chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--no-sandbox", // required for the unprivileged CI container
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let wsUrl;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = targets.find((t) => t.type === "page")?.webSocketDebuggerUrl;
    } catch {
      // devtools endpoint not up yet
    }
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) throw new Error("Chrome did not expose a debugging target in 20s");

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("CDP socket failed")), { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  // Collected rather than thrown, so one stray error does not mask the
  // functional assertions. Uncaught exceptions fail a scenario; console.error
  // is only reported, since third-party scripts routinely log noise.
  const pageErrors = [];
  const consoleErrors = [];

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      pageErrors.push(d.exception?.description || d.text);
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      consoleErrors.push(
        msg.params.args.map((a) => a.value ?? a.description ?? "?").join(" ")
      );
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");

  /** Evaluate an expression in the page and return its value. Throws on page-side errors. */
  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    const details = res.result?.exceptionDetails;
    if (details) {
      throw new Error(
        `page evaluate failed: ${details.exception?.description || details.text}`
      );
    }
    return res.result?.result?.value;
  };

  const navigate = async (url, { settleMs = 6000 } = {}) => {
    await send("Page.navigate", { url });
    await sleep(settleMs);
  };

  /** Poll an expression until it returns truthy. Returns the value, or throws on timeout. */
  const waitFor = async (expression, { timeoutMs = 15000, label = expression } = {}) => {
    const deadline = Date.now() + timeoutMs;
    let last;
    while (Date.now() < deadline) {
      last = await evaluate(expression);
      if (last) return last;
      await sleep(250);
    }
    throw new Error(`timed out after ${timeoutMs}ms waiting for: ${label}`);
  };

  const close = async () => {
    try {
      ws.close();
    } catch {
      // socket already gone
    }
    chrome.kill();

    // Chrome releases the profile directory asynchronously, and on Windows it
    // routinely holds its locks for longer than one grace period. This used to
    // be a single rmSync after 300ms, with the failure swallowed and a comment
    // saying the OS would clean up eventually. It does not: %TEMP% is not
    // swept unless Storage Sense is on, so every slow release left tens of
    // megabytes behind, silently, forever.
    //
    // Retrying is the fix — the lock does clear, it just takes longer than one
    // guess. Roughly 3s of attempts, which costs nothing on a run that already
    // takes minutes.
    for (let attempt = 0; attempt < 12; attempt++) {
      await sleep(250);
      try {
        rmSync(profile, { recursive: true, force: true });
        return;
      } catch {
        // still locked; go round again
      }
    }

    // Out of attempts, and waiting longer HERE is the wrong trade: this runs
    // inside the scenario, so every extra second is a second on the suite.
    // Hand it to the end-of-run pass instead, which retries once every Chrome
    // in the suite is gone — by which point the lock is certainly released.
    // Measured: 2 of 25 scenarios reach this line on Windows.
    unreleasedProfiles.add(profile);
  };

  return { evaluate, navigate, waitFor, send, pageErrors, consoleErrors, close, sleep };
}
