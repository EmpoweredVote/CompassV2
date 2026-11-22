// Reproduces the lens-set destruction chain, at the layer where it starts.
//
// 🔴 WHAT THIS IS ABOUT. `PUT /compass/my-lenses` used to delete every lens the
// body did not mention, and the client used to render a failed GET as an empty
// set. Together that is four steps from one network blip to permanent loss, and
// there is no history table:
//
//   1. the GET fails (apiFetch returns null on a transient failure, by design)
//   2. the client sets userLenses to []            <- this file
//   3. the user saves anything at all, so a short list goes out
//   4. the server deletes everything not in it
//
// Measured against production on 2026-11-22: three lenses stored, a one-lens
// PUT, one survivor, HTTP 200, no warning. The server half of the fix lives in
// EV-Accounts (a deletion must be named in `delete_keys`); this is the client
// half, which breaks the chain at step 2 and is worth having on its own.
//
// Follows CompassContext.flipEcho.test.jsx: real provider, mocked fetch, no JSX
// (vitest.config.js runs without @vitejs/plugin-react).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { CompassProvider, useCompass } from "./CompassContext.jsx";

vi.mock("@empoweredvote/ev-ui", () => ({
  evContext: {
    configure() {},
    preload() { return Promise.resolve(); },
    async get() { return {}; },
    async set() { return true; },
    async getAuthedSlice() { return null; },
    async setAuthedSlice() { return false; },
    subscribe() { return () => {}; },
  },
}));

const LENS_A = { key: "u_aaa001", name: "Measure A", topicIds: ["t0"], visibility: "private" };
const LENS_B = { key: "u_bbb002", name: "Measure B", topicIds: ["t1"], visibility: "private" };

const topics = Array.from({ length: 4 }, (_, i) => ({
  id: `t${i}`,
  short_title: `topic-${i}`,
  stances: [{ id: `s${i}a`, value: 1, text: "a" }],
}));

/** Every call made to /compass/my-lenses, in order, so a PUT cannot hide. */
let lensCalls;
/** What the next GET /my-lenses should do. */
let getMyLenses;

function ok(body) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}
function fail(status, body = { code: "INTERNAL_ERROR" }) {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) });
}

function mockFetchImpl(url, options = {}) {
  const method = options.method || "GET";

  // Checked BEFORE /compass/lenses: one is a substring of the other.
  if (url.includes("/compass/my-lenses")) {
    lensCalls.push({ method, body: options.body ? JSON.parse(options.body) : null });
    if (method === "GET") return getMyLenses();
    return ok([]);
  }
  if (url.includes("/compass/topics")) return ok(topics);
  if (url.includes("/compass/categories")) return ok([]);
  if (url.includes("/compass/lenses")) return ok([]);
  if (url.includes("/account/me")) return ok({ id: "user-1", display_name: "Smoke" });
  if (url.includes("/compass/selected-topics")) return ok([]);
  if (url.includes("/compass/answers")) return ok([]);
  if (url.includes("/auth/session")) return fail(401);
  return ok({});
}

let container;
let root;
let ctx;

function Capture() {
  ctx = useCompass();
  return null;
}

beforeEach(() => {
  localStorage.clear();
  // A token present plus a 200 from /account/me is what makes the provider
  // consider this browser signed in.
  localStorage.setItem("ev_token", "test-token");
  lensCalls = [];
  getMyLenses = () => ok([LENS_A, LENS_B]);
  vi.stubGlobal("fetch", vi.fn(mockFetchImpl));
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function flush(ms = 30) {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
}

async function mount() {
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(CompassProvider, null, createElement(Capture)));
  });
  await flush(40);
}

const puts = () => lensCalls.filter((c) => c.method === "PUT");

describe("a failed lens read is not an empty lens set", () => {
  it("keeps the lenses it already had when a refresh fails", async () => {
    await mount();
    expect(ctx.userLenses.map((l) => l.key)).toEqual(["u_aaa001", "u_bbb002"]);

    // The blip. This used to produce setUserLenses([]).
    getMyLenses = () => fail(500);
    await act(async () => { await ctx.refreshUserLenses(); });

    expect(ctx.userLenses.map((l) => l.key)).toEqual(["u_aaa001", "u_bbb002"]);
  });

  it("treats a 200 that is not a list as a failure, not as zero lenses", async () => {
    await mount();

    // A 500's error object used to reach `Array.isArray(data) ? data : []`.
    getMyLenses = () => ok({ code: "INTERNAL_ERROR", message: "boom" });
    await act(async () => { await ctx.refreshUserLenses(); });

    expect(ctx.userLenses.map((l) => l.key)).toEqual(["u_aaa001", "u_bbb002"]);
  });

  it("still reports the load as settled, so a u_ arrival stops waiting", async () => {
    getMyLenses = () => fail(500);
    await mount();

    // Settled is not the same as known — but callers waiting on a `?calibrate=u_`
    // link must still be released, or they wait forever.
    expect(ctx.userLensesLoaded).toBe(true);
  });
});

describe("a set the client does not know is a set it will not overwrite", () => {
  it("refuses to save after a failed read, and sends no PUT", async () => {
    getMyLenses = () => fail(500);
    await mount();

    // Every later read fails too, so the set stays unknown.
    await expect(
      act(async () => { await ctx.saveUserLenses([LENS_A]); })
    ).rejects.toThrow(/lens set unknown/);

    // 🔴 THE POINT OF THE WHOLE FILE. One PUT here is two lenses gone.
    expect(puts()).toEqual([]);
  });

  it("recovers on its own once a read succeeds", async () => {
    getMyLenses = () => fail(500);
    await mount();
    expect(puts()).toEqual([]);

    // The network comes back. The save that follows should just work, without
    // the user having to reload the page.
    getMyLenses = () => ok([LENS_A, LENS_B]);
    await act(async () => { await ctx.saveUserLenses([LENS_A, LENS_B]); });

    expect(puts()).toHaveLength(1);
    expect(puts()[0].body.lenses.map((l) => l.key)).toEqual(["u_aaa001", "u_bbb002"]);
  });
});

describe("a deletion is named, never merely omitted", () => {
  it("sends an empty delete_keys for an ordinary save", async () => {
    await mount();

    await act(async () => {
      await ctx.saveUserLenses([{ ...LENS_A, name: "Renamed" }, LENS_B]);
    });

    expect(puts()[0].body.delete_keys).toEqual([]);
  });

  it("names the key when the caller means to destroy one", async () => {
    await mount();

    await act(async () => {
      await ctx.saveUserLenses([LENS_B], { deleteKeys: ["u_aaa001"] });
    });

    expect(puts()[0].body.delete_keys).toEqual(["u_aaa001"]);
    expect(puts()[0].body.lenses.map((l) => l.key)).toEqual(["u_bbb002"]);
  });

  // A short list with no delete_keys is exactly the payload the blanked client
  // used to send. The server answers 409 rather than honouring it; the client's
  // job is to stop trusting its own copy and go and re-read.
  it("re-reads and surfaces the conflict when the server refuses a silent deletion", async () => {
    await mount();

    let putStatus = { status: 409, body: { code: "LENS_DELETE_NOT_ACKNOWLEDGED", unacknowledged_keys: ["u_bbb002"] } };
    vi.stubGlobal("fetch", vi.fn((url, options = {}) => {
      if (url.includes("/compass/my-lenses") && (options.method || "GET") === "PUT") {
        lensCalls.push({ method: "PUT", body: JSON.parse(options.body) });
        return Promise.resolve({
          ok: false, status: putStatus.status, json: () => Promise.resolve(putStatus.body),
        });
      }
      return mockFetchImpl(url, options);
    }));

    await expect(
      act(async () => { await ctx.saveUserLenses([LENS_A]); })
    ).rejects.toThrow(/u_bbb002/);

    // It went back to the server rather than keeping its stale picture.
    expect(ctx.userLenses.map((l) => l.key)).toEqual(["u_aaa001", "u_bbb002"]);
  });
});
