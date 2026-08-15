import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/types/**"],
    server: {
      deps: {
        inline: ["@material/material-color-utilities"],
      },
    },
  },
});
