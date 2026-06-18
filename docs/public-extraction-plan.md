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
5. Add source and CSS snapshots before any public release candidate.
