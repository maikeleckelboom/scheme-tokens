# Changelog

## 0.0.0

- Repair the unpublished v1 package into a dependency-light core with root-only runtime APIs and JSON Schema subpaths.
- Remove in-core Material 3, Texel conversion, CSS parser coupling, fake Material generation, and engine-backed public
  subpaths.
- Add ergonomic `defineTokenGraph()` / `defineTokenFragment()` authoring defaults while keeping parsed wire formats
  strict.
- Strengthen deterministic diagnostics, direct dependency metadata, package-boundary checks, docs examples, and packed
  tarball validation.
- Add `@color-scheme-tokens/source-material3` as an optional Material 3 source adapter package outside the root core
  boundary.
