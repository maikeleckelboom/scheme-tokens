---
layout: home
hero:
  name: scheme-tokens
  text: Compose and resolve token graphs
  tagline: Define string values, references, modes, and layers in TypeScript.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /reference/api
---

```ts
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.600": "#6750a4",
    primary: tokenRef("brand.600"),
  },
});
```

A graph describes the tokens and their relationships. Compilation resolves those relationships
into values; CSS export turns the values into custom properties.

Start with [your first stylesheet](./guide/getting-started.md), then add
[modes and layers](./guide/define-tokens.md) or
[Material 3 colors](./guide/material3.md). Use generated roles behind application aliases with
the [Material/shadcn example](./guide/material3.md#use-shadcn-names), then connect them to
[Tailwind utilities](./guide/tailwind-css-v4.md#use-shadcn-variables).
