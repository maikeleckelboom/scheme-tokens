# Define Tokens

Use `defineTokens()` for the ordinary direct-token path.

```ts
import { defineTokens } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
  primary: "#6750a4",
});

export { graph };
```

Strings are color values. They are not inferred as references based on spelling.

Use explicit graph input when tokens need metadata or aliases:

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.primary": {
      value: "#6750a4",
      visibility: "internal",
    },
  },
  aliases: {
    primary: "brand.primary",
  },
});

export { graph };
```

Use modes when a token has more than one authored value:

```ts
import { defineTokens } from "scheme-tokens";

const graph = defineTokens(
  {
    background: {
      light: "#ffffff",
      dark: "#141218",
    },
  },
  {
    modes: ["light", "dark"],
    defaultMode: "light",
  },
);

export { graph };
```

Use `tokenRef()` or `{ ref: "other.token" }` inside token definitions only when a reference needs metadata or per-mode
shape. Prefer `aliases` for ordinary token-key mapping.
