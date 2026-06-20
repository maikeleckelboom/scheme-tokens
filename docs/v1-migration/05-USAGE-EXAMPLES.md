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
