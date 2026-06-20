# Architecture

`color-scheme-tokens` is a dependency-light color-token graph core. The graph is the system of record; manual authoring
helpers and source adapters feed it, validation and compilation resolve it, and exporters project compiled sets into
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
color-conversion engines, or any other optional capability engine.

## Data Shapes

```text
helper input or strict graph input
  -> parse and validate
  -> compile selected tokens
  -> serialize compiled JSON or export CSS
```

`defineTokenGraph()` and `defineTokenFragment()` are authoring helpers for ordinary package use. They may fill safe
defaults and normalize JSON-safe shorthand. `parseTokenGraph()` remains the strict boundary for persisted wire-format
data.

Compiled token sets are output artifacts. They contain resolved colors, selected tokens, origin metadata, and direct
dependencies. Exporters consume compiled token sets only.

The published JSON Schemas cover strict persisted graph input, strict fragment input, and serialized compiled token set
output. They are not authoring-helper schemas and do not accept helper shorthand.

## Compilation

Compilation validates first, then resolves selected tokens. The default selection is `public`; exact key selection and
`all` selection are explicit options. Public tokens may depend on internal tokens.

Compiled tokens store direct dependencies by mode. Full transitive analysis is intentionally not stored in every compiled
token; it can be added later as an on-demand analyzer without bloating the default compiled artifact.

## Exporters

Exporters consume compiled token sets only. They do not validate graphs, resolve references, load engines, mutate token
sets, or patch browser DOM state.

The CSS exporter is dependency-free and uses a conservative selector validator. It can return either a stylesheet string
or structured `{ mode, selector, declarations }` blocks for runtime preview surfaces and custom renderers. It supports
the generated root, data-attribute, class, and simple exact-selector workflows without making a CSS parser part of the
core dependency graph.

## Sources

`buildTokenSet()` runs one or more `TokenSource` objects in array order, composes their graph material before caller
fragments, validates the composed strict graph input, and compiles the selected token set. This is the core integration
point for adapter packages.

Adapter packages may depend on engines. Core exposes the interface but does not provide Material 3, Texel, conversion, or
image-backed behavior. The first source adapter is `@color-scheme-tokens/source-material3`; it lives outside the root
package and owns the Material engine dependency.

Source adapters produce graph input for `buildTokenSet()`. Conversion adapters perform separate conversion operations and
return `Result` values with adapter-owned issues. The adapter package topology and release obligations are defined in
[`ADR 0002`](./adr/0002-adapter-package-architecture.md).

## Determinism

Object-record diagnostics, compiled token keys, serialized JSON keys, modes after the default mode, and CSS declarations
use code-unit ordering. Public issue codes and JSON Pointer paths are contractual.
