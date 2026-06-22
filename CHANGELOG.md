# Changelog

## 0.1.0

Initial pre-release candidate for the simplified core package.

- Compile authored token graphs into `CompiledScheme` artifacts.
- Expose direct compiled token mode maps, for example `scheme.tokens.background.base`.
- Return named success payload fields from public result-shaped APIs.
- Export deterministic CSS variables through `exportCssVars()`.
- Parse and serialize strict token graph, token layer, and compiled scheme artifacts.
- Keep the root package dependency-light and engine-free.
- Leave Material 3, palette generation, color science, image extraction, conversion, and vendor-specific behavior outside the package boundary.
