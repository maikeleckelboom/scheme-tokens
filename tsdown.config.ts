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
  // Declaration maps stay off. They resolve to `../src/*.ts` without inline
  // `sourcesContent`, and the package ships only `dist` and `schemas`, so a
  // shipped map would replace one dangling lookup with nine.
  dts: { sourcemap: false },
  plugins: [
    {
      name: "scheme-tokens:strip-declaration-source-map-url",
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
