# @color-scheme-tokens/source-material3

Material 3 source adapter for `color-scheme-tokens`.

Manual custom-color graphs only need the root `color-scheme-tokens` package. Install this adapter only when a project
wants Material 3 Dynamic Color output from the official Material color utility engine.

```bash
pnpm add color-scheme-tokens @color-scheme-tokens/source-material3
```

## Usage

```ts
import { buildTokenSet } from "color-scheme-tokens";
import { material3Source } from "@color-scheme-tokens/source-material3";

const built = buildTokenSet({
  source: material3Source({
    sourceColor: "#6750a4",
  }),
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

console.log(built.value.tokenSet.tokens["material3.primary"]);
```

The adapter emits strict graph input with `light` and `dark` modes. Token keys are namespaced under the source id:

```text
material3.primary
material3.on-primary
material3.primary-container
```

`sourceColor` currently accepts strict opaque hex strings in `#rrggbb` form. Other CSS color syntaxes are rejected
instead of being parsed approximately.

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
    "app.background": { ref: "material3.surface" },
    "app.foreground": { ref: "material3.on-surface" },
    "app.action": { ref: "material3.primary" },
  },
});

const built = buildTokenSet({
  source: material3Source({
    sourceColor: "#6750a4",
    defaultVisibility: "internal",
  }),
  fragments: [application],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}
```

Material 3 support lives in this adapter package. The root package does not import, export, document as required, or
depend on the Material engine for manual/custom colors.
