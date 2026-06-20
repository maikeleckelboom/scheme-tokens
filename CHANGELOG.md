# Changelog

## 0.1.0

- Rename the pre-public package identity to `scheme-tokens` and the compiled whole-artifact vocabulary to scheme before
  the first release candidate; no compatibility aliases are shipped.
- Release the dependency-light `scheme-tokens` core package with explicit token graph contracts, strict graph
  parsing, token compilation, deterministic serialization, and `Result` / `Issue` diagnostics.
- Publish strict JSON Schema artifacts for persisted token graphs, token layers, and serialized compiled schemes.
- Support CSS variable export through `exportCssVariables(..., { prefix })` for stylesheet strings and
  `exportCssVariableBlocks(..., { prefix })` for structured mode blocks; omitted or empty prefixes emit unprefixed custom
  properties such as `--background`, and the removed `variablePrefix` option is not accepted.
- Keep authoring helpers ergonomic with JSON-safe manual token graphs and token layers while preserving strict persisted
  input behavior.
- Allow helper-only token-key string reference shorthand and metadata plus mode-key shorthand in `defineTokenGraph()` and
  `defineTokenLayer()` while keeping strict parser and schema inputs explicit.
- Release `@scheme-tokens/source-material3` as a separate Material 3 source adapter package that owns all Material
  behavior, uses `sourceColor`, supports `extendedColors`, and depends on the real Material color utility engine.
- Expose `buildScheme({ sources, layers })` as the adapter runner and layer composer shape. `sources` is optional for
  layer-only builds, source-only builds remain valid, and later layers override earlier layers or source tokens by token
  key.
- Add `modes`, `defaultMode`, and `defaultVisibility` to `BuildSchemeOptions` so layer-only builds can establish an
  explicit graph mode envelope without moving mode authority onto `TokenLayerInput`.
- Document the canonical core token-key language as dot-separated lower-kebab identifier segments, with external format
  names handled by adapter-owned mapping and diagnostics rather than by loosening core validation.
- Add the standards interoperability roadmap and ADR 0003 for future format adapter packages such as
  `@scheme-tokens/format-dtcg`; DTCG runtime support remains deferred beyond 0.1.0.
- Document `@scheme-tokens/conversion-texel` as a planned future conversion adapter using adapter-owned
  `@texel/color`, with no Texel runtime support in core.
- Document `@scheme-tokens/target-shadcn` as a planned future target adapter for explicit, overridable shadcn CSS
  variable contract mapping; shadcn runtime support remains deferred beyond 0.1.0.
- Preserve the package boundary: the root package has no Material dependency, Material exports, Material subpaths, or
  Material schema branches.
