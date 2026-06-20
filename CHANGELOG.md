# Changelog

## 0.1.0

- Release the dependency-light `color-scheme-tokens` core package with explicit token graph contracts, strict graph
  parsing, token compilation, deterministic serialization, and `Result` / `Issue` diagnostics.
- Publish strict JSON Schema artifacts for persisted token graphs, token fragments, and serialized compiled token sets.
- Support CSS variable export through `exportCssVariables(..., { prefix })` for stylesheet strings and
  `exportCssVariableBlocks(..., { prefix })` for structured mode blocks; omitted or empty prefixes emit unprefixed custom
  properties such as `--background`, and the removed `variablePrefix` option is not accepted.
- Keep authoring helpers ergonomic with JSON-safe manual token graphs while preserving strict persisted input behavior.
- Allow helper-only token-key string reference shorthand in `defineTokenGraph()` and `defineTokenFragment()` while keeping
  strict parser and schema inputs explicit.
- Release `@color-scheme-tokens/source-material3` as a separate Material 3 source adapter package that owns all Material
  behavior, uses `sourceColor`, supports `extendedColors`, and depends on the real Material color utility engine.
- Expose `buildTokenSet({ sources })` as the adapter runner shape, with a required non-empty source array even for a
  single `TokenSource`, returning `{ graph, compiled }`.
- Preserve the package boundary: the root package has no Material dependency, Material exports, Material subpaths, or
  Material schema branches.
