import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
  const shellEnv = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => k.startsWith("VITE_"))
  );
  const env = { ...fileEnv, ...shellEnv };

  return {
    base: env.VITE_BASE || "/",
    plugins: [react(), tailwindcss()],
    build: { outDir: "dist", assetsDir: "assets" },
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
