import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Electron loads dist/index.html via the file:// protocol (both in dev
  // and in a packaged build). Vite's default base ("/") emits root-relative
  // asset paths (/assets/...), which resolve against the filesystem root
  // under file://, not against dist/ — causing every asset request to
  // 404 and the renderer to never mount. A relative base makes the
  // generated paths (./assets/...) resolve correctly regardless of where
  // dist/ is loaded from.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173
  }
});