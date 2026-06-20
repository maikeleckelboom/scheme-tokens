# Semver

The first public release line starts at `0.1.0`. The packages are usable, but they are still pre-`1.0.0`: minor releases
may include breaking public-contract changes when they simplify the package or correct an early API mistake. Patch
releases should stay compatible and focus on fixes, documentation, and release tooling.

These are versioned contracts:

- root runtime exports;
- package subpath exports;
- graph, layer, and compiled JSON formats;
- public TypeScript types;
- `Issue.code` values;
- JSON Pointer path semantics;
- parser acceptance and rejection boundaries;
- compiler selection behavior;
- deterministic serialization shape;
- CSS exporter option semantics.

Message text, internal file layout, and implementation strategy are not public compatibility contracts unless explicitly
documented as such.

Adapter packages version their own root exports, input types, issue codes, optional schemas, and engine dependency
behavior. Core semver does not cover optional engine behavior that lives outside `scheme-tokens`.
