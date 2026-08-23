# Roadmap

`scheme-tokens` is converging on a stable, deliberately small contract. The roadmap is therefore a
set of evidence gates, not a feature backlog.

## Current proven state

- `scheme-tokens@0.2.0` is the released core: an embedded, zero-runtime-dependency TypeScript
  compiler for application-owned, string-valued token graphs.
- `@scheme-tokens/material3@0.1.0` is the released optional sibling composition package. It keeps
  Material generation outside the core compiler boundary.
- `maikel.site`, the current production core consumer, was upgraded from `0.1.0` to `0.2.0`
  without an adapter or application-behaviour migration. Its package compatibility checks passed.
  The feature branch's complete repository gate remained red only on unrelated pre-existing
  manifest, icon, and visual-baseline drift, so that aggregate command is not recorded as green.
- The readable theme-coordinate example is the same source that the packed core consumer
  typechecks and executes. It proves four flattened application coordinates, exact public
  selection, internal references, CSS projection, and deterministic output against the tarball.
- The Material 3 release gates exercise packed consumers against the core peer contract.
- Compiler behavior, deterministic serialization and CSS output, schemas, declaration snapshots,
  tarball contents, and package resolution already have repository-owned validation.

## Positioning

Core composes and resolves the graph that exists before a token file or platform artifact. It is
not a competing DTCG Resolver or platform build ecosystem.

DTCG import can be reconsidered if real consumer demand appears. DTCG export, generic Resolver
semantics, a CLI, platform exporter proliferation, structured token values, runtime plugin
registries, and design-system product policy are not current roadmap work. Optional composition
belongs outside core when it can preserve that boundary.

## Schema identifiers and namespace ownership

The three packaged schemas use canonical `$id` URIs under `https://scheme-tokens.dev/schemas/`.
A JSON Schema identifier is a URI identity and does not require network retrieval for the packaged
schema contract to work. The schemas remain available through the published package exports.

The project does not currently control that domain, and the URI host is not available over HTTP.
Because released artifacts already contain these identifiers, controlling the existing namespace
and deciding whether to host the exact packaged bytes there is a pre-1.0 ownership and reliability
concern. It is not evidence that the runtime or packaged schemas are invalid, and it does not block
the current convergence work. This roadmap does not prescribe a replacement identifier.

## Planned 0.3 convergence release

`0.3.0` is the planned convergence release. Its purpose is to close evidenced contract and
ergonomic questions, remove any easy-to-remove public API traps, and leave the current compiler
boundary ready for stability review. It is not a commitment to add speculative capabilities.

If the 0.3 exit gates below are satisfied, the next planned core release is `1.0.0`. Any additional
pre-1.0 minor requires an explicit unresolved contract blocker. This policy does not guarantee that
0.3 must mathematically be the final 0.x release.

## 1.0 evidence gates

- Exercise the current core release in the production consumer and distinguish package
  compatibility from unrelated consumer-repository failures.
- Control the published schema identifier namespace and protect any hosted representations against
  drift from the packaged schema bytes.
- Keep one readable, executable reference example as the authority used by the packed
  theme-coordinate consumer.
- Explain early that default public compilation is conservatively partial while exact literal-key
  selection produces a complete record after runtime validation.
- Deliberately retain and document graph-first composition, ordered layer precedence, and
  whole-declaration replacement, unless concrete consumer evidence exposes a contract blocker.
- Keep `Result` binary unless concrete use cases require another success/failure model. Keep
  advisory analysis outside compiler failure diagnostics.
- Investigate mode-authoring duplication with measured production/reference data before considering
  any private ergonomics experiment; do not infer a public API from hypothetical pain.
- Demonstrate Material 3 peer compatibility and release policy for the candidate core version.
- Review the root export and wire surfaces for unresolved traps that are materially cheaper to
  remove before 1.0 than after it.

## Material 3 peer maintenance

`@scheme-tokens/material3@0.1.0` declares `scheme-tokens: ^0.2.0`; under pre-1.0 semver that range
does not include core `0.3.0`. Compatibility must be demonstrated release by release. Do not widen
the peer range across all pre-1.0 minors without evidence that the adapter remains compatible with
each included core contract.
