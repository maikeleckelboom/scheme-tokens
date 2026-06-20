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
