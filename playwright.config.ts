import { defineConfig } from "@playwright/test";

// The CSS activation contract (ADR 0013 D7) in real engines. `pnpm test:browsers` builds the
// package first, and the suite exercises the built exporter in each engine.
export default defineConfig({
  testDir: "tests/browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  reporter: process.env.CI === undefined ? "list" : [["list"], ["github"]],
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
