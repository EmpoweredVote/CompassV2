// Minimal Chrome DevTools Protocol driver.
//
// Deliberately dependency-free: it uses Node's built-in WebSocket (Node >= 22)
// and whatever Chrome is already installed, so `npm ci` stays untouched and CI
// needs no browser download step.

import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
    // Give Chrome a beat to release the profile dir before removing it.
    await sleep(300);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // best effort; the OS temp dir gets cleaned eventually
    }
  };

  return { evaluate, navigate, waitFor, send, pageErrors, consoleErrors, close, sleep };
}
