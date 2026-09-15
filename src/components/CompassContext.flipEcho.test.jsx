// Reproduces the "Flip button flickers during Full Calibration" bug.
//
// Root cause: the guest write effect publishes `invertedSpokes` (among other
// slices) to the cross-subdomain ev-context broker on every `answers` change,
// and the broker echoes every set() back to the tab that made it (see
// node_modules/@empoweredvote/ev-ui dist/index.js `onMessage` /
// `notifySubscribers`). The subscribe callback is supposed to recognize and
// discard those self-echoes, but during Full Calibration — where a user
// answers far more topics than fit the published scope/cap — the echo's `a`
// field (scoped+capped) never matches the full local `answers`, so the
// suppression never triggers and a *stale* echo (captured before a Flip
// click, delivered after) gets applied as if it were a genuine external
// update, reverting `invertedSpokes` and re-triggering another publish.
//
// This test drives the real CompassContext/CompassProvider against a mock
// broker that reproduces the real broker's self-echo behavior (async,
// order-preserving, but with real latency), and shows the Flip toggling.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { CompassProvider, useCompass } from "./CompassContext.jsx";

// vitest.config.js runs without @vitejs/plugin-react (see vitest.setup.js's
// neighboring localStorage-polyfill note), so this file avoids JSX and uses
// createElement directly rather than pulling the plugin in for one test.

vi.mock("@empoweredvote/ev-ui", () => {
  // Minimal stand-in for the real postMessage broker: stores the last value,
  // and on every set() schedules an async broadcast of THAT call's own value
  // to every subscriber (itself included) — same as the real broker's
  // self-echo behavior. Each broadcast carries the snapshot from its own
  // set() call, not whatever is latest by the time it fires — a shared
  // mutable "last stored value" read at broadcast time would silently
  // coalesce every pending message into the newest one and erase the exact
  // stale-echo race this test exists to reproduce.
  let stored = {};
  const subs = new Set();
  const broadcast = (value, delayMs) => {
    setTimeout(() => {
      for (const fn of subs) fn(value);
    }, delayMs);
  };
  return {
    evContext: {
      configure() {},
      preload() { return Promise.resolve(); },
      async get() { return stored; },
      async set(value) {
        stored = value;
        // Real round-trip latency is variable; queue several overlapping
        // writes below to reproduce out-of-order-relative-to-state delivery.
        broadcast(value, 10 + Math.floor(Math.random() * 20));
        return true;
      },
      async getAuthedSlice() { return null; },
      async setAuthedSlice() { return false; },
      subscribe(fn) {
        subs.add(fn);
        return () => subs.delete(fn);
      },
    },
  };
});

const TOPIC_COUNT = 20;
const topics = Array.from({ length: TOPIC_COUNT }, (_, i) => ({
  id: `t${i}`,
  short_title: `topic-${i}`,
  stances: [{ id: `s${i}a`, value: 1, text: "a" }, { id: `s${i}b`, value: 2, text: "b" }],
}));
// An already-established compass — the realistic precondition for reaching
// Full Calibration, and the thing that puts `answers` outside the published
// scope once the user answers topics beyond it.
const selectedTopicIds = topics.slice(0, 8).map((t) => t.id);

function mockFetchImpl(url) {
  const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  if (url.includes("/compass/topics")) return ok(topics);
  if (url.includes("/compass/categories")) return ok([]);
  if (url.includes("/compass/lenses")) return ok([]);
  if (url.includes("/auth/session")) return Promise.resolve({ ok: false, status: 401 });
  return ok({});
}

let container;
let root;
let ctx;

function Capture() {
  ctx = useCompass();
  return null;
}

function Tree() {
  return createElement(CompassProvider, null, createElement(Capture));
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(mockFetchImpl));
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function flush(ms) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe("Full Calibration flip flicker", () => {
  it("does not revert invertedSpokes from a stale self-echo once answers exceed the published scope", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(Tree));
    });

    // Wait for topics to load and auth-check to settle (guest).
    await flush(20);
    expect(ctx.topicsLoaded).toBe(true);

    // Establish a compass (8 topics) — this is what makes the published `a`
    // a SCOPED subset once the user answers beyond it in Full Calibration.
    await act(async () => {
      ctx.setSelectedTopics(selectedTopicIds);
    });
    await flush(20);

    // Rapid-fire answers to many topics beyond the 8-topic compass — this is
    // exactly what Full Calibration does, and it's what fires a fresh guest
    // write (evContext.set) on every single answer.
    for (let i = 0; i < TOPIC_COUNT; i++) {
      await act(async () => {
        ctx.setAnswers((prev) => ({ ...prev, [`topic-${i}`]: 2 }));
      });
    }

    // While several of those writes' echoes are still in flight, flip a
    // topic's spoke order — the real user action reported as glitching.
    await act(async () => {
      ctx.setInvertedSpokes((prev) => ({ ...prev, "topic-0": true }));
    });
    expect(ctx.invertedSpokes["topic-0"]).toBe(true);

    // Let every in-flight write's broadcast (including the several stale,
    // pre-flip ones) arrive and be processed.
    await flush(80);

    // The flip must still be in effect — no stale echo should have reverted
    // it, and no oscillation should be left mid-flight.
    expect(ctx.invertedSpokes["topic-0"]).toBe(true);
  });
});
