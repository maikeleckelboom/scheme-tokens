# ADR 0005: Material 3 Adapter Package Boundary

## Status

Accepted. This record supersedes the package, dependency, and release-boundary portions of
[ADR 0004](./0004-material3-adapter-design.md). ADR 0004 remains a historical record of the earlier
combined design.

## Context

`scheme-tokens` is the dependency-light compiler for authored string-valued token graphs. It owns
graph modes, ordered layers, explicit references, visibility, validation, deterministic
compilation, provenance, strict artifacts, canonical serialization, and CSS custom-property
projection. It deliberately does not own palette generation, color parsing or conversion, contrast
policy, or design-system role conventions.

Material 3 generation needs a real color engine. Putting that engine in the root package would make
every manual-token consumer install Material-specific code, weaken the zero-runtime-dependency core
boundary, and make Material terminology part of the core contract. The adapter must integrate
through the existing graph and layer model without introducing a provider registry, plugin
framework, parallel compiler, or Material-specific export pipeline.

## Decision

### Separate optional package

Material 3 generation will live in an optional workspace package:

```text
package.json                       # scheme-tokens core remains at repository root
packages/material3/package.json    # @scheme-tokens/material3
```

Core never imports or re-exports the adapter. The dependency direction is:

```text
consumer
  ├─ scheme-tokens
  └─ @scheme-tokens/material3
       ├─ peer: scheme-tokens
       └─ bundled engine: @material/material-color-utilities@0.4.0
```

There is no `scheme-tokens/material3` subpath, global adapter registry, ambient discovery
mechanism, or root-package convenience export.

The private `tests/rnd/material3` workspace is phase-1 evidence only. It is not the adapter package,
has no public exports, and is never packed with core.

### Package responsibility

`@scheme-tokens/material3` has one responsibility:

> Generate a deterministic `scheme-tokens` layer containing the accepted Material system color
> roles for an explicit graph-mode envelope.

The generated result is ordinary core data. Consumers compose it through `defineTokenGraph()`,
resolve references through `compileTokenGraph()`, serialize it through `serializeTokenLayer()`, and
project CSS through `exportCssVars()`. The adapter is not involved after generation.

### Narrow public surface

The package has one runtime export:

```ts
material3;
```

The intended named type exports are exactly:

```ts
Material3Appearance;
Material3GraphFragment;
Material3SpecVersion;
Material3TokenKey;
Material3Variant;
```

Option and mode-map helper types remain declaration internals. The package does not export engine
classes, engine enums, palettes, role readers, capability tables, conversion helpers, presets,
fixtures, or separately named option types. Public declarations use adapter-owned structural types
and must not leak Material Color Utilities declarations.

### Dependency ownership and bundling

The adapter pins `@material/material-color-utilities` exactly at `0.4.0` as a build dependency. The
engine is bundled into adapter output and is not also installed as a normal runtime dependency.

`scheme-tokens` is a peer dependency and workspace development dependency. It remains external to
the adapter bundle so the application and adapter share one core contract. The published adapter
therefore has no normal runtime dependencies after bundling.

The exact upstream package contains extensionless internal ESM imports that fail under raw Node
ESM. The phase-1 R&D runner reproduces that failure and bundles the exact installed package solely
to execute its conformance probe. The future adapter bundle is the corresponding consumer-safe
distribution boundary.

### Runtime and package shape

The adapter follows the core package line:

- ESM only;
- Node `>=22`;
- browser-safe runtime code without filesystem access;
- `sideEffects: false`;
- root and `./package.json` exports only;
- no upstream declaration leakage.

Bundling Apache-2.0 engine code creates explicit licensing obligations. The packed adapter includes
its MIT license, the Apache-2.0 license, and a notice identifying Material Color Utilities 0.4.0 and
its source. Its package license expression is `MIT AND Apache-2.0`.

### Release obligations

The adapter is not release-ready until packed artifacts prove all of the following:

1. Installing and importing `scheme-tokens` alone remains Material-free.
2. Installing core and adapter tarballs together works in an isolated Node ESM consumer.
3. A strict NodeNext consumer preserves exact Material token-key and mode inference.
4. The adapter bundle has no unresolved Material Color Utilities import.
5. Generated output matches the committed pinned-engine vectors.
6. Adapter output composes, compiles, serializes, and exports through unchanged core APIs.
7. The documented Material Web variable-name recipe emits exact `--md-sys-color-*` properties.
8. Both licenses and the upstream notice are present in the packed adapter.

Root `release:check` will include adapter validation and packed-consumer proof after the adapter
package exists. The adapter will also retain package-level validation and tarball gates.

## First-release non-goals

The package does not provide:

- CSS serialization or selector policy;
- application semantic profiles;
- custom or extended Material colors;
- palette overrides, palette tones, or palette-key-color tokens;
- image extraction or multiple source colors;
- Material 2026 or CMF behavior;
- Wear/watch generation;
- a general color toolbox;
- presets or manifests;
- custom layer IDs or token prefixes;
- deprecated Material Color Utilities APIs or compatibility aliases.

These are not speculative options on `material3()`. They require separate evidence and decisions.

## Consequences

- Core retains zero runtime dependencies and its value-opaque boundary.
- Material consumers opt into a real engine without imposing it on manual-token consumers.
- Engine policy can evolve independently from core graph semantics.
- Generated output remains inspectable, serializable, overrideable, and attributable through core.
- Bundling increases adapter distribution size but prevents raw upstream ESM defects from reaching
  consumers and avoids installing duplicate engine bytes.
- This package boundary does not create a generic plugin architecture.

## Rejected alternatives

### Put Material generation in core

Rejected because it violates the core boundary and adds an engine dependency graph to every
consumer.

### Publish a wrapper independent of `scheme-tokens`

Rejected because it would recreate modes, overrides, provenance, serialization, and CSS concepts
that core already owns.

### Keep the engine as a runtime dependency while also bundling it

Rejected because consumers would install bytes already present in the adapter bundle.

### Vendor an unreleased upstream snapshot

Rejected for v1. The contract is based on the exact published 0.4.0 package. Unreleased 2026, CMF,
and multi-source behavior must not silently become adapter API.

## References

- [ADR 0001: Core Boundary](./0001-core-boundary.md)
- [ADR 0004: Material 3 Adapter Design](./0004-material3-adapter-design.md)
- [ADR 0006: Material 3 Authoring and Mode Contract](./0006-material3-authoring-and-mode-contract.md)
- [ADR 0007: Material 3 Engine and Role Contract](./0007-material3-engine-and-role-contract.md)
