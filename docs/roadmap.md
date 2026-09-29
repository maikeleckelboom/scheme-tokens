# Roadmap

`scheme-tokens` is converging on a stable, deliberately small contract. The roadmap is therefore a
set of evidence gates, not a feature backlog.

## Current proven state

- `scheme-tokens@0.3.0` is the released core: an embedded, zero-runtime-dependency TypeScript
  compiler for application-owned, string-valued token graphs.
- `@scheme-tokens/material3@0.1.1` is the released optional sibling composition package. It keeps
  Material generation outside the core compiler boundary.
- `maikel.site`, the current production core consumer, was upgraded from `0.1.0` to `0.2.0`
  without an adapter or application-behaviour migration. Its package compatibility checks passed.
  The feature branch's complete repository gate remained red only on unrelated pre-existing
  manifest, icon, and visual-baseline drift, so that aggregate command is not recorded as green. It
  now runs core `0.3.0` with the Material 3 adapter at `0.1.1`.
- The readable theme-coordinate example is the same source that the packed core consumer
  typechecks and executes. It proves four flattened application coordinates, exact public
  selection, internal references, CSS projection, and deterministic output against the tarball.
- The Material 3 release gates exercise packed consumers against the core peer contract.
- Compiler behavior, deterministic serialization and CSS output, schemas, declaration snapshots,
  tarball contents, and package resolution already have repository-owned validation.

The current branch implements the P2 core v2 candidate: unified validation/composition/resolution, graph-last precedence, visibility inheritance, concat, D6 metadata, and lossless v1 source upgrades. [ADR 0015](./adr/0015-concat-mode-disambiguation.md) keeps `concat` available as a structurally disambiguated mode. The final static model, CSS redesign, Material API, consumer migration, and publication remain later phases. No 0.4 release is claimed here.

## Positioning

Core composes and resolves the graph that exists before a token file or platform artifact. It is
not a competing DTCG Resolver or platform build ecosystem.

DTCG import can be reconsidered if real consumer demand appears. DTCG export, generic Resolver
semantics, a CLI, platform exporter proliferation, structured token values, runtime plugin
registries, and design-system product policy are not current roadmap work. Optional composition
belongs outside core when it can preserve that boundary.

## Schema identifiers and namespace ownership

Released 0.3 packages archive the three v1 schemas with `$id` URIs under `https://scheme-tokens.dev/schemas/`.
A JSON Schema identifier is a URI identity and does not require network retrieval for the packaged
schema contract to work. Those historical schemas remain in their released packages. The current candidate exports only v2 schemas. The
project does not control that domain, and the URI host is not available over HTTP.

[ADR 0013](./adr/0013-coherent-token-model.md) (D10) settles the question for format version 2
without that domain. The v2 schemas use `tag:` URIs such as
`tag:maikel.site,2026-09-29:scheme-tokens/schema/token-graph/v2`, which name the project author's
domain as the tagging authority and need no registration or hosting. An artifact may carry
`$schema` as a versioned HTTPS hint for editors, pointing at the package's own schema files on a
package CDN, and only `kind` and `formatVersion` decide runtime compatibility. The released v1
identifiers are not rewritten.

## 0.3 convergence release

`0.3.0` shipped as the convergence release. It closed the CSS option-state trap by making exact
selector maps statically incompatible with a separate scope while retaining the runtime diagnostic
for untyped input, and it pinned the layer contract of that release: standalone layers are
mode-unbound, direct expressions apply across the owning graph envelope, and explicit maps are
validated only when composed.

## Planned 0.4 breaking release

The 2026-09 audit found contract blockers that are materially cheaper to fix before `1.0.0`.
[ADR 0013](./adr/0013-coherent-token-model.md) (accepted) designs them as one breaking release,
proposed as `0.4.0`: graph-last composition and visibility-preserving overrides (ADRs 0010 and
0011), a single graph helper, complete public records for literal graphs, layers whose mode maps
must match the graph's modes, an explicit string-joining expression, reshaped compiled provenance,
one CSS activation model with single-hyphen names (ADR 0012), format version 2 with source-format
upgrades, and a supported TypeScript 7.x baseline. The companion Material 3 adapter release is
designed in [ADR 0014](./adr/0014-material3-layer-and-mode-mapping.md) (accepted).

`1.0.0` follows once the production consumer and the Material applications run on that release and
the gates below hold.

## 1.0 evidence gates

- Exercise the current core release in the production consumer and distinguish package
  compatibility from unrelated consumer-repository failures.
- Publish the v2 schemas under their `tag:` identifiers, self-contained, and document the versioned
  `$schema` convention (ADR 0013, D10).
- Keep one readable, executable reference example as the authority used by the packed
  theme-coordinate consumer.
- Explain early which compiled records are complete: literal graphs get complete public records,
  while dynamically built graphs and parsed artifacts stay conservatively partial (ADR 0013, D4).
- Document graph-last composition, ordered layer precedence, and whole-declaration replacement with
  visibility-preserving overrides (ADRs 0010 and 0011).
- Keep `Result` binary unless concrete use cases require another success/failure model. Keep
  advisory analysis outside compiler failure diagnostics.
- Investigate mode-authoring duplication with measured production/reference data before considering
  any private ergonomics experiment; do not infer a public API from hypothetical pain.
- Demonstrate Material 3 peer compatibility and release policy for the candidate core version.
- Review the root export and wire surfaces for unresolved traps that are materially cheaper to
  remove before 1.0 than after it.

## Material 3 peer maintenance

The released `@scheme-tokens/material3@0.1.0` declares `scheme-tokens: ^0.2.0`; under pre-1.0 semver
that range does not include core `0.3.0`. The `0.1.1` patch expanded it to the explicit
`^0.2.0 || ^0.3.0` range after exercising the changeset-versioned packages together in strict
packed consumers. Compatibility must continue to be demonstrated release by release. Do not widen
the peer range across additional pre-1.0 minors without evidence for each included core contract.
The planned 0.4 core changes the layer contract the adapter builds on, so the adapter needs its own
breaking release with a peer range for that core release (ADR 0014).
