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
  deps: {
    alwaysBundle: ["@material/material-color-utilities"],
    neverBundle: ["scheme-tokens"],
    onlyBundle: ["@material/material-color-utilities"],
    dts: {
      neverBundle: ["scheme-tokens"],
    },
  },
  dts: { sourcemap: false },
  plugins: [
    {
      name: "scheme-tokens-material3:strip-declaration-source-map-url",
      generateBundle(_options, bundle) {
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (!fileName.endsWith(".d.ts") || chunk.type !== "chunk") {
            continue;
          }
          chunk.code = chunk.code.replace(/\r?\n?\/\/# sourceMappingURL=\S*\s*$/u, "\n");
        }
      },
    },
  ],
});
