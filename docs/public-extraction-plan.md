# Public Extraction Plan

This repository is the canonical public package for `color-scheme-tokens`. It is not a rename of `material-schemes`, and
it does not copy old Git history.

## Source Mines

- `C:\dev\material-design\material-schemes` is implementation prior art.
- `C:\dev\material-design\material-schemes-library` may be read for API or tooling ideas.
- `C:\dev\material-design\material-schemes-lab` remains external proof tooling and is not moved into this package.

## Public Shape Rules

- Do not expose wrapper-shaped API names such as `createTheme`, `createColorScheme`, `createCssVariables`,
  `MaterialTheme`, or `createMaterialSchemeTokens`.
- Do not expose `material.*` token keys.
- Do not make upstream dynamic-color vocabulary the public package model.
- Do not add framework bindings, CLI tooling, DTCG export, theme editing, image extraction, or contrast repair in the
  initial package.

## Extraction Order

1. Establish graph primitives and runtime validation.
2. Compile aliases and modes into deterministic token sets.
3. Project compiled token sets to CSS.
4. Internalize the dynamic-color source adapter behind `scheme.*` keys.
5. Add plain token layer data and an app-surface layer.
6. Add a recipe that orchestrates source adapters, layers, aliases, one transform hook, compiler, serializer, and CSS
   export.
7. Add source and CSS snapshots before any public release candidate.

## Current Implementation Notes

- The package remains `private: true` at version `0.0.0`.
- The package is ESM-only; CommonJS build output and `require` export conditions are not part of the public contract.
- `ColorTokenValue` is implemented only as a literal authored color payload.
- Source adapters generate token graphs; they do not define the graph model.
- `dynamicSchemeSource()` accepts opaque sRGB source colors and keeps Material color utilities internal as a source
  implementation detail.
- Recipe `aliases` are sugar for simple alias token nodes.
- Token layers are reusable graph additions. `appSurfaceLayer` maps scheme roles to `chrome.*` and `semantic.*` aliases
  as optional convenience data.
- Recipe `transform` is a single advanced graph hook that runs after layers and aliases and before compile.
- `serializeTokenSet()` remains the deterministic snapshot path; there is no public JSON exporter.
- The upstream dynamic color utility version is pinned exactly because algorithm changes can alter generated token output.
