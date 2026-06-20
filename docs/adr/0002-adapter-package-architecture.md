# ADR 0002: Adapter Package Architecture

## Status

Accepted. Implemented for source adapters by the first source adapter package in Slice 4. Conversion, target, and format
adapter packages remain planned unless a package exists with a real implementation and release proof.

## Context

ADR 0001 keeps `scheme-tokens` as the dependency-light core package. Slice 2 made the JSON Schemas strict core
artifacts for persisted graph input, layer input, and compiled scheme output.

Future optional capabilities need real engines without moving those engines into core. The first likely capabilities are
Material 3 source generation and Texel-backed conversion, but this decision must also hold for target framework output
and external format adapters.

## Decision

Adapters are separate npm packages. The root package remains named `scheme-tokens` and remains the core package.
There is no `scheme-tokens/material3`, `scheme-tokens/conversion/*`, or ambient adapter registry.

The repository keeps the core package at the repository root. Adapter packages live under `packages/` only when they have
a real implementation:

```text
package.json                            # scheme-tokens
packages/material3/package.json         # @scheme-tokens/material3
packages/texel/package.json             # @scheme-tokens/texel
packages/shadcn/package.json            # @scheme-tokens/shadcn
packages/dtcg/package.json              # @scheme-tokens/dtcg
packages/*/package.json                 # future source adapters
packages/*/package.json                 # future conversion, target, and format adapters
```

Do not move core to `packages/core` unless a separate decision proves that churn is worth it.

## Package Names

Use role-first package names:

- `@scheme-tokens/material3`;
- `@scheme-tokens/texel`;
- `@scheme-tokens/shadcn`;
- `@scheme-tokens/dtcg`;
- `@scheme-tokens/*` for future source adapters;
- `@scheme-tokens/*` for future conversion, target, and format adapters.

## Pipeline Shape

Adapter lanes can participate in one workflow, but they must not all become the same kind of adapter and they must not
depend on each other's output as a hidden chain. The intended shape is:

```text
source adapters
+ authored token layers
+ target mapping layers
-> buildScheme()
-> optional conversion projection
-> sibling exports
```

Sibling exports include core CSS variables, target-specific CSS from a target adapter, external documents from a format
adapter, and core serialized compiled schemes. Do not design a chain such as `Material -> Texel -> shadcn -> DTCG`;
that creates hidden transitive adapter dependencies and makes downstream adapters depend on each other's artifacts.

## Dependency Ownership

The root package must not depend on optional engines. Material 3 dependencies belong to
`@scheme-tokens/material3`. Texel dependencies belong to `@scheme-tokens/texel`. Target framework
policy belongs to target adapters. External format behavior belongs to format adapters.

Adapters depend on `scheme-tokens` as a peer dependency and dev dependency, not as a normal runtime dependency.
The peer dependency keeps one core contract in the consuming app; the dev dependency lets the adapter build and test
locally. Adapter code may import root types and runtime helpers from `scheme-tokens`, but core must never import an
adapter package.

Engine packages are owned by the adapter that uses them. They should be normal adapter dependencies when the adapter
needs a reproducible implementation at runtime.

## Source Adapter Shape

A source adapter creates a `ColorTokenSource` for `buildScheme({ base })`. Applications can compose authored token
layers after source output with `buildScheme({ base, layers })`. The minimum package root surface is:

- a factory named after the capability, for example `material3(input)`;
- JSON-safe public input types, for example `Material3Input`;
- adapter issue types, for example `Material3Issue`;
- optional metadata constants only when they are useful to consumers.

The factory returns a structural `ColorTokenSource<AdapterIssue>` with a stable lower-kebab `id`. Its `build()` method returns
`Result<ColorTokenGraphInput, AdapterIssue>` and emits strict core graph input accepted by `parseTokenGraph()`.

Reference-vector fixtures are test assets by default. If an adapter intentionally publishes fixtures or metadata, it
must do so through explicit adapter-owned exports or subpaths, not through the core package and not through a global
registry.

## Conversion Adapter Shape

A conversion adapter performs a conversion operation. It is not a `ColorTokenSource` by default. The minimum package root
surface is:

- verb-based conversion functions exported from the adapter package, for example `convertColor(input)`;
- JSON-safe input and output types owned by the adapter;
- adapter issue types returned through `Result`.

Conversion output may be a package-specific JSON-safe value, strict `ColorTokenGraphInput`, strict `ColorTokenLayerInput`, or a
core compiled scheme artifact, depending on the package role. If conversion output is a core artifact, consumers pass
that artifact back to core parse, compile, serialize, or export functions explicitly.

Texel remains planned conversion scope. Future operations likely include `convertColor(input)`, `mapGamut(input)`, and
`projectScheme(input)`. `projectScheme()` projects a `CompiledColorScheme` after build; it does not replace source or target
layers. Gamut mapping must never be silent, and default out-of-gamut RGB behavior should fail rather than clipping or
mapping. Use the upstream `@texel/color` package inside the adapter package only. Do not use `@texel/colors`.

## Target Adapter Shape

A target adapter maps compiled or core token material into a framework or design-system target contract. Target packages
export declared contracts, not namespaces.

The planned shadcn target adapter package is `@scheme-tokens/shadcn`. It may later expose:

- `shadcnLayer()` for direct source-agnostic target contract mapping;
- `material3ShadcnLayer()` for mapping known `material3.*` roles into `shadcn.*` target tokens;
- `validateShadcnScheme()` for explicit target readiness validation;
- `exportShadcnCss()` for target CSS export with internal validation.

`material3ShadcnLayer()` must not claim that Material 3 roles naturally equal shadcn tokens. Normal target-readiness
failures return `Result` issues, not thrown exceptions. Validation should cover required token presence by exported mode,
color value presence, missing target tokens, invalid mappings, CSS variable collisions, and mode-specific absence where
relevant.

Custom target contract extensions must be explicit. Extension token keys remain core-valid token keys but should not be
forced under the target namespace; application tokens may live under `app.*`, `brand.*`, `component.*`, or another
explicit namespace. Exporters must not export every matching namespace token by default, and CSS variable collisions must
be reported instead of overwritten.

## Issue Codes

Adapter issue codes are adapter contracts. They must not pretend to be core issue codes and must not be cast into core
issue unions.

Use adapter-owned lower-kebab namespaces such as `material3-*`, `texel-*`, or another package-specific prefix. Recoverable
adapter failures return `Result` with non-empty `issues`; thrown errors are not the normal failure path. Adapter issue
payloads and paths must stay JSON-safe.

## Schemas and Artifacts

Core schema subpaths remain strict core artifacts only. They do not describe adapter helper input.

Adapter input schemas are optional package-owned artifacts. If shipped, they live under the adapter package and describe
adapter inputs only. Adapter outputs that claim to be core graph, layer, or compiled artifacts must validate against
the matching core schema and parser behavior.

## Release Obligations

Before any adapter release, prove:

- importing `scheme-tokens` remains engine-free;
- importing the adapter may load its engine dependencies, but never through the root package;
- a packed consumer can install and use core plus the adapter;
- adapter issue types and runtime issues stay JSON-safe and package-owned;
- adapter outputs that claim to be core artifacts validate through core;
- reference-vector tests prove engine-backed behavior;
- Material 3 output comes from a real Material algorithm, not an approximation.

## Consequences

- The core package exports stay root plus schema subpaths only.
- Adapter packages can live in this repository without renaming the core package.
- Source adapters feed the core graph pipeline through `ColorTokenSource`.
- Conversion adapters stay separate operations unless they deliberately expose a source adapter too.
