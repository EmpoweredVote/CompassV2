import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// PostHog source-map upload. Inert unless POSTHOG_API_KEY and POSTHOG_PROJECT_ID
// are set at build time (CI / Render build env). See ERROR_TRACKING.md.
const posthogSourcemapsEnabled = Boolean(
  process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID,
);

export default defineConfig(async ({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
  const shellEnv = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => k.startsWith("VITE_"))
  );
  const env = { ...fileEnv, ...shellEnv };

  const plugins = [react(), tailwindcss()];
  if (posthogSourcemapsEnabled) {
    const { default: posthogSourcemaps } = await import("@posthog/rollup-plugin");
    plugins.push(
      posthogSourcemaps({
        personalApiKey: process.env.POSTHOG_API_KEY,
        projectId: process.env.POSTHOG_PROJECT_ID,
        host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
        sourcemaps: { enabled: true, releaseName: "compass" },
      }),
    );
  }

  return {
    base: env.VITE_BASE || "/",
    plugins,
    build: {
      outDir: "dist",
      assetsDir: "assets",
      // 'hidden' emits maps for upload without a sourceMappingURL comment in the
      // shipped bundles; the plugin deletes them after upload by default.
      sourcemap: posthogSourcemapsEnabled ? "hidden" : false,
    },
    // -----------------------------------------------------------------
    // Local dev API proxy
    // -----------------------------------------------------------------
    // The production CompassV2 frontend talks to https://api.empowered.vote
    // directly, but that origin's CORS policy only allows the production
    // domain — so requests from http://localhost:5173 get blocked.
    //
    // To unblock local development, we proxy `/api/*` requests through Vite
    // to the production API. The browser only sees same-origin requests,
    // so CORS never applies.
    //
    // This pairs with `src/lib/auth.js`, which uses a relative `/api` base
    // in dev (`import.meta.env.DEV`) and the absolute prod URL in builds.
    // See COMPASSV2-INTEGRATION.md → "Local Development" for details.
    // -----------------------------------------------------------------
    server: {
      proxy: {
        "/api": {
          target: "https://api.empowered.vote",
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
