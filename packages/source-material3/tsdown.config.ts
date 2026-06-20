import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "neutral",
  target: "es2022",
  tsconfig: "tsconfig.lib.json",
  sourcemap: true,
  clean: true,
  treeshake: true,
  dts: true,
  deps: {
    alwaysBundle: ["@material/material-color-utilities"],
    onlyBundle: ["@material/material-color-utilities"],
  },
});
