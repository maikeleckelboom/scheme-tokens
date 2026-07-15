# Roadmap

The 0.1 release decision is centered on one complete pipeline:

```text
authored string tokens -> strict graph -> deterministic compilation -> CSS or serialized artifacts
```

## 0.1 focus

- Keep one authoring grammar and one `Result` convention.
- Keep multimode authority explicit at the graph boundary.
- Keep layers ordered, mode-neutral, and independently identifiable.
- Keep strict graph, layer, and compiled formats aligned with their schemas and parsers.
- Keep diagnostics, serialization, selection, and CSS output deterministic.
- Prove literal key and mode inference through strict packed consumers.
- Validate a consumer-shaped graph with generated internal strings, public semantic references, explicit repair tokens, light and dark modes, layers, and persisted parsing.

## Deliberate non-goals

- Structured or domain-specific token value systems.
- Palette generation or value interpretation.
- Product policy, role taxonomies, proof models, or repair decisions.
- Runtime plugin, source, provider, preset, or registry frameworks.

Future work should extend composition around the stable compiler rather than broaden the root package into a design-system framework.
