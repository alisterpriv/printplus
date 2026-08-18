import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Two projects in one config file: existing backend tests keep running
// under Node (untouched), and the new React component tests run under
// jsdom. This avoids a config/workspace split for a single new test kind.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["electron/**/*.test.ts", "src/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/app/**/*.test.tsx"],
          setupFiles: ["src/test/setupTests.ts"],
        },
      },
    ],
  },
});
