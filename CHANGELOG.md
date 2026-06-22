# Changelog

## 0.1.0

- Release the dependency-light `scheme-tokens` core package with explicit token graph contracts, strict graph
  parsing, token compilation, deterministic serialization, and `Result` / `Issue` diagnostics.
- Publish strict JSON Schema artifacts for persisted token graphs, token layers, and serialized compiled schemes.
- Support CSS variable export through `exportCssVars(..., { prefix })`, returning stylesheet text, ordered declaration
  lists, and `variableByToken` from one `Result`; omitted or empty prefixes emit unprefixed custom properties such as
  `--background`.
- Keep authoring helpers ergonomic with JSON-safe manual token graphs and token layers while preserving strict persisted
  input behavior.
- Keep references explicit through alias maps, `tokenRef("token.key")`, or `{ ref: "token.key" }`; bare strings remain
  color authoring input and never become references based on spelling.
- Store persisted graph, layer, and compiled colors as structured `ColorValue` objects with `colorSpace`, `components`,
  `alpha`, and optional `hex`.
- Add artifact `kind` discriminators and public parse/serialize functions for token graphs, token layers, and compiled
  color schemes.
- Release `@scheme-tokens/material3` as a separate Material 3 adapter package that owns all Material behavior, uses the
  canonical `sourceColors` field, supports `material3("#6750a4")`, and runs against a real Material Color Utilities
  algorithm.
- Expose `buildScheme` as the one-shot adapter runner and layer composer. `base` is optional for layer-only builds,
  base-only builds remain valid, and later layers override earlier layers or base tokens by token key.
- Expose `createSchemeBuilder` for prepared reusable builds that share the same build path as `buildScheme`.
- Add `modes`, `defaultMode`, and `defaultVisibility` to `BuildSchemeOptions` so layer-only builds can establish an
  explicit graph mode envelope without moving mode authority onto `ColorTokenLayerInput`.
- Support Material generation options `variant`, `contrastLevel`, `specVersion`, `platform`, `paletteOverrides`,
  `extendedColors`, and `paletteTones`, plus integration options `id` and `defaultVisibility`.
- Add `material3Preset` for reusable Material generation defaults and fixed integration options.
- Document the Tailwind v4 recipe as an explicit `@theme` mapping from unprefixed runtime CSS variables.
- Bundle a pinned Material Color Utilities TypeScript snapshot inside `@scheme-tokens/material3` with Apache-2.0
  provenance documented in the adapter package.
- Document the canonical core token-key language as dot-separated lower-kebab identifier segments, with external format
  names handled by adapter-owned mapping and diagnostics rather than by loosening core validation.
- Add the standards interoperability roadmap and ADR 0003 for future DTCG format adapter work in `@scheme-tokens/dtcg`;
  DTCG runtime support remains deferred beyond 0.1.0.
- Document `@scheme-tokens/texel` as a planned future Texel color conversion adapter using adapter-owned
  `@texel/color`, with no Texel runtime support in core.
- Document `@scheme-tokens/shadcn` as a planned future shadcn target adapter for explicit, overridable shadcn CSS
  variable contract mapping; shadcn runtime support remains deferred beyond 0.1.0.
- Preserve the package boundary: the root package has no Material dependency, Material exports, Material subpaths, or
  Material schema branches.
