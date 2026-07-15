# Semver

The first public release line starts at `0.1.0`. Before `1.0.0`, a minor release may change a public contract when that change materially simplifies the package or corrects an early mistake. Patch releases should remain compatible and focus on fixes, documentation, and release tooling.

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

The pre-release migration guide records the reset that precedes the first publication. It does not create compatibility aliases or continued support for removed shapes.
