# Token values

Token expressions are strings, explicit references, or flat concat expressions. Compilation
resolves each expression to a string.

```ts
import { defineTokenGraph, tokenConcat, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    color: "#6750a4",
    primary: tokenRef("color"),
    ring: tokenConcat`0 0 0 3px ${tokenRef("primary")}`,
  },
});
```

Bare strings are literal values. Compilation and serialization preserve their contents.
Generators such as `@scheme-tokens/material3` compute strings before graph composition.

CSS export checks whether an emitted value is safe within a declaration and reports
`invalid-css-value` when it is not. Token meaning, such as whether a string is a suitable color,
remains the caller's concern.

See the [expression reference](../docs-site/reference/api.md#expressions) and
[CSS safety rules](../docs-site/reference/css.md#safe-emission).
