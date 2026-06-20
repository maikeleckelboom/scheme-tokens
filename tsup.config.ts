import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/conversion/index.ts", "src/sources/material3/index.ts"],
  format: ["esm"],
  dts: false,
  tsconfig: "tsconfig.lib.json",
  sourcemap: true,
  clean: true,
  treeshake: true,
});
