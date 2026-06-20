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
