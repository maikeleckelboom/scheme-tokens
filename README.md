# scheme-tokens

A compiler for design tokens.

You give it a token graph — explicit references, modes, ordered layers, public and
internal visibility. It resolves the references, validates them, and emits a
deterministic scheme with provenance for every token. Zero runtime dependencies, no
filesystem access, runs in a browser.

## Install

```sh
pnpm add scheme-tokens
```

## First path

```ts twoslash
import { compileTokenGraph, defineTokens, exportCssVars, tokenRef } from "scheme-tokens";

const graph = defineTokens({
  "brand.600": { value: "oklch(62% 0.18 250)", visibility: "internal" },
  primary: tokenRef("brand.600"),
});

const compiled = compileTokenGraph(graph);
const exported = compiled.ok ? exportCssVars(compiled.value) : compiled;

if (exported.ok) {
  exported.value.css; // ":root {\n  --primary: oklch(62% 0.18 250);\n}\n"
}
```

Bare strings are literal values; `tokenRef()` is the only way to make a reference.
Public tokens resolve through internal ones, so `primary` is emitted and `brand.600`
is not. Every fallible operation returns the same `Result`: the payload under
`value`, a non-empty `issues` tuple otherwise.

## How this relates to DTCG

`scheme-tokens` sits **upstream of the format**. It is the layer where a token graph
is generated and composed, before there is a token file to hand anyone: explicit
references, graph-owned modes, ordered layers, visibility, cycle and reference
validation, deterministic compilation, and structured diagnostics. Its output is a
resolved scheme — every token flattened to a mode-keyed string map with its origin
and dependencies recorded.

[Style Dictionary](https://styledictionary.com) and [Terrazzo](https://terrazzo.app)
sit **downstream**: they consume a DTCG token file and fan it out to platform
artifacts. They are build pipelines for tokens that already exist. The two do not
compete — a generator produces values, `scheme-tokens` composes and resolves them
into a scheme, and a downstream tool takes it from there, or you skip that step and
use the built-in `exportCssVars()` projection.

This package deliberately does not implement the DTCG `$type`/`$value` schema and
does not interpret token values. A value is an opaque string or an explicit `{ ref }`
record; palette generation, value conversion, and contrast policy stay outside the
boundary. It has its own strict JSON artifacts with published schemas:

- `scheme-tokens/schemas/token-graph.v1.schema.json`
- `scheme-tokens/schemas/token-layer.v1.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v1.schema.json`

Use `parseTokenGraph()`, `parseTokenLayer()`, and `parseCompiledScheme()` for
untrusted persisted data, and `serializeTokenGraph()`, `serializeTokenLayer()`, and
`serializeCompiledScheme()` for the canonical byte-stable wire form.

## Documentation

- [Public API](./docs/public-api.md)
- [Architecture](./docs/architecture.md)
- [Application theme coordinates](./docs/application-theme-coordinates.md)
- [Diagnostics](./docs/diagnostics.md)
- [Value policy](./docs/color-policy.md)
- [Migration to 0.1](./docs/migration.md)
- [Semver](./docs/semver.md)
