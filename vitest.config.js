import { defineConfig } from "vitest/config";

// jsdom, because the modules under test touch localStorage and
// crypto.getRandomValues. vitest's default `node` environment has neither.
export default defineConfig({
  test: { environment: "jsdom" },
});
