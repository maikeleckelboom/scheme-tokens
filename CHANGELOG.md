# Changelog

## 0.1.0

Initial pre-release candidate for the string-valued token graph compiler.

- Define single-mode graphs with `base` defaults and require an explicit mode envelope and default for multimode graphs.
- Keep references explicit through `tokenRef()` and strict `{ ref }` records.
- Normalize direct values, explicit mode maps, and expanded `{ value, ...metadata }` definitions into one strict artifact grammar.
- Remove the pre-release `aliases` and `valueByMode` authoring forms.
- Return every fallible public success through `{ ok: true, value }` and export `Result`.
- Separate trusted authoring helpers from parsers for untrusted persisted data.
- Compile public, all, or explicitly selected tokens while resolving references against the complete graph.
- Type runtime-filtered public records conservatively as partial, exact literal tuples as complete after validation, and `all` as complete only for finite authored key unions; keep dynamically parsed compiled artifacts and their CSS maps partial.
- Parse and serialize strict token graph, token layer, and compiled scheme artifacts deterministically.
- Export deterministic CSS custom properties with structured blocks and token-to-variable metadata, rejecting declaration-unsafe values and selectors outside the bounded safe grammar.
- Prove that applications can flatten independent theme axes into private complete modes, select an exact public semantic contract, and reuse structured declarations for application-owned selector and media-query policy.
- Keep the root package dependency-light and outside palette generation, value interpretation, and product-domain policy.
