# Semver

The public release line started at `0.1.0`. Before `1.0.0`, a minor release may change a public contract when that change materially simplifies the package or corrects an early mistake. Patch releases should remain compatible and focus on fixes, documentation, and release tooling.

Releases are versioned with changesets: a change to any contract below needs a changeset in the same branch, and `pnpm changeset:version` applies the pending files to `package.json` and `CHANGELOG.md`.

CI automatically requires that changeset when the committed TypeScript declaration snapshot moves. It cannot infer every behavioural contract change from source, so declaration-stable changes such as deterministic ordering remain a policy and review responsibility.

These are versioned contracts:

- root runtime exports;
- root TypeScript exports and literal inference behavior;
- package schema subpaths;
- graph, layer, and compiled JSON formats;
- `Result` success and failure shapes;
- `Issue.code` values and JSON Pointer path semantics;
- trusted-helper and untrusted-parser boundaries;
- graph mode and layer composition semantics;
- compilation selection, completeness typing, and output ordering;
- canonical serialization;
- CSS exporter option, block, formatting, declaration-safety, bounded-selector, and collision semantics.

Human-readable issue messages, internal file layout, and implementation strategy are not compatibility contracts unless explicitly documented otherwise.

The migration guide records the reset that preceded the first publication. It is a historical handoff and does not create compatibility aliases or continued support for removed shapes.
