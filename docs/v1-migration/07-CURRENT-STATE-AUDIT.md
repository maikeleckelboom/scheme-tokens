# Audited current state and migration delta

This document describes the repository at the audited baseline. It is evidence for migration planning, not desired v1 behavior.

## 1. Baseline

```text
Repository: maikeleckelboom/color-scheme-tokens
Commit: 8d03d468c05e9dcbcc54759339129c55bcabbcf7
Commit title: refactor(api): remove constructor-heavy root exports
Audit date: 2026-06-19
```

Baseline link:

```text
https://github.com/maikeleckelboom/color-scheme-tokens/commit/8d03d468c05e9dcbcc54759339129c55bcabbcf7
```

At audit time the repository’s current files still matched this snapshot. Codex must re-check HEAD and reconcile later changes before editing.

An umbrella GitHub issue exists:

```text
https://github.com/maikeleckelboom/color-scheme-tokens/issues/1
```

That issue records the earlier audits but uses some superseded vocabulary (`Problem`, `schemaVersion`, etc.). The normative files in this migration package supersede it. The issue may be updated/closed after implementation, but it is not the final API contract.

## 2. Package state

Current `package.json` at the baseline:

```text
name: color-scheme-tokens
version: 0.0.0
private: true
type: module
sideEffects: false
Node: >=18
package manager: pnpm 11.7.0
runtime dependency: @material/material-color-utilities 0.4.0
entry points: root and ./sources/material3
files: dist, docs, README, CHANGELOG, LICENSE
```

Key deltas:

- Node 18 is obsolete for the intended release; v1 target is Node 22/24 CI.
- Conversion subpath is absent.
- Internal docs are included in the tarball.
- Package repository/homepage/bugs/publish metadata is incomplete.
- The Material dependency is bundled despite also being a runtime dependency.
- No CI directory exists at the audited snapshot.

## 3. Current root runtime exports

Current `src/index.ts` exports:

```text
parseColorInput
parseHexColor
srgb255
compileGraph
compileValidatedGraph
createSourceGraph
isTokenKey
parseTokenKey
isModeKey
parseModeKey
serializeTokenSet
validateGraph
exportCssVariables
createSchemeTokens
```

The type surface is much larger and includes duplicate aliases and erased types not protected by the runtime snapshot.

Target root runtime exports are only:

```text
defineTokenGraph
defineTokenFragment
parseTokenGraph
parseColor
compileTokenGraph
buildTokenSet
exportCssVariables
serializeTokenSet
formatCssColor
```

## 4. Result and diagnostic inconsistency

Current `src/core/graph.ts` defines both:

```ts
{ ok: false, problems: readonly Problem[] }
{ ok: false, problem: Problem }
```

The first permits an empty error array. Current diagnostics variously use `kind`, `code`, both, or raw arrays.

Current color diagnostics also retain arbitrary `input: unknown`, which can be cyclic/large/sensitive and can make recommended JSON error formatting throw.

Migration:

- one `Issue` base;
- one non-empty `issues` Result;
- JSON Pointer paths;
- no raw input retention;
- issue cap/cascade suppression.

## 5. Current graph model

Current graph format:

```ts
{
  schemaVersion: "color-scheme-token-graph/v0",
  modes: string[],
  tokens: TokenNodeInput[],
}
```

Token nodes are separate color and alias variants. Values use arrays of `{ mode, value }`. There is no explicit default mode or visibility.

Migration:

- record-based tokens;
- `formatVersion: 1`;
- explicit `defaultMode` and `defaultVisibility`;
- `value` / exact `valueByMode`;
- literal/reference expression grammar;
- fragments in data;
- lower-kebab keys;
- canonical origins.

## 6. Current graph validation boundary is unsafe

Current `validateGraph(graph: ColorSchemeTokenGraphInput)` accepts an already typed object and immediately dereferences fields. It repeatedly uses `String()` coercion for unchecked runtime values. Malformed JavaScript/JSON lookalikes can throw or be coerced instead of receiving precise issues.

The normalization pass re-parses colors and contains an “impossible” throw:

```text
Invalid color input reached graph normalization.
```

Provenance is carried through by reference.

Migration:

- `parseTokenGraph(input: unknown)`;
- descriptor-safe plain-data inspection;
- no coercion;
- one pass to owned canonical graph;
- no public `validateGraph`.

## 7. Current color model and parser

Current supported canonical variants are already sRGB, Display-P3, and OKLCH, but:

- `parseHexColor` accepts only six-digit hex, optionally without `#`;
- `parseColorInput` accepts a public path parameter;
- accepted color objects are returned by reference;
- RGB/P3 components are forced into `0…1`, conflating validity with gamut;
- `srgb255()` throws;
- there is no coherent constructor family for P3/OKLCH;
- diagnostics use incompatible Result forms.

Migration:

- one `parseColor(unknown)` concrete grammar;
- exact object parsing/copying;
- finite extended RGB values;
- canonical alpha/hue/-0;
- no throwing constructors;
- precision-preserving formatter.

## 8. Current compiler

Current `compileGraph` validates and then calls public `compileValidatedGraph`. Current compiled token set is an array:

```ts
{
  schemaVersion: "compiled-color-scheme-tokens/v0",
  modes: ModeKey[],
  tokens: CompiledColorToken[],
}
```

Resolution:

- recursively follows aliases;
- allocates path arrays;
- searches arrays per mode;
- does not memoize;
- may repeat cycle diagnostics;
- exposes impossible failure states for an already validated input;
- only supports `include?: string[]`, with fallback error handling for empty problem arrays.

Migration:

- private validated compiler;
- public combined `compileTokenGraph`;
- stack-safe memoized resolution;
- explicit public/all/exact selection;
- record output;
- origins/dependencies/metadata;
- deterministic cycle reporting.

## 9. Current recipe duplicates work and eagerly exports

Current `createSchemeTokens()`:

1. invokes/validates source graph;
2. converts canonical graph back to authored input;
3. applies layers and aliases;
4. validates again;
5. compiles;
6. always generates CSS;
7. always serializes a snapshot.

The round trip debrands/re-wraps values and creates impossible assertions.

Migration:

```text
source.build -> compose fragments -> parse once -> compile once
```

Replace with `buildTokenSet()` returning only `{ graph, tokenSet }`.

## 10. Current layer subsystem is residue

Current layer behavior has an ignored `name`, no validated-layer construction path, and reconstructs token fields without performing meaningful overlay semantics. Reconstruction risks dropping future fields.

Migration:

- delete `layers/`, `applyLayers`, and layer types;
- use plain fragments;
- duplicate keys always fail.

## 11. Current generic source leaks Material concepts

Current `ColorSchemeTokenSource` requires a `roleSet`, although custom sources do not inherently have a Material role inventory. Source problems widen `kind` to `string`.

Migration:

```ts
interface TokenSource<I extends Issue> {
  id: string;
  build(): Result<TokenGraphInput, I>;
}
```

No role-set requirement. Preserve source-specific issue unions.

## 12. Current Material adapter

Current `material3Source`:

- option is named `color`, not `sourceColor`;
- captures caller options and reads them later;
- validates categories sequentially and can stop early;
- accepts only opaque sRGB;
- has duplicated key-color arrays/validation;
- exposes generic role-set machinery;
- emits camel-case role keys;
- advertises required and optional roles separately.

Current required role list is the source of the fixed v1 inventory; optional dim roles are removed from v1 output.

Migration:

- copy options at construction;
- aggregate issues;
- explicit conversion/gamut policy;
- fixed lower-kebab inventory;
- private adapter types;
- catch upstream exceptions;
- exact ARGB boundary.

## 13. Current CSS exporter defects

Current exporter accepts unchecked:

```text
selector
prefix
modeSelectors
```

and returns a bare string.

Current variable naming:

1. splits camelCase;
2. flattens dot hierarchy;
3. joins with hyphens;
4. lowercases.

This silently collides, for example:

```text
foo.barBaz  -> --foo-bar-baz
foo.bar.baz -> --foo-bar-baz
```

After lower-kebab keys, these also collide under a single-hyphen flattening:

```text
a.b-c
a-b.c
```

Other current issues:

- `localeCompare()` ordering;
- first mode treated as default;
- misleading `minify` name;
- no selector collision detection;
- unchecked CSS interpolation.

Migration:

- validated Result;
- structured strategies;
- explicit default mode;
- `--` hierarchy encoding;
- true pretty/compact;
- standards-aware selector validation.

## 14. Current CSS color precision loss

Current `formatCssColor`:

- rounds every sRGB channel to 8-bit;
- clamps channels to `0…255`;
- uses `toFixed(4)` for P3/OKLCH;
- emits legacy byte-oriented RGB with alpha.

This loses legitimate authored/conversion precision and silently clips out-of-gamut values.

Migration:

- byte hex only when exactly lossless;
- modern `color(srgb …)` otherwise;
- shortest round-trip numbers;
- no silent clipping/mapping.

## 15. Current serializer is not canonical

Current `serializeTokenSet`:

- exposes an indentation option;
- uses `localeCompare()`;
- spreads color objects, preserving construction property order;
- emits provenance directly, preserving caller property order;
- depends on input mode order.

Semantically equal values can serialize differently.

Migration:

- one output form;
- explicit object reconstruction/property order;
- recursive extension canonicalization;
- code-unit ordering;
- canonical modes;
- one trailing newline.

## 16. Current packaging/tooling gaps

Current build bundles Material via:

```ts
noExternal: ["@material/material-color-utilities"];
```

while retaining it as a runtime dependency. This pays both costs and creates attribution risk.

Current TypeScript config:

- includes Node types in library source;
- has one config for source/tests/config;
- uses `skipLibCheck: true`;
- suppresses deprecations globally;
- excludes scripts from main include.

Current Vitest config uses deprecated `test.server.deps.inline` and an optimizer override that may no longer be needed.

Current smoke script is `.ts` executed directly with Node despite the declared Node 18 floor.

Migration:

- external dependencies;
- Node >=22;
- split configs;
- scripts typechecked;
- no blanket suppressions;
- modern Vitest config;
- packed-package smoke;
- CI Node 22/24;
- package lint and declaration checks.

## 17. Current documentation/release residue

Current package `files` includes all of `docs`, which contains internal extraction/review/phase material and local path/history details. `tests/phase0-contract.test.ts` validates planning prose rather than package behavior. Smoke tests retain a catalog of removed historical APIs.

Migration:

- package only public artifacts;
- delete planning-prose contract tests;
- exact positive public API approvals;
- executable README examples;
- no historical negative API catalog;
- keep migration/archive docs out of tarball.

## 18. Confirmed baseline-to-target name map

| Baseline                                  | Target                                     |
| ----------------------------------------- | ------------------------------------------ |
| `parseColorInput`, `parseHexColor`        | `parseColor`                               |
| `validateGraph`                           | `parseTokenGraph`                          |
| `compileGraph`                            | `compileTokenGraph`                        |
| `compileValidatedGraph`                   | private internal compiler                  |
| `createSourceGraph`, `createSchemeTokens` | `buildTokenSet`                            |
| layer types / `applyLayers`               | fragments in graph/build data              |
| `problems` / `problem`                    | `issues`                                   |
| `kind` diagnostic                         | `code`                                     |
| `schemaVersion`                           | `formatVersion`                            |
| `values` arrays                           | `valueByMode` records                      |
| alias nodes                               | `{ ref }` expressions                      |
| token arrays                              | token records                              |
| `CssVariableOptions.prefix`               | `ExportCssVariablesOptions.variablePrefix` |
| `minify`                                  | `format: "compact"`                        |
| Material `color`                          | `sourceColor`                              |
| camel Material roles                      | lower-kebab roles                          |

## 19. Drift re-audit checklist

At migration start, compare current HEAD against this evidence:

- [ ] package version/private state;
- [ ] dependency versions;
- [ ] root/subpath export lists;
- [ ] graph/color/compiler files;
- [ ] open PR/branch changes if visible;
- [ ] new CI/tooling files;
- [ ] changed Material upstream API/role behavior;
- [ ] any current user-authored uncommitted files.

Any post-baseline change that already implements part of v1 should be evaluated against the final names/semantics, not preserved merely because it is newer.
