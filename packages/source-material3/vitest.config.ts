import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ["@material/material-color-utilities"],
        },
      },
    },
    environment: "node",
    include: ["tests/**/*.test.ts"],
    server: {
      deps: {
        inline: ["@material/material-color-utilities"],
      },
    },
  },
});
