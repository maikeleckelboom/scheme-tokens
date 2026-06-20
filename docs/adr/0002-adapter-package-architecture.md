# ADR 0002: Adapter Package Architecture

## Status

Accepted. Implemented by the first source adapter package in Slice 4.

## Context

ADR 0001 keeps `color-scheme-tokens` as the dependency-light core package. Slice 2 made the JSON Schemas strict core
artifacts for persisted graph input, fragment input, and compiled token-set output.

Future optional capabilities need real engines without moving those engines into core. The first likely capabilities are
Material 3 source generation and Texel-backed conversion, but this decision must hold for future source and conversion
adapters too.

## Decision

Adapters are separate npm packages. The root package remains named `color-scheme-tokens` and remains the core package.
There is no `color-scheme-tokens/sources/*`, `color-scheme-tokens/conversion/*`, or ambient adapter registry.

The repository stays a single core package for now. If it later becomes a workspace, keep the core package at the
repository root and add adapter packages under `packages/`:

```text
package.json                            # color-scheme-tokens
packages/source-material3/package.json  # @color-scheme-tokens/source-material3
packages/conversion-texel/package.json  # @color-scheme-tokens/conversion-texel
packages/source-*/package.json          # future source adapters
packages/conversion-*/package.json      # future conversion adapters
```

Do not move core to `packages/core` unless a separate decision proves that churn is worth it.

## Package Names

Use role-first package names:

- `@color-scheme-tokens/source-material3`;
- `@color-scheme-tokens/conversion-texel`;
- `@color-scheme-tokens/source-*` for future source adapters;
- `@color-scheme-tokens/conversion-*` for future conversion adapters.

## Dependency Ownership

The root package must not depend on optional engines. Material 3 dependencies belong to
`@color-scheme-tokens/source-material3`. Texel dependencies belong to `@color-scheme-tokens/conversion-texel`.

Adapters depend on `color-scheme-tokens` as a peer dependency and dev dependency, not as a normal runtime dependency.
The peer dependency keeps one core contract in the consuming app; the dev dependency lets the adapter build and test
locally. Adapter code may import root types and runtime helpers from `color-scheme-tokens`, but core must never import an
adapter package.

Engine packages are owned by the adapter that uses them. They should be normal adapter dependencies when the adapter
needs a reproducible implementation at runtime.

## Source Adapter Shape

A source adapter creates a `TokenSource` for `buildTokenSet()`. The minimum package root surface is:

- a factory named after the capability, for example `material3Source(input)`;
- JSON-safe public input types, for example `Material3SourceInput`;
- adapter issue types, for example `Material3SourceIssue`;
- optional metadata constants only when they are useful to consumers.

The factory returns a structural `TokenSource<AdapterIssue>` with a stable lower-kebab `id`. Its `build()` method returns
`Result<TokenGraphInput, AdapterIssue>` and emits strict core graph input accepted by `parseTokenGraph()`.

Reference-vector fixtures are test assets by default. If an adapter intentionally publishes fixtures or metadata, it
must do so through explicit adapter-owned exports or subpaths, not through the core package and not through a global
registry.

## Conversion Adapter Shape

A conversion adapter performs a conversion operation. It is not a `TokenSource` by default. The minimum package root
surface is:

- a verb-based conversion function, for example `convertWithTexel(input)`;
- JSON-safe input and output types owned by the adapter;
- adapter issue types returned through `Result`.

Conversion output may be a package-specific JSON-safe value, strict `TokenGraphInput`, strict `TokenFragmentInput`, or a
core compiled token-set artifact, depending on the package role. If conversion output is a core artifact, consumers pass
that artifact back to core parse, compile, serialize, or export functions explicitly.

## Issue Codes

Adapter issue codes are adapter contracts. They must not pretend to be core issue codes and must not be cast into core
issue unions.

Use adapter-owned lower-kebab namespaces such as `material3-*`, `texel-*`, or another package-specific prefix. Recoverable
adapter failures return `Result` with non-empty `issues`; thrown errors are not the normal failure path. Adapter issue
payloads and paths must stay JSON-safe.

## Schemas and Artifacts

Core schema subpaths remain strict core artifacts only. They do not describe adapter helper input.

Adapter input schemas are optional package-owned artifacts. If shipped, they live under the adapter package and describe
adapter inputs only. Adapter outputs that claim to be core graph, fragment, or compiled artifacts must validate against
the matching core schema and parser behavior.

## Release Obligations

Before any adapter release, prove:

- importing `color-scheme-tokens` remains engine-free;
- importing the adapter may load its engine dependencies, but never through the root package;
- a packed consumer can install and use core plus the adapter;
- adapter issue types and runtime issues stay JSON-safe and package-owned;
- adapter outputs that claim to be core artifacts validate through core;
- reference-vector tests prove engine-backed behavior;
- Material 3 output comes from a real Material algorithm, not an approximation.

## Consequences

- The core package exports stay root plus schema subpaths only.
- Adapter packages can live in this repository without renaming the core package.
- Source adapters feed the core graph pipeline through `TokenSource`.
- Conversion adapters stay separate operations unless they deliberately expose a source adapter too.
