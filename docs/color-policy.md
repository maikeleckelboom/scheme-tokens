# Color Policy

Root color values are authored strings.

The package preserves the string in graph input, compiled output, deterministic JSON, and CSS custom-property export. It
does not interpret CSS color grammar or promise that a browser will accept a value.

## Root Behavior

Root may validate:

- token keys;
- graph, layer, and compiled artifact shape;
- references and aliases;
- mode coverage;
- deterministic serialization order;
- CSS custom-property name validity and uniqueness;
- CSS declaration safety.

Root must not validate:

- color syntax correctness;
- color-space domains;
- browser support;
- color equivalence;
- color conversion;
- generated palette quality;
- contrast repair.

## Authoring Strings

Any string in a token value position is an authored color value:

```ts
import { defineTokens } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  accent: "var(--brand-accent)",
  warning: "color-mix(in srgb, red 80%, white)",
});

export { graph };
```

Root does not decide whether those strings are good CSS. That responsibility belongs to the author, the browser, or an
optional adapter that explicitly owns that capability.

## References

Strings are not references. Use `aliases`, `tokenRef()`, or `{ ref }` when a token should point at another token:

```ts
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.primary": "#6750a4",
    primary: tokenRef("brand.primary"),
  },
});

export { graph };
```

## Optional Adapters

Future color conversion, projection, validation, or external-format handling belongs outside root. A future package such
as `@scheme-tokens/texel` may depend on a color engine and return adapter-owned `Result` issues. That must be explicit
adapter behavior, not silent root compilation or CSS export behavior.

The Material 3 adapter is already separate. It accepts strict `#rrggbb` source colors because that is the adapter's v0
input contract, then emits generated token values as CSS strings.
