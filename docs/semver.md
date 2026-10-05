# Semver

Before `1.0.0`, minor releases may change public contracts. Patch releases keep compatibility
and cover fixes, documentation, and tooling.

Published behavior changes need a changeset. `pnpm changeset:version` applies pending changesets
to package versions and generated changelogs. CI detects declaration-snapshot changes; other
behavior changes are reviewed against the same policy.

## Versioned contracts

- Runtime and TypeScript exports, inference, and supported Node and TypeScript ranges.
- Graph, layer, and compiled artifact formats, schema subpaths, and source-format upgrades.
- `Result` shapes, issue codes, JSON Pointer paths, and structured issue payloads.
- Authoring and parser boundaries, modes, composition, visibility, and reference resolution.
- Compilation selection, record completeness, ordering, and serialization.
- CSS options, activation order, selector specificity, complete blocks, naming, formatting,
  reference projection, safety checks, and supported grammars.
- Material generation settings, role keys, output, and core peer compatibility.

Human-readable issue messages, TypeScript diagnostic wording, and internal implementation
details are not compatibility contracts.

## Compiler support

The consumer TypeScript range is
`>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0`.
It is independent of the repository's development compiler. Raising a supported floor or removing
a supported line is a breaking change; support expansions also need a changeset and compatibility
evidence. See [Development](./development.md#typescript-compatibility) for the checks and
[ADR 0017](./adr/0017-consumer-compiler-support.md) for the decision.

## Persisted data

Source graphs and layers remain readable through lossless format upgrades. Compiled artifacts
are rebuilt from source rather than upgraded. See the
[artifact reference](../docs-site/reference/api.md#reading-v1-source).

Historical migration records describe earlier transitions. Current upgrade instructions live in
[Upgrade to 0.4](../docs-site/guide/migration.md).
