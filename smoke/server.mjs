// Boots the Vite dev server for a smoke run and tears it down afterwards.
//
// Dev mode on purpose: `src/lib/auth.js` only uses the relative `/api` base when
// `import.meta.env.DEV` is true, which routes through the Vite proxy in
// vite.config.js. A production build calls the absolute API host directly and
// would be blocked by CORS from localhost.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// smoke/ -> repo root. Resolved from this file so a run works from any cwd.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function startDevServer({ port = 5199 } = {}) {
  // Invoke Vite's JS entry with the current Node binary rather than going
  // through `npm` — avoids the Windows .cmd/shell handling entirely.
  const proc = spawn(
    process.execPath,
    [join(REPO_ROOT, "node_modules", "vite", "bin", "vite.js"),
     "--port", String(port), "--strictPort"],
    { stdio: "ignore", cwd: REPO_ROOT }
  );

  const baseUrl = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return { baseUrl, stop: () => stop(proc) };
    } catch {
      // not listening yet
    }
    await sleep(500);
  }
  await stop(proc);
  throw new Error(`Vite dev server did not come up on ${baseUrl} within 30s`);
}

async function stop(proc) {
  if (process.platform === "win32") {
    // npm spawns vite as a child; kill the whole tree or the port stays bound.
    spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    proc.kill("SIGTERM");
  }
  await sleep(500);
}
