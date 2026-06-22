# Architecture

`scheme-tokens` is a dependency-light token graph compiler.

The core owns:

- token graph and token layer contracts;
- JSON-safe authoring inputs;
- strict graph parsing and validation;
- deterministic token compilation;
- compiled scheme parsing and serialization;
- CSS custom property export;
- issue contracts for recoverable failures.

The core does not own palette generation, color science, image extraction, browser canvas, vendor engines, plugin registries, or design-system expansion.

## Pipeline

```text
authored tokens
-> defineTokens() or defineTokenGraph()
-> compileTokenGraph()
-> compiled scheme
-> exportCssVars() or serializeCompiledScheme()
```

External generators can feed the first step by producing plain authored token data. They are ordinary userland code from the root package's point of view.

## Authored Graphs

Graph input supports CSS-ready strings and explicit references. Bare strings are never inferred as references.

```ts
import { defineTokens, tokenRef } from "scheme-tokens";

const graph = defineTokens({
  "brand.primary": "#6750a4",
  primary: tokenRef("brand.primary"),
});
```

Strict persisted artifacts keep references structured as `{ ref: "token.key" }`.

## Compiled Schemes

Compiled tokens are plain mode maps:

```ts
compiled.scheme.tokens.background.base;
```

Metadata that would collide with mode names lives under `metadataByToken`:

```ts
compiled.scheme.metadataByToken.background.dependenciesByMode.base;
```

This keeps the default read path small while preserving deterministic diagnostics, dependencies, origins, and metadata for advanced workflows.
