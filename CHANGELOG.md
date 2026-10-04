# Changelog

## 0.4.0

### Minor Changes

- c04eb01: Cut the core runtime and wire model over to v2. Remove `defineTokens` in favor of one-object `defineTokenGraph`, add canonical flat concat and reference-only `tokenConcat` templates, and expose `orThrow` with complete structured error causes.

  Compose ordered layers before graph tokens, preserve visibility through omitted overrides, and validate layer mode sets at runtime. Compiled metadata now records complete `declarations` and sparse `expressionByMode`, including resolved reference-part values for concat, instead of the old winning origin and dependency records. Resolution uses one iterative bounded DAG engine with deterministic cycles and original reference pointers.

  Write format version 2 and export only self-contained v2 schemas. Continue reading v1 source graphs/layers through a deterministic lossless upgrade that preserves published values, visibility, metadata, and mode order, including the valid `concat` mode. Reject compiled v1 with a request to recompile source. V2 schema hints are optional uninterpreted strings; trusted helpers do not accept them. Native v2 preserves authored mode order.

- dbe30df: Implement the static contract of the v2 model. `defineTokenGraph` now infers `TokenGraph<Key, Mode, PublicKey>`: every composed key, the mode union, and the public keys after layers compose in array order and graph tokens compose last, with explicit visibility replacing and omitted visibility preserving exactly as the runtime does. Default and explicit `public` compilation return complete token and metadata records when that public set is finite and fully known, and the CSS token-to-variable lookup follows. Uncertain visibility, dynamic key sets, non-tuple layer lists, parsed graphs, and runtime selection arrays stay partial. The graph type's third generic is now the public key union instead of the layer tuple, and `tokens` is typed as the graph's own, possibly partial, declarations. `defineTokenGraph` returns the new `DefinedTokenGraph`, a `TokenGraph` whose own authored keys are definite in `tokens`, while a key only a layer declares is not.

  `defineTokenLayer` infers `TokenLayer<Key, Mode, Visibility>`, where `Mode` is the layer mode set (`never` without mode maps, a finite union for literal layers, `string` when unknown) and the new `LayerVisibilityFacts` type records the default and which keys may declare or omit visibility. Literal layers whose mode maps disagree, and finite layer sets that differ from the graph's, fail type checking with a `LayerModeMismatch` diagnostic that names both sets. `TokenGraph` and `TokenLayer` are now type aliases whose precise claims are nominal: only the helpers, and values that flow unchanged from them, make one, so an object literal, a spread copy, or a mapped type fits only the plain forms and compiles as dynamic data. Explicit assertions and rewrites that TypeScript still types as the original value, such as `Object.assign` with field overrides or in-place mutation, keep the original facts and are outside this guarantee; define a changed graph or layer with the helpers instead. Finite key unions are exact claims, and compiling a union of graphs yields one scheme type per graph.

  Literal authoring is validated by a strict constraint that rejects reference typos with TypeScript's suggestion, incomplete or foreign mode maps, invalid visibility, unknown or mixed metadata, and mode names outside the runtime lower-kebab grammar, including `valueByMode` and the reserved names; `concat` stays a valid mode and concat expressions are recognized by their exact array shape. `tokenConcat` now types its canonical result: a string without references, a reference or concat with one, and a concat with several.

  The static contract is verified with strict source and packed declaration matrices. The subsequent consumer-compiler-support changeset expands the consumer range to `>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0`, while retaining TS7 development tooling and TypeScript next as a non-blocking signal. Runtime behavior, wire formats, and schemas are unchanged.

- cbce315: Replace the CSS selector strategies with one activation model. `exportCssVars()` groups activation options under `activation`: `root` (default `:root`, or `:host` in a shadow root), `attribute` (explicit opt-in to one `data-*` marker attribute; omission emits no markers), `media` (a media condition per mode at `root`), and `selectors` (selector conditions per mode: one selector string, one `{ selector, media? }` object, or a non-empty list of those objects). `cascadeLayer`, `prefix`, `variableName`, `format`, and `references` are top-level options. The `scope` and `modeSelectors` options, the data-attribute, class, and exact-selector strategies, `classPrefix`, and the `CssScope` and `CssModeSelectors` types are removed; classes are selector conditions, and the new `CssCondition` type names one. Unknown options, the removed ones included, are rejected.

  Blocks are emitted in tier order default, media, attribute, selector; within a tier in the scheme's authored mode order; within a mode in condition order. The default block is separate from the default mode's attribute marker, when requested. Every generated selector is wrapped in `:where()` and has zero specificity, so a later matching block wins and application CSS competes through the ordinary cascade. Opted-in attribute markers are unanchored and include the default mode, so nested sections switch modes; a marker value that is not a mode, such as `data-theme="system"`, leaves the media preference in charge. `activation.root` does not affect attribute targeting: only `activation.attribute: { name: "data-theme", includeHost: true }` adds host matching alongside ordinary elements. Selector conditions may overlap; the later mode wins. Every block declares every selected token. `cascadeLayer` wraps the whole output in `@layer <name>`. The exporter emits custom properties only and never `!important`; `color-scheme` is an ordinary token that application CSS binds.

  A block now reports `tier`, `mode`, a non-empty `selectors` list, optional `media`, and `declarations`, replacing its single `selector`. `variableByToken` keeps the compiled completeness.

  Default variable names join the prefix and token-key segments with single hyphens: `action.primary.background` becomes `--action-primary-background` instead of `--action--primary--background`. Because keys such as `a-b.c` and `a.b-c` now share a name, every collision among the exported tokens fails with `duplicate-css-variable`, carrying `firstKey` (first in code-unit order), `key`, and `property`, and a message that names all three. Unexported internal keys never collide.

  The bounded selector grammar adds `:where()`, `:is()`, `:not()`, `:host`, and `:host()`; media conditions and layer names have bounded grammars of their own. Failures are collected instead of returned one at a time. The issue codes `invalid-scope`, `invalid-data-attribute`, `invalid-class-prefix`, `invalid-mode-selectors`, `missing-mode-selector`, `unknown-mode-selector`, and `duplicate-mode-selector` are removed; `invalid-root`, `invalid-attribute`, `invalid-media`, `invalid-selector-condition`, `unknown-condition-mode`, and `invalid-cascade-layer` are added, with `option`, `tier`, `index`, and `media` context where they apply. Each emitted value is checked for declaration safety once, and values of modes without any block are not checked.

- e9d375b: Add optional `references: "var"` to `exportCssVars()`. Resolved output remains the default and is unchanged when the option is omitted, explicitly undefined, or `"resolved"`. Retained references link their direct targets only when emitted by this selected scheme, using the actual prefix/custom variable names built once. Other pure references inline their own resolved values; concat preserves literals and links or inlines each reference part independently, without adding dependencies or bypassing omitted intermediates.

  Every activation block still declares every selected token, including aliases, in canonical key order. Local target overrides propagate through linked aliases; an unmarked descendant's override does not update an inherited alias. CSS token-stream substitution differs from arbitrary character concatenation: dimensional suffix assembly and inserted `var()` inside quoted strings are not repaired. Resolved output remains available for those uses.

  Safety checks use the exact complete projected declaration shared by blocks and CSS formatting. Unsafe retained concat uses `invalid-css-value` at `/metadataByToken/<key>/expressionByMode/<mode>`; resolved/direct token values retain `/tokens/<key>/<mode>`. Unused resolved/fallback strings and isolated fragments are not checked in var output. Name failures, collisions, and independent unsafe projected declarations remain collected failures. Invalid references options use `invalid-css-options` with `option: "references"`. Compiled parsing remains structural; no metadata consistency or graph validation is added.

- a35e122: Refine the candidate public API before stabilization. Material generation uses
  `modeSettings` and `Material3ModeSettings`, with congruent explicit built-in
  `colorMode` accepted. Compilation takes selection arrays, and the trusted graph
  helper normalizes omitted graph-local tokens to an empty canonical record.

  Expose `LayerVisibilityFacts` with explicit may-set fields. Compiled v2 declaration
  metadata uses `declaredVisibility`; the parser and schema reject the old field.
  Diagnostics are discriminated by code with emitter-guaranteed payloads;
  `inconsistent-layer-modes` separates internally disagreeing maps from
  `layer-mode-mismatch` against a graph. Selection issue paths use `/selection/<index>`.

  Group CSS activation under `activation`, rename `system` to `media`, and use
  `default`, `media`, `attribute`, and `selector` structured tiers. Attributes are
  explicit opt-in, with `{ name, includeHost: true }` adding host targeting independently
  of root. Selector activation accepts one condition object as well as strings and
  lists; its malformed-condition code is `invalid-selector-condition`. No compatibility
  aliases are retained. Core graph/layer wire formats and reference semantics remain unchanged.

### Patch Changes

- a86d217: Expand supported consumer compilers to `>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0`.
  The authoritative core and full P5.1 Material matrices run against actual source and paired
  tarballs, with strict-only and stricter settings, skipLibCheck false and consumer declaration
  emission. The repository retains TypeScript 7 development tooling. Runtime behavior and
  declarations are unchanged. The existing pending minor changesets still project core 0.4.0
  and Material 0.2.0 with peer ^0.4.0; no primary-worktree versioning is applied.

## 0.3.0

### Minor Changes

- 4b55405: Reject a separate CSS scope at compile time when exact mode selectors are supplied, matching the existing runtime contract.

  Migration note: exported `ExportCssVarsOptions` is now a union type rather than an interface-shaped contract. Consumers that used `interface ... extends ExportCssVarsOptions` should use a type alias with an intersection or other type composition instead.

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
