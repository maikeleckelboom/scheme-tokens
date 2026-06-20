# @color-scheme-tokens/source-material3

Material 3 source adapter for `color-scheme-tokens`.

Manual token graphs only need the root `color-scheme-tokens` package. Install this adapter only when a project
wants Material 3 Dynamic Color output from the official Material color utility engine.

```bash
pnpm add color-scheme-tokens @color-scheme-tokens/source-material3
```

## Usage

```ts
import { buildTokenSet } from "color-scheme-tokens";
import { material3Source } from "@color-scheme-tokens/source-material3";

const built = buildTokenSet({
  sources: [
    material3Source({
      sourceColor: "#6750a4",
    }),
  ],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

console.log(built.value.compiled.tokens["material3.primary"]);
```

The adapter emits strict graph input with `light` and `dark` modes. Token keys are namespaced under the source id:

```text
material3.primary
material3.on-primary
material3.primary-container
```

`sourceColor` is the required Material source color used to generate the scheme. Some Material tooling calls this a seed
color; this adapter keeps the field name `sourceColor` and does not accept `color`, `seed`, or `source` aliases.
`sourceColor` currently accepts strict opaque hex strings in `#rrggbb` form. Other CSS color syntaxes are rejected
instead of being parsed approximately.

## Extended Colors

Material extended colors are exposed through this adapter as `extendedColors`, using stable adapter vocabulary rather than
the engine's own option names.

```ts
import { buildTokenSet } from "color-scheme-tokens";
import { material3Source } from "@color-scheme-tokens/source-material3";

const built = buildTokenSet({
  sources: [
    material3Source({
      sourceColor: "#6750a4",
      extendedColors: [{ name: "success", color: "#2e7d32" }],
    }),
  ],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}
```

Each entry is shaped as `{ name, color, harmonize? }`. `name` is a lower-kebab token segment, `color` uses the same
strict `#rrggbb` input as `sourceColor`, and `harmonize` maps to Material custom color harmonization behavior. When
omitted, `harmonize` defaults to `true`.

Extended color tokens are emitted under the source id namespace:

```text
material3.extended.success.color
material3.extended.success.on-color
material3.extended.success.color-container
material3.extended.success.on-color-container
```

Engine-specific option names stay internal adapter vocabulary. The adapter does not accept `customColors` or `blend`.
Advanced key-color-driven scheme input remains future scope; this adapter does not implement or reserve a loose
`keyColors` API.

## Composition

Use `defaultVisibility: "internal"` when the Material roles should feed public application tokens without being exported
as public tokens themselves.

```ts
import { buildTokenSet, defineTokenFragment } from "color-scheme-tokens";
import { material3Source } from "@color-scheme-tokens/source-material3";

const application = defineTokenFragment<"light" | "dark">({
  id: "application",
  defaultVisibility: "public",
  tokens: {
    "app.background": "material3.surface",
    "app.foreground": "material3.on-surface",
    "app.action": "material3.primary",
  },
});

const built = buildTokenSet({
  sources: [
    material3Source({
      sourceColor: "#6750a4",
      defaultVisibility: "internal",
    }),
  ],
  fragments: [application],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}
```

Material 3 support lives in this adapter package. The root package does not import, export, document as required, or
depend on the Material engine for manual token graphs.

The adapter package owns `@material/material-color-utilities@0.4.0` and bundles the required runtime code in its published
artifact because the upstream package's extensionless internal ESM imports do not run directly in supported Node.js
consumer projects. The published package includes `NOTICE.md` with the Apache-2.0 attribution for that bundled code.
