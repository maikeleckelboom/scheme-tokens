# `scheme-tokens` pre-release audit and usage corpus

**Audit date:** 2026-06-20
**Repository:** <https://github.com/maikeleckelboom/scheme-tokens>
**Proposed release:** `scheme-tokens@0.1.0` and `@scheme-tokens/material3@0.1.0`

This document is both a consumer usage guide and a pre-release audit. It covers every public runtime export,
important type contracts, normal combinations, persistence boundaries, layer composition, CSS projection, Material 3
integration, framework/tooling patterns, and adversarial JavaScript inputs that materially alter behavior.

Snippet expectations: positive recipe snippets should be copy/paste plausible. Adversarial snippets are probes and may
intentionally return `Result` failures. Some later snippets use previously introduced fixtures such as `graph`,
`compiled`, or adapter-local helper functions. Syntax should still be valid TypeScript unless the snippet is explicitly
demonstrating invalid source text.

---

## 1. Product positioning and mental model

`scheme-tokens` is a small, engine-agnostic color scheme compiler for TypeScript and JavaScript apps. It lets consumers
author manual color tokens, compose generated bases and ordered layers, validate strict graph artifacts, export runtime
CSS variables, and serialize deterministic compiled schemes. The root package stays dependency-light. Optional engines
such as Material 3 live in adapter packages.

It is not:

- a Material wrapper (Material 3 is one optional adapter);
- a CSS-in-JS runtime engine;
- a browser theme mutator;
- a DTCG implementation;
- a Tailwind plugin;
- a general design-token platform for every token type.

The mental model:

```text
authoring helpers or strict graph input
  -> parse and validate
  -> compile selected tokens
  -> export CSS variables or serialize compiled JSON
```

With adapters:

```text
source adapters + authored layers
  -> buildScheme()
  -> sibling exports (CSS, serialized JSON, adapter-specific outputs)
```

---

## 2. Install and package boundaries

### Core-only install

```bash
pnpm add scheme-tokens
# or: npm install scheme-tokens
# or: yarn add scheme-tokens
```

The core package has no runtime dependencies.

### Material 3 adapter install

```bash
pnpm add scheme-tokens @scheme-tokens/material3
```

The adapter declares `scheme-tokens` as a peer dependency and dev dependency, not as a normal runtime dependency.

### Package subpaths

The core package exports only:

- `.` (runtime helpers and types)
- `./schemas/token-graph.v1.schema.json`
- `./schemas/token-layer.v1.schema.json`
- `./schemas/compiled-scheme.v1.schema.json`
- `./package.json`

There are no core conversion, Material, source adapter, or engine subpaths.

### Runtime imports

```ts
import {
  buildScheme,
  compileTokenGraph,
  createSchemeBuilder,
  defineTokenGraph,
  defineTokenLayer,
  defineTokens,
  exportCssVars,
  formatCssColor,
  parseColor,
  parseTokenGraph,
  serializeScheme,
} from "scheme-tokens";
```

### Representative type imports

```ts
import type {
  BuildSchemeIssue,
  BuildSchemeOptions,
  BuildSchemeSourceOptions,
  ColorInput,
  ColorValue,
  CompiledScheme,
  CompiledToken,
  CompileTokenGraphIssue,
  CompileTokenGraphOptions,
  CssModeSelectors,
  CssScope,
  CssVarBlock,
  CssVarsExport,
  ExportCssVarsIssue,
  ExportCssVarsOptions,
  Issue,
  JsonValue,
  Result,
  SchemeBuilder,
  SchemeBuilderConfig,
  TokenGraphInput,
  TokenGraph,
  TokenGraphIssue,
  TokenLayerInput,
  TokenOrigin,
  TokenSelection,
  TokenSource,
  TokenVisibility,
} from "scheme-tokens";
```

### ESM-only

The package exposes an ESM `import` condition only. CommonJS `require()` is unsupported.

```js
// Do not document this as supported.
const tokens = require("scheme-tokens");
```

### Node engine

Package metadata requires Node `>=22`. The bundle targets ES2022 and core has no runtime dependencies, but
package-manager engine enforcement may reject non-Node environments. Test the packed artifact in every target runtime
before documenting support.

### Load a schema with `createRequire`

```ts
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const graphSchema = require("scheme-tokens/schemas/token-graph.v1.schema.json");
```

### JSON import attributes where supported

```ts
import graphSchema from "scheme-tokens/schemas/token-graph.v1.schema.json" with { type: "json" };
```

---

## 3. Quick manual token usage

`defineTokens()` is the smallest manual-token helper. It accepts a token record plus optional graph-level options.

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
  primary: "#6750a4",
  "primary-foreground": "#ffffff",
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const css = exportCssVars(compiled.value);
if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}

console.log(css.value.css);
```

With no `modes` field, `defineTokens()` creates one mode named `base`. In a single-mode graph, `base` means "the one
ordinary value for this token." It is not a Material role, generated palette, light mode, or dark mode.

Directly authored tokens default to `public`, and compilation defaults to `selection: "public"`.

### Helper shorthand

`defineTokens()`, `defineTokenGraph()`, and `defineTokenLayer()` accept JSON-safe shorthand:

- a color string such as `"#6750a4"` becomes `{ value: "#6750a4" }`;
- a token-key string such as `"brand.primary"` becomes `{ value: { ref: "brand.primary" } }`;
- an explicit reference such as `{ ref: "brand.primary" }` becomes `{ value: { ref: "brand.primary" } }`;
- metadata plus mode keys such as `{ visibility: "public", light: "#fff", dark: "#000" }` becomes strict per-mode
  values when modes are declared;
- mode records such as `{ light: "#fff", dark: "#000" }` become `{ valueByMode: { light: "#fff", dark: "#000" } }`
  when modes are declared.

Supported color literals remain color values. Token-key-shaped non-color strings become references. This shorthand is
helper-only and is not accepted by `parseTokenGraph()`.

### Helper is not a validator

```ts
import { compileTokenGraph, defineTokens } from "scheme-tokens";

const graph = defineTokens({
  background: "not a color",
});

// Validation occurs here, not in defineTokens().
const result = compileTokenGraph(graph);
```

### Reference shorthand

```ts
import { defineTokens } from "scheme-tokens";

const graph = defineTokens({
  "brand.primary": "#6750a4",
  primary: "brand.primary",
});
```

### Explicit strict value

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.primary": { value: "#6750a4" },
  },
});
```

### Internal palette with public aliases

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  defaultVisibility: "internal",
  tokens: {
    "palette.violet-40": "#6750a4",
    "palette.white": "#ffffff",
    primary: {
      visibility: "public",
      value: { ref: "palette.violet-40" },
    },
    "primary-foreground": {
      visibility: "public",
      value: { ref: "palette.white" },
    },
  },
});
```

`defaultVisibility: "internal"` keeps source tokens out of the ordinary compiled scheme unless a token opts into
`visibility: "public"`. Public tokens may reference internal tokens. `internal` controls default selection, not
confidentiality.

### Metadata and extensions

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "app.legacy-accent": {
      value: "#ff00ff",
      visibility: "public",
      description: "Legacy accent retained for old themes.",
      deprecated: "Use primary instead.",
      extensions: {
        "company.figma": {
          collection: "Semantic colors",
          variableId: "VariableID:123",
        },
        "company.review": {
          owner: "design-systems",
          approved: false,
        },
      },
    },
  },
});
```

Extension keys require at least two lower-kebab namespace segments.

### Unusual valid token keys

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    constructor: "#ffffff",
    prototype: "#000000",
    "brand.primary": "#6750a4",
    "release.2026-color": "#123456",
  },
});
```

### Invalid token key matrix

```ts
import { compileTokenGraph } from "scheme-tokens";

const candidates = [
  "App.background",
  "app_background",
  "app..background",
  ".app",
  "app.",
  "app/background",
  "app background",
  "app.2nd-color",
  "__proto__",
];

for (const key of candidates) {
  console.log(
    key,
    compileTokenGraph({
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: { [key]: { value: "#ffffff" } },
    }),
  );
}
```

Expected: `invalid-token-key` for each candidate.

### Token keys

Core token keys use dot-separated lower-kebab identifier segments. Valid examples:

- `background`
- `primary-foreground`
- `brand.primary`
- `material3.on-primary`

Core does not accept camelCase, snake_case, PascalCase, spaces, or mixed casing in token keys. The strict parser and
JSON Schemas reject those names with contractual diagnostics instead of normalizing them.

---

## 4. Light and dark schemes

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "internal",
  tokens: {
    "brand.primary": {
      light: "#6750a4",
      dark: "#d0bcff",
    },
    "brand.on-primary": {
      light: "#ffffff",
      dark: "#381e72",
    },
    background: {
      visibility: "public",
      light: "#ffffff",
      dark: "#141218",
    },
    foreground: {
      visibility: "public",
      light: "#111111",
      dark: "#f5eff7",
    },
    primary: {
      visibility: "public",
      value: "brand.primary",
    },
    "primary-foreground": {
      visibility: "public",
      value: "brand.on-primary",
    },
  },
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const css = exportCssVars(compiled.value);
if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}

console.log(css.value.css);
```

The default CSS selectors are `:root` for the default mode and `:root[data-color-scheme="dark"]` for the dark mode.

### Strict `valueByMode`

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    background: {
      valueByMode: {
        light: "#ffffff",
        dark: "#141218",
      },
    },
  },
});
```

### References resolve independently by mode

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "internal",
  tokens: {
    "brand.primary": {
      light: "#6750a4",
      dark: "#d0bcff",
    },
    primary: {
      visibility: "public",
      value: { ref: "brand.primary" },
    },
  },
});
```

### Unusual mode vocabulary

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["daylight", "club", "red-light", "oled", "projector", "high-contrast", "e-ink", "print"],
  defaultMode: "daylight",
  tokens: {
    background: {
      valueByMode: {
        daylight: "#f8f8f8",
        club: "#101014",
        "red-light": "#120000",
        oled: "#000000",
        projector: "#181818",
        "high-contrast": "#000000",
        "e-ink": "#ffffff",
        print: "#ffffff",
      },
    },
  },
});
```

### Helper-reserved mode names throw

```ts
import { defineTokenGraph } from "scheme-tokens";

defineTokenGraph({
  modes: ["value", "dark"],
  defaultMode: "value",
  tokens: {
    background: {
      value: "#ffffff",
      dark: "#000000",
    },
  },
});
```

Reserved helper names: `visibility`, `description`, `deprecated`, `extensions`, `value`, and `valueByMode`.

### Strict input can use a helper-reserved mode

```ts
import { parseTokenGraph } from "scheme-tokens";

parseTokenGraph({
  formatVersion: 1,
  modes: ["value", "dark"],
  defaultMode: "value",
  defaultVisibility: "public",
  tokens: {
    background: {
      valueByMode: {
        value: "#ffffff",
        dark: "#000000",
      },
    },
  },
});
```

This helper/wire-format divergence is documented: helper shorthand reserves those names so mode-key detection does not
silently reinterpret token definitions.

---

## 5. Strict graph parsing and JSON schemas

`parseTokenGraph()` accepts strict persisted graph input. Strict graph input spells out `formatVersion`, `modes`,
`defaultMode`, `defaultVisibility`, and token definitions with `value` or `valueByMode`.

### Parse JSON from disk

```ts
import { readFile } from "node:fs/promises";
import { parseTokenGraph } from "scheme-tokens";

const input: unknown = JSON.parse(await readFile("tokens.graph.json", "utf8"));

const parsed = parseTokenGraph(input);
if (!parsed.ok) {
  console.error(parsed.issues);
}
```

### Strict shape

```ts
import { parseTokenGraph } from "scheme-tokens";

const strictGraph = {
  $schema: "https://scheme-tokens.dev/schemas/token-graph.v1.schema.json",
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    background: { value: "#ffffff" },
  },
} as const;

parseTokenGraph(strictGraph);
```

### Authoring shorthand is rejected at the wire boundary

```ts
import { parseTokenGraph } from "scheme-tokens";

parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    background: "#ffffff",
  },
});
```

Expected: `invalid-token-definition`. Persist `{ "value": "#ffffff" }` instead.

### Unknown graph and token fields

```ts
import { parseTokenGraph } from "scheme-tokens";

parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    background: {
      value: "#ffffff",
      figmaId: "123",
    },
  },
  metadata: {},
});
```

Expected: `unknown-property`. Use namespaced `extensions` for metadata.

### Exact reference object

```ts
import { parseTokenGraph } from "scheme-tokens";

parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    "brand.primary": { value: "#6750a4" },
    primary: { value: { ref: "brand.primary" } },
  },
});
```

### Reference extras are rejected

```ts
import { parseTokenGraph } from "scheme-tokens";

parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    primary: {
      value: {
        ref: "brand.primary",
        fallback: "#000000",
      },
    },
  },
});
```

Expected: `unknown-property`.

### Unknown reference and JSON Pointer path

```ts
import { parseTokenGraph } from "scheme-tokens";

const result = parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    primary: { value: { ref: "missing.token" } },
  },
});

if (!result.ok) {
  console.log(result.issues[0]?.path);
  // /tokens/primary/value
}
```

### Cycle in one mode only

```ts
import { parseTokenGraph } from "scheme-tokens";

parseTokenGraph({
  formatVersion: 1,
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: {
    "a.color": {
      valueByMode: {
        light: "#ffffff",
        dark: { ref: "b.color" },
      },
    },
    "b.color": {
      valueByMode: {
        light: "#000000",
        dark: { ref: "a.color" },
      },
    },
  },
});
```

Expected: `reference-cycle`.

### Null-prototype records

```ts
import { parseTokenGraph } from "scheme-tokens";

const tokens = Object.create(null) as Record<string, unknown>;
tokens["background"] = { value: "#ffffff" };

const graph = Object.assign(Object.create(null), {
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens,
});

parseTokenGraph(graph);
```

### Class graph is rejected

```ts
import { parseTokenGraph } from "scheme-tokens";

class Graph {
  formatVersion = 1;
  modes = ["base"];
  defaultMode = "base";
  defaultVisibility = "public";
  tokens = {};
}

parseTokenGraph(new Graph());
```

Expected: `invalid-object`. The plain-record reader rejects prototypes other than `Object.prototype` or `null`.

### Non-enumerable and symbol fields are outside JSON

```ts
import { parseTokenGraph } from "scheme-tokens";

const hidden = Symbol("hidden");
const graph = {
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {},
  [hidden]: "ignored",
};

Object.defineProperty(graph, "alsoIgnored", {
  enumerable: false,
  value: true,
});

parseTokenGraph(graph);
```

### Cyclic extension data

```ts
import { parseTokenGraph } from "scheme-tokens";

const payload: Record<string, unknown> = {};
payload.self = payload;

parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    background: {
      value: "#ffffff",
      extensions: { "example.payload": payload },
    },
  },
});
```

Expected: an `invalid-json-value` issue, not an exception.

### Shared but non-cyclic extension data

```ts
import { parseTokenGraph } from "scheme-tokens";

const shared = { owner: "design-systems" };

parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    background: {
      value: "#ffffff",
      extensions: {
        "example.first": shared,
        "example.second": shared,
      },
    },
  },
});
```

Sharing is copied as JSON data and is not a cycle.

### Input mutation after parsing

```ts
import { parseTokenGraph } from "scheme-tokens";

const input = {
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    background: { value: "#ffffff" },
  },
};

const parsed = parseTokenGraph(input);
if (parsed.ok) {
  (input.tokens.background as { value: string }).value = "#000000";
  console.log(parsed.value.tokens.background?.valueByMode.base);
  // remains white
}
```

### JSON Schema validation pipeline

The published JSON Schemas describe strict persisted artifacts only: token graph input, token layer input, and
serialized compiled scheme output. They do not describe `defineTokens()`, `defineTokenGraph()`, or `defineTokenLayer()`
helper shorthand.

```ts
import { createRequire } from "node:module";
import Ajv2020 from "ajv/dist/2020";

const require = createRequire(import.meta.url);
const graphSchema = require("scheme-tokens/schemas/token-graph.v1.schema.json");
const layerSchema = require("scheme-tokens/schemas/token-layer.v1.schema.json");
const compiledSchema = require("scheme-tokens/schemas/compiled-scheme.v1.schema.json");

const ajv = new Ajv2020({
  allErrors: true,
  schemas: [graphSchema, layerSchema, compiledSchema],
});

const validateGraph = ajv.getSchema("https://scheme-tokens.dev/schemas/token-graph.v1.schema.json");

if (validateGraph === undefined) {
  throw new Error("Graph schema was not registered.");
}

const unknownGraph: unknown = JSON.parse(text);

if (!validateGraph(unknownGraph)) {
  throw new Error(JSON.stringify(validateGraph.errors, null, 2));
}
```

### Schema is structural preflight only

The graph schema accepts any string as a color value, including `"red"`, while the parser rejects named colors other
than `transparent`. Schemas also cannot enforce default-mode membership, exact per-mode keys, reference existence,
cycles, or compiled mode-record equality.

Document the pipeline as:

```text
JSON Schema shape validation
  -> parseTokenGraph semantic validation
  -> compileTokenGraph reference resolution and selection
```

### Schema cannot correlate mode keys

```ts
const input = {
  formatVersion: 1,
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: {
    background: {
      valueByMode: { light: "#ffffff" },
    },
  },
};
```

The parser must reject missing `dark` even if structural schema validation succeeds.

### Editor schema association

```json
{
  "json.schemas": [
    {
      "fileMatch": ["/tokens/**/*.graph.json"],
      "url": "./node_modules/scheme-tokens/schemas/token-graph.v1.schema.json"
    }
  ]
}
```

---

## 6. Compilation and selection

### Default public selection

```ts
import { compileTokenGraph, defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  defaultVisibility: "internal",
  tokens: {
    "palette.primary": "#6750a4",
    primary: {
      visibility: "public",
      value: { ref: "palette.primary" },
    },
  },
});

const compiled = compileTokenGraph(graph);
if (compiled.ok) {
  console.log(Object.keys(compiled.value.tokens));
  // ["primary"]
}
```

### All tokens

```ts
import { compileTokenGraph } from "scheme-tokens";

const compiled = compileTokenGraph(graph, { selection: "all" });
```

### Exact keys

```ts
import { compileTokenGraph } from "scheme-tokens";

const compiled = compileTokenGraph(graph, {
  selection: { keys: ["background", "foreground"] },
});
```

### Select an internal token exactly

```ts
import { compileTokenGraph, defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  defaultVisibility: "internal",
  tokens: {
    "palette.primary": "#6750a4",
  },
});

const compiled = compileTokenGraph(graph, {
  selection: { keys: ["palette.primary"] },
});

if (compiled.ok) {
  console.log(compiled.value.tokens["palette.primary"]?.visibility);
  // internal
}
```

### Dependencies resolve but are omitted from exact output

```ts
import { compileTokenGraph, defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  defaultVisibility: "internal",
  tokens: {
    "palette.primary": "#6750a4",
    primary: {
      visibility: "public",
      value: { ref: "palette.primary" },
    },
  },
});

const compiled = compileTokenGraph(graph, {
  selection: { keys: ["primary"] },
});

if (compiled.ok) {
  console.log(Object.keys(compiled.value.tokens));
  // ["primary"]

  console.log(compiled.value.tokens.primary?.dependenciesByMode.base);
  // ["palette.primary"]
}
```

### Dependencies are direct only

```ts
import { compileTokenGraph, defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "palette.primary": "#6750a4",
    "semantic.action": { ref: "palette.primary" },
    "button.background": { ref: "semantic.action" },
  },
});

const compiled = compileTokenGraph(graph);
if (compiled.ok) {
  console.log(compiled.value.tokens["button.background"]?.dependenciesByMode.base);
  // ["semantic.action"]
}
```

`dependenciesByMode` stores direct dependencies only. Full transitive analysis is intentionally not stored in every
compiled token.

### Output order is canonical, not request order

```ts
import { compileTokenGraph } from "scheme-tokens";

const compiled = compileTokenGraph(graph, {
  selection: { keys: ["z.last", "a.first"] },
});

if (compiled.ok) {
  console.log(Object.keys(compiled.value.tokens));
  // code-unit sorted
}
```

### Empty, duplicate, and unknown selections

```ts
import { compileTokenGraph } from "scheme-tokens";

compileTokenGraph(graph, { selection: { keys: [] } });
compileTokenGraph(graph, {
  selection: { keys: ["background", "background"] },
});
compileTokenGraph(graph, {
  selection: { keys: ["missing.token"] },
});
```

Expected codes: `empty-selection`, `duplicate-selection-key`, `unknown-selection-key`.

### No public tokens

```ts
import { compileTokenGraph, defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  defaultVisibility: "internal",
  tokens: { "palette.primary": "#6750a4" },
});

compileTokenGraph(graph); // no-selected-tokens
compileTokenGraph(graph, { selection: "all" }); // succeeds
```

### Whole-graph validation precedes selection

```ts
import { compileTokenGraph } from "scheme-tokens";

compileTokenGraph(
  {
    formatVersion: 1,
    modes: ["base"],
    defaultMode: "base",
    defaultVisibility: "internal",
    tokens: {
      background: {
        visibility: "public",
        value: "#ffffff",
      },
      "unused.invalid": {
        value: { ref: "missing.target" },
      },
    },
  },
  { selection: { keys: ["background"] } },
);
```

The whole graph fails. This is intentional current policy: selection controls output, not the graph-validation boundary.

### 10,001-token reference chain

```ts
import { compileTokenGraph } from "scheme-tokens";

const tokens: Record<string, { value: string | { ref: string } }> = {
  "chain.t00000": { value: "#000000" },
};

for (let index = 1; index <= 10_000; index += 1) {
  const current = index.toString().padStart(5, "0");
  const previous = (index - 1).toString().padStart(5, "0");
  tokens[`chain.t${current}`] = {
    value: { ref: `chain.t${previous}` },
  };
}

compileTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens,
});
```

Reference resolution is iterative, not recursive. The repository tests this for stack safety.

---

## 7. Layers and `buildScheme()`

Layers are ordered authored token overlays. A generated base is optional; a layer-only build does not need an empty base
array.

### Layer-only build

```ts
import { buildScheme, defineTokenLayer } from "scheme-tokens";

const base = defineTokenLayer({
  id: "base",
  tokens: {
    background: "#ffffff",
    foreground: "#111111",
    primary: "#6750a4",
  },
});

const brand = defineTokenLayer({
  id: "brand",
  tokens: {
    primary: "#ff3b30",
  },
});

const built = buildScheme({
  layers: [base, brand],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}
```

Later layers win by token key. This is deterministic token composition, not CSS cascade behavior: there is no selector
specificity, `!important`, CSS `@layer`, DOM mutation, or style injection.

### Layer-only light and dark build

`defineTokenLayer()` requires `modes` when the layer itself needs to normalize pure mode records.
`buildScheme({ modes, defaultMode, layers })` is the canonical form for layer-only multi-mode builds.

```ts
import { buildScheme, defineTokenLayer } from "scheme-tokens";

const base = defineTokenLayer<"light" | "dark">({
  id: "base",
  modes: ["light", "dark"],
  tokens: {
    background: {
      light: "#ffffff",
      dark: "#141218",
    },
    foreground: {
      light: "#111111",
      dark: "#f5eff7",
    },
  },
});

const built = buildScheme({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [base],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}
```

### Generated base plus application layers

```ts
import { buildScheme, defineTokenLayer, exportCssVars } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const application = defineTokenLayer<"light" | "dark">({
  id: "application",
  tokens: {
    background: "material3.surface",
    foreground: "material3.on-surface",
    primary: "material3.primary",
    "primary-foreground": "material3.on-primary",
  },
});

const built = buildScheme(
  material3({ sourceColors: "#6750a4" }, { defaultVisibility: "internal" }),
  { layers: [application] },
);

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

const css = exportCssVars(built.value);
if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}

console.log(css.value.css);
```

### Repeated builds with `createSchemeBuilder()`

```ts
import { createSchemeBuilder, defineTokenLayer, exportCssVars } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const application = defineTokenLayer<"light" | "dark">({
  id: "application",
  defaultVisibility: "public",
  tokens: {
    background: "material3.surface",
    foreground: "material3.on-surface",
    primary: "material3.primary",
    "primary-foreground": "material3.on-primary",
  },
});

const builder = createSchemeBuilder({
  layers: [application],
});

const built = builder.build(material3("#6750a4"));
if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

const exported = exportCssVars(built.value);
if (!exported.ok) {
  throw new Error(JSON.stringify(exported.issues, null, 2));
}

console.log(exported.value.css);
```

`createSchemeBuilder()` prepares reusable build options without a base. Its `build()` method accepts a source shorthand
such as `material3("#6750a4")`, an explicit object such as `{ base: material3("#6750a4") }`, or no argument for a
layer-only build. The prepared config is isolated from caller mutation.

### `buildScheme()` signatures

- `buildScheme({ base, layers, modes, defaultMode, defaultVisibility, selection })` is the canonical explicit form.
- `buildScheme(source)` and `buildScheme([sourceA, sourceB])` are base-only convenience forms.
- `buildScheme(source, { layers, selection })` is generated-base plus application layers.
- At least one base input or layer is required.

### Layer composition rules

- When base inputs are present, they compose first in array order. Duplicate token keys across base inputs are invalid.
- Layers compose after base inputs as ordered authored token overlays. Later layers win by token key, and a layer may
  override a base token.
- References, missing-reference checks, and circular-reference checks run after final composition.
- Winning token origin metadata points at the winning base input or layer.
- Mixed source/layer positional arrays are intentionally unsupported. Use `buildScheme({ base, layers })` or
  `buildScheme(source, { layers })` instead.

### Strict layers in persisted graph input

Strict graph input may include a `layers` array. Each layer is a strict `TokenLayerInput` with `formatVersion`, `id`,
`defaultVisibility`, and `tokens`.

```ts
import { parseTokenGraph } from "scheme-tokens";

const parsed = parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    primary: { value: "#6750a4" },
  },
  layers: [
    {
      formatVersion: 1,
      id: "brand",
      defaultVisibility: "public",
      tokens: {
        primary: { value: "#ff3b30" },
      },
    },
  ],
});

if (parsed.ok) {
  console.log(parsed.value.tokens.primary?.origin);
  // { kind: "layer", id: "brand" }
}
```

### Layer id diagnostics

```ts
import { parseTokenGraph } from "scheme-tokens";

parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {},
  layers: [
    {
      formatVersion: 1,
      id: "Application",
      defaultVisibility: "public",
      tokens: {},
    },
  ],
});
```

Expected: `invalid-layer-id` at `/layers/0/id`.

### References resolve against final layer winners

```ts
import { compileTokenGraph } from "scheme-tokens";

const compiled = compileTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    primary: { value: "#6750a4" },
    background: { value: { ref: "primary" } },
  },
  layers: [
    {
      formatVersion: 1,
      id: "brand",
      defaultVisibility: "public",
      tokens: {
        primary: { value: "#ff3b30" },
      },
    },
  ],
});

if (compiled.ok) {
  console.log(compiled.value.tokens.background?.valueByMode.base);
  // resolved from #ff3b30, the layer winner
}
```

---

## 8. Material 3 adapter

Material 3 output is provided by `@scheme-tokens/material3`, not by the root package. The adapter vendors a pinned
official Material Color Utilities TypeScript snapshot and emits strict `light` and `dark` graph tokens under a
lower-kebab source id namespace.

### Basic Material source

```ts
import { buildScheme } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const built = buildScheme(material3("#6750a4"));
if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}
```

### Shorthand and canonical object input

`material3("#6750a4")` is shorthand for `material3({ sourceColors: "#6750a4" })`.

```ts
import { material3 } from "@scheme-tokens/material3";

const base = material3({ sourceColors: "#6750a4" });
```

### Multi-source shorthand

```ts
import { material3 } from "@scheme-tokens/material3";

const base = material3(["#6750a4", "#00a88f"], { variant: "cmf", specVersion: "2026" });
```

The first color is the primary source color. Additional colors are passed to the official multi-source Material
generation path in array order.

### Object input with generation options and integration policy

```ts
import { material3 } from "@scheme-tokens/material3";

const base = material3(
  {
    sourceColors: ["#6750a4", "#00a88f"],
    variant: "cmf",
    specVersion: "2026",
    contrastLevel: 0.5,
    extendedColors: [{ name: "success", color: "#2e7d32", harmonize: true }],
  },
  {
    id: "brand-material",
    defaultVisibility: "internal",
  },
);
```

`variant`, `contrastLevel`, `specVersion`, `platform`, `palettes`, `extendedColors`, and `paletteTones` belong in the
first argument (generation input). `id` and `defaultVisibility` belong in the optional second argument (integration
policy).

### Shorthand input with generation and integration options

```ts
import { material3 } from "@scheme-tokens/material3";

const base = material3("#6750a4", { variant: "expressive" }, { defaultVisibility: "internal" });
```

With shorthand input, the second argument is Material generation options and the third argument is integration policy.

### `material3Preset()`

```ts
import { material3Preset } from "@scheme-tokens/material3";

const material = material3Preset({ variant: "tonal-spot" }, { defaultVisibility: "internal" });

const base = material("#6750a4");
```

Runtime generation input wins over preset defaults. Arrays such as `extendedColors` replace preset arrays. Integration
options are fixed at preset creation.

### Dynamic controls

```ts
import { material3 } from "@scheme-tokens/material3";

const base = material3({
  sourceColors: "#6750a4",
  variant: "expressive",
  contrastLevel: 0.5,
  specVersion: "2026",
  platform: "phone",
});
```

Supported variants: `monochrome`, `neutral`, `tonal-spot`, `vibrant`, `expressive`, `fidelity`, `content`, `rainbow`,
`fruit-salad`, `cmf`. `cmf` requires `specVersion: "2026"`.

### Palette overrides

```ts
import { material3 } from "@scheme-tokens/material3";

const base = material3({
  sourceColors: "#6750a4",
  palettes: {
    primary: "#6750a4",
    secondary: "#006a60",
    tertiary: "#7d5260",
    neutral: "#605d62",
    neutralVariant: "#605d66",
    error: "#ba1a1a",
  },
});
```

### Extended colors

```ts
import { material3 } from "@scheme-tokens/material3";

const base = material3({
  sourceColors: "#6750a4",
  extendedColors: [
    {
      name: "success",
      color: "#2e7d32",
      harmonize: true,
      description: "Positive state color",
    },
  ],
});
```

Generated keys:

```text
material3.extended.success.color
material3.extended.success.on-color
material3.extended.success.color-container
material3.extended.success.on-color-container
```

### Palette tone tokens

```ts
import { material3 } from "@scheme-tokens/material3";

const base = material3({
  sourceColors: "#6750a4",
  paletteTones: [0, 40, 90, 100],
});
```

`paletteTones: true` emits the material-schemes tone list. Palette tone token keys are lower-kebab and core-schema
compatible:

```text
material3.palette.primary.tone-40
material3.palette.secondary.tone-90
material3.extended.success.palette.tone-40
```

### Custom namespace

```ts
import { buildScheme } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const source = material3({ sourceColors: "#6750a4" }, { id: "brand-material" });
const built = buildScheme(source);
if (built.ok) {
  console.log(Object.keys(built.value.tokens).some((key) => key.startsWith("brand-material.")));
  // true
}
```

### Material role keys differ by spec version

Newer roles such as `primary-dim`, `secondary-dim`, `tertiary-dim`, and `error-dim` are emitted only when the selected
official `specVersion` exposes them. Consumers should not assume every spec version has an identical role-key surface.

### Accepted and rejected source-color forms

```ts
import { material3 } from "@scheme-tokens/material3";

material3("#6750a4").build(); // accepted
material3("#AABBCC").build(); // accepted
material3({ sourceColors: "#6750a4" }).build(); // accepted

material3({ sourceColors: "#abc" }).build(); // rejected: material3-unsupported-color-input
material3({ sourceColors: "#6750a480" }).build(); // rejected: material3-unsupported-color-input
material3({ sourceColors: "rgb(103 80 164)" }).build(); // rejected: material3-unsupported-color-input
material3({ sourceColors: [] }).build(); // rejected: material3-invalid-source-colors
```

The adapter deliberately accepts strict opaque `#rrggbb` only, not the root parser's broader input grammar.

### Stale option names are rejected

The adapter rejects removed or older option names instead of treating them as aliases. `sourceColor`, `color`,
`seedColor`, `customColors`, `style`, and similar stale fields produce `material3-invalid-input` issues.

### Two Material themes in one build

```ts
import { buildScheme, defineTokenLayer } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const application = defineTokenLayer<"light" | "dark">({
  id: "application",
  tokens: {
    "app.consumer-action": "consumer-brand.primary",
    "app.pro-action": "pro-brand.primary",
  },
});

const built = buildScheme(
  [
    material3({ sourceColors: "#6750a4" }, { id: "consumer-brand", defaultVisibility: "internal" }),
    material3({ sourceColors: "#006a6a" }, { id: "pro-brand", defaultVisibility: "internal" }),
  ],
  { layers: [application] },
);
```

### Engine provenance

The adapter vendors a minimal official TypeScript snapshot from
`material-foundation/material-color-utilities@6fd88eb3e95ba1d457842e2a2bf847d06b3a018a`. Vendored internals remain
package-private and preserve upstream Apache-2.0 license provenance. The root package does not import, export, document
as required, or depend on the Material engine.

---

## 9. CSS variable export

`exportCssVars()` returns one `Result` whose success value contains `css` and `blocks`. `css` is the serialized
stylesheet string. `blocks` contains one structured block per compiled mode, preserving the CSS model as
`{ mode, selector, declarations }` for runtime application, previews, or custom renderers.

### Default export

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokenGraph({
    modes: ["light", "dark"],
    defaultMode: "light",
    tokens: {
      background: { light: "#ffffff", dark: "#141218" },
      foreground: { light: "#111111", dark: "#f5eff7" },
    },
  }),
);

if (compiled.ok) {
  const css = exportCssVars(compiled.value);
  if (css.ok) {
    console.log(css.value.css);
    console.log(css.value.blocks[0]?.declarations["--background"]);
  }
}
```

Default selectors:

```css
:root {
}

:root[data-color-scheme="dark"] {
}
```

### Prefix

Omit `prefix`, pass `undefined`, or pass `""` to emit unprefixed custom properties such as `--background` and
`--primary-foreground`. Pass `prefix: "color"` to emit namespaced properties such as `--color-background`.

Dot-separated token keys flatten with hyphens: `material3.primary` exports as `--material3-primary` without a prefix or
`--color-material3-primary` with `prefix: "color"`.

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, { prefix: "color" });
```

### Compact format

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, { format: "compact" });
```

Compact output has no pretty whitespace or trailing newline.

### Explicit root scope

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  scope: { strategy: "root" },
});
```

### Scoped element

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  scope: {
    strategy: "selector",
    selector: ".application",
  },
});
```

Generated selectors:

```css
.application {
}

.application[data-color-scheme="dark"] {
}
```

### Custom data attribute

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  modeSelectors: {
    strategy: "data-attribute",
    attribute: "data-theme",
  },
});
```

### Class strategy

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  modeSelectors: {
    strategy: "class",
    classPrefix: "theme-",
  },
});
```

Generated selectors:

```css
:root {
}

:root.theme-dark {
}
```

The default mode has no class.

### Scoped class applies to the same element

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  scope: {
    strategy: "selector",
    selector: ".widget",
  },
  modeSelectors: {
    strategy: "class",
    classPrefix: "theme-",
  },
});
```

This generates `.widget.theme-dark`, not `.theme-dark .widget`.

### Exact selectors for every mode

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  modeSelectors: {
    strategy: "selectors",
    selectors: {
      light: ':root[data-theme="light"]',
      dark: ':root[data-theme="dark"]',
    },
  },
});
```

Omit `scope` when exact selectors are supplied.

### Shadow DOM host with generated class

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  scope: {
    strategy: "selector",
    selector: ":host",
  },
  modeSelectors: {
    strategy: "class",
    classPrefix: "theme-",
  },
});
```

Expected non-default selector: `:host.theme-dark`. Test it in a browser, not only the heuristic validator.

### Selector limitations

The CSS exporter uses a conservative selector validator, not a full CSS parser. It rejects parentheses, braces,
semicolons, at-signs, comments, leading/trailing combinators, and whitespace-adjacent combinators. This means:

- functional pseudo-classes such as `:is()`, `:where()`, and `:host-context()` are rejected;
- attribute selectors with operators such as `^=` are rejected;
- selector lists in generated scope positions are accepted by the validator but transformed incorrectly (only the last
  list member receives the mode condition);
- pseudo-elements in generated scope positions produce invalid selector placement.

Use exact selectors when you need selector lists, functional pseudo-classes, or pseudo-elements. The validator is a
safe simple-selector subset, not general selector validity.

### Invalid prefix matrix

```ts
import { exportCssVars } from "scheme-tokens";

for (const prefix of ["", "Theme", "theme.tokens", "theme_tokens", "2theme"]) {
  console.log(exportCssVars(compiled, { prefix } as never));
}
```

Empty prefix is valid (emits unprefixed). Others produce `invalid-css-prefix`.

### Missing, unknown, and duplicate exact selectors

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  modeSelectors: {
    strategy: "selectors",
    selectors: { light: ":root" },
  },
});

exportCssVars(compiled, {
  modeSelectors: {
    strategy: "selectors",
    selectors: {
      light: ":root",
      dark: ".dark",
      sepia: ".sepia",
    },
  },
});

exportCssVars(compiled, {
  modeSelectors: {
    strategy: "selectors",
    selectors: {
      light: ":root",
      dark: ":root",
    },
  },
});
```

Expected codes: `missing-mode-selector`, `unknown-mode-selector`, `duplicate-mode-selector`.

### Write a CSS file

```ts
import { writeFile } from "node:fs/promises";
import { exportCssVars } from "scheme-tokens";

const css = exportCssVars(compiled);
if (css.ok) {
  await writeFile("dist/theme.css", css.value.css, "utf8");
}
```

### Inline SSR style

```ts
function escapeStyleText(css: string): string {
  return css.replaceAll("</style", "<\\/style");
}

const css = exportCssVars(compiled);
if (css.ok) {
  const html = `<style data-generated-theme>${escapeStyleText(css.value.css)}</style>`;
}
```

### Constructable stylesheet

```ts
const css = exportCssVars(compiled);
if (css.ok) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css.value.css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}
```

### Caller-owned media query

```ts
const variables = exportCssVars(compiled);
if (variables.ok) {
  const css = `@media (prefers-contrast: more) {\n${variables.value.css}\n}`;
}
```

The exporter does not own at-rules. Verify cascade semantics; simply wrapping root blocks may not model the intended
mode.

---

## 10. Tailwind v4 mapping boundary

`scheme-tokens` owns authored token names and runtime CSS variables. Tailwind owns the `@theme` namespace it needs to
generate utilities. Keep those contracts separate: export stable runtime variables from `scheme-tokens`, then map the
color tokens your app wants Tailwind to expose.

Step 1: compile and export runtime CSS variables.

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
  primary: "#6750a4",
  "primary-foreground": "#ffffff",
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const css = exportCssVars(compiled.value);
if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}

console.log(css.value.css);
```

Step 2: load the generated runtime CSS in your app.

```css
:root {
  --background: #ffffff;
  --foreground: #111111;
  --primary: #6750a4;
  --primary-foreground: #ffffff;
}
```

Step 3: map those runtime variables into Tailwind's color contract explicitly.

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
}
```

Tailwind utilities now use Tailwind's `--color-*` theme variables, while the runtime variables from `scheme-tokens`
remain authored, stable, and unprefixed. Do not derive Tailwind colors by blindly remapping every exported declaration;
keep the mapping to the color tokens that are part of your app's Tailwind contract.

---

## 11. Serialization

`serializeScheme()` serializes compiled schemes only. It returns deterministic JSON text ending with a newline.

### Serialize compiled output

```ts
import { compileTokenGraph, defineTokenGraph, serializeScheme } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.primary": "#6750a4",
    "surface.canvas": "#ffffff",
  },
});

const compiled = compileTokenGraph(graph);
if (compiled.ok) {
  const json = serializeScheme(compiled.value);
  console.log(json.endsWith("\n")); // true
}
```

### Write compiled JSON

```ts
import { writeFile } from "node:fs/promises";
import { serializeScheme } from "scheme-tokens";

await writeFile("dist/tokens.compiled.json", serializeScheme(compiled), "utf8");
```

### Deterministic content hash

```ts
import { createHash } from "node:crypto";
import { serializeScheme } from "scheme-tokens";

const serialized = serializeScheme(compiled);
const digest = createHash("sha256").update(serialized).digest("hex");
```

### Insertion order does not change canonical output

```ts
import { compileTokenGraph, serializeScheme } from "scheme-tokens";

const left = compileTokenGraph({
  formatVersion: 1,
  modes: ["dark", "light"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: {
    "b.color": { value: "#111111" },
    "a.color": { value: "#ffffff" },
  },
});

const right = compileTokenGraph({
  formatVersion: 1,
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: {
    "a.color": { value: "#ffffff" },
    "b.color": { value: "#111111" },
  },
});

if (left.ok && right.ok) {
  console.log(serializeScheme(left.value) === serializeScheme(right.value)); // true
}
```

### Authoring syntax is normalized away

```ts
import { compileTokenGraph, defineTokenGraph, serializeScheme } from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokenGraph({
    tokens: { background: "rgb(255 255 255)" },
  }),
);

if (compiled.ok) {
  console.log(serializeScheme(compiled.value));
  // contains a normalized color object, not the original string
}
```

### Compiled JSON is not graph input

```ts
import { parseTokenGraph, serializeScheme } from "scheme-tokens";

const persisted = JSON.parse(serializeScheme(compiled));
parseTokenGraph(persisted); // wrong artifact kind
```

References are resolved and the shape differs.

### No public compiled-scheme parser

There is no public `parseCompiledScheme()` in the current API. Exporters and the serializer trust `CompiledScheme`. A
malformed or tampered artifact can throw, produce invalid CSS, or be silently rewritten.

**Recommendation:** Add `parseCompiledScheme()` as a safe parse boundary, or document the trust boundary and provide a
complete AJV recipe. Until then, validate with the published `compiled-scheme.v1.schema.json` plus explicit cross-field
invariants before casting.

```ts
import { createRequire } from "node:module";
import Ajv2020 from "ajv/dist/2020";
import type { CompiledScheme } from "scheme-tokens";

const require = createRequire(import.meta.url);
const compiledSchema = require("scheme-tokens/schemas/compiled-scheme.v1.schema.json");

const ajv = new Ajv2020({ allErrors: true, schemas: [compiledSchema] });
const validate = ajv.compile(compiledSchema);
const unknownArtifact: unknown = JSON.parse(serializedText);

if (!validate(unknownArtifact)) {
  throw new Error(JSON.stringify(validate.errors, null, 2));
}

// Add custom checks: every token's valueByMode and dependenciesByMode keys
// must exactly match the scheme's modes.
```

### Forged compiled scheme probe

```ts
import { exportCssVars } from "scheme-tokens";

const forged = {
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  tokens: {
    background: {
      visibility: "public",
      valueByMode: { base: undefined },
      origin: { kind: "graph" },
      dependenciesByMode: { base: [] },
    },
  },
};

exportCssVars(forged as never);
```

This can throw or emit nonsense. The serializer is not a validator or repair operation. A compiled-scheme parser would
close this trust gap.

---

## 12. Browser, framework, and build-tool usage

The simplest architecture is build-time/server-startup generation followed by DOM attribute/class toggling.

### Plain browser mode switch

```ts
type Mode = "light" | "dark";

export function setMode(mode: Mode): void {
  const root = document.documentElement;
  if (mode === "light") {
    delete root.dataset.colorScheme;
  } else {
    root.dataset.colorScheme = mode;
  }
}
```

The default generated mode has no attribute selector.

### Persisted preference

```ts
type Mode = "light" | "dark";

export function loadMode(): Mode {
  return localStorage.getItem("color-scheme") === "dark" ? "dark" : "light";
}

export function setMode(mode: Mode): void {
  localStorage.setItem("color-scheme", mode);
  if (mode === "light") {
    delete document.documentElement.dataset.colorScheme;
  } else {
    document.documentElement.dataset.colorScheme = mode;
  }
}
```

### React provider

```tsx
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";

type Mode = "light" | "dark";

const ThemeContext = createContext<{
  mode: Mode;
  setMode(mode: Mode): void;
} | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<Mode>("light");
  const value = useMemo(
    () => ({
      mode,
      setMode(next: Mode) {
        setModeState(next);
        if (next === "light") {
          delete document.documentElement.dataset.colorScheme;
        } else {
          document.documentElement.dataset.colorScheme = next;
        }
      },
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error("ThemeProvider is missing.");
  return value;
}
```

No package runtime import is needed client-side when CSS is prebuilt.

### Vue composable

```ts
import { ref, watchEffect } from "vue";

type Mode = "light" | "dark";

export function useColorScheme() {
  const mode = ref<Mode>("light");
  watchEffect(() => {
    if (mode.value === "light") {
      delete document.documentElement.dataset.colorScheme;
    } else {
      document.documentElement.dataset.colorScheme = mode.value;
    }
  });
  return { mode };
}
```

### Svelte store

```ts
import { writable } from "svelte/store";

type Mode = "light" | "dark";
export const colorScheme = writable<Mode>("light");

colorScheme.subscribe((mode) => {
  if (typeof document === "undefined") return;
  if (mode === "light") {
    delete document.documentElement.dataset.colorScheme;
  } else {
    document.documentElement.dataset.colorScheme = mode;
  }
});
```

### Web Component

```ts
class ThemedPanel extends HTMLElement {
  readonly #root = this.attachShadow({ mode: "open" });

  connectedCallback() {
    this.#root.innerHTML = `
      <style>
        :host {
          background: var(--background);
          color: var(--foreground);
        }
      </style>
      <slot></slot>
    `;
  }

  set mode(value: "light" | "dark") {
    this.classList.toggle("theme-dark", value === "dark");
  }
}

customElements.define("themed-panel", ThemedPanel);
```

Generate and adopt matching `:host` CSS.

### Server-rendered style component

```tsx
import { compileTokenGraph, exportCssVars } from "scheme-tokens";

export function ThemeStyle() {
  const compiled = compileTokenGraph(graph);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues));

  const css = exportCssVars(compiled.value);
  if (!css.ok) throw new Error(JSON.stringify(css.issues));

  return (
    <style
      data-scheme-tokens
      dangerouslySetInnerHTML={{
        __html: css.value.css.replaceAll("</style", "<\\/style"),
      }}
    />
  );
}
```

### Vite plugin

```ts
import type { Plugin } from "vite";
import { compileTokenGraph, exportCssVars } from "scheme-tokens";

export function schemeTokensPlugin(): Plugin {
  return {
    name: "scheme-tokens",
    generateBundle() {
      const compiled = compileTokenGraph(graph);
      if (!compiled.ok) this.error(JSON.stringify(compiled.issues, null, 2));

      const css = exportCssVars(compiled.value);
      if (!css.ok) this.error(JSON.stringify(css.issues, null, 2));

      this.emitFile({
        type: "asset",
        fileName: "theme.css",
        source: css.value.css,
      });
    },
  };
}
```

### CLI compiler

```ts
#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { compileTokenGraph, exportCssVars } from "scheme-tokens";

const [inputPath, outputPath] = process.argv.slice(2);
if (inputPath === undefined || outputPath === undefined) {
  console.error("Usage: compile-scheme <graph.json> <theme.css>");
  process.exit(2);
}

const input: unknown = JSON.parse(await readFile(inputPath, "utf8"));
const compiled = compileTokenGraph(input);
if (!compiled.ok) {
  console.error(JSON.stringify(compiled.issues, null, 2));
  process.exit(1);
}

const css = exportCssVars(compiled.value);
if (!css.ok) {
  console.error(JSON.stringify(css.issues, null, 2));
  process.exit(1);
}

await writeFile(outputPath, css.value.css, "utf8");
```

### CI linting

```ts
import { readFile } from "node:fs/promises";
import { parseTokenGraph } from "scheme-tokens";

const parsed = parseTokenGraph(JSON.parse(await readFile(file, "utf8")));

if (!parsed.ok) {
  for (const issue of parsed.issues) {
    console.error(`${file}${issue.path ?? ""}: ${issue.code}: ${issue.message}`);
  }
  process.exitCode = 1;
}
```

### Generated artifact drift check

```bash
pnpm generate:tokens
git diff --exit-code -- dist/theme.css dist/tokens.compiled.json
```

### Multi-brand artifact build

```ts
import { buildScheme, serializeScheme } from "scheme-tokens";

for (const brand of brands) {
  const built = buildScheme({ base: [brandSource(brand)] });
  if (!built.ok) throw new Error(JSON.stringify(built.issues));

  await writeFile(`dist/${brand.id}.json`, serializeScheme(built.value), "utf8");
}
```

Sanitize brand IDs; arbitrary customer names are not valid token or source identifiers.

### User-authored theme quotas

```ts
import { parseTokenGraph } from "scheme-tokens";

const MAX_INPUT_BYTES = 1_000_000;
if (text.length > MAX_INPUT_BYTES) {
  throw new Error("Theme input is too large.");
}

const parsed = parseTokenGraph(JSON.parse(text));
```

Also limit modes, tokens, identifier lengths, extension depth and size, and output bytes.

### Dependency report

```ts
import { compileTokenGraph } from "scheme-tokens";

const compiled = compileTokenGraph(graph, { selection: "all" });
if (compiled.ok) {
  for (const [key, token] of Object.entries(compiled.value.tokens)) {
    for (const mode of compiled.value.modes) {
      console.log(key, mode, token.dependenciesByMode[mode]);
    }
  }
}
```

### Visual-regression matrix

```ts
for (const mode of compiled.modes) {
  await page.evaluate((selectedMode) => {
    if (selectedMode === "light") {
      delete document.documentElement.dataset.colorScheme;
    } else {
      document.documentElement.dataset.colorScheme = selectedMode;
    }
  }, mode);

  await expect(page).toHaveScreenshot(`application-${mode}.png`);
}
```

---

## 13. Custom `TokenSource` adapters

`TokenSource` is structural. Core accepts a safe base input object with a valid string `id` and callable `build`,
permits extra adapter metadata, and invokes `build()` with the original source object as `this`.

### Minimal custom source

```ts
import {
  buildScheme,
  defineTokenGraph,
  type Result,
  type TokenGraphInput,
  type TokenSource,
} from "scheme-tokens";

const source: TokenSource = {
  id: "brand",
  build(): Result<TokenGraphInput> {
    return {
      ok: true,
      value: defineTokenGraph({
        tokens: { "brand.primary": "#6750a4" },
      }),
    };
  },
};

const built = buildScheme({ base: [source] });
```

### Source factory

```ts
import {
  buildScheme,
  defineTokenGraph,
  type TokenGraphInput,
  type TokenSource,
} from "scheme-tokens";

function brandSource(primary: string): TokenSource {
  return {
    id: "brand",
    build() {
      return {
        ok: true as const,
        value: defineTokenGraph({
          tokens: { "brand.primary": primary },
        }),
      };
    },
  };
}

buildScheme({ base: [brandSource("#6750a4")] });
```

### Source metadata and preserved receiver

```ts
import { buildScheme, defineTokenGraph } from "scheme-tokens";

const source = {
  id: "brand",
  primary: "#6750a4",
  build() {
    return {
      ok: true as const,
      value: defineTokenGraph({
        tokens: { "brand.primary": this.primary },
      }),
    };
  },
};

buildScheme({ base: [source] });
```

### Multiple sources and cross-source references

```ts
import { buildScheme, defineTokenGraph, type TokenSource } from "scheme-tokens";

const palette: TokenSource = {
  id: "palette",
  build() {
    return {
      ok: true,
      value: defineTokenGraph({
        defaultVisibility: "internal",
        tokens: { "palette.primary": "#6750a4" },
      }),
    };
  },
};

const semantic: TokenSource = {
  id: "semantic",
  build() {
    return {
      ok: true,
      value: defineTokenGraph({
        tokens: {
          "semantic.action": { ref: "palette.primary" },
        },
      }),
    };
  },
};

buildScheme({ base: [palette, semantic] });
```

### Forward reference to a later source

```ts
import { buildScheme } from "scheme-tokens";

buildScheme({ base: [semantic, palette] });
```

Full reference validation happens after composition, so forward references work.

### Adapter-owned issue type

```ts
import {
  defineTokenGraph,
  type Issue,
  type Result,
  type TokenGraphInput,
  type TokenSource,
} from "scheme-tokens";

type BrandIssue = Issue<"brand-primary-missing"> & {
  readonly field: "primary";
};

function configurableBrandSource(primary: string | undefined): TokenSource<BrandIssue> {
  return {
    id: "brand",
    build(): Result<TokenGraphInput, BrandIssue> {
      if (primary === undefined) {
        return {
          ok: false,
          issues: [
            {
              code: "brand-primary-missing",
              message: "A brand primary color is required.",
              path: "/primary",
              field: "primary",
            },
          ],
        };
      }
      return {
        ok: true,
        value: defineTokenGraph({
          tokens: { "brand.primary": primary },
        }),
      };
    },
  };
}
```

### Source throws

```ts
import { buildScheme, type TokenSource } from "scheme-tokens";

const source: TokenSource = {
  id: "explosive",
  build() {
    throw new Error("engine crashed");
  },
};

buildScheme({ base: [source] });
// source-build-failed; original cause is not surfaced
```

### Async source is unsupported

```ts
import { buildScheme } from "scheme-tokens";

const asyncSource = {
  id: "remote",
  async build() {
    const response = await fetch("/tokens.json");
    return {
      ok: true as const,
      value: await response.json(),
    };
  },
};

buildScheme({ base: [asyncSource as never] });
```

Fetch first, then create a synchronous source.

### Duplicate source IDs

```ts
import { buildScheme } from "scheme-tokens";

buildScheme({
  base: [
    { id: "brand", build: firstBuild },
    { id: "brand", build: secondBuild },
  ],
});
```

Expected: `duplicate-source-id`.

### Duplicate keys across sources

```ts
import { buildScheme, defineTokenGraph } from "scheme-tokens";

const first = {
  id: "first",
  build: () => ({
    ok: true as const,
    value: defineTokenGraph({ tokens: { "brand.primary": "#6750a4" } }),
  }),
};

const second = {
  id: "second",
  build: () => ({
    ok: true as const,
    value: defineTokenGraph({ tokens: { "brand.primary": "#1455d9" } }),
  }),
};

buildScheme({ base: [first, second] });
```

Expected: `duplicate-token-key`. Sources never override each other.

### Mismatched source modes

```ts
import { buildScheme, defineTokenGraph } from "scheme-tokens";

const single = {
  id: "single",
  build: () => ({
    ok: true as const,
    value: defineTokenGraph({ tokens: { "single.color": "#ffffff" } }),
  }),
};

const dual = {
  id: "dual",
  build: () => ({
    ok: true as const,
    value: defineTokenGraph({
      modes: ["light", "dark"],
      defaultMode: "light",
      tokens: {
        "dual.color": { light: "#ffffff", dark: "#000000" },
      },
    }),
  }),
};

buildScheme({ base: [single, dual] });
```

Expected: `invalid-source-result`.

### Equivalent modes in different order compose successfully

```ts
import { buildScheme } from "scheme-tokens";

const first = fixedSource("first", {
  formatVersion: 1,
  modes: ["dark", "light"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: { "first.token": { valueByMode: { light: "#ffffff", dark: "#000000" } } },
});

const second = fixedSource("second", {
  formatVersion: 1,
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: {
    "second.token": {
      valueByMode: { light: { ref: "first.token" }, dark: { ref: "first.token" } },
    },
  },
});

buildScheme({ base: [first, second] }); // succeeds
```

Source modes are compared by canonical set semantics, not array order.

### Class source is runtime-rejected

```ts
import { buildScheme, defineTokenGraph, type TokenSource } from "scheme-tokens";

class Source implements TokenSource {
  id = "brand";

  build() {
    return {
      ok: true as const,
      value: defineTokenGraph({ tokens: { "brand.primary": "#6750a4" } }),
    };
  }
}

buildScheme({ base: [new Source()] });
```

The plain-record reader rejects prototypes other than `Object.prototype` or `null`. Class instances satisfy the
structural type but fail runtime validation. Use plain-object sources.

### Source invocation order and side effects

```ts
import { buildScheme, defineTokenGraph } from "scheme-tokens";

const calls: string[] = [];

const first = {
  id: "first",
  build() {
    calls.push("first");
    return {
      ok: true as const,
      value: defineTokenGraph({ tokens: { "first.color": "#ffffff" } }),
    };
  },
};

const second = {
  id: "second",
  build() {
    calls.push("second");
    return {
      ok: true as const,
      value: defineTokenGraph({ tokens: { "second.color": "#000000" } }),
    };
  },
};

buildScheme({ base: [first, second] });
console.log(calls); // ["first", "second"]
```

All builds can run before a duplicate-token composition error is found. Keep source builds pure or idempotent. A failed
source stops later builds.

### Source graph validation

`buildScheme()` validates every source graph as a strict `TokenGraphInput` before composition. Each source graph is
parsed independently with `skipReferenceValidation` so cross-source and forward references continue to work, but
envelope fields (`formatVersion`, `modes`, `defaultMode`, `defaultVisibility`, `tokens`, `layers`) are validated
per-source.

---

## 14. Adversarial JavaScript and input probes

These snippets test no-throw boundaries and bounded diagnostics. Each is labeled with the failure class it probes.

### Hostile object proxy

```ts
import { parseTokenGraph } from "scheme-tokens";

const hostile = new Proxy(
  {},
  {
    ownKeys() {
      throw new Error("trap");
    },
  },
);

parseTokenGraph(hostile);
```

The plain-record reader catches proxy traps and returns `invalid-object` without invoking user code.

### Hostile object proxy with prototype trap

```ts
import { parseColor, parseTokenGraph } from "scheme-tokens";

const hostile = new Proxy(
  {},
  {
    getPrototypeOf() {
      throw new Error("prototype trap should be contained");
    },
  },
);

parseColor(hostile); // invalid-color-input, not an exception
parseTokenGraph(hostile); // invalid-object, not an exception
```

### Hostile array proxy — needs retest

```ts
import { parseTokenGraph } from "scheme-tokens";

const hostileModes = new Proxy(["base"], {
  get(target, property, receiver) {
    if (property === "length") {
      throw new Error("hostile length trap");
    }
    return Reflect.get(target, property, receiver);
  },
});

parseTokenGraph({
  formatVersion: 1,
  modes: hostileModes,
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {},
});
```

The plain-record reader is safe for objects, but several array paths use `.entries()`, `.length`, or `for...of` after
only `Array.isArray()`. A proxy around an array still passes `Array.isArray(proxy)`. This probe needs retest: if it
throws, introduce a safe array reader analogous to `readPlainRecord()`.

### Accessor-backed token definition

```ts
import { parseTokenGraph } from "scheme-tokens";

const definition = {};
Object.defineProperty(definition, "value", {
  enumerable: true,
  get() {
    throw new Error("must not execute");
  },
});

parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: { background: definition },
});
```

The plain-record reader rejects accessor descriptors without invoking the getter.

### Deep extension JSON — needs retest

```ts
import { parseTokenGraph } from "scheme-tokens";

let nested: unknown = null;

for (let index = 0; index < 50_000; index += 1) {
  nested = [nested];
}

parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    background: {
      value: "#ffffff",
      extensions: { "example.deep": nested },
    },
  },
});
```

Extension copying and serialization are recursive. The exact failing depth is runtime-dependent. Use iterative
traversal, a documented depth limit, or both.

### Unsupported JSON values in extensions

```ts
import { parseTokenGraph } from "scheme-tokens";

for (const payload of [
  { value: undefined },
  { value: 1n },
  { value: () => {} },
  { value: new Date() },
  { value: Number.NaN },
  { value: Number.POSITIVE_INFINITY },
]) {
  console.log(
    parseTokenGraph({
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {
        background: {
          value: "#ffffff",
          extensions: { "example.payload": payload },
        },
      },
    }),
  );
}
```

Expected: `invalid-json-value` for non-finite numbers, functions, bigints, and class instances.

### Negative zero in extension JSON

```ts
import { parseTokenGraph } from "scheme-tokens";

const parsed = parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    background: {
      value: "#ffffff",
      extensions: {
        "example.payload": { value: -0 },
      },
    },
  },
});

if (parsed.ok) {
  const ext = parsed.value.tokens.background?.extensions?.["example.payload"] as { value: number };
  console.log(Object.is(ext.value, -0)); // false, canonicalized to 0
}
```

### Sparse extension array

```ts
import { parseTokenGraph } from "scheme-tokens";

const sparse = new Array(3);
sparse[2] = "value";

parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    background: {
      value: "#ffffff",
      extensions: { "example.sparse": sparse },
    },
  },
});
```

Expected: `invalid-json-value`. Array holes are observed as `undefined` during JSON copying, so sparse extension arrays
are invalid probes rather than successful canonicalization cases.

### JavaScript numeric color parsing — still current

```ts
import { parseColor } from "scheme-tokens";

for (const input of ["rgb(0x10 0 0)", "rgb(0b10 0 0)", "rgb(0o10 0 0)"]) {
  console.log(input, parseColor(input));
}
```

The parser uses `Number()` as the lexical validator. Hexadecimal, binary, and octal JavaScript literals are not CSS
number tokens but can be accepted. Validate a CSS-number grammar before conversion.

### Selector-list bug probe — still current

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  scope: {
    strategy: "selector",
    selector: ".app, .portal",
  },
});
```

The selector validator accepts selector lists, but generated strategies only append the mode condition to the last
list member, producing `.app, .portal[data-color-scheme="dark"]`. Either parse and transform every selector or reject
top-level lists for generated strategies.

### Pseudo-element bug probe — still current

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  scope: {
    strategy: "selector",
    selector: ".preview::before",
  },
});
```

Pseudo-elements receive mode conditions in an invalid position: `.preview::before[data-color-scheme="dark"]`. Reject
pseudo-element scopes for generated strategies or place the condition through a selector AST.

### Invalid selector false positives — still current

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  modeSelectors: {
    strategy: "selectors",
    selectors: {
      light: ".",
      dark: "#",
    },
  },
});
```

These character strings pass the heuristic validator even though they are not useful valid selectors.

### Valid modern selector false negative — still current

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  modeSelectors: {
    strategy: "selectors",
    selectors: {
      light: ":root",
      dark: ':root:is(.dark, [data-theme="dark"])',
    },
  },
});
```

Parentheses are rejected by the current selector subset.

### Nested mode-selector strategy typo — still current

```ts
import { exportCssVars } from "scheme-tokens";

exportCssVars(compiled, {
  modeSelectors: {
    strategy: "data-attribute",
    attribute: "data-theme",
    attrbute: "data-other-theme", // silently ignored
  } as never,
});
```

Top-level exporter options reject unknown keys, but nested mode-selector strategies do not.

### Forged cyclic extension in serialized output

```ts
import { serializeScheme } from "scheme-tokens";

const cyclic: Record<string, unknown> = {};
cyclic.self = cyclic;

const forged = structuredClone(compiled) as never;
(
  forged as { tokens: { background: { extensions: Record<string, unknown> } } }
).tokens.background.extensions = {
  "example.cycle": cyclic,
};

serializeScheme(forged);
```

This can recurse until a stack failure. A compiled-scheme parser would close this trust gap.

### Self-reference

```ts
import { parseTokenGraph } from "scheme-tokens";

parseTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    background: {
      value: { ref: "background" },
    },
  },
});
```

Expected: `reference-cycle`.

---

## 15. Unsupported or out-of-scope uses

```ts
import { parseColor } from "scheme-tokens";

// Contextual CSS and advanced CSS colors:
parseColor("var(--brand-primary)");
parseColor("color-mix(in oklch, red, blue)");

// No public color conversion API:
convertColor(color, "display-p3"); // not exported

// No contrast analyzer:
contrastRatio(foreground, background); // not exported

// No reference fallback:
({ ref: "brand.primary", fallback: "#6750a4" }); // rejected

// No arithmetic or mix expression:
({ mix: [{ ref: "brand.primary" }, "#ffffff"], amount: 0.2 }); // rejected
```

Also out of scope:

- asynchronous sources;
- mode inheritance;
- multiple independent mode axes;
- CSS media, support, container, or layer projection;
- automatic DOM state management;
- safe runtime parsing of compiled JSON (no `parseCompiledScheme()` yet);
- automatic contrast or gamut analysis;
- automatic palette generation in core;
- DTCG import or export in core;
- image extraction or canvas-backed color analysis;
- Tailwind theme generation in core;
- Texel conversion in core.

---

## 16. Release checklist and remaining pre-release decisions

### Validation

Run on the exact commit to be tagged:

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
git diff --check
```

### Finding reclassification

| ID  | Severity | Original finding                                                 | Status                                                                                                               |
| --- | -------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| B01 | Blocker  | Fragment per-mode shorthand type/runtime mismatch                | Obsolete: the fragment helper was removed. `defineTokenLayer()` requires `modes` when normalizing pure mode records. |
| B02 | Blocker  | Source graph envelope data silently discarded                    | Resolved: `buildScheme()` parses each source graph as strict `TokenGraphInput` before composition.                   |
| B03 | Blocker  | Hostile array proxies escape `Result` boundaries                 | Needs retest: object paths are safe; array paths still use `.entries()` and `.length` directly.                      |
| H01 | High     | Deep extension JSON can overflow recursive traversal             | Still current: extension copying and serialization are recursive.                                                    |
| H02 | High     | Generated selectors mishandle selector lists and pseudo-elements | Still current: selector lists pass validation but transform incorrectly.                                             |
| H03 | High     | Selector heuristic accepts invalid selectors                     | Still current: `.`, `#`, `[]` pass; functional pseudo-classes are rejected.                                          |
| H04 | High     | Mode-selector strategy objects ignore unknown keys               | Still current: nested strategies do not reject typos.                                                                |
| H05 | High     | Color parser accepts JavaScript-only numeric literals            | Still current: `Number()` accepts `0x`, `0b`, `0o` prefixes.                                                         |
| H06 | High     | Serialized compiled schemes have no runtime parse boundary       | Still current: no `parseCompiledScheme()`.                                                                           |
| M01 | Medium   | Equivalent source modes fail when order differs                  | Resolved: source modes compared by canonical set semantics.                                                          |
| M02 | Medium   | `$schema` accepts any string despite `invalid-schema-uri`        | Still current: only non-string values are rejected.                                                                  |
| M03 | Medium   | `sourceToken` has no public producer                             | Still current: recommendation to remove or implement.                                                                |
| M04 | Medium   | `dependenciesByMode` means direct dependencies only              | Behavior current; this audit documents direct-only semantics. Public docs may still need prominence.                 |
| M05 | Medium   | Type-compatible class sources are runtime-rejected               | Behavior current; this audit documents the plain-object runtime constraint. Public docs may still need coverage.     |
| M06 | Medium   | Selection does not isolate invalid graph material                | Behavior current; this audit documents selection as output-only, not a validation boundary.                          |
| M07 | Medium   | JSON Schema acceptance is weaker than parser acceptance          | Behavior current; this audit documents schema validation as structural preflight.                                    |
| L01 | Low      | ESM-only and Node `>=22` are not prominent                       | Behavior current; this audit now documents support. Keep README and package docs aligned before release.             |
| L02 | Low      | Serializer name is compiled-only                                 | Resolved by rename: `serializeScheme()` is clear.                                                                    |
| L03 | Low      | `formatCssColor()` requires normalized `ColorValue`              | Behavior current; this audit documents the normalized input contract.                                                |
| L04 | Low      | `internal` is not a security boundary                            | Behavior current; this audit and README document visibility as selection, not confidentiality.                       |

### Recommended fix order

1. Resolve B03 and H01 with a safe iterative array reader and depth limit for extension copying.
2. Resolve H02 and H03 by parsing or strictly narrowing selectors and rejecting selector lists for generated strategies.
3. Resolve H04 by rejecting unknown keys in nested mode-selector strategies.
4. Resolve H05 with a CSS-number lexer.
5. Decide whether `parseCompiledScheme()` belongs in `0.1.0`; otherwise document the trust boundary.
6. Resolve M02 by validating `$schema` as a URI or renaming the issue.
7. Remove or implement `sourceToken` (M03).
8. Promote the audit-documented support and behavior notes into any remaining public docs that should carry them.

### Browser bundle smoke test

Bundle and execute a core-only workflow with a mainstream browser bundler. Assert no Node built-ins, Material engine,
or optional engine enters the core bundle.

### Real CSS parser and browser test

```ts
const sheet = new CSSStyleSheet();
expect(() => sheet.replaceSync(css)).not.toThrow();
```

Run selector fixtures in Playwright. This catches false positives that a regex cannot.

### Pack and clean-consumer install

```bash
pnpm pack
pnpm --filter @scheme-tokens/material3 pack
```

Install both tarballs in a clean project. Publish core before the adapter because the adapter declares a core peer
dependency.

### Registry preflight

```bash
npm whoami
npm view scheme-tokens
npm view @scheme-tokens/material3
```

### Schema URL preflight

Verify all public `$id` URLs (`https://scheme-tokens.dev/schemas/...`) return the exact versioned schemas with a JSON
content type and immutable version semantics.

### Public documentation coverage

1. ESM-only statement and Node `>=22` requirement.
2. Exact accepted color syntax table.
3. Exact selector subset and limitations.
4. Schema validation is structural; parser validation is authoritative.
5. `internal` visibility controls default selection, not confidentiality.
6. `dependenciesByMode` stores direct dependencies only.
7. Whole graph is validated before selection.
8. Sources are synchronous plain objects; class instances are runtime-rejected.
9. Source modes are compared by canonical set semantics.
10. Safe persisted compiled-scheme guidance.
11. `defineTokenLayer()` requires `modes` when normalizing pure mode records.
12. `formatCssColor()` requires normalized `ColorValue`.
