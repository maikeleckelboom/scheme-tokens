# Semver

The package is still private at `0.0.0`; breaking changes are allowed while finalizing the first public contract.

After publication, these are versioned contracts:

- root runtime exports;
- package subpath exports;
- graph, fragment, and compiled JSON formats;
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
behavior. Core semver does not cover optional engine behavior that lives outside `color-scheme-tokens`.
