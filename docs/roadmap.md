# Roadmap

`scheme-tokens` 0.1.0 is focused on one small product: a token graph that compiles to deterministic CSS custom
properties and typed TypeScript data.

## 0.1.0 Scope

0.1.0 includes:

- strict token graph, token layer, and compiled scheme contracts;
- JSON-safe helper input through `defineTokens()`, `defineTokenGraph()`, and `defineTokenLayer()`;
- explicit references through aliases, `tokenRef()`, or `{ ref }`;
- `compileTokenGraph()` for graph validation and selected-token resolution;
- `buildScheme()` and `createSchemeBuilder()` for optional source adapters and layers;
- deterministic compiled-scheme serialization;
- CSS custom-property export through `exportCssVars()`;
- strict schema artifacts for persisted graph, layer, and compiled scheme formats;
- `@scheme-tokens/material3` as the first real adapter package.

Root values are authored strings. Root preserves and emits those strings. It does not parse CSS color grammar, normalize
values, convert spaces, generate palettes, or validate browser color support.

## 0.1.0 Exclusions

0.1.0 does not include:

- root CSS color parsing or formatting APIs;
- conversion or projection engines in the root package;
- external design-token format import/export;
- framework-specific target output;
- image extraction, browser canvas behavior, or dynamic runtime styling helpers.

## Adapter Lanes

Adapter packages are explicit package boundaries. They may depend on optional engines without contaminating the root
import graph.

Source adapters generate graph input before `buildScheme()`. `@scheme-tokens/material3` is the current source adapter.

Conversion adapters may transform compiled schemes after compilation. A future `@scheme-tokens/texel` package may own
color conversion behavior and an engine dependency. Root must stay free of that dependency.

Format adapters may import or export external wire formats such as DTCG. Their naming, validation, and diagnostics are
adapter-owned concerns.

The intended workflow is:

```text
source adapters
+ authored layers
-> buildScheme()
-> optional adapter-owned projection
-> sibling exports
```

Root CSS export and compiled JSON serialization remain sibling outputs from the compiled scheme.

## Future Work

Future work should keep the root package small:

- DTCG import/export belongs in a dedicated format adapter.
- Color conversion belongs in a dedicated conversion adapter.
- Target-framework output belongs outside root and should be explicit if it is ever added.
- Root token keys remain dot-separated lower-kebab identifier segments.
- External naming rules must be preserved or diagnosed by adapters, not by loosening core validation.
