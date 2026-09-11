// Runs before each test file (see `test.setupFiles` in vitest.config.js).
//
// Why this exists: Node 22+ ships a native, experimental `localStorage` global.
// It is only a warning-getter — reading it prints
//   "localStorage is not available because --localstorage-file was not provided"
// and evaluates to `undefined`. Its mere presence stops jsdom from installing
// its own `window.localStorage`, so under jsdom on a recent Node, bare
// `localStorage` is `undefined` and every test that touches it throws
// `Cannot read properties of undefined (reading 'clear')`. Notably this hits
// `localStorage` only; jsdom's `sessionStorage` is unaffected.
//
// CI runs on Node 20, which has no such global, so jsdom's real localStorage
// works there and this shim is inert (the guard below is false). It only steps
// in on Node 22+ dev machines. This is unrelated to the Vitest version — it
// reproduces identically on Vitest 3 and 4.
if (typeof window !== "undefined" && !window.localStorage) {
  // Minimal in-memory Web Storage. Mirrors the semantics these tests rely on:
  // string coercion, `null` for a missing key, and per-file isolation (this
  // file re-runs for every test file, so each starts with an empty store).
  class MemoryStorage {
    #map = new Map();
    get length() {
      return this.#map.size;
    }
    key(index) {
      return Array.from(this.#map.keys())[index] ?? null;
    }
    getItem(key) {
      const k = String(key);
      return this.#map.has(k) ? this.#map.get(k) : null;
    }
    setItem(key, value) {
      this.#map.set(String(key), String(value));
    }
    removeItem(key) {
      this.#map.delete(String(key));
    }
    clear() {
      this.#map.clear();
    }
  }

  const store = new MemoryStorage();
  const define = (target) =>
    Object.defineProperty(target, "localStorage", {
      value: store,
      configurable: true,
      writable: true,
    });
  define(window);
  define(globalThis);
}
