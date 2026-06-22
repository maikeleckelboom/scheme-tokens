# Architecture

`scheme-tokens` is a dependency-light color-token graph core. The graph is the system of record; helpers and adapters
feed graph material, compilation resolves selected tokens, and exporters produce deterministic artifacts.

## Core Ownership

The root package owns:

- token graph contracts;
- JSON-safe public authoring inputs;
- graph parsing and validation;
- token compilation;
- deterministic serialization;
- CSS custom-property export;
- `Result` and `Issue` contracts;
- adapter interfaces.

The root package does not own Material 3, Texel, image extraction, browser canvas behavior, CSS color engines,
conversion engines, external format import/export behavior, target framework scaffolding, or runtime style injection.

## Data Flow

```text
helper input or strict graph input
  -> parse and validate
  -> compile selected tokens
  -> serialize compiled JSON or export CSS
```

With adapters:

```text
source adapters
+ authored token layers
-> buildScheme()
-> compiled scheme
-> CSS variables and JSON artifacts
```

Adapters are explicit package boundaries. Material source generation and future conversion or format work are sibling
capabilities around the compiled scheme, not transitive dependencies in root.

## Values

Token values are authored strings. Root preserves them in helper output, strict artifacts, compiled schemes,
serialization, and CSS export. Root validates the token graph around those values; it does not interpret CSS color
grammar or rewrite values.

References are explicit objects. Compilation resolves references by mode and stores string values in compiled tokens.

## Authoring and Wire Formats

`defineTokens()`, `defineTokenGraph()`, and `defineTokenLayer()` are authoring helpers. They may fill safe defaults and
normalize JSON-safe shorthand.

`parseTokenGraph()`, `parseTokenLayer()`, and `parseCompiledScheme()` are strict artifact boundaries. Strict persisted
artifacts carry `kind`, `formatVersion`, modes, token records, and string values. The published JSON Schemas cover those
strict shapes only; they are not schemas for helper shorthand.

Runtime parsers remain the authority for default-mode membership, per-mode value coverage, references, cycles, and
cross-field constraints.

## Compilation

Compilation validates first, then resolves selected tokens. The default selection is `public`; exact key selection and
`all` selection are explicit options. Public app tokens may depend on internal implementation tokens.

Compiled tokens store direct dependencies by mode. Full transitive analysis is intentionally not stored in every
compiled token; it can be added later as an on-demand analyzer without bloating the default compiled artifact.

## Exporters

Exporters consume compiled schemes only. They do not validate graphs, resolve references, load engines, mutate compiled
schemes, or patch browser DOM state.

The CSS exporter is dependency-free and uses a conservative selector validator. It returns a stylesheet string and
structured `{ mode, selector, declarations }` blocks from the same operation. Declaration values are the compiled string
values.

## Base Inputs and Layers

`buildScheme()` resolves generated base input and layer graph contributors before compilation. Base inputs are generated
or external graph-material providers. Layers are ordered named authored token overlays.

When several base inputs are provided, they compose first in array order. Duplicate token keys across base inputs are
invalid. Layers compose after base inputs in array order. Later layers override earlier layers by token key, and layers
may override base tokens. References, missing-reference validation, and circular-reference validation run after the final
graph has been composed.

Layer composition is intentionally simpler than CSS cascade behavior. It has no selector specificity, no `!important`,
no implicit CSS `@layer` behavior, no DOM behavior, and no runtime style injection helpers.

## Determinism

Object-record diagnostics, compiled token keys, serialized JSON keys, modes after the default mode, and CSS declarations
use code-unit ordering. Public issue codes and JSON Pointer paths are contractual.
