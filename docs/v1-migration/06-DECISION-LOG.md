# Consolidated decision log

This document preserves the reasoning behind the normative contract and identifies proposals that were superseded. It prevents future maintainers or automated agents from reviving rejected designs merely because they appear in the historical conversation or current v0 source.

## Status vocabulary

- **Accepted:** implement in v1.
- **Closure:** an operational choice resolved here because the conversation left alternatives open; chosen to make the one-shot migration unambiguous and consistent with accepted principles.
- **Rejected:** do not implement in v1.
- **Deferred:** possible future work; no placeholder API is added now.
- **Superseded:** an earlier accepted-looking proposal replaced by a later decision.

## D-001 — Graph-first generic core

**Status:** Accepted

The generic token graph is the architectural center. Material 3 is a source adapter, not the package model. Color conversion is an optional numerical capability, not a prerequisite for graph validity.

**Consequences:**

- core-only use is complete;
- no `m3.*` assumptions in generic graph types;
- no generic source role-set requirement;
- exporters consume compiled token sets only.

## D-002 — JSON-safe data is the authoring API

**Status:** Accepted

Every public domain value/options object is ordinary JSON-safe data. Remove the second helper language of `ref()`, `byMode()`, `publicToken()`, and `internalToken()`.

**Rationale:** one representation is easier to learn, persist, schema-validate, document, and keep deterministic.

**Exception:** `TokenSource` is executable and contains `build()`; its captured options and outputs remain JSON-safe.

## D-003 — Identity-style `define*` helpers

**Status:** Closure; supersedes earlier “helper adds version” sketches

`defineTokenGraph()` and `defineTokenFragment()` accept the same complete shape as raw JSON, including `formatVersion: 1`. They preserve literals and provide compile-time feedback but perform no authoritative validation or hidden transformation.

**Rationale:** exact parity between code and JSON is more valuable than saving one version field, and the latest refined graph example included `formatVersion` in helper input.

## D-004 — One Result and Issue taxonomy

**Status:** Accepted

Final vocabulary:

```text
Issue / issues / code / path / message
```

`Problem/problems`, singular `problem`, and error `kind` are superseded.

**Rationale:** aligns with modern validation libraries, separates recoverable issues from thrown errors, and gives one generic consumer shape.

## D-005 — `kind` is a scalpel

**Status:** Accepted

Use `kind` only as a discriminant for a closed structural union, such as `TokenOrigin` or private normalized AST nodes. Do not use it for issues, ordinary authoring, strategies, or mode values.

Reserve `type` for future semantic data/token category vocabulary. A color-only package does not need redundant `type: "color"` fields.

## D-006 — Final naming family

**Status:** Accepted

```text
defineTokenGraph / defineTokenFragment
parseTokenGraph / parseColor
compileTokenGraph / buildTokenSet
exportCssVariables / serializeTokenSet / formatCssColor
convertColor / isColorInGamut / mapColorToGamut
material3Source
```

Specific option names are `variablePrefix`, `modeSelectors`, and `classPrefix`.

## D-007 — `formatVersion`, not `schemaVersion`

**Status:** Accepted

Persisted data uses numeric `formatVersion: 1`. Optional `$schema` is tooling metadata. Reject v0; do not add a v0 reader.

## D-008 — Expressions replace alias nodes

**Status:** Accepted

There is one token-definition model. A color expression is a literal/input or exact `{ ref: "token.key" }`. Mode variance wraps the same expression grammar using `valueByMode`.

**Rejected:** separate color node and alias node families.

## D-009 — `value` / `valueByMode`

**Status:** Accepted; supersedes `value` / `values`

- `value`: one expression in every mode;
- `valueByMode`: exact expression per mode;
- mutually exclusive;
- no partial fallback.

## D-010 — Mode semantics

**Status:** Accepted

A mode is one complete resolved scenario, not an independent axis. Encode combinations explicitly (`light-high-contrast`). Do not implement modifier permutation/resolver machinery in v1.

## D-011 — Identifier grammar

**Status:** Accepted

One or more lower-kebab segments; dots delimit token hierarchy. Single segment is valid. No camelCase, uppercase, Unicode, or silent normalization.

Material keys migrate from camel forms such as `m3.onPrimary` to `m3.on-primary`.

## D-012 — Fragments, not layers

**Status:** Accepted

Fragments are named JSON data included in a graph/build. They do not overlay or override. Duplicate keys and duplicate fragment IDs are issues.

**Rejected:** last-wins, first-wins, imperative `applyLayers()`, unused layer names, or field-by-field copying that drops future fields.

## D-013 — Explicit visibility and selection

**Status:** Accepted

Tokens are public/internal, inherited from graph/fragment default. Default compilation selects public tokens. `all` and exact key selection are explicit. Exact selection may include internal tokens.

Visibility is not security, redaction, or authorization.

## D-014 — Required source for `buildTokenSet`

**Status:** Accepted

`buildTokenSet()` always has a source and orchestrates source + fragments. Manual use is `compileTokenGraph(graph)`. An optional source would create conflicting mode/default configuration branches.

## D-015 — Compose once, parse once, compile once

**Status:** Accepted

Delete the current source-validate -> de-normalize -> layer -> revalidate -> compile pipeline. The internal validated compiler is private.

## D-016 — Compiled records and metadata

**Status:** Accepted

Compiled tokens are a record keyed by token key, not an array. Each selected token carries resolved `valueByMode`, explicit visibility, origin, supported metadata, and mode-specific dependencies.

## D-017 — Dependencies are transitive and mode-specific

**Status:** Accepted

`dependenciesByMode` is a unique deterministic transitive closure for each mode. Direct edges remain visible in canonical graph expressions.

## D-018 — Canonical mode and token ordering

**Status:** Closure

Canonical modes are `defaultMode` first, then remaining mode IDs sorted by UTF-16 code-unit order. Token and dependency keys use the same comparator. Exact selection and non-conflicting fragment order are not observable.

**Rationale:** explicit default first is ergonomic while code-unit sorting is locale-independent.

## D-019 — Serializer metadata inclusion

**Status:** Closure

`serializeTokenSet()` includes all compiled metadata: visibility, values, origin, `dependenciesByMode`, description, deprecation, and extensions.

**Rationale:** the serializer is a public versioned wire format for the actual `CompiledTokenSet`, not a lossy value-only export. Visibility is documented as non-secret because dependencies/origin may name internal tokens.

## D-020 — One canonical serializer

**Status:** Accepted

Keep `serializeTokenSet`; do not rename to `exportTokenSetJson`. It has no indentation/format options and returns one byte-stable JSON representation with one trailing newline.

The earlier “internal snapshot” description is superseded. A root export and recipe result made it public; v1 makes that contract explicit rather than pretending it is internal.

## D-021 — CSS exporter is fallible

**Status:** Accepted

`exportCssVariables()` returns `Result` because prefixes and selectors are dynamic validated configuration. Pure `formatCssColor()` and `serializeTokenSet()` remain total for canonical library-produced values.

## D-022 — Structured CSS strategies

**Status:** Accepted

Common mode strategies are data attribute and class. Exact selectors are supported as a validated advanced strategy. No callback `selectorForMode` or variable-name function.

Raw selector validation uses a standards-aware parser, not an ad-hoc regex.

## D-023 — Injective CSS variable names

**Status:** Accepted

Because valid token segments contain hyphens and dots delimit hierarchy, flattening both to `-` collides. Use `--` between hierarchy segments:

```text
a.b-c -> --a--b-c
a-b.c -> --a-b--c
```

No custom naming hook in v1.

## D-024 — `format: pretty | compact`

**Status:** Accepted

Replace misleading `minify`. Compact must actually remove unnecessary whitespace. Pretty/compact exact bytes are public behavior.

## D-025 — Valid color is not the same as in gamut

**Status:** Accepted

Finite encoded sRGB/P3 coordinates outside `0…1` remain representable. Parsing and conversion do not silently clip/map. Gamut membership and mapping are explicit conversion operations.

## D-026 — Root color spaces

**Status:** Accepted

Canonical root spaces are sRGB, Display-P3, and OKLCH. Alpha is straight and explicit. The package remains color-specific.

## D-027 — Concrete `parseColor()` grammar

**Status:** Accepted plus closure

Accept the documented bounded concrete grammar. Reject contextual/computed CSS. Include `color(srgb …)` as a closure decision because canonical formatting requires it for precise non-byte sRGB round trips.

## D-028 — Precision-preserving CSS colors

**Status:** Accepted

Hex only for opaque byte-aligned sRGB. No universal 8-bit conversion and no `toFixed(4)`. Preserve finite out-of-gamut coordinates.

## D-029 — Texel is a private engine

**Status:** Accepted

Use exact-pinned `@texel/color` internally for conversion/gamut operations. Do not expose its types, parser, serializer, mutable vectors, or an engine-injection interface.

**Rationale:** its conversion/gamut separation matches the model; its parser and byte-oriented sRGB serializer do not match public parsing/canonical precision requirements.

## D-030 — One package, explicit subpaths

**Status:** Accepted

Root, conversion, and Material are entry points of one package. Dependencies are normal external runtime dependencies. Root import graph remains independent, but installation includes advertised capabilities.

**Rejected:** optional peer dependency complexity and late missing-module errors.

## D-031 — Explicit gamut mapping

**Status:** Accepted

```text
convertColor(color, targetSpace)
isColorInGamut(color, targetGamut)
mapColorToGamut(color, targetGamut, { method, outputSpace? })
```

Mapping is explicitly lossy. V1 method is `preserve-lightness`. No default hidden clipping/mapping.

## D-032 — Material color bridge

**Status:** Accepted

Material accepts concrete supported colors, converts to sRGB, rejects out-of-gamut by default or maps only when explicitly configured, requires alpha 1, then quantizes to ARGB at the adapter boundary.

Rename `color` to `sourceColor`.

## D-033 — Fixed Material role inventory

**Status:** Closure

V1 emits only the current required stable role set, converted to lower-kebab keys. Omit upstream-optional dim roles (`primary-dim`, `secondary-dim`, `tertiary-dim`, `error-dim`).

**Rationale:** application fragments can safely reference a fixed documented inventory across algorithms/platforms. Conditional advertised keys are hostile to deterministic graph composition.

## D-034 — Synchronous deterministic sources

**Status:** Accepted

Sources are synchronous. Remote I/O happens before construction. Same captured JSON options produce the same graph. Do not duplicate every API into sync/async forms.

## D-035 — Source execution is contained

**Status:** Accepted

Catch thrown source/dependency exceptions and validate malformed Result objects. Preserve source-specific issue unions without widening.

## D-036 — Ownership

**Status:** Accepted

Parsed/canonical/compiled outputs do not share mutable caller-owned objects. Built-in source factories copy options at construction. Runtime freezing is optional.

## D-037 — Strict unknown fields and extensions

**Status:** Accepted

Reject typos/unknown fields. Namespaced JSON-safe `extensions` is the only metadata escape hatch. `description` and boolean/string `deprecated` are supported.

## D-038 — Raw JSON duplicate limitation

**Status:** Accepted

Object-level parsing cannot recover duplicate members discarded by `JSON.parse()`. Do not make false guarantees. A future raw-text parser is separate deferred work.

## D-039 — Issue cap

**Status:** Closure

Maximum 100 issues: first 99 actionable plus `issue-limit-reached` when truncated.

**Rationale:** deterministic bounded memory for hostile input while retaining useful aggregate diagnostics.

## D-040 — Node/tooling floor

**Status:** Accepted

Raise Node floor to 22 and test Node 22/24. Split configs, remove deprecated Vitest config, include scripts in typechecking, and validate packed artifacts.

## D-041 — Externalize dependencies and honor licenses

**Status:** Accepted

Do not bundle Material or Texel by default. Exact-pin output-sensitive dependencies. Bundling requires full third-party notices/license compliance.

## D-042 — Runtime and type surfaces are contracts

**Status:** Accepted

Runtime `Object.keys()` snapshots are insufficient. Add declaration-level API approvals for root and every subpath. No dependency-type leakage.

## D-043 — Executable documentation

**Status:** Accepted

README/public examples compile against the packed package and deterministic examples execute in CI. This prevents drift between onboarding and actual exports.

## D-044 — Publish JSON Schemas

**Status:** Accepted

Ship schemas for graph, fragment, and compiled set. Keep schemas/types/runtime parser/docs cross-tested. Runtime semantics remain authoritative beyond JSON Schema expressiveness.

## D-045 — No eager exporters in build orchestration

**Status:** Accepted

`buildTokenSet()` returns `{ graph, tokenSet }` only. CSS and JSON are explicit projections.

## D-046 — No `formatProblems`

**Status:** Accepted

An earlier audit invented this root function without a contract. It is removed from the proposed surface. Applications can format issues directly.

## D-047 — No public throwing constructors

**Status:** Accepted

Delete `srgb255()` and hidden throwing key/mode/hex assertion helpers from public API. Parsing uses Result and direct object/string authoring.

## D-048 — No public key/mode parser surface

**Status:** Accepted

Identifier parsing is internal to graph/options parsing. The final root surface omits `parseTokenKey`, `parseModeKey`, `isTokenKey`, and `isModeKey` to avoid exposing low-level grammar operations without a demonstrated user workflow.

## D-049 — Canonical issue/format/output stability

**Status:** Accepted

Issue codes/paths, CSS bytes/defaults, canonical JSON bytes, format versions, Material role/output algorithms, and color-space unions are versioned contracts after publication. Message text is not.

## Supersession map

| Earlier term/design                  | Final decision                            |
| ------------------------------------ | ----------------------------------------- |
| `Problem`, `problems`                | `Issue`, `issues`                         |
| `{ ok:false, problem }`              | `{ ok:false, issues: NonEmptyIssues }`    |
| `schemaVersion: "…/v0"`              | `formatVersion: 1`                        |
| `values`                             | `valueByMode`                             |
| color token vs alias token           | expression literal/ref in one token model |
| `compileGraph`                       | `compileTokenGraph`                       |
| `createSchemeTokens`                 | `buildTokenSet`                           |
| `createSourceGraph`                  | internalized into build pipeline          |
| `exportTokenSetJson`                 | `serializeTokenSet`                       |
| `prefix`                             | `variablePrefix` / `classPrefix`          |
| `modes` CSS option                   | `modeSelectors`                           |
| `minify`                             | `format: "compact"`                       |
| layers                               | fragments                                 |
| `m3.onPrimary`                       | `m3.on-primary`                           |
| first mode is default                | explicit `defaultMode`                    |
| internal snapshot                    | public canonical token-set wire format    |
| Texel public model/parser/serializer | private numerical adapter only            |
| optional source in high-level recipe | required source in `buildTokenSet`        |
| source role set in generic interface | fixed adapter-private Material inventory  |

## Rejected alternatives

Do not reintroduce:

- constructor-heavy authoring DSL;
- callback/nested graph builder solely for type inference;
- callbacks in CSS naming/selectors/formatting;
- global plugin registration;
- pluggable color-engine interface;
- last-wins fragments/layers;
- partial mode maps/default fallback;
- cross-mode refs;
- independent mode axes in v1;
- silent identifier normalization;
- silent color clipping/mapping;
- byte-quantized generic sRGB output;
- Texel parser/serializer as public behavior;
- unconditional eager CSS/JSON production;
- `visibility` as security;
- arbitrary raw data embedded in issues;
- locale-sensitive canonical sorting;
- optional dependency/peer setup for advertised subpaths;
- current v0 docs/tests as compatibility requirements.

## Deferred work — no placeholder API now

- independent resolver contexts/mode axes;
- computed color expressions (`mix`, alpha, contrast, etc.);
- DTCG import/export and resolver compatibility;
- raw JSON text parser with duplicate-member detection;
- asynchronous source orchestration;
- automatic wide-gamut fallback generation;
- additional color spaces/gamuts/mapping methods;
- more token data types;
- warnings/severity diagnostics;
- public explanation/resolution traces beyond origin/dependencies;
- custom CSS naming hooks;
- alternative numerical engines.

Future features must earn public surface and follow the semver policy. Do not reserve vague options or export internal abstractions “for flexibility.”

## Research/reference trail

The design conversation consulted these primary or high-value references. They are context, not external authority over this specification:

- Repository baseline: https://github.com/maikeleckelboom/color-scheme-tokens/tree/8d03d468c05e9dcbcc54759339129c55bcabbcf7
- Umbrella issue: https://github.com/maikeleckelboom/color-scheme-tokens/issues/1
- `@texel/color`: https://github.com/texel-org/color and https://www.npmjs.com/package/@texel/color
- Material Color Utilities: https://github.com/material-foundation/material-color-utilities
- CSS Color Module Level 4: https://www.w3.org/TR/css-color-4/
- CSS Custom Properties: https://www.w3.org/TR/css-variables-1/
- Design Tokens Community Group format draft: https://www.designtokens.org/tr/drafts/format/
- DTCG resolver preview (future context only): https://www.designtokens.org/tr/drafts/resolver/
- TypeScript narrowing/discriminants: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- TypeScript const type parameters: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html
- TypeScript `satisfies`: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html
- Vitest type testing: https://vitest.dev/guide/testing-types.html
- Node release schedule: https://nodejs.org/en/about/previous-releases
- Rust API Guidelines: https://rust-lang.github.io/api-guidelines/
- Joshua Bloch, “How to Design a Good API and Why it Matters”: https://www.youtube.com/watch?v=aAb7hSCtvGw
- API Extractor: https://api-extractor.com/
- `publint`: https://publint.dev/
- Are the Types Wrong: https://arethetypeswrong.github.io/

Where upstream behavior changes, re-audit rather than assuming these links still describe the pinned versions.
