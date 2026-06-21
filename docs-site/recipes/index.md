# Recipes

Short snippets for common jobs.

## Manual Colors

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
  primary: "#6750a4",
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;
export { stylesheet };
```

## Light and Dark Modes

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens(
  {
    background: { light: "#ffffff", dark: "#141218" },
    foreground: { light: "#111111", dark: "#f5eff7" },
  },
  { modes: ["light", "dark"], defaultMode: "light" },
);

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;
export { stylesheet };
```

## OKLCH

```ts
import { defineTokens } from "scheme-tokens";

const graph = defineTokens({
  accent: "oklch(0.62 0.18 285)",
});

export { graph };
```

## Display-P3

```ts
import { defineTokens } from "scheme-tokens";

const graph = defineTokens({
  accent: "color(display-p3 0.42 0.32 0.74)",
});

export { graph };
```

## App Tokens From Implementation Tokens

```ts
import { compileTokenGraph, defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.primary": {
      value: "#6750a4",
      visibility: "internal",
    },
    primary: tokenRef("brand.primary"),
  },
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

export { compiled };
```

## Material Roles Into App Tokens

```ts
import { buildScheme, defineTokenLayer, exportCssVars } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const application = defineTokenLayer<"light" | "dark">({
  id: "application",
  aliases: {
    "app.background": "material3.surface",
    "app.foreground": "material3.on-surface",
    "app.primary": "material3.primary",
    "app.primary-foreground": "material3.on-primary",
  },
});

const built = buildScheme(material3("#6750a4", undefined, { defaultVisibility: "internal" }), {
  layers: [application],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

const cssExport = exportCssVars(built.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const appStylesheet = cssExport.value.css;
export { appStylesheet };
```

## Custom CSS Custom-Property Names

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  "app.background": "#ffffff",
  "app.foreground": "#111111",
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value, {
  variableName: ({ tokenKey }) => `--theme-${tokenKey.replaceAll(".", "-")}`,
});

if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const customPropertyByToken = cssExport.value.variableByToken;
export { customPropertyByToken };
```

## Exact Mode Selectors

```ts
import { exportCssVars, type CompiledColorScheme } from "scheme-tokens";

export function exportExactSelectors(compiled: CompiledColorScheme): string {
  const cssExport = exportCssVars(compiled, {
    modeSelectors: {
      strategy: "selectors",
      selectors: {
        light: ":root",
        dark: ".dark",
      },
    },
  });

  if (!cssExport.ok) {
    throw new Error(JSON.stringify(cssExport.issues, null, 2));
  }

  return cssExport.value.css;
}
```

## Read `variableByToken`

`variableByToken` is a token-key to CSS custom-property map.

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokens({
    background: "#ffffff",
  }),
);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const customPropertyByToken = cssExport.value.variableByToken;
const backgroundCustomProperty = customPropertyByToken.background;
export { backgroundCustomProperty };
```

## Read Ordered `blocks`

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokens({
    background: "#ffffff",
    foreground: "#111111",
  }),
);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const firstBlock = cssExport.value.blocks[0];
const declarations = firstBlock?.declarations ?? [];
export { declarations };
```

## Serialize and Parse Compiled Schemes

```ts
import {
  compileTokenGraph,
  defineTokens,
  parseCompiledScheme,
  serializeCompiledScheme,
} from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokens({
    background: "#ffffff",
  }),
);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const json = serializeCompiledScheme(compiled.value);
const parsed = parseCompiledScheme(JSON.parse(json));

export { json, parsed };
```

## Handle `Result` Errors

```ts
import type { Issue, Result } from "scheme-tokens";

export function unwrap<Value, I extends Issue>(result: Result<Value, I>): Value {
  if (!result.ok) {
    const message = result.issues.map((issue) => issue.code).join(", ");
    throw new Error(message);
  }
  return result.value;
}
```

## Build-Time CSS File Output

```ts
import { writeFile } from "node:fs/promises";
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokens({
    background: "#ffffff",
    foreground: "#111111",
  }),
);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;
await writeFile("src/styles/tokens.css", stylesheet);
```

## Root-Only Usage

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokens({
    background: "#ffffff",
    foreground: "#111111",
  }),
);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;
export { stylesheet };
```

## Root Plus Material Adapter

```ts
import { buildScheme, defineTokenLayer, exportCssVars } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const appLayer = defineTokenLayer<"light" | "dark">({
  id: "application",
  aliases: {
    "app.background": "material3.surface",
    "app.foreground": "material3.on-surface",
  },
});

const built = buildScheme(material3("#6750a4"), {
  layers: [appLayer],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

const cssExport = exportCssVars(built.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const appStylesheet = cssExport.value.css;
export { appStylesheet };
```
