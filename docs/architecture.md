# Architecture

`scheme-tokens` is a dependency-light color-token graph core. The graph is the system of record; manual authoring
helpers and source adapters feed it, validation and compilation resolve it, and exporters project compiled schemes into
deterministic CSS or JSON artifacts.

## Core Ownership

The root package owns:

- token graph contracts;
- JSON-safe public authoring inputs;
- graph parsing and validation;
- token compilation;
- deterministic serialization;
- CSS variable export;
- `Result` and `Issue` contracts;
- adapter interfaces.

The root package does not own Material 3, Texel, image extraction, browser canvas behavior, CSS parser engines,
color-conversion engines, external format import/export behavior, target framework scaffolding, or any other optional
capability engine.

## Data Shapes

```text
helper input or strict graph input
  -> parse and validate
  -> compile selected tokens
  -> serialize compiled JSON or export CSS
```

With adapters, the same core build step remains the center of the workflow:

```text
source adapters
+ authored token layers
+ target mapping layers
-> buildScheme()
-> optional conversion projection
-> sibling exports
```

Adapters are not a transitive chain. Material source generation, Texel projection, shadcn export, DTCG export, core CSS
export, and core serialization stay explicit sibling operations around the compiled scheme instead of becoming
`Material -> Texel -> shadcn -> DTCG`.

`defineTokens()`, `defineTokenGraph()`, and `defineTokenLayer()` are authoring helpers for ordinary package use. They may
fill safe defaults and normalize JSON-safe shorthand. `defineTokens()` is the simple token-record graph helper;
`defineTokenGraph()` remains the full graph-shaped helper. `parseTokenGraph()` remains the strict boundary for persisted
wire-format data.

Compiled schemes are output artifacts. They contain resolved colors, selected tokens, origin metadata, and direct
dependencies. Exporters consume compiled schemes only.

The published JSON Schemas cover strict persisted graph input, strict layer input, and serialized compiled scheme
output. They are not authoring-helper schemas and do not accept helper shorthand.

## Compilation

Compilation validates first, then resolves selected tokens. The default selection is `public`; exact key selection and
`all` selection are explicit options. Public tokens may depend on internal tokens.

Compiled tokens store direct dependencies by mode. Full transitive analysis is intentionally not stored in every compiled
token; it can be added later as an on-demand analyzer without bloating the default compiled artifact.

## Exporters

Exporters consume compiled schemes only. They do not validate graphs, resolve references, load engines, mutate compiled
schemes, or patch browser DOM state.

The CSS exporter is dependency-free and uses a conservative selector validator. It can return either a stylesheet string
or structured `{ mode, selector, declarations }` blocks for runtime preview surfaces and custom renderers. It supports
the generated root, data-attribute, class, and simple exact-selector workflows without making a CSS parser part of the
core dependency graph.

## Base Inputs

`buildScheme()` resolves generated base input and layer graph contributors before compilation. Base inputs are generated
or external graph-material providers. Layers are ordered named authored token overlays.

When several base inputs are provided, they compose first in array order. Duplicate token keys across base inputs are
invalid. Layers compose after base inputs in array order. Later layers override earlier layers by token key, and layers
may override base tokens. References, missing-reference validation, and circular-reference validation run after the final
graph has been composed. Winning token origin metadata points at the winning base input or layer.

Layer composition is intentionally simpler than CSS cascade behavior. It has no selector specificity, no `!important`, no
implicit CSS `@layer` behavior, no DOM behavior, and no runtime style injection helpers.

Adapter packages may depend on engines, external format tooling, or target framework policy. Core exposes the interface
but does not provide Material 3, Texel, conversion, DTCG, shadcn, or image-backed behavior. The Material 3 adapter is
`@scheme-tokens/material3`; it lives outside the root package and owns the Material engine dependency.

Source adapters produce graph input for `buildScheme()`. Conversion adapters perform separate post-compile conversion
operations and return `Result` values with adapter-owned issues. Format adapters import or export external file and wire
formats, and may expose source helpers, conversion functions, or exporters when the external format is bidirectional.
Target adapters map compiled or core token material into a target framework or design-system contract and may export
target-specific scaffolds. Target exporters validate declared target contracts; they do not scan arbitrary namespaces by
default. Adapter package topology and release obligations are defined in
[`ADR 0002`](./adr/0002-adapter-package-architecture.md), with format adapter rules in
[`ADR 0003`](./adr/0003-format-adapter-packages.md).

## Determinism

Object-record diagnostics, compiled token keys, serialized JSON keys, modes after the default mode, and CSS declarations
use code-unit ordering. Public issue codes and JSON Pointer paths are contractual.
