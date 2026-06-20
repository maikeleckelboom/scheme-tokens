# Full migration plan

This plan maps the audited pre-v1 repository to the normative v1 contract. It is written for a single major implementation run, but phases are ordered to keep the tree testable and reduce rework.

## 1. Migration policy

### 1.1 Greenfield reset

The package is unpublished and currently marked `0.0.0`/private. Treat every current public name as replaceable. Do not preserve source compatibility, runtime compatibility, persisted v0 formats, snapshots, old CSS names, or old error shapes.

Do not implement:

```text
@deprecated aliases
legacy overloads
v0 graph readers
old/new dual fields
automatic field renames
compatibility namespace exports
old fixture adapters
migration warnings
```

A clean deletion is preferred to a wrapper.

### 1.2 Worktree safety

Before editing:

```bash
git status --short
git rev-parse HEAD
git diff --stat 8d03d468c05e9dcbcc54759339129c55bcabbcf7...HEAD
pnpm install --frozen-lockfile
pnpm validate
```

Never reset or discard unrelated user work. If current HEAD contains post-audit changes, classify each as:

- compatible and retained;
- superseded by this specification and rewritten;
- unrelated and preserved;
- conflict requiring a documented adaptation.

### 1.3 One implementation, not parallel generations

Do not leave `compileGraph` alongside `compileTokenGraph`, or `Problem` alongside `Issue`. Replace call sites and remove the old implementation in the same migration.

## 2. Target source layout

The exact filenames may follow repository style, but responsibilities should converge approximately to:

```text
src/
  index.ts

  core/
    result.ts
    json.ts
    identifiers.ts
    canonical.ts
    color.ts
    graph-input.ts
    graph.ts
    parse-token-graph.ts
    compile-token-graph.ts
    source.ts
    build-token-set.ts

  exporters/
    format-css-color.ts
    export-css-variables.ts
    serialize-token-set.ts
    selector-validation.ts

  conversion/
    index.ts
    conversion.ts
    texel-adapter.ts

  sources/
    material3/
      index.ts
      material3-source.ts
      material3-options.ts
      material3-roles.ts
      material3-adapter.ts

schemas/
  token-graph.v1.schema.json
  token-fragment.v1.schema.json
  compiled-token-set.v1.schema.json

tests/
  unit/
  integration/
  properties/
  types/
  package/
  fixtures/

scripts/
  check-api.mjs or API Extractor configs
  check-doc-examples.mjs
  smoke-consumer.mjs
  check-tarball.mjs

.github/workflows/
  ci.yml
```

Avoid internal barrel chains that obscure dependencies. Public entry point files should explicitly export the approved manifest.

## 3. Phase 0 — establish the baseline

1. Record current commit and dirty files.
2. Run current install/validation/build/smoke commands.
3. Capture current packed tarball listing.
4. Confirm actual package dependency and tool versions.
5. Inspect the current public runtime snapshot and emitted `.d.ts` files.
6. Identify current internal documents that must not ship.
7. Create a migration notes file outside the published `files` set if useful.

Do not spend time fixing old tests independently when the behavior is intentionally deleted. Preserve a failing baseline record, then replace tests with v1 contract tests.

## 4. Phase 1 — result, JSON safety, identifiers, canonical utilities

### 4.1 Replace Result vocabulary

Create the final `Issue`, `NonEmptyIssues`, and `Result` types first. Convert all new code to `issues`. Do not temporarily bridge `problems`.

Delete:

```text
ParseResult
singular problem result shape
possibly empty failure arrays
kind-based issue discriminants
raw input fields in issues
```

Create internal helpers that construct successes/failures without widening literals. Keep helpers internal.

### 4.2 Implement issue collection

Create deterministic issue accumulation:

- fixed traversal order;
- cascade suppression hooks;
- first 99 actionable issues;
- final `issue-limit-reached` issue;
- never empty.

### 4.3 Implement safe JSON inspection

Build shared internal functions for:

- plain-record detection using descriptors;
- own enumerable data-property enumeration;
- safe exact-key checking;
- finite JSON value copying;
- cycle detection for extensions/source issues;
- RFC 6901 path construction and escaping;
- code-unit string sorting;
- `-0` normalization.

Do not call getters. Do not use `String(value)` as validation.

### 4.4 Implement identifiers

Create internal parsers/predicates for:

- token key;
- mode ID;
- source ID;
- fragment ID;
- variable prefix;
- class prefix;
- extension namespace.

They are internal utilities, not root exports. Tests cover valid/invalid boundaries and no normalization.

## 5. Phase 2 — color model, parser, and formatter

### 5.1 Replace `src/core/colorValue.ts`

Implement final input/canonical types and `parseColor(input: unknown)`.

Required parsing order:

1. primitive string grammar;
2. exact object shape by `colorSpace`;
3. component validation;
4. canonical allocation and normalization.

Do not return accepted caller objects by reference.

### 5.2 String parser

Implement a deliberately bounded parser rather than delegating public behavior to Texel or Material utilities. It may use internal tokenizer helpers. Test all accepted/rejected forms in the normative spec.

The parser must accept `color(srgb …)` because the formatter emits it.

### 5.3 Formatter

Replace byte-clamping and `toFixed(4)` behavior. Create one canonical number formatter based on normalized finite numbers and shortest round-trip text.

Hex output only for opaque byte-aligned sRGB. Every other form retains precision.

### 5.4 Color invariants

Add unit and property tests before graph work:

- parse never throws for JSON values;
- accepted objects are copied;
- `formatCssColor(parseColor(text).value)` is parseable for all accepted canonical values in the formatter’s supported range;
- no silent clipping/mapping;
- alpha always present;
- hue/negative-zero canonicalization.

Delete public `parseHexColor`, `parseColorInput`, `srgb255`, and throwing `hex`/assertion constructors. Hex support is part of `parseColor`.

## 6. Phase 3 — graph types, helpers, parser, and schemas

### 6.1 Replace the v0 graph model

Delete the array-based color/alias node model and v0 `schemaVersion`. Implement the exact record-based v1 input grammar.

No separate alias token category exists. A token’s expression is a color literal/input or `{ ref }`, either shared with `value` or per mode with `valueByMode`.

### 6.2 Implement authoring helpers

Implement `defineTokenGraph` and `defineTokenFragment` as plain-data identity helpers with const generics.

Prototype type behavior in `.test-d.ts` before locking signatures:

- direct graph missing mode -> compile error;
- direct graph extra mode -> compile error;
- invalid default mode -> compile error;
- token keys remain literal;
- fragment keys remain literal;
- standalone fragment does not falsely claim graph-mode completeness;
- editor performance remains reasonable for a generated large token record.

Do not introduce callback builders to solve inference.

### 6.3 Implement `parseTokenGraph`

Parse unknown top-down without dereferencing unchecked values. Suggested staged passes:

1. top-level shape and known properties;
2. format/modes/default/default visibility;
3. direct token structural parsing;
4. fragment structural parsing and ID uniqueness;
5. declaration flattening and duplicate detection;
6. color/reference parsing and exact mode expansion;
7. target existence;
8. cycle validation;
9. canonical owned output.

Use safe internal maps keyed by strings. Do not let object prototype keys (`__proto__`, `constructor`) affect indexes; the identifier grammar already rejects them as token segments where applicable, but indexes must still be robust.

### 6.4 Origins

- direct graph token -> `{ kind: "graph" }`;
- graph fragment token -> `{ kind: "fragment", id }`;
- source composition uses an internal parser context to produce source origins.

### 6.5 Schemas

Create all three JSON Schemas during this phase, not after code stabilization. Test representative fixtures against both schema and runtime parser. Keep semantic limitations documented.

## 7. Phase 4 — stack-safe compiler and selection

### 7.1 Replace `compileGraph.ts`

Create `compileTokenGraph(input: unknown, options?)` as parse + internal compile. Do not expose the internal validated compiler.

### 7.2 Selection parser

Strictly parse options and selection:

```text
undefined -> public
public
all
{ keys: non-empty unique valid existing keys }
```

Reject unknown option fields and malformed selection objects. Canonically sort selected keys; do not preserve request order.

### 7.3 Resolver algorithm

The graph currently has at most one outgoing reference edge per token-mode node, but implement with a general explicit-state resolver so future expression branches do not require a rewrite.

A suitable iterative design:

```text
state[(key, mode)] = unseen | visiting | resolved
value[(key, mode)] = ColorValue
dependencies[(key, mode)] = sorted unique keys

for each canonical token/mode:
  walk with explicit stack
  mark visiting
  when literal: resolve and unwind
  when reference:
    if resolved: reuse
    if visiting: canonicalize/report cycle once
    else push target
```

Memoize all graph nodes, not only selected outputs, because selected public tokens can depend on internal nodes.

Do not clone the whole path on every step. Use indexes/parent state to avoid quadratic memory.

### 7.4 Cycle canonicalization

For a cycle sequence, rotate it so the lexicographically smallest key is first, retain direction, append the start key only in message text if desired, and key deduplication by `(mode, canonical cycle sequence)`. This makes insertion/start traversal irrelevant.

### 7.5 Dependencies

For each token/mode, compute unique transitive dependency closure. Since v1 chains are linear, this is simple; still store as an immutable sorted array. Do not include self.

### 7.6 Compiled output

Create a fresh `CompiledTokenSet` with:

- canonical modes;
- canonical token record;
- resolved canonical color copies;
- explicit visibility;
- origin;
- mode-specific transitive dependencies;
- copied metadata/extensions.

## 8. Phase 5 — generic sources and `buildTokenSet`

### 8.1 Replace generic source contract

Remove `ColorSchemeTokenSource`, role-set requirements, and generic Material role metadata. Introduce only `TokenSource<I extends Issue>`.

### 8.2 Source result validation

A TypeScript declaration does not make arbitrary JavaScript trustworthy. Validate:

- source is object-like and has a valid ID;
- `build` is callable;
- invocation exception is caught;
- returned object is an exact Result shape;
- failed issues are non-empty, JSON-safe, and have code/message/path types;
- success graph is parsed normally.

Preserve valid source-specific issue objects without widening their code type at compile time.

### 8.3 Build pipeline

Replace `createSourceGraph()` and `createSchemeTokens()` with `buildTokenSet()`:

```text
call source once
copy source output
append caller fragments as declarations, not overrides
parse once with origin context
compile once
return graph + tokenSet
```

No de-normalization/revalidation round trip. No CSS/JSON eager output.

### 8.4 Custom source tests

Cover:

- successful deterministic source;
- source-specific issue inference;
- thrown source;
- malformed success/failure result;
- mutable source options copied by built-in sources;
- duplicate source/fragment token;
- invalid source ID;
- source called exactly once.

## 9. Phase 6 — CSS exporter and canonical serializer

### 9.1 CSS naming

Implement the injective hierarchy encoding exactly. Keep helper private and property-test it over generated valid key pairs.

Do not retain camel-case splitting or lowercasing; valid keys are already canonical lower-kebab.

### 9.2 CSS options parser

Strictly validate option object fields and strategy-specific exactness.

Use a standards-aware CSS selector parser for raw complete selectors. Select an established maintained dependency, exact-pin it, isolate it behind one internal module, and add license metadata. Do not expose its types.

Reject:

- selector lists when the contract expects one selector, unless deliberately supported and tested as a complete selector list;
- declaration/block injection;
- invalid escapes;
- missing/extra selector-map modes;
- duplicate resulting selectors;
- scope plus exact selectors conflict;
- invalid data attribute/class prefix.

### 9.3 Output

Use explicit default mode and canonical order. Use `formatCssColor`. Implement true pretty/compact forms and exact newline rules.

### 9.4 Serializer

Build canonical plain objects field by field. Do not spread color, origin, token, or extensions into output. Recursively canonicalize extension objects.

Remove serializer indentation options and `localeCompare`.

## 10. Phase 7 — conversion subpath

### 10.1 Add dependency and build entry

Add exact `@texel/color@1.1.11` as a runtime dependency and external build import. Add `src/conversion/index.ts` as an explicit entry.

### 10.2 Private adapter

Build exhaustive mappings for the package’s three spaces and two gamuts. Copy input/output buffers and alpha. Contain exceptions and non-finite output.

### 10.3 Public operations

Implement exact signatures and semantics from the public API. Do not add defaults that hide mapping policy.

### 10.4 Numerical tests

Use independent/reference vectors, not values generated by the same adapter under test. Store tolerances and the metric rationale in tests. Include identity, round-trip, alpha, mutation, out-of-gamut conversion, mapping postconditions, and declaration leakage.

## 11. Phase 8 — Material 3 rewrite

### 11.1 Options and ownership

Rename `color` to `sourceColor`. Replace mutable closure behavior by parsing/copying options in `material3Source()`.

Derive public unions and runtime arrays from single const sources where feasible, but do not export internal constants.

### 11.2 Validation

Aggregate independent option and color issues. Validate:

- variant;
- contrast level;
- spec version;
- platform;
- source color;
- all supplied key colors;
- alpha;
- gamut policy.

### 11.3 Conversion bridge

Use the private conversion implementation, not public imports or duplicated matrices. Reject out-of-gamut by default; map only when configured.

### 11.4 Material generation

Introduce an internal validated opaque in-gamut sRGB type. Quantize once to ARGB. Remove duplicate validation of constructed ARGB-derived values and unreachable issue branches. Catch upstream generation errors.

### 11.5 Role reconciliation

Convert upstream camel names to the exact fixed lower-kebab inventory. Emit exactly those keys in both modes. Omit optional dim roles. Lock inventory in runtime and type tests.

Generated roles are direct source tokens, internal by default, with `origin.kind = "source"`, `origin.id = "material3"`, and upstream role in `sourceToken` where useful.

## 12. Phase 9 — public surfaces and packaging

### 12.1 Root/subpath indexes

Rewrite entry files from scratch against the approved runtime/type manifests. Avoid wildcard exports from internal modules.

### 12.2 Build

Configure three ESM entries:

```text
src/index.ts
src/conversion/index.ts
src/sources/material3/index.ts
```

Externalize all runtime dependencies. Remove Material `noExternal`.

### 12.3 Package metadata

- Node `>=22`;
- repository/homepage/bugs;
- publishConfig;
- explicit exports including schemas;
- files limited to dist, schemas, README, CHANGELOG, LICENSE, and any required notices;
- no internal docs/reviews/plans;
- keep publication safety/version unchanged during automated migration;
- no CJS unless a new explicit requirement is approved.

### 12.4 TypeScript configs

Split:

```text
tsconfig.base.json
tsconfig.lib.json
tsconfig.test.json
tsconfig.scripts.json
```

Library config:

- browser-neutral ES libraries as needed;
- `types: []`;
- strict/exact optional/no unchecked index;
- declarations/maps;
- no accidental Node API.

Tests/scripts may include Node types. Remove blanket `ignoreDeprecations`. Include scripts in typechecking. Packed consumer uses `skipLibCheck: false`.

### 12.5 Test/build tooling

Add and configure:

- property testing (for example `fast-check`);
- API Extractor or equivalent declaration approval;
- `publint`;
- `@arethetypeswrong/cli`;
- JSON Schema test validation;
- executable Markdown examples;
- packed tarball consumer;
- tarball content inspection.

Remove deprecated Vitest server configuration and only retain optimizer workarounds proven necessary.

### 12.6 CI

Add CI on Node 22 and 24. Cache pnpm responsibly. Run the complete release gate, not just tests. Branch protection is a repository setting and may need owner action; document that if the automation cannot configure it.

## 13. Phase 10 — docs, examples, and residue deletion

### 13.1 Rewrite README

README order:

1. purpose and core-only quick start;
2. modes/references/visibility;
3. CSS/JSON output;
4. fragments;
5. custom source;
6. Material subpath;
7. conversion subpath;
8. API links and compatibility statement.

Do not make Material the only quick start. The generic core is the product center.

### 13.2 Executable examples

Extract all TypeScript blocks marked for execution. Compile them against the packed tarball, never `src` paths. Execute deterministic examples where safe and compare output.

### 13.3 Delete residue

Delete old planning tests/doc assertions, old port paths, old negative API catalog tests, and unused barrels. Keep only current architecture/user docs. Internal migration files must not enter the tarball.

## 14. Current-file migration map

| Current path/concept                        | v1 action                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/core/graph.ts`                         | Replace with final Result split and graph model; preferably separate modules.         |
| `src/core/colorValue.ts`                    | Replace with final color types/parser; remove throwing/hex-specific public functions. |
| `src/core/colorTokenValue.ts`               | Delete public literal wrapper; internal expression AST only if useful.                |
| `src/core/keys.ts`                          | Replace with internal identifier parser; no root exports.                             |
| `src/core/modes.ts`                         | Replace with internal identifier parser; no light/dark defaults.                      |
| `src/core/validateGraph.ts`                 | Replace by `parseTokenGraph`; accept unknown and own data.                            |
| `src/core/compileGraph.ts`                  | Replace by `compileTokenGraph` plus private stack-safe compiler.                      |
| `src/core/createSourceGraph.ts`             | Fold into `buildTokenSet`; delete public operation.                                   |
| `src/core/colorSchemeTokenSource.ts`        | Replace with generic `TokenSource`; remove role set.                                  |
| `src/core/serializeTokenSet.ts`             | Rewrite canonical v1 serializer.                                                      |
| `src/exporters/formatCssColor.ts`           | Rewrite precision-preserving formatter.                                               |
| `src/exporters/exportCssVariables.ts`       | Rewrite options, naming, selectors, Result.                                           |
| `src/layers/*`                              | Delete; fragments replace layers.                                                     |
| `src/recipes/createSchemeTokens.ts`         | Replace with `buildTokenSet`.                                                         |
| `src/sources/material3/material3Source.ts`  | Rewrite options, copying, conversion, issues.                                         |
| `src/sources/material3/material3RoleSet.ts` | Replace role-set abstraction with fixed private role list and exported type union.    |
| `tsup.config.ts`                            | Three entries, dependencies external, no `noExternal`.                                |
| `tsconfig.json`                             | Split configs, remove blanket Node/global suppression.                                |
| `vitest.config.ts`                          | Remove deprecated `server.deps.inline`, add type/property configs as needed.          |
| `scripts/smokeConsumer.ts`                  | Replace with typed/checked `.mjs` or deliberate TS runner; test packed package only.  |
| `tests/phase0-contract.test.ts`             | Delete.                                                                               |
| old `public-api.test.ts`                    | Replace with exact per-entry runtime snapshots plus declaration approvals.            |

## 15. Mandatory deletion inventory

Delete, not deprecate:

```text
ParseResult
TokenKeyInput
ModeKeyInput
TokenKeyProblem / KeyParseProblem duplicate families
ModeKeyProblem / ModeParseProblem duplicate families
CompileResult aliases
ColorSchemeTokenGraph duplicate aliases
ColorSchemeTokenLayer / ValidatedColorSchemeTokenLayer
validated compiler public types
ColorSchemeTokenSourceRoleSet generic contract
ColorSchemeTokenAliases
SchemeTokensRecipe* names
CssVariableOptions old name
snapshot/cssVariables eager recipe fields
hex/tokenKey/modeKey/srgb255 assertion helpers
core lightMode/darkMode defaults
internal graphBuilder/layers/recipes barrels with no public subpath
legacy transform and old-signature smoke assertions
old port-specific namespace/default-property assertions
```

Search the final repository for all old names and fail the release gate if any survive outside an explicitly historical changelog entry:

```bash
rg -n 'ParseResult|problems|schemaVersion|compileGraph|compileValidatedGraph|createSchemeTokens|createSourceGraph|validateGraph|applyLayers|ColorSchemeTokenLayer|srgb255|parseColorInput|parseHexColor|modeKey|tokenKey|onPrimary|surfaceContainer' src tests README.md schemas scripts package.json
```

Adjust the search so legitimate upstream role strings in isolated Material internals do not create false positives; public emitted keys remain lower-kebab.

## 16. Final integration pass

Before declaring completion:

1. run format/lint/type/unit/type/property/schema/build/package/docs gates;
2. inspect generated declarations manually;
3. inspect packed tarball manually;
4. install tarball into a clean consumer with Node 22 and 24;
5. verify root-only import graph;
6. compare runtime exports to approved lists;
7. search for legacy names and internal paths;
8. ensure no migration/archive docs are published;
9. update CHANGELOG with a pre-release v1 migration summary without claiming publication;
10. produce a final report with commands and results.
