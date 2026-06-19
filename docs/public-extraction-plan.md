# Public Extraction Plan

This repository is the canonical public package for `color-scheme-tokens`. It is not a rename of `material-schemes`, and
it does not copy prior Git history.

## Source Mines

- `C:\dev\material-design\material-schemes` is implementation prior art.
- `C:\dev\material-design\material-schemes-library` may be read for API or tooling ideas.
- `C:\dev\material-design\material-schemes-lab` remains external proof tooling and is not moved into this package.

## Public Shape Rules

- Keep the package root focused on generic token graph, recipe, compiler, serializer, CSS export, and color value APIs.
- Do not expose `material.*` token keys.
- Do not expose Material 3 source adapter exports from the package root.
- Do not make upstream dynamic-color vocabulary the public package model.
- Do not model key palette colors as generic graph concepts.
- Do not add framework bindings, CLI tooling, DTCG export, theme editing, image extraction, or contrast repair in the
  initial package.

## Extraction Order

1. Establish graph primitives and runtime validation.
2. Compile aliases and modes into deterministic token sets.
3. Project compiled token sets to CSS.
4. Add explicit source adapters that produce graphs.
5. Keep Material 3 Dynamic Color behind the `color-scheme-tokens/sources/material3` adapter.
6. Add plain token layer data as generic graph additions.
7. Add a recipe that orchestrates source adapters, layers, aliases, compiler, serializer, and CSS export.
8. Add source and CSS snapshots before any public release candidate.

## Current Implementation Notes

- The package remains `private: true` at version `0.0.0`.
- The package is ESM-only; CommonJS build output and `require` export conditions are not part of the public contract.
- `ColorTokenValue` is implemented only as a literal authored color payload.
- Source adapters generate token graphs; they do not define the graph model.
- `material3Source()` accepts opaque sRGB source colors through the Material 3 adapter subpath.
- `material3Source()` emits `m3.*` tokens. Consumers should map those to application-owned namespaces such as `app.*` or
  `brand.*` when they need stable product semantics.
- Material 3 `keyColors` and `algorithm` options are adapter concerns. `specVersion`, `platform`, `variant`, and
  `contrastLevel` do not belong to generic recipe options.
- ARGB conversion is an adapter implementation detail for the Material 3 source or an explicit low-level interop concern.
  It is not the happy-path public API. Public examples should prefer plain color inputs such as hex strings.
- Recipe `aliases` are sugar for simple alias token nodes.
- Token layers are reusable graph additions. Public layers must be source-agnostic unless their name and docs explicitly
  state the source dependency.
- The public recipe does not expose a graph transform hook for v1. Extension points are deferred until they can be
  designed without widening the graph contract by default.
- `serializeTokenSet()` remains the canonical internal deterministic snapshot path; there is no DTCG or public JSON
  exporter.
- The upstream dynamic color utility version is pinned exactly because algorithm changes can alter generated token output.
