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
