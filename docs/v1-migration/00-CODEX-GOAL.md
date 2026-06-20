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
