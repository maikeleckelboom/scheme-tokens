# color-scheme-tokens v1 migration bible

This monolithic document combines the normative migration package for systems that prefer one context file. The section order preserves the same authority described in `README.md`. The historical conversation archive is deliberately excluded; consult `99-SOURCE-CONVERSATION-ARCHIVE.md` only for provenance.

---

---

<!-- BEGIN README.md -->

# color-scheme-tokens v1 migration package

**Prepared:** 2026-06-19  
**Repository:** `maikeleckelboom/color-scheme-tokens`  
**Audited baseline:** `8d03d468c05e9dcbcc54759339129c55bcabbcf7`  
**Status:** normative implementation brief for a greenfield, pre-publication breaking migration

This package replaces the design conversation as the durable source of truth for the `color-scheme-tokens` v1 migration. It contains the final vocabulary, data model, public API, color semantics, optional capability boundaries, migration sequence, test plan, release gate, examples, and the rationale behind accepted and rejected alternatives.

The original conversation is preserved in `99-SOURCE-CONVERSATION-ARCHIVE.md` for provenance only. It is intentionally **non-normative** because it contains earlier proposals that were later superseded.

## How to use this package with Codex

1. Copy this directory into the repository, preferably as `docs/v1-migration/`.
2. Give Codex the contents of `00-CODEX-GOAL.md` as the `/goal` instruction.
3. Keep all files available in the working tree while Codex works.
4. Do not give the conversation archive equal authority to the normative files.
5. Do not publish or tag from the automated migration run.

## Authority and precedence

When two statements appear to conflict, use this order:

1. `00-CODEX-GOAL.md` — execution contract and completion criteria.
2. `01-NORMATIVE-SPEC.md` — architecture and behavioral semantics.
3. `02-PUBLIC-API.md` — exact public vocabulary, signatures, and entry points.
4. `04-TEST-AND-RELEASE-GATE.md` — executable acceptance criteria.
5. `03-MIGRATION-PLAN.md` — implementation sequence and repository mapping.
6. `08-SEMVER-AND-MAINTENANCE.md` — post-publication compatibility policy.
7. `05-USAGE-EXAMPLES.md` — examples that must compile against the packed package.
8. `06-DECISION-LOG.md` — rationale and superseded alternatives.
9. `07-CURRENT-STATE-AUDIT.md` — audited starting state, not desired behavior.
10. `99-SOURCE-CONVERSATION-ARCHIVE.md` — historical record only.

Later normative decisions deliberately supersede earlier conversation vocabulary. In particular:

| Superseded                                                   | Final                                  |
| ------------------------------------------------------------ | -------------------------------------- |
| `Problem`, `problems`                                        | `Issue`, `issues`                      |
| `schemaVersion`                                              | `formatVersion`                        |
| `values`                                                     | `valueByMode`                          |
| `compileGraph`                                               | `compileTokenGraph`                    |
| `createSchemeTokens`                                         | `buildTokenSet`                        |
| `exportTokenSetJson`                                         | `serializeTokenSet`                    |
| generic `prefix`                                             | `variablePrefix` / `classPrefix`       |
| alias token nodes                                            | reference expressions `{ ref: "…" }`   |
| layers and overlay semantics                                 | fragments with duplicate-key rejection |
| helper DSL (`ref`, `byMode`, `publicToken`, `internalToken`) | direct JSON-safe authoring data        |

## Package contents

- `00-CODEX-GOAL.md` — paste-ready one-shot goal.
- `01-NORMATIVE-SPEC.md` — complete v1 architecture and domain contract.
- `02-PUBLIC-API.md` — exact runtime/type surface and issue catalog.
- `03-MIGRATION-PLAN.md` — phased implementation plan and deletion map.
- `04-TEST-AND-RELEASE-GATE.md` — mandatory test matrix and release checklist.
- `05-USAGE-EXAMPLES.md` — end-to-end intended API examples.
- `06-DECISION-LOG.md` — accepted decisions, rejected alternatives, future scope.
- `07-CURRENT-STATE-AUDIT.md` — current repository findings at the audited baseline.
- `08-SEMVER-AND-MAINTENANCE.md` — compatibility policy after first publication.
- `99-SOURCE-CONVERSATION-ARCHIVE.md` — complete source conversation, non-normative.
- `COLOR-SCHEME-TOKENS-V1-MIGRATION-BIBLE.md` — all normative files combined.

## Normative language

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used in their ordinary requirements sense. A MUST is an acceptance criterion, not a suggestion.

## Scope boundary

This migration produces a deterministic, color-specific token graph compiler with optional conversion and Material 3 capabilities. It does not generalize the package to typography, dimensions, arbitrary DTCG token types, asynchronous sources, global plugins, or user-injected color engines.

<!-- END README.md -->

---

<!-- BEGIN 00-CODEX-GOAL.md -->

# Codex `/goal`: complete the color-scheme-tokens v1 migration in one pass

Perform the full greenfield v1 migration of `maikeleckelboom/color-scheme-tokens` in the current working tree. Read every normative document in this directory before editing code. Treat `99-SOURCE-CONVERSATION-ARCHIVE.md` as historical evidence only; do not copy superseded APIs from it.

## Mission

Turn the unpublished `0.0.0` package into an idiomatic, deterministic, JSON-first TypeScript library whose architectural center is a generic color-token graph. Complete the migration, tests, documentation, schemas, packaging, CI, and release gates in this run. Do not stop after scaffolding or leave parallel v0/v1 implementations.

The package is greenfield and unpublished. Breaking changes are required. **Delete obsolete contracts outright. Do not add deprecated aliases, compatibility wrappers, v0 readers, migration overloads, or hidden fallback branches.**

Do not publish, tag, create a GitHub release, or change repository visibility. Keep the package’s publication safety switch/version unchanged unless the repository owner has separately instructed otherwise.

## Required reading and precedence

Read in this order:

1. `01-NORMATIVE-SPEC.md`
2. `02-PUBLIC-API.md`
3. `04-TEST-AND-RELEASE-GATE.md`
4. `03-MIGRATION-PLAN.md`
5. `08-SEMVER-AND-MAINTENANCE.md`
6. `05-USAGE-EXAMPLES.md`
7. `06-DECISION-LOG.md`
8. `07-CURRENT-STATE-AUDIT.md`

The first four are authoritative for implementation. When examples or historical text differ, implement the final names and semantics from the authoritative documents.

## Baseline and drift handling

The audit baseline is commit:

```text
8d03d468c05e9dcbcc54759339129c55bcabbcf7
```

Before editing:

```bash
git status --short
git rev-parse HEAD
pnpm install --frozen-lockfile
pnpm validate
```

If HEAD differs from the baseline, inspect all intervening changes and adapt the implementation without weakening this specification. Preserve unrelated intentional work. Do not reset, discard, or overwrite user changes. Record material drift and how it was reconciled in the final report.

If the old suite fails before edits, record the failure, determine whether it is baseline breakage or environmental, and continue with the migration. The final suite must pass.

## Non-negotiable architecture

Implement these boundaries:

```text
Manual JSON-safe graph ─┐
Custom synchronous source ─┼─> canonical parsed graph ─> compiler ─> compiled token set ─> explicit exporters
Material 3 source ────────┘

Optional conversion:
ColorValue ─> convert / gamut-test / explicit gamut-map ─> ColorValue
```

The root package MUST work fully without invoking Material 3 or color conversion. Root imports MUST NOT load `@texel/color` or `@material/material-color-utilities`. Optional capabilities use explicit subpath imports, not a plugin registry.

All public domain data and options MUST be JSON-safe plain data. The only deliberate function-valued public abstraction is synchronous `TokenSource.build()`.

## Final root runtime surface

The root entry point MUST export exactly these runtime functions, subject only to a deliberately documented addition approved by the API snapshot:

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

The conversion subpath MUST export exactly:

```text
convertColor
isColorInGamut
mapColorToGamut
```

The Material subpath MUST export exactly:

```text
material3Source
```

Do not publicly export the old constructors, validators, low-level key/mode helpers, internal compiler, layers, or dependency types.

## Final vocabulary

Use these names consistently in source, declarations, diagnostics, tests, schemas, README, examples, and generated output:

```text
Issue / issues / code / path / message
formatVersion
value / valueByMode / ref
defineTokenGraph / defineTokenFragment
parseTokenGraph / parseColor
compileTokenGraph / buildTokenSet
exportCssVariables / serializeTokenSet / formatCssColor
variablePrefix / modeSelectors / classPrefix / strategy / method / format
TokenOrigin / origin.kind / dependenciesByMode
```

`kind` is reserved for closed structural discriminants such as `TokenOrigin`; it is not an error field and does not appear in ordinary token authoring. `type` is reserved for a future semantic token/data category and is not emitted redundantly for this color-only package.

## Final data model

The public graph/fragment model is the direct JSON model:

```ts
const graph = defineTokenGraph({
  formatVersion: 1,
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "internal",
  tokens: {
    "brand.primary": {
      valueByMode: {
        light: "#6750a4",
        dark: "#d0bcff",
      },
    },
    "app.action": {
      visibility: "public",
      value: { ref: "brand.primary" },
    },
  },
});
```

Required semantics:

- `formatVersion` is numeric `1`; optional `$schema` is tooling metadata.
- A mode is one complete resolved scenario, not an independently composable axis.
- `defaultMode` is explicit and must belong to `modes`.
- `value` and `valueByMode` are mutually exclusive.
- `valueByMode` must contain every declared mode and no extra mode; there is no fallback.
- `{ ref: "token.key" }` is exact and resolves the referenced token in the current mode.
- Cross-mode references are not supported in v1.
- Tokens inherit `defaultVisibility` unless they set `visibility`.
- Public tokens may depend on internal tokens.
- Visibility controls default selection only; it is not secrecy or authorization.
- Fragments are data, have unique IDs, and never override. Any duplicate token key across graph/source/fragments is an issue.
- Exact selection may request internal tokens; empty, duplicate, or unknown exact keys are issues.
- Parsed and compiled data are owned copies and do not alias caller-owned inputs.

Identifiers use one or more dot-separated lower-kebab segments. A segment matches:

```regex
^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$
```

Token keys may contain dots; mode, source, fragment, and prefix identifiers are one segment. Never silently normalize an identifier.

## Results and diagnostics

Use one result shape everywhere a recoverable failure is possible:

```ts
interface Issue<Code extends string = string> {
  readonly code: Code;
  readonly message: string;
  readonly path?: string; // RFC 6901 JSON Pointer
}

type NonEmptyIssues<I> = readonly [I, ...I[]];

type Result<Value, I extends Issue = Issue> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly issues: NonEmptyIssues<I> };
```

Issue codes and path semantics are contractual; message wording is not. Never retain arbitrary raw input in an issue. Suppress cascade noise. Collect at most 100 issues: the first 99 actionable issues plus a final `issue-limit-reached` issue when truncation is required.

All public `parse*` functions accept `unknown` and must not throw for ordinary JSON-compatible values. Reject non-plain/accessor/exotic objects without invoking accessors. Proxies and user code that throws during fundamental reflection are outside the no-throw guarantee, but source and dependency boundaries must catch exceptions.

## Colors

Root supports canonical sRGB, Display-P3, and OKLCH values with straight alpha.

- sRGB and Display-P3 coordinates are encoded/nonlinear D65 coordinates.
- Finite RGB coordinates may be outside `0…1`; validity and gamut membership are separate.
- Alpha is finite `0…1` and canonical values always include it.
- OKLCH hue is degrees normalized to `[0, 360)`; `-0` becomes `0`; exact achromatic chroma `0` canonicalizes hue to `0`.
- Parsing never clips or gamut-maps.
- CSS formatting never clips, gamut-maps, or silently quantizes.

`parseColor()` accepts the concrete grammar documented in the spec, including hex forms, `transparent`, `rgb()`, `oklch()`, and `color(srgb …)` / `color(display-p3 …)`. Reject contextual/computed CSS such as `var()`, `currentColor`, `calc()`, relative colors, system colors, and `light-dark()`.

`formatCssColor()` emits lowercase hex only for opaque byte-aligned sRGB. Otherwise it uses precision-preserving modern CSS syntax and shortest round-trippable numbers.

## Compilation and determinism

Compose once, parse once, compile once. The validated compiler is private.

- Flatten direct tokens/fragments/source tokens into a canonical graph with explicit visibility and origin.
- Resolve references iteratively or topologically, memoized by token and mode; do not recurse per request.
- Be stack-safe for deep chains and near-linear in graph size.
- Report each unique cycle once per affected mode, deterministically.
- Compiled tokens are a record keyed by token key.
- Every compiled token contains `valueByMode`, `origin`, `dependenciesByMode`, visibility, and supported metadata.
- Dependencies are the unique transitive closure for each mode, sorted by UTF-16 code-unit order.
- Canonical token order is UTF-16 code-unit order.
- Canonical mode order is `defaultMode` first, then remaining modes in UTF-16 code-unit order.
- Selection array order is not observable in compiled or serialized output.

## CSS export

`exportCssVariables()` validates dynamic options and returns `Result<string, ExportCssVariablesIssue>`.

Use declarative configuration only:

- `variablePrefix`
- `scope` with `root` or a validated complete selector
- `modeSelectors` using `data-attribute`, `class`, or exact selector mapping
- `format: "pretty" | "compact"`

Detect missing/extra custom mode selectors and duplicate resulting selector strings. Use explicit `defaultMode`; never infer it from array position.

Token key hierarchy must map injectively to CSS custom properties. Use `--` between token hierarchy segments:

```text
app.action-text -> --theme--app--action-text
a.b-c           -> --theme--a--b-c
a-b.c           -> --theme--a-b--c
```

Pretty output has one trailing newline. Compact output is genuinely compact and has no trailing newline.

## Canonical serialization

`serializeTokenSet()` is a total projection for library-produced `CompiledTokenSet` values and emits one public, versioned canonical JSON form:

- no formatting options;
- explicit property order;
- code-unit ordering, never `localeCompare()`;
- recursively sorted extension object keys;
- normalized `-0` and finite numbers only;
- all compiled metadata included;
- exactly one trailing newline.

Semantically equivalent token sets must serialize byte-for-byte identically regardless of insertion order, fragment order, selection order, property construction order, or locale.

## Optional conversion

Use exact-pinned `@texel/color` as a private numerical adapter only. Keep it external in emitted JavaScript and absent from public declarations.

```ts
convertColor(color, targetSpace) // conversion only; no clipping/mapping
isColorInGamut(color, gamut)     // total predicate
mapColorToGamut(color, gamut, { method, outputSpace? }) // explicit lossy step
```

Carry alpha separately, allocate fresh outputs, assert finite results, and catch dependency exceptions. Do not expose a pluggable engine, Texel types, its parser, or its serializer.

## Material 3 source

`material3Source()` is isolated at `color-scheme-tokens/sources/material3` and returns a synchronous deterministic `TokenSource`.

- Rename option `color` to `sourceColor`.
- Clone/parse options at source construction; do not close over mutable caller objects.
- Accept supported concrete color inputs.
- Require alpha `1`.
- Convert to sRGB explicitly. Reject out-of-sRGB-gamut input by default; map only when an explicit `gamutMapping` method is configured.
- Quantize to 8-bit ARGB only at the Material boundary and document that loss.
- Aggregate independent option/color/key-color issues.
- Catch upstream generation exceptions.
- Emit exactly the fixed guaranteed lower-kebab `m3.*` inventory in the spec; omit unstable optional dim roles in v1.
- Generated Material tokens are internal by default.

Keep `@material/material-color-utilities` exact-pinned and external. Do not bundle Apache-2.0 code into the MIT package output.

## Packaging and tooling

- Add explicit ESM entry points for `.`, `./conversion`, and `./sources/material3`.
- Export the three versioned JSON schema files.
- Raise the Node floor to `>=22` and test Node 22 and 24.
- Externalize runtime dependencies; remove `noExternal` bundling.
- Split TypeScript configs for library/tests/scripts; library uses `types: []`.
- Remove blanket deprecation suppression and deprecated Vitest configuration.
- Include scripts in typechecking.
- Add repository/homepage/bugs/publishConfig metadata.
- Lock runtime exports and declaration exports for every entry point.
- Add executable README examples against the packed tarball.
- Add `publint`, `@arethetypeswrong/cli`, property testing, JSON-schema validation, and packed-consumer gates.
- Exclude internal plans/reviews/local paths from the published tarball.

## Mandatory deletion

Delete or replace, without aliases:

```text
ParseResult
Problem/problems vocabulary
schemaVersion v0 formats
array color/alias token-node model
compileGraph and public compileValidatedGraph
createSchemeTokens and createSourceGraph
validateGraph public export
layers/applyLayers and layer types
ref/byMode/publicToken/internalToken helpers
hex/tokenKey/modeKey/srgb255 throwing helpers
parseTokenKey/parseModeKey/isTokenKey/isModeKey root exports
roleSet leakage from generic TokenSource
legacy barrels, phase-plan tests, smoke negative checks, port-history assertions
```

Regenerate fixtures directly against v1. Do not retain tests whose only purpose is proving removed APIs stay removed; exact surface snapshots already enforce that.

## Required implementation sequence

Follow `03-MIGRATION-PLAN.md`, but finish all phases:

1. Foundation: Issue/Result, safe JSON utilities, identifiers, canonical comparators.
2. Color model/parser/formatter.
3. Graph/fragment types, helpers, parser, schemas.
4. Compiler, selection, origins, dependencies, stack-safe resolution.
5. TokenSource and `buildTokenSet` one-pass orchestration.
6. CSS and canonical JSON exporters.
7. Private Texel adapter and conversion subpath.
8. Material source rewrite and stable role inventory.
9. Public surfaces, package exports, docs, CI, release tooling.
10. Delete all residue and run the full release gate.

## Completion gate

The task is complete only when every item in `04-TEST-AND-RELEASE-GATE.md` passes, including:

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
```

The exact scripts may be reorganized, but an equivalent single command must run type checks, lint, unit/integration/type/property tests, builds, schema checks, API approvals, package linting, packed-consumer tests, documentation examples, and tarball-content checks.

Also verify:

- root import does not load optional engines;
- generated `.d.ts` files expose no private dependency types;
- all documented examples compile against the packed package with `skipLibCheck: false`;
- canonical output invariants hold under generated permutations and multiple locales;
- a 10,000-token reference chain does not overflow the stack;
- distinct valid token keys cannot collide as CSS variables;
- no caller-owned mutation changes parsed or compiled outputs;
- the tarball contains no internal migration package or source conversation.

## Final response from Codex

At completion, report:

1. the final commit/working-tree summary;
2. all public entry points and approved runtime/type manifests;
3. major files added, replaced, and deleted;
4. dependency and package changes;
5. all commands run and their results;
6. any baseline drift reconciled;
7. any deliberate implementation detail not fixed by the specification;
8. confirmation that nothing was published or tagged.

Do not report success while any mandatory gate is skipped or failing. Fix failures in the same run.

<!-- END 00-CODEX-GOAL.md -->

---

<!-- BEGIN 01-NORMATIVE-SPEC.md -->

# Normative v1 architecture and behavior specification

This document defines the intended behavior of `color-scheme-tokens` v1. It is normative. The migration is accepted only when implementation, public declarations, schemas, tests, README examples, and packed-package behavior agree with it.

## 1. Product definition

`color-scheme-tokens` is a deterministic, color-specific token graph compiler for TypeScript and JavaScript applications. Its generic core:

1. accepts authored color-token graphs as readable JSON-safe data;
2. validates and canonicalizes untrusted runtime values;
3. resolves same-mode token references;
4. selects public, all, or exact tokens;
5. produces a concrete compiled token set;
6. exports canonical JSON and validated CSS custom properties.

Optional subpaths add:

- color-space conversion and explicit gamut mapping;
- Material 3 token generation.

Optional capabilities do not define or validate the generic graph. The root is complete without invoking them.

### 1.1 Core principles

- **JSON first.** The public data model is the authoring model, not a hidden builder DSL.
- **Parse at runtime boundaries.** TypeScript types improve authoring but do not replace validation.
- **Own accepted data.** Canonical values never alias mutable caller input.
- **No silent coercion.** Reject wrong types; never turn them into strings or numbers opportunistically.
- **No silent loss.** Conversion, clipping, gamut mapping, quantization, and fallback generation are explicit.
- **Determinism is a contract.** Locale, insertion order, fragment order, mutable input, and dependency implementation details must not alter canonical results.
- **Small public surface.** No convenience function is public merely because an internal implementation needs it.
- **Greenfield cleanup.** No compatibility code for pre-v1 contracts.

### 1.2 Out of scope for v1

The following are deliberately excluded:

- typography, dimensions, spacing, shadows, gradients, or a generic all-token-type framework;
- independent mode axes or a DTCG Resolver implementation;
- arithmetic/mixing expressions beyond literals and references;
- cross-mode references;
- asynchronous sources;
- global registries or plugin installation APIs;
- user-injected color engines;
- arbitrary callbacks in graph/compiler/export options;
- a raw JSON text parser that preserves duplicate object members;
- automatic sRGB fallback generation for wide-gamut CSS;
- automatic gamut mapping;
- DTCG import/export beyond optional future work;
- v0 format readers or migration shims.

## 2. Package architecture

```text
color-scheme-tokens
  root
    authoring helpers
    graph parser
    color parser
    compiler
    source orchestration
    CSS exporter
    canonical JSON serializer
    CSS color formatter

  /conversion
    private @texel/color adapter
    conversion
    gamut membership
    explicit gamut mapping

  /sources/material3
    private Material adapter
    fixed Material role inventory
```

### 2.1 Semantic independence

The root can author, parse, compile, inspect, serialize, and export sRGB, Display-P3, and OKLCH values without conversion or Material generation. A graph may contain different color spaces in different tokens or modes.

### 2.2 Import-graph independence

Importing the root must not evaluate or load either third-party numerical engine:

```ts
import { compileTokenGraph } from "color-scheme-tokens";
```

Only explicit subpaths may load their implementation dependencies:

```ts
import { convertColor } from "color-scheme-tokens/conversion";
import { material3Source } from "color-scheme-tokens/sources/material3";
```

### 2.3 Installation behavior

A subpath is not a separately installed package. In the single-package v1 design, normal runtime dependencies are installed transitively even when a consumer imports only the root. They remain external in built JavaScript, and root modules do not import them.

Do not use optional dependencies or optional peers for advertised v1 capabilities. Those create late missing-module failures or manual setup.

### 2.4 No registry

Do not add:

```ts
registerPlugin(...)
registerColorEngine(...)
use(...)
```

Capability selection is ordinary explicit imports and values.

## 3. JSON-safe public data

Every public domain value and options object is JSON-safe, except the executable `TokenSource` capability.

Allowed recursively:

```text
null
boolean
finite number
string
array of JSON values
plain record with string keys and JSON values
```

Disallowed:

```text
undefined
NaN
Infinity / -Infinity
bigint
symbol
function
Date
Map
Set
class instance
accessor property
cyclic object graph
exotic prototype/proxy behavior
```

### 3.1 Plain object rule

Runtime parsers:

- inspect own enumerable data properties only;
- inspect property descriptors before reading values;
- accept records whose prototype is `Object.prototype` or `null`;
- reject accessors and other prototypes;
- never use prototype-chain membership to validate records;
- never merge untrusted records with unsafe `Object.assign()` or blind spread;
- allocate new normal plain objects for successful outputs.

The no-throw parser guarantee applies to ordinary JSON-compatible values. Proxies or reflection traps that throw are outside the ordinary-value guarantee. External source/dependency calls are nevertheless wrapped so their exceptions become issues.

### 3.2 Strict unknown-property policy

Unknown properties are issues. Typos must not be silently ignored:

```ts
{
  visiblity: "public", // issue: unknown-property
  value: "#fff",
}
```

The explicit metadata escape hatch is `extensions`, whose keys are namespaced and whose values are canonical JSON values.

### 3.3 Extension keys

An extension key must contain at least two dot-separated lower-kebab segments, suitable for reverse-domain ownership:

```text
com.example.design-tool
org.example.accessibility
```

Extensions are preserved by parsing, compilation, and canonical serialization. Serializer ordering of extension object keys is recursive and deterministic.

## 4. Results and issues

All recoverable public failures use one shape:

```ts
export interface Issue<Code extends string = string> {
  readonly code: Code;
  readonly message: string;
  readonly path?: string;
}

export type NonEmptyIssues<I> = readonly [I, ...I[]];

export type Result<Value, I extends Issue = Issue> =
  | {
      readonly ok: true;
      readonly value: Value;
    }
  | {
      readonly ok: false;
      readonly issues: NonEmptyIssues<I>;
    };
```

### 4.1 Vocabulary

- `Issue` is a structured recoverable validation/operation failure.
- `Error` is reserved for exceptional thrown failures in application code or truly impossible internal assertions.
- `code` is the machine-actionable discriminator.
- `message` is human-readable but not stable API.
- `path` is an RFC 6901 JSON Pointer into the relevant public input.
- `kind` is not an issue field.

### 4.2 Path rules

Use RFC 6901 escaping:

```text
~ -> ~0
/ -> ~1
```

Examples:

```text
/modes/1
/tokens/app.action/value/ref
/fragments/0/tokens/app.background/valueByMode/dark
/extensions/com.example~1legacy
```

Additional contextual fields such as `key`, `mode`, `firstPath`, `fragmentId`, `sourceId`, or `cycle` may appear on specific issue variants and are contractual when exported by that variant.

### 4.3 Non-empty failures

A failed `Result` always contains at least one issue. Remove every fallback made necessary by an optionally empty issue array.

### 4.4 Issue accumulation

Parsers aggregate independent actionable failures but suppress cascades whose prerequisites are invalid. For example, an invalid mode declaration does not also trigger dozens of secondary missing-mode issues.

Maximum output is 100 issues:

- retain the first 99 actionable issues in deterministic traversal order;
- when further issues exist, append one final `issue-limit-reached` issue;
- stop allocating additional issue objects.

### 4.5 Safe issue data

Issues must themselves be JSON-safe. Do not retain arbitrary `input: unknown`, because cyclic or huge inputs can break error formatting and cause accidental data leakage. A bounded primitive preview may be used internally only if specified and tested; it is not required.

## 5. Identifier grammar

### 5.1 Segment grammar

One identifier segment matches:

```regex
^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$
```

Consequences:

- lower-case ASCII only;
- may start only with a letter;
- digits allowed after the first character;
- single hyphens separate words;
- no leading, trailing, or consecutive hyphens;
- no camelCase, uppercase, underscores, whitespace, or Unicode;
- no silent normalization.

### 5.2 Token keys

A token key is one or more segments joined by dots:

```regex
^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*$
```

Valid:

```text
background
app.action
app.action-text
m3.surface-container-high
```

Invalid:

```text
.app.action
app..action
app.onPrimary
App.action
app_action
app.action-
```

Single-segment keys are valid.

### 5.3 Other IDs

Mode IDs, source IDs, fragment IDs, and `variablePrefix` are exactly one segment. A mode represents one complete scenario, so combinations use names such as:

```text
light
light-high-contrast
dark-high-contrast
```

`classPrefix` is a safe CSS class prefix and must end with `-`, for example `scheme-`; the portion before the final hyphen follows the segment character restrictions.

## 6. Public graph format

### 6.1 Versioning

Every graph and fragment carries:

```ts
formatVersion: 1;
```

`formatVersion` governs runtime compatibility. It is numeric and local to that persisted format.

An optional `$schema` string may provide editor tooling:

```json
{
  "$schema": "https://color-scheme-tokens.dev/schemas/token-graph.v1.json",
  "formatVersion": 1
}
```

`$schema` does not determine runtime behavior. The parser accepts it as tooling metadata and does not copy it into the canonical semantic graph.

`defineTokenGraph()` and `defineTokenFragment()` accept the same complete data shape as JSON, including `formatVersion: 1`. They are identity-style authoring helpers rather than version-injecting builders. This later decision supersedes earlier sketches in which the helpers inserted a version field.

### 6.2 Graph shape

```ts
interface TokenGraphInput<Mode extends string = string> {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly modes: readonly Mode[];
  readonly defaultMode: Mode;
  readonly defaultVisibility: "public" | "internal";
  readonly tokens: Readonly<Record<string, TokenDefinitionInput<Mode>>>;
  readonly fragments?: readonly TokenFragmentInput<Mode>[];
}
```

Requirements:

- `modes` is non-empty and contains unique valid mode IDs.
- `defaultMode` is one declared mode.
- Direct tokens may be empty, including when fragments supply all declarations.
- Unknown top-level fields are issues.
- Fragment array order does not affect successful semantic output.

### 6.3 Fragment shape

```ts
interface TokenFragmentInput<Mode extends string = string> {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly id: string;
  readonly defaultVisibility: "public" | "internal";
  readonly tokens: Readonly<Record<string, TokenDefinitionInput<Mode>>>;
}
```

Fragments do not redeclare modes or default mode. They are composed into a graph/source context whose modes determine `valueByMode` completeness.

Fragment IDs are unique across a composition. Duplicate IDs are issues even when their token keys do not collide, because origin metadata would be ambiguous.

### 6.4 Token definition

A token definition contains metadata plus exactly one value form:

```ts
type TokenDefinitionInput<Mode extends string = string> = {
  readonly visibility?: "public" | "internal";
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
} & (
  | {
      readonly value: ColorExpressionInput;
      readonly valueByMode?: never;
    }
  | {
      readonly value?: never;
      readonly valueByMode: Readonly<Record<Mode, ColorExpressionInput>>;
    }
);
```

Rules:

- `value` applies the same expression to every mode.
- `valueByMode` contains exactly all declared modes and no others.
- Supplying both or neither is an issue.
- There is no implicit fallback to `defaultMode`.
- `visibility` defaults to the containing graph/fragment default.
- `description` is unrestricted Unicode text.
- `deprecated: true` marks without explanation; a string provides explanation.
- Empty deprecation strings are rejected.
- Unknown token-definition fields are issues.

### 6.5 Expressions

```ts
interface ReferenceInput {
  readonly ref: string;
}

type ColorExpressionInput = ColorInput | ReferenceInput;
```

A reference object is exact. It contains only a string `ref` field. Extra fields, numeric refs, nested selectors, and cross-mode fields are issues.

Reference semantics:

- resolve the target token for the current mode;
- target may be public or internal;
- target must exist;
- cycles are invalid;
- cross-mode references are not supported;
- reference strings are token keys, not JSON Pointer/URI references;
- do not use `$ref`.

### 6.6 Composition and duplicates

All declarations form one namespace. Reject every duplicate token key across:

```text
direct graph vs direct graph
source vs caller fragment
source vs source-owned fragment
source-owned fragment vs caller fragment
graph direct token vs graph fragment
fragment vs fragment
```

Never use first-wins or last-wins behavior. A duplicate issue includes the new path and the first declaration path.

Duplicate member names in raw JSON text cannot be recovered after `JSON.parse()`. `parseTokenGraph(input: unknown)` must not claim to detect duplicates discarded by an external parser. A future raw-text `parseTokenGraphJson()` is separate scope.

## 7. Authoring helpers and runtime parser

### 7.1 `defineTokenGraph()`

This is a TypeScript authoring helper. It:

- preserves literal mode and token-key inference;
- checks direct `valueByMode` maps against the graph’s inferred mode tuple where TypeScript can do so;
- checks `defaultMode` against inferred modes;
- rejects obvious structural mistakes at compile time;
- returns the same ordinary JSON-safe object;
- performs no authoritative runtime validation;
- adds no symbols, methods, classes, brands, or hidden metadata.

Use `const` type parameters and `NoInfer` or an equivalent implementation. Add type tests for error quality, literal preservation, large token records, and emitted declarations under the repository’s pinned TypeScript.

A separately defined fragment cannot know a future graph/source’s full mode set. `defineTokenFragment()` preserves structure and keys, while mode completeness is authoritative when the fragment is composed and parsed. Do not overpromise standalone compile-time mode completeness.

### 7.2 `parseTokenGraph()`

```ts
parseTokenGraph(input: unknown): Result<TokenGraph, TokenGraphIssue>
```

It is the runtime boundary for JSON, JavaScript, config files, and network data. It:

1. validates structure and unknown fields;
2. validates JSON-safety and identifiers;
3. parses colors into canonical owned `ColorValue` objects;
4. expands `value` into every mode;
5. validates exact mode maps;
6. applies explicit inherited visibility;
7. flattens fragments;
8. records origins;
9. detects duplicate declarations;
10. validates targets and cycles per mode;
11. returns a newly allocated canonical graph.

Canonical `TokenGraph` has no `fragments`, no `$schema`, no omitted visibility, and no `value` shorthand. Every token has explicit `valueByMode` and origin.

The parser must not use `String()`, numeric coercion, truthiness as type validation, or assertions that can throw on ordinary malformed input.

## 8. Canonical graph and origins

```ts
type TokenOrigin =
  | { readonly kind: "graph" }
  | { readonly kind: "fragment"; readonly id: string }
  | {
      readonly kind: "source";
      readonly id: string;
      readonly sourceToken?: string;
    };
```

`kind` is correct here because origin is a closed structural union. It is not used in user-authored token expressions.

A canonical graph token contains:

```ts
interface TokenGraphToken {
  readonly visibility: "public" | "internal";
  readonly valueByMode: Readonly<Record<string, ColorExpression>>;
  readonly origin: TokenOrigin;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}
```

The canonical public expression representation remains JSON-simple:

```ts
type ColorExpression = ColorValue | { readonly ref: string };
```

Internal compiler nodes may use a `kind`-tagged AST, but those types are not public.

## 9. Compilation

### 9.1 `compileTokenGraph()`

This is the combined public parse-and-compile boundary:

```ts
compileTokenGraph(
  input: unknown,
  options?: CompileTokenGraphOptions,
): Result<CompiledTokenSet, TokenGraphIssue | CompileTokenGraphIssue>
```

It accepts unknown at runtime so JavaScript/JSON callers receive structured issues rather than crashes. Typed callers normally pass a value from `defineTokenGraph()`.

The internal compiler accepts only canonical `TokenGraph` and is not exported.

### 9.2 Selection

```ts
type TokenSelection = "public" | "all" | { readonly keys: readonly string[] };
```

Rules:

- default is `"public"`;
- `"public"` selects all public tokens;
- `"all"` selects all tokens;
- exact selection selects those keys regardless of visibility;
- exact selection must contain at least one key;
- exact keys must be valid, unique, and present;
- selection order does not determine output order;
- internal dependencies of selected tokens always resolve;
- if selection yields no tokens, return `no-selected-tokens` rather than a misleading successful empty artifact.

Visibility is convenience, not confidentiality. Exact selection can request internal values. Origin and dependency metadata can reveal internal token names in canonical JSON.

### 9.3 Resolution

For each `(token, mode)`:

- resolve literal immediately;
- follow references in the same mode;
- memoize results;
- track dependencies;
- do not recursively recompute from each selected token;
- do not use call-stack recursion for unbounded chains.

An iterative depth-first algorithm, explicit stack, topological pass, or equivalent stack-safe approach is acceptable. Complexity should be near-linear in the number of token-mode nodes and reference edges.

Cycle reporting:

- detect per mode;
- canonicalize a cycle representation so each unique cycle appears once per mode;
- issue order and cycle order are deterministic under token insertion permutations;
- include the affected mode and canonical cycle key list.

### 9.4 Compiled token set

```ts
interface CompiledToken {
  readonly visibility: "public" | "internal";
  readonly valueByMode: Readonly<Record<string, ColorValue>>;
  readonly origin: TokenOrigin;
  readonly dependenciesByMode: Readonly<Record<string, readonly string[]>>;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

interface CompiledTokenSet {
  readonly formatVersion: 1;
  readonly modes: readonly string[];
  readonly defaultMode: string;
  readonly tokens: Readonly<Record<string, CompiledToken>>;
}
```

Dependencies are the deterministic transitive closure excluding the token itself. For `a -> b -> c`, dependencies are:

```text
a: [b, c]
b: [c]
c: []
```

They are unique and code-unit sorted for each mode.

### 9.5 Canonical order

The semantic/canonical order is:

- modes: `defaultMode`, then all other modes in UTF-16 code-unit order;
- token keys: UTF-16 code-unit order;
- dependency keys: UTF-16 code-unit order;
- record keys in serialized metadata/extensions: UTF-16 code-unit order.

Use a comparator equivalent to:

```ts
const compareCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
```

Never use `localeCompare()` or `Intl.Collator` for canonical data.

## 10. Source orchestration

### 10.1 `TokenSource`

```ts
interface TokenSource<I extends Issue = Issue> {
  readonly id: string;
  build(): Result<TokenGraphInput, I>;
}
```

A source is synchronous and deterministic for the JSON-safe options captured at construction.

Remote I/O occurs before source construction:

```ts
const data = await fetch(url).then((response) => response.json());
const source = customSource({ data });
```

Do not add async variants in v1.

The generic source contract has no Material role set or adapter-specific metadata.

### 10.2 Source boundary containment

`buildTokenSet()` validates source ID, invokes `build()` exactly once, and catches thrown exceptions. It rejects malformed result objects, empty/malformed issue arrays, non-JSON issue payloads, and malformed graphs with stable wrapper issues.

Source-specific issue unions remain generic and narrowable; do not widen them to `string` discriminants.

### 10.3 `buildTokenSet()`

```ts
buildTokenSet({
  source,
  fragments,
  selection,
});
```

`source` is required. Manual graphs use `compileTokenGraph()` instead.

Pipeline:

```text
source.build()
  -> combine source data and caller fragments without overwrites
  -> parse/canonicalize once with source/fragment origins
  -> compile internally once
  -> return { graph, tokenSet }
```

It does not eagerly generate CSS or JSON.

Source-produced tokens receive source origin. Caller fragments receive fragment origin. The Material adapter may set `sourceToken` to the upstream role name.

## 11. Color model

### 11.1 Supported canonical spaces

```text
srgb
display-p3
oklch
```

Canonical values always include straight/unpremultiplied alpha:

```ts
interface SrgbColor {
  readonly colorSpace: "srgb";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

interface DisplayP3Color {
  readonly colorSpace: "display-p3";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

interface OklchColor {
  readonly colorSpace: "oklch";
  readonly l: number;
  readonly c: number;
  readonly h: number;
  readonly alpha: number;
}
```

### 11.2 Coordinate semantics

- `srgb` and `display-p3` use encoded/nonlinear coordinates relative to D65.
- RGB coordinates must be finite but may be below `0` or above `1`.
- Such RGB colors are valid values but may be outside the named gamut.
- `oklch.l` is finite; it is not silently clamped.
- `oklch.c` is finite and non-negative.
- `oklch.h` is finite input and canonicalized modulo 360 to `[0, 360)`.
- exact `c === 0` canonicalizes `h` to `0`; no hidden epsilon is used.
- every `-0` coordinate canonicalizes to `0`.
- alpha is finite and in `[0, 1]`.
- missing alpha defaults to `1` on input and is always explicit canonically.

Allowing finite extended coordinates prevents conversion from being conflated with display-gamut clipping. CSS projection may have browser-level clipping behavior, but the library does not alter the stored coordinates.

### 11.3 Color object input

Accepted object variants have exact known properties. Unknown properties are issues. Objects are copied into canonical values.

### 11.4 Concrete string grammar

`parseColor(input: unknown)` accepts ASCII case-insensitive function/keyword names and standard ASCII whitespace for these concrete forms:

1. Hex:

```text
#rgb
#rgba
#rrggbb
#rrggbbaa
```

A leading `#` is required. Canonical hex parsing is sRGB.

2. Keyword:

```text
transparent
```

Canonical value is transparent black sRGB.

3. `rgb()`:

- modern space-separated syntax;
- legacy comma syntax;
- channels may be numbers on the 0–255 scale or percentages;
- alpha may be a number or percentage;
- mixed legacy delimiter forms are rejected;
- values are normalized to encoded sRGB coordinates and are not gamut-clamped.

4. `oklch()`:

- modern space-separated syntax;
- lightness number or percentage;
- chroma number (percentage support may be implemented only if mapped to the CSS Color 4 reference range and covered by tests);
- hue unitless degrees or `deg`;
- optional `/` alpha number or percentage.

5. `color()`:

```text
color(srgb r g b [ / a ])
color(display-p3 r g b [ / a ])
```

Components may be finite numbers or percentages according to the documented normalization. The `srgb` form is required because canonical formatting emits it for non-byte-aligned or translucent sRGB.

Explicitly reject in v1:

```text
currentColor
named colors other than transparent
system colors
var(...)
light-dark(...)
relative color syntax
calc(...)
color-mix(...)
none/missing components
lab/lch/oklab/hsl/hwb/device-cmyk
```

Rejecting these keeps `ColorValue` context-free and concrete.

### 11.5 `formatCssColor()`

For a canonical `ColorValue`:

- opaque sRGB with all channels exactly byte-aligned -> lowercase `#rrggbb`;
- every other sRGB -> `color(srgb r g b)` with optional `/ alpha`;
- Display-P3 -> `color(display-p3 r g b)` with optional `/ alpha`;
- OKLCH -> `oklch(l c h)` with optional `/ alpha`;
- omit `/ 1`;
- normalize `-0`;
- use shortest round-trippable decimal text;
- exponent notation is permitted where JavaScript’s canonical number string requires it;
- do not call `toFixed()`;
- do not clip, map, or quantize.

A value is byte-aligned when each channel is exactly equal to `round(channel * 255) / 255` and the rounded byte is in `0…255`.

## 12. Conversion subpath

### 12.1 Dependency boundary

Use exact-pinned `@texel/color` version `1.1.11` for the audited migration, unless repository drift already contains an explicitly reviewed replacement. Any version change requires re-running all numerical/golden tests before acceptance.

It is:

- a normal external runtime dependency;
- imported only by private conversion adapter modules;
- not used as public color types;
- not used for public parsing;
- not used for canonical CSS formatting;
- absent from generated public declaration signatures.

### 12.2 API semantics

```ts
convertColor(color, targetSpace);
```

- colorimetric conversion only;
- no clipping;
- no gamut mapping;
- preserve alpha exactly;
- return a fresh canonical object;
- return an issue if dependency output is non-finite or not representable.

```ts
isColorInGamut(color, gamut);
```

- total predicate for canonical colors;
- no mutation;
- supported gamuts are sRGB and Display-P3.

```ts
mapColorToGamut(color, gamut, { method, outputSpace? })
```

- explicitly lossy;
- `gamut` is the target physical gamut;
- `outputSpace` is the coordinate representation, defaulting to the target gamut’s RGB space;
- v1 method name is `"preserve-lightness"`;
- result must satisfy the selected gamut postcondition within the documented numerical tolerance.

### 12.3 Adapter safety

- map the package’s closed space union exhaustively to selected Texel constants;
- copy coordinates into fresh arrays;
- provide a fresh output array to APIs that support output buffers;
- copy results into owned objects;
- carry alpha outside the three-coordinate conversion;
- catch dependency exceptions at one adapter boundary;
- never retain dependency arrays;
- avoid exposing shared scratch-buffer or callback behavior;
- assert all result coordinates are finite.

## 13. Material 3 source

### 13.1 Dependency policy

Keep exact-pinned `@material/material-color-utilities` version `0.4.0` for the audited migration unless reviewed drift intentionally changes it. Externalize it from emitted JavaScript. Because it is Apache-2.0, do not redistribute bundled source under only the package’s MIT license.

### 13.2 Source contract

```ts
material3Source(options): TokenSource<Material3SourceIssue>
```

Source ID:

```text
material3
```

Generated graph:

```text
modes: [light, dark]
defaultMode: light
defaultVisibility: internal
```

The source factory parses and copies options immediately. Mutating the caller’s options later must not affect `build()`.

### 13.3 Options

```ts
interface Material3SourceOptions {
  readonly sourceColor: ColorInput;
  readonly keyColors?: {
    readonly primary?: ColorInput;
    readonly secondary?: ColorInput;
    readonly tertiary?: ColorInput;
    readonly neutral?: ColorInput;
    readonly neutralVariant?: ColorInput;
  };
  readonly algorithm?: {
    readonly variant?: "tonalSpot" | "vibrant" | "expressive" | "neutral";
    readonly contrastLevel?: number;
    readonly specVersion?: "2021" | "2025";
    readonly platform?: "phone" | "watch";
  };
  readonly gamutMapping?: {
    readonly method: "preserve-lightness";
  };
}
```

Defaults remain:

```text
variant: tonalSpot
contrastLevel: 0
specVersion: 2021
platform: phone
```

### 13.4 Color bridge

For source and key colors:

1. parse to canonical `ColorValue`;
2. require alpha `1`;
3. convert to sRGB without clipping;
4. test sRGB gamut;
5. if out of gamut and no `gamutMapping`, return an issue;
6. if mapping configured, map explicitly with that method;
7. quantize in-gamut sRGB to 8-bit ARGB at the adapter boundary;
8. invoke upstream Material generation.

The ARGB quantization is intentionally lossy and adapter-specific. It is not generic color normalization.

Aggregate independent algorithm, source-color, and key-color issues. Catch upstream exceptions as `material3-generation-failed` with no raw exception object in public issue data.

### 13.5 Fixed stable inventory

V1 emits exactly these guaranteed lower-kebab keys, each prefixed `m3.`:

```text
primary-palette-key-color
secondary-palette-key-color
tertiary-palette-key-color
neutral-palette-key-color
neutral-variant-palette-key-color
error-palette-key-color
background
on-background
surface
surface-dim
surface-bright
surface-container-lowest
surface-container-low
surface-container
surface-container-high
surface-container-highest
on-surface
surface-variant
on-surface-variant
inverse-surface
inverse-on-surface
outline
outline-variant
shadow
scrim
surface-tint
primary
on-primary
primary-container
on-primary-container
inverse-primary
secondary
on-secondary
secondary-container
on-secondary-container
tertiary
on-tertiary
tertiary-container
on-tertiary-container
error
on-error
error-container
on-error-container
primary-fixed
primary-fixed-dim
on-primary-fixed
on-primary-fixed-variant
secondary-fixed
secondary-fixed-dim
on-secondary-fixed
on-secondary-fixed-variant
tertiary-fixed
tertiary-fixed-dim
on-tertiary-fixed
on-tertiary-fixed-variant
```

Do not emit upstream-optional `primary-dim`, `secondary-dim`, `tertiary-dim`, or `error-dim` in v1. A fixed inventory is preferable to conditional advertised references.

Every role must exist for both modes under every supported algorithm option combination. Tests lock the inventory and representative values.

## 14. CSS custom-property export

### 14.1 Failure model

`exportCssVariables()` returns `Result` because it validates dynamic prefixes and selectors. It never interpolates unchecked configuration into CSS.

### 14.2 Options

```ts
interface ExportCssVariablesOptions {
  readonly variablePrefix?: string;
  readonly scope?:
    | { readonly strategy: "root" }
    | { readonly strategy: "selector"; readonly selector: string };
  readonly modeSelectors?:
    | {
        readonly strategy: "data-attribute";
        readonly attribute: string;
      }
    | {
        readonly strategy: "class";
        readonly classPrefix: string;
      }
    | {
        readonly strategy: "selectors";
        readonly selectors: Readonly<Record<string, string>>;
      };
  readonly format?: "pretty" | "compact";
}
```

Defaults:

```text
variablePrefix: absent
scope: { strategy: "root" }
modeSelectors: { strategy: "data-attribute", attribute: "data-color-scheme" }
format: "pretty"
```

### 14.3 Selector semantics

For `data-attribute` and `class` strategies:

- default mode uses only the scope selector;
- each non-default mode appends the mode selector to the scope;
- mode IDs are safe lower-kebab identifiers and are escaped for their CSS context anyway.

For exact `selectors` strategy:

- the map contains every mode and no extra mode;
- each value is a complete selector;
- `scope` must be omitted to avoid ambiguous composition;
- resulting selector strings must be unique;
- each selector must be parsed/validated by a standards-aware selector parser, not a home-grown “no braces” regex.

A `scope.strategy: "selector"` value is also validated with the same parser. Pin and isolate any parser dependency, and test rejection of selector-list injection, declaration injection, malformed escapes, and braces/semicolons.

Data-attribute names must be safe custom data attributes beginning with `data-`. Class prefixes must satisfy the grammar in section 5.

### 14.4 Variable naming

Split a token key at dots. Preserve lower-kebab spelling within each segment. Join hierarchy segments with `--`, and place an optional prefix as the first segment:

```text
background + no prefix       -> --background
app.action + no prefix       -> --app--action
app.action-text + theme      -> --theme--app--action-text
a.b-c + theme                -> --theme--a--b-c
a-b.c + theme                -> --theme--a-b--c
```

This mapping is injective under the identifier grammar. No callback/custom naming function is available in v1.

### 14.5 Output ordering and layout

- block order: default mode first, then remaining canonical modes;
- declaration order: canonical token key order;
- value text: `formatCssColor()`;
- pretty: two-space declaration indent, one blank line between blocks, exactly one final newline;
- compact: no unnecessary whitespace and no final newline;
- empty blocks are not emitted; a compiled set cannot be empty under normal selection.

## 15. Canonical token-set serialization

`serializeTokenSet(tokenSet)` is the public wire-format serializer for library-produced compiled sets.

It includes:

```text
formatVersion
modes
defaultMode
tokens
  visibility
  valueByMode
  origin
  dependenciesByMode
  description, if present
  deprecated, if present
  extensions, if present
```

Canonical property order:

1. top level: `formatVersion`, `modes`, `defaultMode`, `tokens`;
2. token: `visibility`, `valueByMode`, `origin`, `dependenciesByMode`, `description`, `deprecated`, `extensions`;
3. origin: `kind`, then `id`, then `sourceToken` where applicable;
4. colors:
   - sRGB/P3: `colorSpace`, `r`, `g`, `b`, `alpha`;
   - OKLCH: `colorSpace`, `l`, `c`, `h`, `alpha`;
5. all free-form record keys recursively code-unit sorted.

Numbers:

- reject/non-produce non-finite values before this stage;
- normalize `-0` to `0`;
- use JSON’s shortest round-trippable number representation;
- do not round to an arbitrary decimal count.

The result has exactly one trailing newline. There are no indentation or compactness options. Consumers who want presentation formatting may parse and reformat a copy, which is not the canonical wire format.

## 16. Ownership and mutation

Successful parsing and source construction copy all accepted public data, including:

```text
colors
mode maps
token maps
fragment maps
metadata
extensions
source options
provenance/origin source strings
selector maps where retained
```

Mutation tests must prove:

- changing original graph input does not change `TokenGraph`;
- changing original color input does not change `ColorValue`;
- changing source options after `material3Source()` does not change future builds;
- compiled token values do not share object identities with authored values;
- conversion output does not alias input or dependency buffers.

Runtime deep-freezing is optional and not a public guarantee. Ownership is required.

## 17. Public schemas

Ship versioned JSON Schemas for:

```text
schemas/token-graph.v1.schema.json
schemas/token-fragment.v1.schema.json
schemas/compiled-token-set.v1.schema.json
```

Schemas must:

- use `additionalProperties: false` except at defined record/extension boundaries;
- encode `value`/`valueByMode` exclusivity;
- encode color object exactness and metadata types;
- document that exact mode-key equality and reference/cycle semantics require runtime validation beyond JSON Schema;
- agree with examples and TypeScript types;
- be included in package exports and tarball.

Tests validate all examples against schemas and validate known-invalid fixtures are rejected. Runtime parser remains authoritative for semantic constraints JSON Schema cannot express.

## 18. Determinism and performance guarantees

The following are observable contracts:

- no canonical operation depends on locale;
- record insertion order is never used as semantic order;
- non-conflicting fragment reordering does not alter canonical graph/token set/serialized bytes;
- exact selection order does not alter output order;
- property construction order does not alter serialized bytes;
- source called once per build;
- same source/options/input produces the same graph and token set;
- a 10,000-token acyclic reference chain compiles without stack overflow;
- resolution is memoized/near-linear;
- cycle reporting is stable and deduplicated;
- CSS naming is injective for all valid keys;
- formatter/parser round trips stay within the exact/tolerance rules specified by each format.

## 19. Trust boundaries and throws

Public functions fall into two categories.

### 19.1 Fallible boundaries returning `Result`

```text
parseTokenGraph
parseColor
compileTokenGraph
buildTokenSet
exportCssVariables
convertColor
mapColorToGamut
material3Source(...).build
```

These return structured issues for recoverable invalid input/config/dependency failures.

### 19.2 Total projections/predicates on canonical values

```text
formatCssColor
serializeTokenSet
isColorInGamut
```

They are total for canonical values produced by this package. Forged malformed objects that merely satisfy a structural TypeScript assertion are outside their supported input contract. Public docs must say this explicitly rather than pretending TypeScript structural types create runtime brands.

Internal invariant failures may throw, but tests should make them unreachable through supported public input.

<!-- END 01-NORMATIVE-SPEC.md -->

---

<!-- BEGIN 02-PUBLIC-API.md -->

# Normative public API and declaration contract

This document freezes the intended v1 public vocabulary, entry points, observable type behavior, and issue-code families. Internal module names and implementation helpers may differ, but generated declarations and packed-package behavior must conform.

## 1. Entry points

The package is ESM-only and has no default exports.

### 1.1 Root: `color-scheme-tokens`

Runtime exports, exactly:

```ts
defineTokenGraph;
defineTokenFragment;
parseTokenGraph;
parseColor;
compileTokenGraph;
buildTokenSet;
exportCssVariables;
serializeTokenSet;
formatCssColor;
```

### 1.2 Conversion: `color-scheme-tokens/conversion`

Runtime exports, exactly:

```ts
convertColor;
isColorInGamut;
mapColorToGamut;
```

### 1.3 Material: `color-scheme-tokens/sources/material3`

Runtime exports, exactly:

```ts
material3Source;
```

### 1.4 Schemas

Export these JSON files explicitly:

```text
color-scheme-tokens/schemas/token-graph.v1.schema.json
color-scheme-tokens/schemas/token-fragment.v1.schema.json
color-scheme-tokens/schemas/compiled-token-set.v1.schema.json
```

### 1.5 Forbidden public runtime exports

The following remain internal or are deleted:

```text
validateGraph
compileValidatedGraph
createSourceGraph
applyLayers
ref
byMode
publicToken
internalToken
hex
srgb255
tokenKey
modeKey
parseTokenKey
parseModeKey
isTokenKey
isModeKey
literalColor
formatProblems
```

Do not export dependency re-exports, constants from Texel/Material utilities, internal schema constants, comparators, unsafe assertion constructors, parser combinators, or AST nodes.

## 2. Root type-export manifest

The root may export exactly these public type names. Non-exported declaration helpers may appear in `.d.ts` output only when API Extractor rolls them into the approved declaration and they do not become importable named exports.

```text
JsonPrimitive
JsonValue

Issue
NonEmptyIssues
Result

ColorSpace
ColorInput
ColorValue
SrgbColorInput
DisplayP3ColorInput
OklchColorInput
SrgbColor
DisplayP3Color
OklchColor
ParseColorIssue

TokenVisibility
ReferenceInput
ColorExpressionInput
ColorExpression
TokenDefinitionInput
TokenFragmentInput
TokenGraphInput
TokenOrigin
TokenGraphToken
TokenGraph
TokenGraphIssue

TokenSelection
CompileTokenGraphOptions
CompileTokenGraphIssue
CompiledToken
CompiledTokenSet

TokenSource
BuildTokenSetOptions
BuildTokenSetValue
BuildTokenSetIssue

CssScope
CssModeSelectors
ExportCssVariablesOptions
ExportCssVariablesIssue
```

Do not export branded string types, redundant input aliases, duplicate result aliases, internal normalized expression types, or generic source role metadata.

## 3. Root declarations

The following declarations are normative at the semantic level. The exact generic machinery for better diagnostics may vary, but it must preserve the indicated assignability, literals, and runtime behavior.

### 3.1 JSON values

```ts
export type JsonPrimitive = null | boolean | number | string;

export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
```

Runtime validation additionally requires numbers to be finite and object graphs to be acyclic plain data.

### 3.2 Issues and Results

```ts
export interface Issue<Code extends string = string> {
  readonly code: Code;
  readonly message: string;
  readonly path?: string;
}

export type NonEmptyIssues<I> = readonly [I, ...I[]];

export type Result<Value, I extends Issue = Issue> =
  | {
      readonly ok: true;
      readonly value: Value;
    }
  | {
      readonly ok: false;
      readonly issues: NonEmptyIssues<I>;
    };
```

A failure never has `value`; a success never has `issues`. Do not add a singular `issue` form.

### 3.3 Color inputs and values

```ts
export type ColorSpace = "srgb" | "display-p3" | "oklch";

export interface SrgbColorInput {
  readonly colorSpace: "srgb";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha?: number;
}

export interface DisplayP3ColorInput {
  readonly colorSpace: "display-p3";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha?: number;
}

export interface OklchColorInput {
  readonly colorSpace: "oklch";
  readonly l: number;
  readonly c: number;
  readonly h: number;
  readonly alpha?: number;
}

export type ColorInput = string | SrgbColorInput | DisplayP3ColorInput | OklchColorInput;

export interface SrgbColor {
  readonly colorSpace: "srgb";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

export interface DisplayP3Color {
  readonly colorSpace: "display-p3";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

export interface OklchColor {
  readonly colorSpace: "oklch";
  readonly l: number;
  readonly c: number;
  readonly h: number;
  readonly alpha: number;
}

export type ColorValue = SrgbColor | DisplayP3Color | OklchColor;
```

### 3.4 Color issues

```ts
export type ParseColorIssue = Issue<
  | "invalid-color-input"
  | "unsupported-color-syntax"
  | "invalid-color-space"
  | "missing-color-property"
  | "unknown-color-property"
  | "invalid-color-component"
> & {
  readonly component?: string;
  readonly colorSpace?: string;
};
```

`invalid-color-component` covers wrong type, non-finite coordinate, invalid alpha, negative OKLCH chroma, and malformed numeric text; `message` supplies detail. This avoids an excessively granular code union while preserving stable machine categories.

### 3.5 Graph authoring types

```ts
export type TokenVisibility = "public" | "internal";

export interface ReferenceInput {
  readonly ref: string;
}

export type ColorExpressionInput = ColorInput | ReferenceInput;

export type ColorExpression = ColorValue | ReferenceInput;

export type TokenDefinitionInput<Mode extends string = string> = {
  readonly visibility?: TokenVisibility;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
} & (
  | {
      readonly value: ColorExpressionInput;
      readonly valueByMode?: never;
    }
  | {
      readonly value?: never;
      readonly valueByMode: Readonly<Record<Mode, ColorExpressionInput>>;
    }
);

export interface TokenFragmentInput<Mode extends string = string> {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<string, TokenDefinitionInput<Mode>>>;
}

export interface TokenGraphInput<Mode extends string = string> {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<string, TokenDefinitionInput<Mode>>>;
  readonly fragments?: readonly TokenFragmentInput<Mode>[];
}
```

The apparent `Record` type does not weaken runtime exactness. Runtime parsing rejects unknown mode keys and unknown fields.

### 3.6 Authoring helpers

Required observable behavior:

```ts
export function defineTokenGraph<
  const Modes extends readonly [string, ...string[]],
  const Tokens extends Readonly<Record<string, TokenDefinitionInput<NoInfer<Modes[number]>>>>,
  const Fragments extends readonly TokenFragmentInput<NoInfer<Modes[number]>>[] | undefined =
    undefined,
>(input: {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly modes: Modes;
  readonly defaultMode: Modes[number];
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Tokens;
  readonly fragments?: Fragments;
}): {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly modes: Modes;
  readonly defaultMode: Modes[number];
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Tokens;
  readonly fragments?: Fragments;
};

export function defineTokenFragment<
  const Mode extends string = string,
  const Tokens extends Readonly<Record<string, TokenDefinitionInput<Mode>>> = Readonly<
    Record<string, TokenDefinitionInput<Mode>>
  >,
>(input: {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Tokens;
}): {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Tokens;
};
```

The implementation may use overloads/intersections to improve inference. It MUST:

- preserve literal modes, default mode, IDs, and token keys;
- reject a direct graph token’s missing/extra `valueByMode` key when context permits;
- reject an invalid direct `defaultMode` at type level;
- preserve a separately defined fragment’s literal keys;
- not promise standalone fragment mode completeness;
- return plain data with identity-equivalent content.

### 3.7 Canonical graph types

```ts
export type TokenOrigin =
  | {
      readonly kind: "graph";
    }
  | {
      readonly kind: "fragment";
      readonly id: string;
    }
  | {
      readonly kind: "source";
      readonly id: string;
      readonly sourceToken?: string;
    };

export interface TokenGraphToken {
  readonly visibility: TokenVisibility;
  readonly valueByMode: Readonly<Record<string, ColorExpression>>;
  readonly origin: TokenOrigin;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export interface TokenGraph {
  readonly formatVersion: 1;
  readonly modes: readonly [string, ...string[]];
  readonly defaultMode: string;
  readonly tokens: Readonly<Record<string, TokenGraphToken>>;
}
```

### 3.8 Graph issue codes

```ts
export type TokenGraphIssue =
  | ParseColorIssue
  | (Issue<
      | "invalid-object"
      | "unknown-property"
      | "missing-property"
      | "invalid-format-version"
      | "invalid-schema-uri"
      | "invalid-json-value"
      | "empty-modes"
      | "invalid-mode-key"
      | "duplicate-mode-key"
      | "default-mode-not-found"
      | "invalid-default-visibility"
      | "invalid-fragment-id"
      | "duplicate-fragment-id"
      | "invalid-token-key"
      | "duplicate-token-key"
      | "invalid-visibility"
      | "invalid-token-definition"
      | "missing-token-value"
      | "conflicting-token-value"
      | "missing-mode-value"
      | "unknown-mode-value"
      | "invalid-reference"
      | "unknown-reference"
      | "reference-cycle"
      | "invalid-description"
      | "invalid-deprecated"
      | "invalid-extensions"
      | "invalid-extension-key"
      | "issue-limit-reached"
    > & {
      readonly key?: string;
      readonly mode?: string;
      readonly fragmentId?: string;
      readonly firstPath?: string;
      readonly cycle?: readonly string[];
    });
```

A code should not be emitted when a more primary prerequisite issue makes it meaningless. For example, malformed `modes` suppress derived missing-mode issues.

### 3.9 Parsing

```ts
export function parseColor(input: unknown): Result<ColorValue, ParseColorIssue>;

export function parseTokenGraph(input: unknown): Result<TokenGraph, TokenGraphIssue>;
```

Neither function accepts a public `path` parameter. Path-aware internal parsers compose paths privately.

### 3.10 Selection and compilation

```ts
export type TokenSelection =
  | "public"
  | "all"
  | {
      readonly keys: readonly string[];
    };

export interface CompileTokenGraphOptions {
  readonly selection?: TokenSelection;
}

export type CompileTokenGraphIssue = Issue<
  | "invalid-compile-options"
  | "invalid-selection"
  | "empty-selection"
  | "invalid-selection-key"
  | "duplicate-selection-key"
  | "unknown-selection-key"
  | "no-selected-tokens"
> & {
  readonly key?: string;
};

export interface CompiledToken {
  readonly visibility: TokenVisibility;
  readonly valueByMode: Readonly<Record<string, ColorValue>>;
  readonly origin: TokenOrigin;
  readonly dependenciesByMode: Readonly<Record<string, readonly string[]>>;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export interface CompiledTokenSet {
  readonly formatVersion: 1;
  readonly modes: readonly [string, ...string[]];
  readonly defaultMode: string;
  readonly tokens: Readonly<Record<string, CompiledToken>>;
}

export function compileTokenGraph(
  input: unknown,
  options?: CompileTokenGraphOptions,
): Result<CompiledTokenSet, TokenGraphIssue | CompileTokenGraphIssue>;
```

The options object is runtime-validated strictly even though its TypeScript type is declared.

### 3.11 Sources and build orchestration

```ts
export interface TokenSource<I extends Issue = Issue> {
  readonly id: string;
  build(): Result<TokenGraphInput, I>;
}

export interface BuildTokenSetOptions<I extends Issue = Issue> {
  readonly source: TokenSource<I>;
  readonly fragments?: readonly TokenFragmentInput[];
  readonly selection?: TokenSelection;
}

export interface BuildTokenSetValue {
  readonly graph: TokenGraph;
  readonly tokenSet: CompiledTokenSet;
}

export type BuildTokenSetIssue =
  | TokenGraphIssue
  | CompileTokenGraphIssue
  | (Issue<
      | "invalid-build-options"
      | "invalid-source-id"
      | "source-build-failed"
      | "invalid-source-result"
      | "invalid-source-issue"
    > & {
      readonly sourceId?: string;
    });

export function buildTokenSet<I extends Issue>(
  options: BuildTokenSetOptions<I>,
): Result<BuildTokenSetValue, I | BuildTokenSetIssue>;
```

`source-build-failed` contains no raw thrown object or stack in the public issue. Development-only causal logging is allowed outside the stable result.

### 3.12 CSS exporter types

```ts
export type CssScope =
  | {
      readonly strategy: "root";
    }
  | {
      readonly strategy: "selector";
      readonly selector: string;
    };

export type CssModeSelectors =
  | {
      readonly strategy: "data-attribute";
      readonly attribute: string;
    }
  | {
      readonly strategy: "class";
      readonly classPrefix: string;
    }
  | {
      readonly strategy: "selectors";
      readonly selectors: Readonly<Record<string, string>>;
    };

export interface ExportCssVariablesOptions {
  readonly variablePrefix?: string;
  readonly scope?: CssScope;
  readonly modeSelectors?: CssModeSelectors;
  readonly format?: "pretty" | "compact";
}

export type ExportCssVariablesIssue = Issue<
  | "invalid-css-options"
  | "invalid-variable-prefix"
  | "invalid-scope"
  | "invalid-selector"
  | "invalid-data-attribute"
  | "invalid-class-prefix"
  | "invalid-mode-selectors"
  | "missing-mode-selector"
  | "unknown-mode-selector"
  | "duplicate-mode-selector"
> & {
  readonly mode?: string;
  readonly selector?: string;
};

export function exportCssVariables(
  tokenSet: CompiledTokenSet,
  options?: ExportCssVariablesOptions,
): Result<string, ExportCssVariablesIssue>;
```

### 3.13 Total projections

```ts
export function serializeTokenSet(tokenSet: CompiledTokenSet): string;

export function formatCssColor(color: ColorValue): string;
```

These accept canonical library-produced values. They do not parse unknown structural lookalikes.

## 4. Conversion subpath declarations

### 4.1 Type-export manifest

```text
ColorGamut
GamutMappingMethod
MapColorToGamutOptions
ColorConversionIssue
GamutMappingIssue
```

The subpath imports root `ColorSpace`, `ColorValue`, `Issue`, and `Result` types rather than redeclaring or re-exporting them under aliases.

### 4.2 Types and functions

```ts
import type { ColorSpace, ColorValue, Issue, Result } from "color-scheme-tokens";

export type ColorGamut = "srgb" | "display-p3";

export type GamutMappingMethod = "preserve-lightness";

export interface MapColorToGamutOptions {
  readonly method: GamutMappingMethod;
  readonly outputSpace?: ColorSpace;
}

export type ColorConversionIssue = Issue<
  "unsupported-color-space" | "color-conversion-failed" | "non-finite-color-result"
> & {
  readonly colorSpace?: string;
  readonly targetSpace?: string;
};

export type GamutMappingIssue = Issue<
  | "unsupported-gamut"
  | "unsupported-gamut-mapping-method"
  | "invalid-output-space"
  | "gamut-mapping-failed"
  | "non-finite-color-result"
> & {
  readonly gamut?: string;
  readonly method?: string;
  readonly outputSpace?: string;
};

export function convertColor(
  color: ColorValue,
  targetSpace: ColorSpace,
): Result<ColorValue, ColorConversionIssue>;

export function isColorInGamut(color: ColorValue, gamut: ColorGamut): boolean;

export function mapColorToGamut(
  color: ColorValue,
  gamut: ColorGamut,
  options: MapColorToGamutOptions,
): Result<ColorValue, GamutMappingIssue>;
```

No generated declaration may name `@texel/color`, `ColorSpace` from Texel, mutable vector aliases, or its gamut callback types.

## 5. Material subpath declarations

### 5.1 Type-export manifest

```text
Material3AlgorithmVariant
Material3SpecVersion
Material3Platform
Material3KeyColors
Material3AlgorithmOptions
Material3GamutMappingOptions
Material3SourceOptions
Material3SourceIssue
Material3TokenKey
```

### 5.2 Options

```ts
import type { ColorInput, Issue, TokenSource } from "color-scheme-tokens";

export type Material3AlgorithmVariant = "tonalSpot" | "vibrant" | "expressive" | "neutral";

export type Material3SpecVersion = "2021" | "2025";

export type Material3Platform = "phone" | "watch";

export interface Material3KeyColors {
  readonly primary?: ColorInput;
  readonly secondary?: ColorInput;
  readonly tertiary?: ColorInput;
  readonly neutral?: ColorInput;
  readonly neutralVariant?: ColorInput;
}

export interface Material3AlgorithmOptions {
  readonly variant?: Material3AlgorithmVariant;
  readonly contrastLevel?: number;
  readonly specVersion?: Material3SpecVersion;
  readonly platform?: Material3Platform;
}

export interface Material3GamutMappingOptions {
  readonly method: "preserve-lightness";
}

export interface Material3SourceOptions {
  readonly sourceColor: ColorInput;
  readonly keyColors?: Material3KeyColors;
  readonly algorithm?: Material3AlgorithmOptions;
  readonly gamutMapping?: Material3GamutMappingOptions;
}
```

### 5.3 Fixed token-key type

```ts
export type Material3TokenKey =
  | "m3.primary-palette-key-color"
  | "m3.secondary-palette-key-color"
  | "m3.tertiary-palette-key-color"
  | "m3.neutral-palette-key-color"
  | "m3.neutral-variant-palette-key-color"
  | "m3.error-palette-key-color"
  | "m3.background"
  | "m3.on-background"
  | "m3.surface"
  | "m3.surface-dim"
  | "m3.surface-bright"
  | "m3.surface-container-lowest"
  | "m3.surface-container-low"
  | "m3.surface-container"
  | "m3.surface-container-high"
  | "m3.surface-container-highest"
  | "m3.on-surface"
  | "m3.surface-variant"
  | "m3.on-surface-variant"
  | "m3.inverse-surface"
  | "m3.inverse-on-surface"
  | "m3.outline"
  | "m3.outline-variant"
  | "m3.shadow"
  | "m3.scrim"
  | "m3.surface-tint"
  | "m3.primary"
  | "m3.on-primary"
  | "m3.primary-container"
  | "m3.on-primary-container"
  | "m3.inverse-primary"
  | "m3.secondary"
  | "m3.on-secondary"
  | "m3.secondary-container"
  | "m3.on-secondary-container"
  | "m3.tertiary"
  | "m3.on-tertiary"
  | "m3.tertiary-container"
  | "m3.on-tertiary-container"
  | "m3.error"
  | "m3.on-error"
  | "m3.error-container"
  | "m3.on-error-container"
  | "m3.primary-fixed"
  | "m3.primary-fixed-dim"
  | "m3.on-primary-fixed"
  | "m3.on-primary-fixed-variant"
  | "m3.secondary-fixed"
  | "m3.secondary-fixed-dim"
  | "m3.on-secondary-fixed"
  | "m3.on-secondary-fixed-variant"
  | "m3.tertiary-fixed"
  | "m3.tertiary-fixed-dim"
  | "m3.on-tertiary-fixed"
  | "m3.on-tertiary-fixed-variant";
```

### 5.4 Issues and source factory

```ts
export type Material3SourceIssue = Issue<
  | "invalid-material3-options"
  | "invalid-source-color"
  | "invalid-key-color"
  | "unsupported-alpha"
  | "out-of-srgb-gamut"
  | "unsupported-variant"
  | "invalid-contrast-level"
  | "unsupported-spec-version"
  | "unsupported-platform"
  | "material3-generation-failed"
  | "issue-limit-reached"
> & {
  readonly sourceId?: "material3";
  readonly keyColor?: keyof Material3KeyColors;
};

export function material3Source(options: Material3SourceOptions): TokenSource<Material3SourceIssue>;
```

The source factory itself returns a capability object; option problems are reported by `build()`. It may eagerly copy and internally parse safe option structure at construction, but it must preserve the public synchronous source shape.

No declaration may name upstream Material utility classes/types.

## 6. Package export map

Target shape, adapted to actual build filenames:

```json
{
  "type": "module",
  "sideEffects": false,
  "engines": {
    "node": ">=22"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./conversion": {
      "types": "./dist/conversion/index.d.ts",
      "import": "./dist/conversion/index.js"
    },
    "./sources/material3": {
      "types": "./dist/sources/material3/index.d.ts",
      "import": "./dist/sources/material3/index.js"
    },
    "./schemas/token-graph.v1.schema.json": "./schemas/token-graph.v1.schema.json",
    "./schemas/token-fragment.v1.schema.json": "./schemas/token-fragment.v1.schema.json",
    "./schemas/compiled-token-set.v1.schema.json": "./schemas/compiled-token-set.v1.schema.json",
    "./package.json": "./package.json"
  }
}
```

No wildcard internal subpath export. Consumers must not deep-import `dist` or `src` files.

## 7. Public documentation requirements

Every runtime function and exported public type has TSDoc that states:

- whether input is trusted canonical data or untrusted runtime data;
- whether it can fail and which Result it returns;
- mutation/ownership behavior;
- determinism behavior where relevant;
- lossy behavior where relevant;
- one concise example or cross-link.

Documentation must not mention old API names except in a migration/deletion note that is excluded from the package’s normal onboarding.

## 8. Surface approval

Lock all three runtime surfaces with exact export snapshots. Lock declarations with API Extractor approval files or an equally strict generated declaration manifest.

The gate fails for:

- an accidental new runtime export;
- an accidental type export;
- a missing documented export;
- an old renamed type left behind;
- any `@texel/color` or Material utility type leaked into public declarations;
- a declaration that requires `skipLibCheck: true`;
- a mismatch between root and subpath types.

<!-- END 02-PUBLIC-API.md -->

---

<!-- BEGIN 04-TEST-AND-RELEASE-GATE.md -->

# Mandatory test matrix and release gate

This checklist is executable acceptance criteria. The migration is not complete until every applicable item passes. Skipped checks require an explicit documented reason and owner approval; normal implementation difficulty is not a reason to skip.

## 1. Required top-level commands

Provide scripts equivalent to:

```json
{
  "scripts": {
    "typecheck": "...",
    "lint": "...",
    "format": "...",
    "test": "...",
    "test:types": "...",
    "test:properties": "...",
    "test:schemas": "...",
    "test:docs": "...",
    "api:check": "...",
    "build": "...",
    "package:check": "...",
    "smoke:consumer": "...",
    "validate": "...",
    "release:check": "..."
  }
}
```

`release:check` must run the complete gate against the actual built/packed artifact, without duplicate uncontrolled builds or relying on source imports.

Expected final invocation:

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
```

## 2. Unit tests — Result and issues

- [ ] Success has exactly `{ ok: true, value }`.
- [ ] Failure has exactly `{ ok: false, issues }`.
- [ ] Every failure issue tuple is non-empty.
- [ ] No public failure uses `problem` or `problems`.
- [ ] Issue codes use `code`, never `kind`.
- [ ] Paths are valid RFC 6901 pointers with `~` and `/` escaping.
- [ ] Issues are JSON-serializable and contain no raw arbitrary input.
- [ ] Independent issues aggregate in deterministic order.
- [ ] Cascading issues are suppressed.
- [ ] At most 100 issues are returned.
- [ ] Inputs producing more than 99 actionable issues end with one `issue-limit-reached` issue.
- [ ] Message text may change without breaking tests that should assert codes/paths/context.

## 3. Unit/property tests — safe JSON and ownership

For every public parser and option parser:

- [ ] `null`, primitives, arrays, empty objects, deeply nested JSON, and malformed shapes do not throw.
- [ ] Class instances, Date, Map, Set, arrays where records are required, and exotic prototypes are rejected.
- [ ] Accessor properties are rejected without invoking getters.
- [ ] Null-prototype records are handled according to the spec and copied to normal objects.
- [ ] Unknown properties are rejected at all strict object levels.
- [ ] Cyclic extension values are rejected without infinite recursion.
- [ ] Non-finite numbers are rejected.
- [ ] Mutating the original input after success does not alter returned data.
- [ ] Mutating one successful result does not alter a later independent result.

Property test:

```ts
fc.assert(
  fc.property(fc.jsonValue(), (value) => {
    expect(() => parseTokenGraph(value)).not.toThrow();
    expect(() => parseColor(value)).not.toThrow();
  }),
);
```

Use bounded depth/size profiles for routine CI plus larger scheduled/stress cases.

## 4. Identifier tests

Generate valid and invalid identifiers around every grammar boundary.

- [ ] Single-segment token keys are accepted.
- [ ] Multiple lower-kebab segments are accepted.
- [ ] Hyphens inside segments are accepted.
- [ ] CamelCase, uppercase, underscore, whitespace, Unicode, empty segments, leading/trailing/consecutive hyphens are rejected.
- [ ] Mode/source/fragment/prefix IDs reject dots.
- [ ] No identifier is normalized.
- [ ] Extension keys require at least two namespaced segments.
- [ ] Reserved-looking object names cannot exploit prototypes.

## 5. Color parser tests

### 5.1 Accepted strings

- [ ] `#rgb`
- [ ] `#rgba`
- [ ] `#rrggbb`
- [ ] `#rrggbbaa`
- [ ] upper/lower hex digits with canonical output
- [ ] `transparent`
- [ ] modern `rgb()` with numbers
- [ ] modern `rgb()` with percentages
- [ ] legacy comma `rgb()`/`rgba()` if supported by the final grammar
- [ ] alpha number and percentage
- [ ] `oklch()` with number/percentage lightness as specified
- [ ] hue number and `deg`
- [ ] `color(srgb …)`
- [ ] `color(display-p3 …)`
- [ ] reasonable ASCII whitespace and case-insensitive function names

### 5.2 Rejected strings

- [ ] missing `#` bare hex
- [ ] invalid hex lengths/digits
- [ ] mixed legacy/modern RGB separators
- [ ] malformed slash/alpha
- [ ] non-finite/exponent overflow
- [ ] unsupported color space
- [ ] `currentColor`
- [ ] named colors other than `transparent`
- [ ] system colors
- [ ] `var()`
- [ ] `calc()`
- [ ] `light-dark()`
- [ ] relative color syntax
- [ ] `color-mix()`
- [ ] `none` components
- [ ] unsupported functions

### 5.3 Object values

- [ ] exact sRGB/P3/OKLCH objects accepted.
- [ ] omitted alpha becomes `1`.
- [ ] unknown properties rejected.
- [ ] missing components rejected.
- [ ] wrong component types rejected.
- [ ] finite out-of-range RGB coordinates accepted as valid values.
- [ ] invalid alpha rejected.
- [ ] negative OKLCH chroma rejected.
- [ ] hue normalized to `[0, 360)`.
- [ ] `-0` normalized.
- [ ] exact achromatic hue canonicalized to `0`.
- [ ] accepted object is copied.

## 6. CSS color formatter tests

- [ ] Opaque byte-aligned sRGB produces lowercase `#rrggbb`.
- [ ] Non-byte-aligned sRGB produces `color(srgb …)` without quantization.
- [ ] Translucent sRGB produces `color(srgb … / alpha)`.
- [ ] P3 produces `color(display-p3 …)`.
- [ ] OKLCH produces `oklch(…)`.
- [ ] `/ 1` is omitted.
- [ ] `-0` is never emitted.
- [ ] No `toFixed()`-style truncation.
- [ ] Out-of-gamut coordinates are preserved.
- [ ] Formatter never clips or maps.
- [ ] Formatted output re-parses to equal canonical components or documented round-trip tolerance.

Use generated finite colors over bounded practical and extended ranges. Exact equality is expected when parsing the formatter’s own decimal strings because shortest round-trip number text is used.

## 7. Authoring helper type tests

Use `*.test-d.ts` / Vitest type tests or equivalent.

- [ ] `defineTokenGraph()` preserves literal mode tuple.
- [ ] It preserves literal token keys.
- [ ] `defaultMode` outside modes is a type error.
- [ ] Direct `valueByMode` missing a mode is a type error.
- [ ] Direct `valueByMode` with an extra mode is a type error.
- [ ] `value` plus `valueByMode` is a type error.
- [ ] Neither value form is a type error.
- [ ] Fragment IDs/token keys remain literal.
- [ ] Standalone fragments remain usable without falsely requiring a graph-mode generic.
- [ ] Reference keys can target external/source keys without an over-restrictive false type error.
- [ ] Large generated token maps do not cause unacceptable compiler/editor performance.
- [ ] Throwing/convenience helpers are absent from type surface.

## 8. Graph parser tests

### 8.1 Top-level

- [ ] `formatVersion: 1` accepted; missing/wrong versions rejected.
- [ ] optional `$schema` accepted as tooling metadata and omitted from canonical graph.
- [ ] unknown top-level property rejected.
- [ ] modes non-empty, valid, unique.
- [ ] default mode must exist.
- [ ] default visibility valid.
- [ ] direct tokens may be empty.

### 8.2 Definitions and fragments

- [ ] direct/fragment visibility inheritance becomes explicit.
- [ ] exact metadata types and unknown-field rejection.
- [ ] namespaced JSON-safe extensions preserved/copied.
- [ ] `value` expands to all modes.
- [ ] `valueByMode` requires exactly all modes.
- [ ] no default-mode fallback.
- [ ] reference object exactness.
- [ ] cross-mode ref field rejected.
- [ ] invalid/unknown target issues are precise.
- [ ] fragments flatten with correct origin.
- [ ] duplicate fragment IDs rejected.
- [ ] duplicate token keys rejected across every composition pair.
- [ ] duplicate issue includes current and first paths.
- [ ] reordering non-conflicting fragments does not change canonical graph semantics.
- [ ] parser does not claim to detect raw JSON duplicate members lost before invocation.

### 8.3 Cycles

- [ ] direct self-reference.
- [ ] two-node cycle.
- [ ] longer cycle.
- [ ] mode-specific cycle only in affected mode.
- [ ] each unique cycle once per mode.
- [ ] canonical cycle diagnostics under token insertion permutations.
- [ ] no duplicate cycle reports from every possible starting token.

## 9. Compiler tests

- [ ] default selection is public.
- [ ] `all` includes internal.
- [ ] exact selection can include internal.
- [ ] exact empty selection -> `empty-selection`.
- [ ] duplicate exact key -> `duplicate-selection-key`.
- [ ] invalid exact key -> `invalid-selection-key`.
- [ ] unknown exact key -> `unknown-selection-key`.
- [ ] zero selected tokens -> `no-selected-tokens`.
- [ ] internal dependencies resolve but are not emitted under public selection.
- [ ] selected output order is canonical, not request order.
- [ ] every selected token has every canonical mode.
- [ ] resolved colors are owned copies.
- [ ] metadata/visibility/origin preserved.
- [ ] `dependenciesByMode` is unique transitive closure, excludes self, code-unit sorted.
- [ ] mode-dependent references produce different dependencies by mode.
- [ ] no public internal compiler bypass.

Stress/property tests:

- [ ] 10,000-token acyclic chain compiles without stack overflow.
- [ ] repeated shared dependencies are memoized.
- [ ] growth is near-linear; use operation counters or generous non-flaky performance bounds.
- [ ] insertion permutations produce equal compiled semantics and identical serialization.

## 10. Source/build tests

- [ ] custom source success.
- [ ] custom source-specific issue type remains inferred/narrowable.
- [ ] source ID grammar enforced.
- [ ] source `build()` called exactly once.
- [ ] thrown source becomes `source-build-failed`.
- [ ] malformed success result becomes `invalid-source-result`.
- [ ] malformed failure/empty issues becomes `invalid-source-result` or `invalid-source-issue`.
- [ ] source issue payload must be JSON-safe.
- [ ] source graph parsed once.
- [ ] caller fragments composed once.
- [ ] source/fragment duplicates rejected.
- [ ] successful value contains only `graph` and `tokenSet` core products.
- [ ] no CSS or JSON work occurs unless exporter called.
- [ ] same source/options yields deterministic output.

## 11. CSS variable exporter tests

### 11.1 Options

- [ ] default root/data-attribute/pretty behavior.
- [ ] valid `variablePrefix`.
- [ ] invalid generic/uppercase/dotted prefix rejected.
- [ ] valid custom scope selector.
- [ ] malformed/injecting selector rejected by standards-aware parser.
- [ ] valid data attribute beginning `data-`.
- [ ] invalid attribute rejected.
- [ ] valid class prefix ending `-`.
- [ ] invalid class prefix rejected.
- [ ] exact selector map requires every mode and no extras.
- [ ] exact selectors conflict with `scope` as specified.
- [ ] duplicate selector strings rejected.
- [ ] unknown option properties rejected.

### 11.2 Naming injectivity

Property test:

```ts
fc.assert(
  fc.property(validTokenKeyArb, validTokenKeyArb, (a, b) => {
    fc.pre(a !== b);
    expect(toCssName(a, prefix)).not.toBe(toCssName(b, prefix));
  }),
);
```

Explicit regressions:

```text
a.b-c != a-b.c
foo.bar-baz != foo-bar.baz
single segment vs multi segment
prefix boundary vs first token segment
```

### 11.3 Output

- [ ] explicit default mode drives base block even if input order differs.
- [ ] other mode blocks canonical.
- [ ] declaration order canonical.
- [ ] public selection contains only compiled tokens.
- [ ] precision-preserving color formatter used.
- [ ] pretty exact whitespace and one final newline.
- [ ] compact truly compact and no final newline.
- [ ] no `localeCompare()` dependency.
- [ ] no selector/prefix interpolation without validation.

Golden CSS fixtures are appropriate because bytes are a public contract.

## 12. Canonical serializer tests

- [ ] exact top-level and token property order.
- [ ] exact color property order per variant.
- [ ] exact origin property order.
- [ ] default mode first; remaining sorted.
- [ ] tokens/dependencies code-unit sorted.
- [ ] extensions recursively sorted.
- [ ] `-0` normalized.
- [ ] no non-finite values.
- [ ] shortest round-trip JSON number strings.
- [ ] exactly one trailing newline.
- [ ] no formatting options.
- [ ] all metadata included.

Property tests:

- [ ] every token insertion permutation yields identical bytes.
- [ ] fragment permutation (without conflicts) yields identical bytes.
- [ ] exact selection permutation yields identical bytes.
- [ ] color object property construction order yields identical bytes.
- [ ] extension/provenance property construction order yields identical bytes.
- [ ] results are identical under multiple process locales.

Run locale cases such as:

```text
C
en-US
de-DE
tr-TR
sv-SE
```

The implementation must not use locale-sensitive sorting.

## 13. Conversion tests

- [ ] identity conversion for all spaces.
- [ ] known reference vectors for sRGB, Display-P3, OKLab intermediary behavior, and OKLCH.
- [ ] documented tolerance metric; use DeltaE OK where perceptual comparison is relevant.
- [ ] round-trip tests with realistic tolerance.
- [ ] conversion may produce out-of-gamut RGB coordinates.
- [ ] conversion never clips/maps.
- [ ] alpha preserved exactly.
- [ ] input not mutated.
- [ ] output fresh and not dependency-buffer alias.
- [ ] all successful coordinates finite.
- [ ] dependency exception contained.
- [ ] unsupported forged target values return issues rather than uncontrolled throw where boundary validation applies.
- [ ] gamut predicate expected cases/boundaries.
- [ ] mapping output satisfies target gamut within tolerance.
- [ ] mapping method explicit.
- [ ] `outputSpace` differs from target gamut correctly.
- [ ] generated declarations contain no `@texel/color` symbol/name.

Pin golden vectors with source/reference notes. Dependency upgrades require reviewing diffs rather than blindly updating snapshots.

## 14. Material 3 tests

### 14.1 Options and ownership

- [ ] `sourceColor` required.
- [ ] old `color` property rejected.
- [ ] defaults match specification.
- [ ] each variant/spec/platform boundary.
- [ ] contrast finite and `[-1, 1]`.
- [ ] independent option/color/key issues aggregate.
- [ ] alpha other than 1 rejected.
- [ ] mutable options/key colors copied at factory construction.

### 14.2 Color bridge

- [ ] in-gamut sRGB accepted.
- [ ] in-gamut P3/OKLCH converts explicitly.
- [ ] out-of-sRGB input rejected by default.
- [ ] explicit preserve-lightness mapping succeeds and is in gamut.
- [ ] ARGB quantization documented/golden.
- [ ] no generic silent clamping.

### 14.3 Generated graph

- [ ] modes exactly light/dark; default light.
- [ ] default visibility internal.
- [ ] fixed role inventory exactly matches `Material3TokenKey`.
- [ ] every role present for both modes and all supported options.
- [ ] optional dim roles absent.
- [ ] emitted keys lower-kebab.
- [ ] source origin ID/token metadata correct after build.
- [ ] upstream exception becomes `material3-generation-failed`.
- [ ] generated declarations expose no Material utility types.

Golden representative outputs should cover at least default, one alternate variant, 2025/watch where supported, contrast extremes, custom key color, and explicit gamut mapping.

## 15. Runtime and declaration API locks

For each entry point:

- [ ] exact runtime `Object.keys()` snapshot.
- [ ] exact declaration approval (`.api.md` or equivalent).
- [ ] no default export.
- [ ] no old runtime/type name.
- [ ] no accidental internal helper.
- [ ] no dependency type leakage.
- [ ] type-only imports remain type-only in declarations.
- [ ] package consumer can import every documented public type with `skipLibCheck: false`.

Root snapshot expected:

```text
buildTokenSet
compileTokenGraph
defineTokenFragment
defineTokenGraph
exportCssVariables
formatCssColor
parseColor
parseTokenGraph
serializeTokenSet
```

Conversion snapshot expected:

```text
convertColor
isColorInGamut
mapColorToGamut
```

Material snapshot expected:

```text
material3Source
```

## 16. JSON Schema tests

- [ ] schemas are valid against their declared JSON Schema dialect.
- [ ] all valid documentation fixtures pass appropriate schema.
- [ ] representative invalid fixtures fail.
- [ ] `additionalProperties: false` at strict levels.
- [ ] `value`/`valueByMode` exclusivity represented.
- [ ] exact color-object variants represented.
- [ ] metadata/extensions represented.
- [ ] compiled output schema matches canonical serializer output.
- [ ] schema files are included/exported in tarball.
- [ ] schema limitations for semantic mode equality/references/cycles are documented.

## 17. Documentation tests

- [ ] every executable TypeScript block in README/public docs extracted.
- [ ] examples compile against packed tarball, not workspace `src`.
- [ ] consumer uses ESM and strict TypeScript.
- [ ] `skipLibCheck: false`.
- [ ] runtime examples execute where deterministic.
- [ ] expected CSS/JSON examples match bytes.
- [ ] all imports resolve from documented subpaths.
- [ ] no example uses old names or camel-case token keys.
- [ ] raw JSON examples validate against schemas and runtime parser.

## 18. Packed-package tests

Build and pack once, then install the resulting tarball into a clean temporary consumer.

- [ ] `publint` passes.
- [ ] `@arethetypeswrong/cli` passes.
- [ ] ESM import on Node 22.
- [ ] ESM import on Node 24.
- [ ] root workflow compiles/runs.
- [ ] conversion workflow compiles/runs.
- [ ] Material workflow compiles/runs.
- [ ] root import alone does not evaluate/load optional engine modules.
- [ ] declaration maps/source maps reference included files correctly.
- [ ] package exports reject undocumented deep imports.
- [ ] schemas import/read from documented export paths.
- [ ] no TypeScript runtime execution trick in smoke script.

## 19. Tarball contents

The packed tarball may contain only deliberate publication files, such as:

```text
dist/**
schemas/**
README.md
CHANGELOG.md
LICENSE
THIRD_PARTY_NOTICES (only when needed)
package.json
```

It must not contain:

```text
source conversation archive
migration goal/spec package
internal review documents
phase plans
local machine paths
source tests
coverage
.git/.github
editor files
unbuilt src
legacy compatibility fixtures
```

Use an automated allowlist/denylist test against `pnpm pack --json` or the actual tarball.

## 20. Licensing and dependency distribution

- [ ] `@texel/color` external, exact-pinned, MIT license recorded by dependency metadata.
- [ ] Material utilities external, exact-pinned, Apache-2.0 dependency not bundled.
- [ ] selector parser dependency external/exact-pinned if used; license reviewed.
- [ ] generated bundles do not embed third-party source unexpectedly.
- [ ] if any dependency is deliberately bundled, complete license/notice obligations are added and tested in tarball.
- [ ] package’s own MIT license is present.

This is engineering compliance guidance, not legal advice; nevertheless it is a release blocker.

## 21. CI gate

CI matrix:

```text
Node 22
Node 24
```

At minimum, CI runs:

- [ ] frozen install;
- [ ] typecheck (library/test/scripts);
- [ ] lint;
- [ ] format check;
- [ ] runtime/unit/integration tests;
- [ ] type tests;
- [ ] property tests;
- [ ] schema tests;
- [ ] build;
- [ ] API approvals;
- [ ] docs examples;
- [ ] package lint/type checks;
- [ ] packed consumer;
- [ ] tarball contents.

No blanket allowed-failure. Repository branch protection/status requirements may need manual owner configuration; document the exact recommended checks.

## 22. Legacy residue scan

Final automated scans must confirm old names are absent from source/public docs/tests except an intentional changelog migration note:

```text
ParseResult
problem(s) result field
schemaVersion
color-scheme-token-graph/v0
compiled-color-scheme-tokens/v0
compileGraph
compileValidatedGraph
createSchemeTokens
createSourceGraph
validateGraph
applyLayers
ColorSchemeTokenLayer
ColorSchemeTokenAliases
SchemeTokensRecipe
CssVariableOptions
parseColorInput
parseHexColor
srgb255
literalColor
lightMode
darkMode
```

Also confirm no root export or public declaration of token/mode parse helpers.

## 23. Final release-readiness checklist

- [ ] All required commands pass locally.
- [ ] CI exists for Node 22/24.
- [ ] Runtime/type surfaces approved.
- [ ] Schemas shipped and tested.
- [ ] README examples execute from packed package.
- [ ] Core-only usage has no optional-engine import.
- [ ] Deterministic serialization/CSS properties proven.
- [ ] Color precision/gamut semantics proven.
- [ ] Ownership/no-aliasing proven.
- [ ] Stack/deep-chain behavior proven.
- [ ] Material inventory stable.
- [ ] Dependencies external and licenses reviewed.
- [ ] Tarball clean.
- [ ] No compatibility code.
- [ ] No publish/tag performed by automation.
- [ ] Final report names all commands and outcomes.

Only after this gate and an owner review should the repository separately decide to change `private`, set the first publication version, tag, or publish.

<!-- END 04-TEST-AND-RELEASE-GATE.md -->

---

<!-- BEGIN 03-MIGRATION-PLAN.md -->

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

<!-- END 03-MIGRATION-PLAN.md -->

---

<!-- BEGIN 08-SEMVER-AND-MAINTENANCE.md -->

# Post-publication compatibility and maintenance policy

This policy applies after the first stable v1 publication. Before publication, the migration may break the current `0.0.0` code freely and must not add compatibility code.

## 1. Contract categories

The following are public contracts:

1. package entry points and runtime export names;
2. exported type names and assignability;
3. closed string unions and discriminated unions;
4. Result/Issue shape;
5. issue codes and JSON Pointer path semantics;
6. graph/fragment/compiled JSON formats and `formatVersion`;
7. accepted identifier and color grammar;
8. compilation, reference, visibility, selection, and ordering semantics;
9. canonical serialized bytes;
10. canonical CSS bytes/default selectors/variable naming;
11. color conversion/gamut/mapping numerical behavior within documented tolerances;
12. Material role inventory/defaults/generated outputs within documented dependency/algorithm version;
13. dependency-loading boundaries and public declaration independence;
14. minimum supported Node version.

Human-readable issue messages are not contractual.

## 2. Major changes

After v1, these require a major version unless introduced through a separately versioned opt-in that leaves existing behavior unchanged:

- removing, renaming, or changing a runtime export;
- removing, renaming, or incompatibly changing an exported type;
- adding a new member to a closed issue-code union used for exhaustive switches;
- adding a new `ColorValue`, `ColorSpace`, `ColorGamut`, `TokenOrigin`, strategy, or mapping-method union member when existing consumers may be exhaustive;
- adding a required input property;
- making an optional property required;
- changing identifier grammar or normalization;
- changing `value`/`valueByMode`/reference semantics;
- changing default visibility or default selection;
- changing exact mode-map/fallback behavior;
- changing canonical order;
- changing CSS variable-name encoding;
- changing default selectors or exact CSS whitespace/newline/value formatting;
- changing canonical JSON property order/metadata inclusion/number formatting/newline;
- adding an always-emitted compiled/serialized field;
- changing `formatVersion` meaning or supported input format;
- changing Material guaranteed role inventory;
- changing Material defaults or generated values due to algorithm/dependency behavior;
- changing conversion matrices/adaptation/mapping algorithm beyond documented tolerance;
- making an operation implicitly clip/map that previously did not;
- changing a dependency distribution boundary in a way that affects consumer runtime/bundle behavior;
- raising the Node minimum.

### 2.1 Why adding an issue code can be breaking

Consumers are encouraged to narrow by `issue.code`:

```ts
switch (
  issue.code
  // exhaustive cases
) {
}
```

Adding a code to an exported closed union can break exhaustive compilation. Therefore it is major. A function that needs extensible third-party source codes already expresses them through the generic source issue parameter rather than silently widening a core union.

### 2.2 Why output fixes can be major

CSS and canonical JSON are intended for checked-in artifacts, caches, diffs, and build pipelines. Byte changes are observable even when visually equivalent. After v1, do not call an arbitrary output change a patch merely because it fixes an internal implementation.

If old bytes unambiguously violate a normative v1 requirement, a narrowly scoped correction may be considered a patch only after documenting the violation, impact, and migration risk. Default to a major release when consumers could depend on the bytes.

## 3. Minor changes

Normally minor when they do not alter existing behavior:

- a new independent public function or subpath;
- a new optional input property whose absence preserves exact prior behavior and output;
- a new schema annotation/documentation field that is not emitted into canonical data;
- support for an additional accepted color string spelling that maps to an existing `ColorValue` and does not change prior parse results;
- a new opt-in exporter strategy with a new closed-union member only if the type union change is deliberately treated as extensible; under the current closed-union policy, such a member is major, so prefer a new function/versioned options object;
- new noncontractual TSDoc/examples;
- performance improvements with identical results;
- additive test/tooling/package metadata that does not alter runtime/type behavior.

Because many v1 unions are intentionally closed, “additive” is not automatically nonbreaking in TypeScript. Evaluate exhaustive consumers.

## 4. Patch changes

Normally patch:

- issue message wording;
- documentation typo fixes;
- internal refactoring with identical public declarations and outputs;
- performance/memory improvements with identical semantics;
- test/CI/tooling fixes;
- dependency security/patch upgrades proven not to alter public output, declarations, runtime requirements, or import boundaries;
- parser crash fixes that make previously invalid input return the already specified issue without changing valid-input results;
- ownership fixes that remove unintended aliasing while preserving values.

## 5. Input broadening policy

Accepting previously invalid input can be behaviorally observable. Classify it by impact:

- an equivalent spelling within the documented grammar clarification: patch or minor;
- a new concrete syntax mapping to an existing color variant: minor;
- a contextual/computed syntax or new data model: major;
- relaxed unknown-property behavior: major and generally rejected;
- silent normalization of formerly rejected identifiers: major and contrary to policy.

## 6. Optional output fields

Adding an optional TypeScript property to an input/options interface is generally minor when absent behavior is unchanged.

Adding a property to canonical parsed/compiled output is major if the property is always present or changes serialized bytes. An in-memory optional property that is omitted unless a new opt-in is used may be minor, but the serializer and schema impact must be evaluated separately.

## 7. Format versioning

`formatVersion` is per persisted object format. V1 currently uses numeric `1` for graph, fragment, and compiled token set.

Rules:

- reject unsupported versions with structured issues;
- do not guess or coerce versions;
- do not add implicit v0 readers;
- a breaking wire-format change increments `formatVersion` and normally accompanies a package major;
- if multiple versions are supported later, each reader/writer is explicit and tested; no hidden migration during ordinary parsing;
- `$schema` URLs are versioned independently but must correspond to the format.

## 8. Canonical output policy

Every release candidate must compare canonical output against approved fixtures and property invariants.

A change to any of these is reviewed as a public contract change:

```text
field inclusion
field order
record key order
mode order
dependency order
number formatting
color syntax
CSS selector/default strategy
CSS whitespace/newlines
custom-property naming
Material generated values
```

Do not update golden snapshots without a written explanation and semver classification.

## 9. Numerical dependency upgrades

`@texel/color` and `@material/material-color-utilities` are exact-pinned because upgrades can alter deterministic output.

Upgrade procedure:

1. read upstream changelog/diff/license;
2. run all reference vectors and property tests;
3. compare canonical Material/convert/map fixtures;
4. quantify numerical differences with the documented metric;
5. verify gamut postconditions;
6. inspect bundle/import/declaration behavior;
7. classify semver based on observable changes;
8. update attribution/dependency documentation.

A dependency patch number does not imply this package can publish a patch.

## 10. Material evolution policy

The fixed `Material3TokenKey` inventory is a v1 contract.

- upstream optional/new roles are not automatically emitted;
- adding/removing a guaranteed role is major;
- upstream algorithm output changes are public output changes;
- supporting a new `specVersion`/platform/variant adds a closed union member and is major under the exhaustive-union policy unless exposed through a new versioned API;
- deprecating an upstream role requires an explicit package-level plan, not silent disappearance.

## 11. Issue-code maintenance

- Codes are lower-kebab stable identifiers.
- Paths use RFC 6901 consistently.
- Messages may be improved without semver impact.
- Do not repurpose an existing code for a materially different condition.
- Do not merge two codes if consumers may distinguish them without a major release.
- Context fields required by a specific issue variant remain stable.
- New source-specific custom codes belong to the source’s generic issue union, not the core union.

## 12. Deprecation policy

The pre-publication migration uses no deprecations.

After v1, deprecation may be used only when maintaining an old contract through at least one release is worth the surface cost. A deprecation must include:

- replacement;
- reason;
- planned removal major;
- tests proving old/new behavior;
- documentation and changelog.

Do not use deprecation as a default substitute for decisive API design.

## 13. Node support policy

Initial v1 floor is Node 22, with CI on Node 22 and 24.

- dropping an advertised Node major is a package major;
- adding support for a newer Node line is nonbreaking;
- remove EOL lines only in a planned major;
- browser-neutral root source must remain free of accidental Node APIs despite the package’s build/test tooling.

## 14. Package entry-point policy

- no undocumented deep imports;
- each public subpath has runtime and declaration approval;
- adding a new subpath can be minor if it does not alter existing surfaces;
- removing/renaming a subpath is major;
- changing ESM/CJS availability is major;
- public declarations must remain dependency-type clean and compile with `skipLibCheck: false`.

## 15. Documentation as contract

Executable README/public examples are part of the release gate. When implementation changes, update examples in the same change and run them against the packed tarball.

Internal design documents may evolve, but no internal migration/review artifact ships in the package tarball.

## 16. Release process after migration

The automated migration run does not publish. A later owner-controlled first release should:

1. review all approved API files and schemas;
2. run `pnpm release:check` from a clean checkout;
3. inspect tarball contents;
4. decide the first version/private flag deliberately;
5. update changelog/release notes;
6. configure required CI checks/branch protection;
7. tag/publish manually or through a separately approved release workflow.

## 17. Change-review checklist

For every future public change, answer:

1. Is the new capability expressible through existing JSON data rather than a callback/helper?
2. Does it change a closed union?
3. Does it change accepted/rejected input?
4. Does it change issue codes/paths?
5. Does it change canonical JSON or CSS bytes?
6. Does it change color numbers or gamut behavior?
7. Does it change Material keys/values/defaults?
8. Does it leak a dependency type or load a new module from root?
9. Does it affect ownership/determinism/performance?
10. What semver level follows from the most observable change?

Write the usage example first against the literal packed entry point, then update runtime/type surface approvals, schemas, tests, and docs together.

<!-- END 08-SEMVER-AND-MAINTENANCE.md -->

---

<!-- BEGIN 05-USAGE-EXAMPLES.md -->

# Intended v1 usage examples

These examples are normative onboarding examples. During implementation, mark executable blocks and compile them against the packed package. They use the final API; earlier conversation examples with old names are superseded.

## 1. Core-only, single mode

No Material source and no conversion import:

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVariables } from "color-scheme-tokens";

const graph = defineTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    "app.background": {
      value: "#ffffff",
    },
    "app.foreground": {
      value: "#111111",
    },
    "app.accent": {
      value: "#6750a4",
    },
  },
});

const compiled = compileTokenGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const css = exportCssVariables(compiled.value, {
  variablePrefix: "theme",
});

if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}

console.log(css.value);
```

Expected pretty output:

```css
:root {
  --theme--app--accent: #6750a4;
  --theme--app--background: #ffffff;
  --theme--app--foreground: #111111;
}
```

The core already provides validation, canonical ordering, selection, and output. No third-party numerical capability is involved.

## 2. Modes, internal tokens, and references

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVariables } from "color-scheme-tokens";

const graph = defineTokenGraph({
  formatVersion: 1,
  modes: ["dark", "light"],
  defaultMode: "light",
  defaultVisibility: "internal",
  tokens: {
    "brand.primary": {
      description: "Primary brand color",
      valueByMode: {
        light: "#6750a4",
        dark: "#d0bcff",
      },
    },
    "brand.on-primary": {
      valueByMode: {
        light: "#ffffff",
        dark: "#381e72",
      },
    },
    "app.action": {
      visibility: "public",
      value: { ref: "brand.primary" },
    },
    "app.action-text": {
      visibility: "public",
      value: { ref: "brand.on-primary" },
    },
    "app.canvas": {
      visibility: "public",
      valueByMode: {
        light: "#fffbfe",
        dark: "#1c1b1f",
      },
    },
  },
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues));

const css = exportCssVariables(compiled.value, {
  variablePrefix: "theme",
  modeSelectors: {
    strategy: "data-attribute",
    attribute: "data-color-scheme",
  },
});
if (!css.ok) throw new Error(JSON.stringify(css.issues));

console.log(css.value);
```

Expected block order uses explicit `defaultMode`, not authored mode position:

```css
:root {
  --theme--app--action: #6750a4;
  --theme--app--action-text: #ffffff;
  --theme--app--canvas: #fffbfe;
}

:root[data-color-scheme="dark"] {
  --theme--app--action: #d0bcff;
  --theme--app--action-text: #381e72;
  --theme--app--canvas: #1c1b1f;
}
```

The internal `brand.*` tokens resolve but are not emitted by the default public selection.

## 3. Mode-specific references

```ts
const graph = defineTokenGraph({
  formatVersion: 1,
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "internal",
  tokens: {
    "brand.primary": {
      value: "#6750a4",
    },
    "brand.primary-bright": {
      value: "#d0bcff",
    },
    "app.action": {
      visibility: "public",
      valueByMode: {
        light: { ref: "brand.primary" },
        dark: { ref: "brand.primary-bright" },
      },
    },
  },
});
```

A reference always resolves its target in the current mode. There is no `{ ref, mode }` form.

## 4. Plain fragments

```ts
import { compileTokenGraph, defineTokenFragment, defineTokenGraph } from "color-scheme-tokens";

const brand = defineTokenFragment({
  formatVersion: 1,
  id: "brand",
  defaultVisibility: "internal",
  tokens: {
    "brand.primary": {
      valueByMode: {
        light: "#6750a4",
        dark: "#d0bcff",
      },
    },
  },
});

const application = defineTokenFragment({
  formatVersion: 1,
  id: "application",
  defaultVisibility: "public",
  tokens: {
    "app.action": {
      value: { ref: "brand.primary" },
      description: "Primary interactive action",
    },
  },
});

const graph = defineTokenGraph({
  formatVersion: 1,
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "internal",
  tokens: {},
  fragments: [brand, application],
});

const compiled = compileTokenGraph(graph);
```

Fragments do not override. Adding a second fragment that declares `app.action` makes compilation fail with `duplicate-token-key`.

## 5. Parse untrusted JSON

```ts
import { compileTokenGraph, parseTokenGraph } from "color-scheme-tokens";

const response = await fetch("/theme.tokens.json");
const input: unknown = await response.json();

const parsed = parseTokenGraph(input);

if (!parsed.ok) {
  for (const issue of parsed.issues) {
    console.error(
      issue.path === undefined
        ? `${issue.code}: ${issue.message}`
        : `${issue.path}: ${issue.code}: ${issue.message}`,
    );
  }
  throw new Error("Invalid token graph");
}

// The canonical graph is owned and flattened.
console.log(parsed.value.tokens["app.background"]);

// A caller may also pass the original unknown directly to the
// combined parse-and-compile boundary.
const compiled = compileTokenGraph(input);
```

Raw file:

```json
{
  "$schema": "https://color-scheme-tokens.dev/schemas/token-graph.v1.json",
  "formatVersion": 1,
  "modes": ["light", "dark"],
  "defaultMode": "light",
  "defaultVisibility": "public",
  "tokens": {
    "app.background": {
      "valueByMode": {
        "light": "#ffffff",
        "dark": "#111111"
      }
    }
  }
}
```

`$schema` assists editors and is not retained in the canonical semantic graph.

## 6. Selection

Default public selection:

```ts
const publicResult = compileTokenGraph(graph);
```

All tokens:

```ts
const allResult = compileTokenGraph(graph, {
  selection: "all",
});
```

Exact keys, including internal tokens:

```ts
const exactResult = compileTokenGraph(graph, {
  selection: {
    keys: ["brand.primary", "app.action"],
  },
});
```

This is invalid:

```ts
const invalid = compileTokenGraph(graph, {
  selection: {
    keys: [],
  },
});

if (!invalid.ok) {
  console.log(invalid.issues[0].code);
  // "empty-selection"
}
```

Exact selection order does not change compiled/serialized token order.

## 7. Inspect compiled values and dependencies

```ts
const result = compileTokenGraph(graph, {
  selection: { keys: ["app.action"] },
});

if (result.ok) {
  const action = result.value.tokens["app.action"];

  console.log(action.valueByMode.light);
  console.log(action.valueByMode.dark);

  console.log(action.dependenciesByMode.light);
  // ["brand.primary"]

  console.log(action.origin);
  // { kind: "fragment", id: "application" }
}
```

For a chain `app.action -> brand.primary -> source.raw-blue`, the dependency list for `app.action` is the sorted transitive closure:

```ts
["brand.primary", "source.raw-blue"];
```

## 8. Canonical JSON

```ts
import { compileTokenGraph, serializeTokenSet } from "color-scheme-tokens";

const result = compileTokenGraph(graph);
if (!result.ok) throw new Error(JSON.stringify(result.issues));

const json = serializeTokenSet(result.value);
console.log(json);
```

There are no indentation options. The returned string has one canonical field/key order and exactly one trailing newline.

Illustrative shape:

```json
{
  "formatVersion": 1,
  "modes": ["light", "dark"],
  "defaultMode": "light",
  "tokens": {
    "app.action": {
      "visibility": "public",
      "valueByMode": {
        "light": {
          "colorSpace": "srgb",
          "r": 0.396078431372549,
          "g": 0.3137254901960784,
          "b": 0.6431372549019608,
          "alpha": 1
        },
        "dark": {
          "colorSpace": "srgb",
          "r": 0.8156862745098039,
          "g": 0.7372549019607844,
          "b": 1,
          "alpha": 1
        }
      },
      "origin": {
        "kind": "fragment",
        "id": "application"
      },
      "dependenciesByMode": {
        "light": ["brand.primary"],
        "dark": ["brand.primary"]
      }
    }
  }
}
```

## 9. sRGB, Display-P3, and OKLCH without conversion

```ts
const wideGraph = defineTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    "brand.p3-orange": {
      value: {
        colorSpace: "display-p3",
        r: 0.94,
        g: 0.28,
        b: 0.08,
        alpha: 1,
      },
    },
    "brand.oklch-blue": {
      value: {
        colorSpace: "oklch",
        l: 0.62,
        c: 0.18,
        h: 255,
        alpha: 1,
      },
    },
  },
});
```

CSS can represent these directly:

```css
:root {
  --brand--oklch-blue: oklch(0.62 0.18 255);
  --brand--p3-orange: color(display-p3 0.94 0.28 0.08);
}
```

No conversion is required to preserve/export the authored coordinates.

## 10. Finite out-of-gamut RGB is valid

```ts
import { formatCssColor, parseColor } from "color-scheme-tokens";

const parsed = parseColor({
  colorSpace: "srgb",
  r: 1.08,
  g: 0.12,
  b: -0.03,
  alpha: 1,
});

if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

console.log(formatCssColor(parsed.value));
// color(srgb 1.08 0.12 -0.03)
```

The root preserves it. Display-gamut mapping is an explicit conversion-subpath operation.

## 11. Parse and format concrete colors

```ts
import { formatCssColor, parseColor } from "color-scheme-tokens";

const inputs: unknown[] = [
  "#6750a4",
  "#fff8",
  "transparent",
  "rgb(103 80 164 / 75%)",
  "oklch(62% 0.18 255 / 0.8)",
  "color(srgb 0.4 0.3 0.65)",
  "color(display-p3 0.94 0.28 0.08)",
];

for (const input of inputs) {
  const result = parseColor(input);
  if (!result.ok) {
    console.error(result.issues);
    continue;
  }
  console.log(formatCssColor(result.value));
}
```

Contextual CSS is deliberately rejected:

```ts
parseColor("var(--brand)");
parseColor("currentColor");
parseColor("color-mix(in oklch, red, blue)");
```

## 12. CSS class strategy

```ts
const css = exportCssVariables(tokenSet, {
  variablePrefix: "theme",
  scope: {
    strategy: "selector",
    selector: ".application",
  },
  modeSelectors: {
    strategy: "class",
    classPrefix: "scheme-",
  },
  format: "pretty",
});
```

Expected form:

```css
.application {
  --theme--app--background: #ffffff;
}

.application.scheme-dark {
  --theme--app--background: #111111;
}
```

Selectors are parsed/validated before interpolation.

## 13. Exact selector strategy

```ts
const css = exportCssVariables(tokenSet, {
  variablePrefix: "theme",
  modeSelectors: {
    strategy: "selectors",
    selectors: {
      light: ":root",
      dark: ":root[data-color-scheme='dark']",
    },
  },
  format: "compact",
});
```

When using exact selectors, omit `scope`. The map must cover every mode exactly and may not map two modes to the same selector.

## 14. Metadata and extensions

```ts
const graph = defineTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    "app.legacy-accent": {
      value: "#6750a4",
      description: "Legacy accent kept for old screens",
      deprecated: "Use app.action instead.",
      extensions: {
        "com.example.design-tool": {
          collection: "application",
          category: "legacy",
        },
      },
    },
  },
});
```

Unknown metadata fields are not accepted. Namespaced `extensions` is the deliberate escape hatch.

## 15. A custom synchronous source

```ts
import {
  buildTokenSet,
  defineTokenFragment,
  defineTokenGraph,
  type Issue,
  type Result,
  type TokenGraphInput,
  type TokenSource,
} from "color-scheme-tokens";

interface CompanySourceIssue extends Issue<"missing-company-primary"> {}

interface CompanySourceOptions {
  readonly primary?: string;
}

function companySource(options: CompanySourceOptions): TokenSource<CompanySourceIssue> {
  // Own the captured option now.
  const primary = options.primary;

  return {
    id: "company",

    build(): Result<TokenGraphInput, CompanySourceIssue> {
      if (primary === undefined) {
        return {
          ok: false,
          issues: [
            {
              code: "missing-company-primary",
              message: "A company primary color is required.",
              path: "/primary",
            },
          ],
        };
      }

      return {
        ok: true,
        value: defineTokenGraph({
          formatVersion: 1,
          modes: ["light", "dark"],
          defaultMode: "light",
          defaultVisibility: "internal",
          tokens: {
            "company.primary": {
              valueByMode: {
                light: primary,
                dark: "#b5c4ff",
              },
            },
            "company.surface": {
              valueByMode: {
                light: "#ffffff",
                dark: "#111318",
              },
            },
          },
        }),
      };
    },
  };
}

const application = defineTokenFragment({
  formatVersion: 1,
  id: "application",
  defaultVisibility: "public",
  tokens: {
    "app.action": {
      value: { ref: "company.primary" },
    },
    "app.canvas": {
      value: { ref: "company.surface" },
    },
  },
});

const result = buildTokenSet({
  source: companySource({ primary: "#1455d9" }),
  fragments: [application],
});

if (!result.ok) {
  for (const issue of result.issues) {
    switch (issue.code) {
      case "missing-company-primary":
        console.error("Company source configuration is incomplete");
        break;
      default:
        console.error(issue.code, issue.path);
    }
  }
}
```

Only `TokenSource` is executable. Its inputs and output graph remain JSON-safe.

## 16. Material 3 source

```ts
import { buildTokenSet, defineTokenFragment, exportCssVariables } from "color-scheme-tokens";

import { material3Source } from "color-scheme-tokens/sources/material3";

const application = defineTokenFragment({
  formatVersion: 1,
  id: "application",
  defaultVisibility: "public",
  tokens: {
    "app.canvas": {
      value: { ref: "m3.surface" },
    },
    "app.text": {
      value: { ref: "m3.on-surface" },
    },
    "app.action": {
      value: { ref: "m3.primary" },
    },
    "app.action-text": {
      value: { ref: "m3.on-primary" },
    },
    "app.error": {
      value: { ref: "m3.error" },
    },
  },
});

const built = buildTokenSet({
  source: material3Source({
    sourceColor: "#6750a4",
    algorithm: {
      variant: "tonalSpot",
      contrastLevel: 0,
      specVersion: "2021",
      platform: "phone",
    },
  }),
  fragments: [application],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

const css = exportCssVariables(built.value.tokenSet, {
  variablePrefix: "theme",
});

if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}
```

The source’s `m3.*` roles are internal by default; the application fragment defines the public contract.

To inspect/export a raw Material role explicitly:

```ts
const built = buildTokenSet({
  source: material3Source({
    sourceColor: "#6750a4",
  }),
  selection: {
    keys: ["m3.primary"],
  },
});
```

## 17. Conversion without gamut mapping

```ts
import { parseColor } from "color-scheme-tokens";

import { convertColor, isColorInGamut } from "color-scheme-tokens/conversion";

const parsed = parseColor({
  colorSpace: "display-p3",
  r: 1,
  g: 0.22,
  b: 0.08,
  alpha: 1,
});
if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

const converted = convertColor(parsed.value, "srgb");
if (!converted.ok) {
  throw new Error(JSON.stringify(converted.issues));
}

console.log(converted.value);
console.log(isColorInGamut(converted.value, "srgb"));
```

The converted sRGB coordinates may legitimately be outside `0…1`. Conversion does not clip or map.

## 18. Explicit gamut mapping

```ts
import { mapColorToGamut } from "color-scheme-tokens/conversion";

const mapped = mapColorToGamut(converted.value, "srgb", {
  method: "preserve-lightness",
});

if (!mapped.ok) {
  throw new Error(JSON.stringify(mapped.issues));
}

console.log(mapped.value);
```

Return mapped coordinates in OKLCH while targeting the sRGB boundary:

```ts
const mappedOklch = mapColorToGamut(converted.value, "srgb", {
  method: "preserve-lightness",
  outputSpace: "oklch",
});
```

The second argument is always physical target gamut; `outputSpace` is coordinate representation.

## 19. Wide-gamut Material input

Material’s adapter can perform the explicit policy internally:

```ts
const source = material3Source({
  sourceColor: {
    colorSpace: "display-p3",
    r: 0.95,
    g: 0.18,
    b: 0.42,
    alpha: 1,
  },
  gamutMapping: {
    method: "preserve-lightness",
  },
});
```

Without `gamutMapping`, an out-of-sRGB source returns `out-of-srgb-gamut`. In-gamut non-sRGB input may be converted without loss beyond ordinary floating-point transformation; final Material ARGB quantization is always a documented lossy boundary.

## 20. Build-time artifact generation

```ts
// scripts/build-theme.mts
import { writeFile } from "node:fs/promises";

import {
  buildTokenSet,
  defineTokenFragment,
  exportCssVariables,
  serializeTokenSet,
} from "color-scheme-tokens";

import { material3Source } from "color-scheme-tokens/sources/material3";

const application = defineTokenFragment({
  formatVersion: 1,
  id: "application",
  defaultVisibility: "public",
  tokens: {
    "app.background": {
      value: { ref: "m3.surface" },
    },
    "app.foreground": {
      value: { ref: "m3.on-surface" },
    },
  },
});

const result = buildTokenSet({
  source: material3Source({
    sourceColor: "#6750a4",
  }),
  fragments: [application],
});

if (!result.ok) {
  throw new Error(JSON.stringify(result.issues, null, 2));
}

const css = exportCssVariables(result.value.tokenSet, {
  variablePrefix: "theme",
  format: "pretty",
});
if (!css.ok) throw new Error(JSON.stringify(css.issues));

await Promise.all([
  writeFile("generated/theme.css", css.value, "utf8"),
  writeFile("generated/theme.tokens.json", serializeTokenSet(result.value.tokenSet), "utf8"),
]);
```

Exporters are explicit and only run when needed.

## 21. Structured issue handling

```ts
const result = compileTokenGraph(input);

if (!result.ok) {
  for (const issue of result.issues) {
    switch (issue.code) {
      case "invalid-token-key":
        console.error("Rename token", issue.path);
        break;

      case "unknown-reference":
        console.error("Fix reference", issue.path);
        break;

      case "reference-cycle":
        console.error("Cycle", issue.cycle, issue.mode);
        break;

      default:
        console.error(issue.code, issue.path, issue.message);
    }
  }
}
```

Consumers may exhaustively switch on exported code unions. Adding a code to a closed union is therefore a breaking change after v1.

## 22. Type-level authoring feedback

```ts
const graph = defineTokenGraph({
  formatVersion: 1,
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: {
    "app.background": {
      valueByMode: {
        light: "#ffffff",
        // Type error: dark is missing.
      },
    },
  },
});
```

Extra mode:

```ts
valueByMode: {
  light: "#ffffff",
  dark: "#111111",
  // Type error: not declared by graph.
  sepia: "#e8dcc0",
}
```

Runtime parsing remains authoritative for JavaScript and untrusted data.

## 23. JSON Schema use

```json
{
  "$schema": "./node_modules/color-scheme-tokens/schemas/token-graph.v1.schema.json",
  "formatVersion": 1,
  "modes": ["base"],
  "defaultMode": "base",
  "defaultVisibility": "public",
  "tokens": {
    "app.background": {
      "value": "#ffffff"
    }
  }
}
```

The schema provides editor feedback. Runtime parsing still checks semantic references, cycles, exact mode equality, and ownership.

## 24. Package import independence

Root-only application:

```ts
import { compileTokenGraph, defineTokenGraph } from "color-scheme-tokens";
```

This module graph must not load Texel or Material utilities.

Conversion is explicit:

```ts
import { convertColor } from "color-scheme-tokens/conversion";
```

Material is explicit:

```ts
import { material3Source } from "color-scheme-tokens/sources/material3";
```

There is no runtime `registerPlugin()` step.

## 25. Visibility is not confidentiality

```ts
const result = compileTokenGraph(graph, {
  selection: { keys: ["brand.primary"] },
});
```

This may explicitly emit an internal token. Canonical metadata can also name internal dependencies. Do not use visibility for secrets or access control.

<!-- END 05-USAGE-EXAMPLES.md -->

---

<!-- BEGIN 06-DECISION-LOG.md -->

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

<!-- END 06-DECISION-LOG.md -->

---

<!-- BEGIN 07-CURRENT-STATE-AUDIT.md -->

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

<!-- END 07-CURRENT-STATE-AUDIT.md -->
