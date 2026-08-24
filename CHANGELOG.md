# Changelog

## 0.3.0

### Minor Changes

- 4b55405: Reject a separate CSS scope at compile time when exact mode selectors are supplied, matching the existing runtime contract.

  Describe the package explicitly as a zero-runtime-dependency design-token graph compiler.

## 0.2.0

### Minor Changes

- 4fae915: Raise the minimum supported Node.js runtime from 22 to 24. This removes a previously supported
  runtime and therefore ships as a breaking pre-1.0 minor release.

### Patch Changes

- 61690df: Preserve finite reference-key inference across heterogeneous layer tuples so graph tokens can
  reference keys from every tuple member and typos remain statically rejected.
- f047cc9: Add release tooling around the published contract: changesets, a committed API
  surface snapshot at `api/scheme-tokens.api.d.ts`, and CI gates that run publint
  and `@arethetypeswrong/cli` against the packed tarball, install that tarball
  into a scratch project under both `bundler` and `node16` module resolution, and
  fail when the API snapshot moves without a changeset. No published behaviour
  changes.

## 0.1.0

Initial release of the string-valued token graph compiler.

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
