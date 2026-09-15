import { defineConfig } from "vitest/config";

// jsdom, because the modules under test touch localStorage and
// crypto.getRandomValues. vitest's default `node` environment has neither.
//
// setupFiles restores a working `localStorage` on Node 22+, whose native
// experimental `localStorage` global shadows jsdom's. See vitest.setup.js for
// the full explanation. It is inert on the Node 20 CI runner.
export default defineConfig({
  // Source files rely on Vite's automatic JSX runtime (no explicit `import
  // React`), which normally comes from @vitejs/plugin-react in vite.config.js.
  // Vitest's own config is intentionally separate from that (see
  // vitest.setup.js), so it needs this esbuild option directly or any test
  // that renders a .jsx component fails with "React is not defined".
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.js"],
  },
});
