# scheme-tokens

Compile authored token graphs into deterministic schemes and CSS custom properties.

## Install

```sh
pnpm add scheme-tokens
```

## First path

```ts twoslash
import { compileTokenGraph, defineTokens, exportCssVars, tokenRef } from "scheme-tokens";

const graph = defineTokens({
  "brand.600": { value: "oklch(62% 0.18 250)", visibility: "internal" },
  background: "#ffffff",
  primary: tokenRef("brand.600"),
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const exported = exportCssVars(compiled.value);
if (!exported.ok) {
  throw new Error(JSON.stringify(exported.issues, null, 2));
}

const stylesheet = exported.value.css;
```

Bare strings are literal values; `tokenRef()` is the only way to make a reference. Omitting mode
options creates the single mode `base`. Public tokens may resolve through internal ones, so
`primary` is emitted and `brand.600` is not.

Every fallible operation returns the same `Result`: the payload under `value`, a non-empty `issues`
tuple otherwise.

## How this relates to DTCG

`scheme-tokens` sits **upstream of the format**. It is the layer where a token graph is generated
and composed: explicit references, graph-owned modes, ordered layers, public and internal
visibility, cycle and reference validation, deterministic compilation, and structured diagnostics.
Its output is a resolved scheme — every token flattened to a mode-keyed string map with its origin
and dependencies recorded.

[Style Dictionary](https://styledictionary.com) and [Terrazzo](https://terrazzo.app) sit
**downstream**: they consume a DTCG token file and fan it out to platform artifacts. They are build
pipelines for tokens that already exist.

The two do not compete. A generator produces token values, `scheme-tokens` composes and resolves
them into a scheme, and a downstream tool takes it from there — or you skip that step and use the
built-in `exportCssVars()` projection.

What this package deliberately does not do: it does not implement the DTCG `$type`/`$value` schema,
and it does not interpret token values. A value is an opaque string or an explicit `{ ref }` record.
Palette generation, value conversion, and contrast policy stay outside the package boundary. The
package has its own strict JSON artifacts with published schemas:

- `scheme-tokens/schemas/token-graph.v1.schema.json`
- `scheme-tokens/schemas/token-layer.v1.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v1.schema.json`

Use `parseTokenGraph()`, `parseTokenLayer()`, and `parseCompiledScheme()` for untrusted persisted
data, and `serializeTokenGraph()`, `serializeTokenLayer()`, and `serializeCompiledScheme()` for the
canonical byte-stable wire form.

## Documentation

- [Public API](./docs/public-api.md)
- [Architecture](./docs/architecture.md)
- [Application theme coordinates](./docs/application-theme-coordinates.md)
- [Diagnostics](./docs/diagnostics.md)
- [Value policy](./docs/color-policy.md)
- [Pre-release migration](./docs/migration.md)
- [Semver](./docs/semver.md)
