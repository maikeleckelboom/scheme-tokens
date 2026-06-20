# Adapter Policy

Adapters are separate packages. The full package architecture is defined in
[`docs/adr/0002-adapter-package-architecture.md`](./adr/0002-adapter-package-architecture.md).

The repository ships `color-scheme-tokens`, the dependency-light core, and optional adapter packages under `packages/`.
The core package exports root runtime helpers and strict core schema subpaths only. Adapter packages are added only when
a real engine-backed capability is ready.

## Source Adapters

Source adapters create `TokenSource` objects for `buildTokenSet()`.

```ts
interface TokenSource<I extends Issue = Issue> {
  readonly id: string;
  build(): Result<TokenGraphInput, I>;
}
```

`TokenSource` is structural. A source object may include metadata beyond `id` and `build`; core validates those two
members and invokes `build()` with the original source object as the receiver.

Source adapter factories should use plain names such as `material3Source(input)`. They return strict core graph input and
report recoverable failures with adapter-owned issue types.

## Conversion Adapters

Conversion adapters are separate operations, not `TokenSource` objects by default. They should export verb-based
functions such as `convertWithTexel(input)` and return `Result` with adapter-owned issues.

Conversion output may be package-specific JSON-safe data or an explicit core artifact. If it claims to be a core graph,
fragment, or compiled token set, it must satisfy the matching core parser and schema contract.

## Dependency Rules

- Adapter packages may depend on engines.
- The root package must not depend on Material 3, Texel, image, canvas, CSS parser, or conversion engines.
- Adapters should depend on `color-scheme-tokens` as a peer dependency and dev dependency, not as a normal runtime
  dependency.
- Core must not import adapter packages.

Material 3 dependencies belong to `@color-scheme-tokens/source-material3`. Texel dependencies belong to future
`@color-scheme-tokens/conversion-texel`.

## Issue and Schema Rules

- Adapter public inputs should be JSON-safe plain data.
- Recoverable adapter failures use `Result` with non-empty `issues`.
- Adapter issue codes use adapter-owned namespaces such as `material3-*` or `texel-*`.
- Adapter issue codes and paths are adapter contracts and must not pretend to be core issue codes.
- Adapter input schemas are optional package-owned artifacts.
- Core schemas remain strict core artifacts only.

## Release Proofs

Every adapter must prove before release:

- root imports remain engine-free;
- adapter imports may load only the adapter-owned engines;
- a packed consumer can install and use core plus the adapter;
- reference-vector tests prove the real engine-backed behavior;
- Material 3 output, when shipped, comes from a real Material algorithm and is not approximated.

## Current Adapters

- `@color-scheme-tokens/source-material3` creates a `TokenSource` from a strict hex Material `sourceColor` and emits
  `light` / `dark` graph tokens under a lower-kebab source id namespace. Some Material tooling calls that input a seed
  color; the adapter public field remains `sourceColor`.
- Material custom colors are adapter-owned behavior exposed as `extendedColors`, with entries shaped as
  `{ name, color, harmonize? }`. Engine-specific option names stay internal.
- Key-color-driven Material schemes are future advanced scope only and require a clear, official, tested engine path
  before becoming public API.
