# Roadmap

The 0.1 public contract is the core compiler:

```text
authored token graph -> compileTokenGraph() -> compiled scheme -> exportCssVars()
```

## 0.1 Focus

- Keep root imports dependency-light.
- Keep public authoring data JSON-safe.
- Keep strict persisted graph, layer, and compiled-scheme formats explicit.
- Keep diagnostics deterministic and JSON-safe.
- Keep CSS variable export deterministic.
- Keep compiled token reads direct: `scheme.tokens.background.base`.

## Future Notes

External palette generators can feed `scheme-tokens` by producing authored token objects or strict token graphs. A late example may show that pattern with Material 3 or another generator, but the root package will not ship that generator, wrap it in a source abstraction, or make it a release blocker.

Possible future work:

- more examples for spacing, typography, shadows, and radii;
- additional CSS export formatting options;
- schema-focused tests for packed consumers;
- documentation examples for external generator pipelines.

Out of scope for the root package:

- Material 3 implementation;
- color parsing or conversion;
- image extraction;
- plugin, source, provider, or preset frameworks.
