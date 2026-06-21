# Material 3

Material 3 is optional. Manual colors only need `scheme-tokens`; install `@scheme-tokens/material3` when you want a real
Material Dynamic Color base.

```bash
pnpm add scheme-tokens @scheme-tokens/material3
```

## Build a Material Base

```ts twoslash
import { buildScheme, exportCssVars } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const built = buildScheme(material3("#6750a4"));
if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

const cssExport = exportCssVars(built.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;
//    ^?
export { stylesheet };
```

This exports Material role tokens such as `material3.primary` and `material3.surface`. That is useful for inspection or
internal tooling, but Material roles do not naturally equal app-owned tokens.

## Map Roles Into App Tokens

Keep generated Material roles internal by default, then expose app-owned tokens.

```ts
import { buildScheme, defineTokenLayer, exportCssVars, tokenRef } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const application = defineTokenLayer<"light" | "dark">({
  id: "application",
  tokens: {
    background: tokenRef("material3.surface"),
    foreground: tokenRef("material3.on-surface"),
    primary: tokenRef("material3.primary"),
    "primary-foreground": tokenRef("material3.on-primary"),
  },
});

const built = buildScheme(
  material3("#6750a4", undefined, {
    defaultVisibility: "internal",
  }),
  {
    layers: [application],
  },
);

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

`material3()` creates a source input. `buildScheme()` runs that source, applies layers, validates references, and
compiles the selected scheme.

Use `tokens` when app tokens should point at generated role tokens. The app layer is the contract your app uses; the
Material role names stay an implementation detail unless you deliberately export them. References stay explicit through
`tokenRef("material3.role")` or `{ ref: "material3.role" }`.

## Material Input

```ts
import { material3 } from "@scheme-tokens/material3";

const base = material3({
  sourceColors: "#6750a4",
  variant: "tonal-spot",
  contrastLevel: 0,
  specVersion: "2021",
});

export { base };
```

`sourceColors` accepts a strict `#rrggbb` string or a non-empty array for official multi-source paths. Material controls
such as `variant`, `contrastLevel`, `specVersion`, `platform`, `palettes`, `extendedColors`, and `paletteTones` belong
inside `material3()`, not on the root package.
