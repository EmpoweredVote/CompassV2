import { defineConfig } from "vitest/config";

// jsdom, because the modules under test touch localStorage and
// crypto.getRandomValues. vitest's default `node` environment has neither.
//
// setupFiles restores a working `localStorage` on Node 22+, whose native
// experimental `localStorage` global shadows jsdom's. See vitest.setup.js for
// the full explanation. It is inert on the Node 20 CI runner.
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.js"],
  },
});
